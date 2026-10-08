use crate::utils::{get_file_name, glob, unix_now};

use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::SystemTime;
use tokio::sync::RwLock;
use walkdir::{DirEntry, WalkDir};

const SCAN_CACHE_MILLIS: u64 = 5 * 60 * 1000;
const MIN_RESCAN_INTERVAL_MILLIS: u64 = 10 * 1000;
const RECENT_FILES_LIMIT: usize = 12;

#[derive(Debug, Clone, Serialize)]
pub struct StorageSnapshot {
    pub disk: Option<DiskSpace>,
    pub shared: SharedStats,
    pub status: ScanStatus,
    pub disk_error: Option<String>,
    pub scan_error: Option<String>,
}

impl Default for StorageSnapshot {
    fn default() -> Self {
        Self {
            disk: None,
            shared: SharedStats::default(),
            status: ScanStatus::Idle,
            disk_error: None,
            scan_error: None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct DiskSpace {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub available_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct SharedStats {
    pub total_bytes: u64,
    pub file_count: u64,
    pub directory_count: u64,
    pub scanned_at: Option<u64>,
    pub categories: Vec<CategoryStats>,
    pub recent_files: Vec<RecentFile>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CategoryStats {
    pub key: FileCategory,
    pub bytes: u64,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct RecentFile {
    pub name: String,
    pub path: String,
    pub parent: String,
    pub size: u64,
    pub mtime: u64,
    pub category: FileCategory,
}

#[derive(Debug, Clone, Copy, Serialize, Eq, Hash, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum FileCategory {
    Image,
    Video,
    Audio,
    Document,
    Archive,
    Other,
}

impl FileCategory {
    const ALL: [Self; 6] = [
        Self::Image,
        Self::Video,
        Self::Audio,
        Self::Document,
        Self::Archive,
        Self::Other,
    ];
}

#[derive(Debug, Clone, Copy, Serialize, Eq, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ScanStatus {
    Idle,
    Scanning,
    Ready,
    Error,
}

#[derive(Clone)]
pub struct StorageService {
    inner: Arc<StorageInner>,
}

struct StorageInner {
    root: PathBuf,
    hidden: Vec<String>,
    running: Arc<AtomicBool>,
    snapshot: RwLock<StorageSnapshot>,
    scanning: AtomicBool,
    dirty: AtomicBool,
    last_started: AtomicU64,
}

impl StorageService {
    pub fn new(root: PathBuf, hidden: Vec<String>, running: Arc<AtomicBool>) -> Self {
        Self {
            inner: Arc::new(StorageInner {
                root,
                hidden,
                running,
                snapshot: RwLock::new(StorageSnapshot::default()),
                scanning: AtomicBool::new(false),
                dirty: AtomicBool::new(true),
                last_started: AtomicU64::new(0),
            }),
        }
    }

    pub fn mark_dirty(&self) {
        self.inner.dirty.store(true, Ordering::Release);
    }

    pub async fn get(&self, force_refresh: bool) -> StorageSnapshot {
        let root = self.inner.root.clone();
        let disk = tokio::task::spawn_blocking(move || read_disk_space(&root)).await;
        let mut snapshot = self.inner.snapshot.read().await.clone();
        match disk {
            Ok(Ok(value)) => {
                snapshot.disk = Some(value);
                snapshot.disk_error = None;
            }
            Ok(Err(err)) => {
                snapshot.disk = None;
                snapshot.disk_error = Some(err);
            }
            Err(err) => {
                snapshot.disk = None;
                snapshot.disk_error = Some(format!("磁盘容量查询任务失败：{err}"));
            }
        }

        let now = now_millis();
        let stale = snapshot
            .shared
            .scanned_at
            .map(|value| now.saturating_sub(value) >= SCAN_CACHE_MILLIS)
            .unwrap_or(true);
        if force_refresh || stale || self.inner.dirty.load(Ordering::Acquire) {
            self.trigger_scan(force_refresh).await;
            snapshot.status = self.inner.snapshot.read().await.status;
        }
        snapshot
    }

    async fn trigger_scan(&self, force_refresh: bool) {
        let now = now_millis();
        let last_started = self.inner.last_started.load(Ordering::Acquire);
        if force_refresh && now.saturating_sub(last_started) < MIN_RESCAN_INTERVAL_MILLIS {
            return;
        }
        if self
            .inner
            .scanning
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_err()
        {
            return;
        }

        self.inner.last_started.store(now, Ordering::Release);
        self.inner.dirty.store(false, Ordering::Release);
        {
            let mut snapshot = self.inner.snapshot.write().await;
            snapshot.status = ScanStatus::Scanning;
            snapshot.scan_error = None;
        }

        let inner = self.inner.clone();
        tokio::spawn(async move {
            let root = inner.root.clone();
            let hidden = inner.hidden.clone();
            let running = inner.running.clone();
            let result =
                tokio::task::spawn_blocking(move || scan_shared(root, hidden, running)).await;
            let mut snapshot = inner.snapshot.write().await;
            match result {
                Ok(Ok(shared)) => {
                    snapshot.shared = shared;
                    snapshot.status = ScanStatus::Ready;
                    snapshot.scan_error = None;
                }
                Ok(Err(err)) => {
                    snapshot.status = ScanStatus::Error;
                    snapshot.scan_error = Some(err);
                }
                Err(err) => {
                    snapshot.status = ScanStatus::Error;
                    snapshot.scan_error = Some(format!("目录统计任务失败：{err}"));
                }
            }
            inner.scanning.store(false, Ordering::Release);
        });
    }
}

fn read_disk_space(root: &Path) -> Result<DiskSpace, String> {
    let total_bytes = fs2::total_space(root).map_err(|err| format!("无法读取磁盘总容量：{err}"))?;
    let free_bytes = fs2::free_space(root).map_err(|err| format!("无法读取磁盘空闲容量：{err}"))?;
    let available_bytes =
        fs2::available_space(root).map_err(|err| format!("无法读取进程可用容量：{err}"))?;
    Ok(DiskSpace {
        total_bytes,
        used_bytes: total_bytes.saturating_sub(free_bytes),
        free_bytes,
        available_bytes,
    })
}

fn scan_shared(
    root: PathBuf,
    hidden: Vec<String>,
    running: Arc<AtomicBool>,
) -> Result<SharedStats, String> {
    let mut total_bytes = 0u64;
    let mut file_count = 0u64;
    let mut directory_count = 0u64;
    let mut category_totals: HashMap<FileCategory, (u64, u64)> = FileCategory::ALL
        .iter()
        .map(|category| (*category, (0, 0)))
        .collect();
    let mut recent_files = Vec::with_capacity(RECENT_FILES_LIMIT + 1);

    let walker = WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| should_visit(entry, &root, &hidden));

    for entry in walker {
        if !running.load(Ordering::Acquire) {
            return Err("服务正在停止，目录统计已取消".to_string());
        }
        let entry = match entry {
            Ok(value) => value,
            Err(err) => {
                warn!("Skip path while collecting storage statistics: {err}");
                continue;
            }
        };
        if entry.path() == root || entry.file_type().is_symlink() {
            continue;
        }
        if entry.file_type().is_dir() {
            directory_count = directory_count.saturating_add(1);
            continue;
        }
        if !entry.file_type().is_file() {
            continue;
        }

        let metadata = match entry.metadata() {
            Ok(value) => value,
            Err(err) => {
                warn!("Skip metadata while collecting storage statistics: {err}");
                continue;
            }
        };
        let size = metadata.len();
        let mtime = metadata
            .modified()
            .ok()
            .and_then(|value| value.duration_since(SystemTime::UNIX_EPOCH).ok())
            .map(|value| value.as_millis() as u64)
            .unwrap_or_default();
        let category = categorize(entry.path());
        let category_total = category_totals.entry(category).or_default();
        category_total.0 = category_total.0.saturating_add(size);
        category_total.1 = category_total.1.saturating_add(1);
        total_bytes = total_bytes.saturating_add(size);
        file_count = file_count.saturating_add(1);

        let path = entry
            .path()
            .strip_prefix(&root)
            .unwrap_or(entry.path())
            .to_string_lossy()
            .replace('\\', "/");
        let parent = Path::new(&path)
            .parent()
            .map(|value| value.to_string_lossy().replace('\\', "/"))
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "/".to_string());
        recent_files.push(RecentFile {
            name: get_file_name(entry.path()).to_string(),
            path,
            parent,
            size,
            mtime,
            category,
        });
        if recent_files.len() > RECENT_FILES_LIMIT {
            recent_files.sort_unstable_by_key(|item| std::cmp::Reverse(item.mtime));
            recent_files.truncate(RECENT_FILES_LIMIT);
        }
    }

    recent_files.sort_unstable_by_key(|item| std::cmp::Reverse(item.mtime));
    let categories = FileCategory::ALL
        .iter()
        .map(|category| {
            let (bytes, count) = category_totals.get(category).copied().unwrap_or_default();
            CategoryStats {
                key: *category,
                bytes,
                count,
            }
        })
        .collect();

    Ok(SharedStats {
        total_bytes,
        file_count,
        directory_count,
        scanned_at: Some(now_millis()),
        categories,
        recent_files,
    })
}

fn should_visit(entry: &DirEntry, root: &Path, hidden: &[String]) -> bool {
    if entry.path() == root {
        return true;
    }
    if entry.file_type().is_symlink() {
        return false;
    }
    let name = get_file_name(entry.path());
    !hidden.iter().any(|pattern| {
        if entry.file_type().is_dir() {
            if let Some(pattern) = pattern.strip_suffix('/') {
                return glob(pattern, name);
            }
        }
        glob(pattern, name)
    })
}

fn categorize(path: &Path) -> FileCategory {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    match extension.as_str() {
        "apng" | "avif" | "bmp" | "gif" | "heic" | "heif" | "jpeg" | "jpg" | "png" | "tif"
        | "tiff" | "webp" => FileCategory::Image,
        "avi" | "flv" | "m4v" | "mkv" | "mov" | "mp4" | "mpeg" | "mpg" | "webm" | "wmv" => {
            FileCategory::Video
        }
        "aac" | "flac" | "m4a" | "mp3" | "ogg" | "opus" | "wav" | "wma" => FileCategory::Audio,
        "csv" | "doc" | "docx" | "epub" | "json" | "md" | "ods" | "odt" | "pdf" | "ppt"
        | "pptx" | "rtf" | "txt" | "xls" | "xlsx" | "xml" => FileCategory::Document,
        "7z" | "bz2" | "gz" | "iso" | "rar" | "tar" | "tgz" | "xz" | "zip" => FileCategory::Archive,
        _ => FileCategory::Other,
    }
}

fn now_millis() -> u64 {
    unix_now().as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_common_file_types() {
        assert_eq!(categorize(Path::new("photo.JPG")), FileCategory::Image);
        assert_eq!(categorize(Path::new("movie.mp4")), FileCategory::Video);
        assert_eq!(categorize(Path::new("report.pdf")), FileCategory::Document);
        assert_eq!(categorize(Path::new("backup.7z")), FileCategory::Archive);
        assert_eq!(categorize(Path::new("unknown.bin")), FileCategory::Other);
    }
}
