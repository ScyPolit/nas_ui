use chrono::Local;
use if_addrs::{get_if_addrs, IfAddr};
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, OpenOptions},
    io::{Read, Write},
    net::{IpAddr, Ipv4Addr, SocketAddr, TcpListener, TcpStream},
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, State, WindowEvent,
};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};

const CONFIG_VERSION: u32 = 1;
const LOG_LIMIT: u64 = 2 * 1024 * 1024;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Permissions {
    pub browse: bool,
    pub download: bool,
    pub upload: bool,
    pub archive: bool,
    pub manage: bool,
}

impl Default for Permissions {
    fn default() -> Self {
        Self {
            browse: true,
            download: true,
            upload: true,
            archive: true,
            manage: false,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub schema_version: u32,
    pub configured: bool,
    pub share_path: String,
    pub bind: String,
    pub port: u16,
    pub permissions: Permissions,
    pub autostart_app: bool,
    pub start_service: bool,
    pub keep_in_tray: bool,
    pub open_browser: bool,
    pub theme: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            schema_version: CONFIG_VERSION,
            configured: false,
            share_path: String::new(),
            bind: "127.0.0.1".into(),
            port: 5000,
            permissions: Permissions::default(),
            autostart_app: false,
            start_service: true,
            keep_in_tray: true,
            open_browser: false,
            theme: "system".into(),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceStatus {
    state: &'static str,
    healthy: bool,
    pid: Option<u32>,
    uptime_seconds: Option<u64>,
    local_url: String,
    lan_urls: Vec<String>,
    message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathValidation {
    exists: bool,
    is_directory: bool,
    readable: bool,
    writable: bool,
    available_space: Option<u64>,
    warning: Option<String>,
}

struct ManagedChild {
    child: CommandChild,
    pid: u32,
    started: Instant,
}

struct AppState {
    settings: Mutex<Settings>,
    child: Mutex<Option<ManagedChild>>,
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join("settings.json"))
        .map_err(|e| e.to_string())
}

fn log_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_log_dir()
        .map(|dir| dir.join("dufs-desktop.log"))
        .map_err(|e| e.to_string())
}

fn log_event(app: &AppHandle, message: impl AsRef<str>) {
    let Ok(path) = log_path(app) else { return };
    let _ = fs::create_dir_all(path.parent().unwrap_or_else(|| Path::new(".")));
    if fs::metadata(&path)
        .map(|m| m.len() >= LOG_LIMIT)
        .unwrap_or(false)
    {
        let rotated = path.with_extension("log.1");
        let _ = fs::remove_file(&rotated);
        let _ = fs::rename(&path, rotated);
    }
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let line = format!(
            "{} {}\n",
            Local::now().format("%Y-%m-%d %H:%M:%S"),
            message.as_ref()
        );
        let _ = file.write_all(line.as_bytes());
    }
}

fn load_settings(app: &AppHandle) -> Settings {
    let Ok(path) = config_path(app) else {
        return Settings::default();
    };
    match fs::read(&path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Settings>(&bytes).ok())
    {
        Some(mut settings) if settings.schema_version <= CONFIG_VERSION => {
            settings.schema_version = CONFIG_VERSION;
            settings
        }
        Some(_) | None => {
            if path.exists() {
                let backup = path.with_extension(format!(
                    "invalid-{}.json",
                    Local::now().format("%Y%m%d%H%M%S")
                ));
                let _ = fs::rename(&path, backup);
                log_event(app, "配置文件无法读取，已备份并进入重新配置流程");
            }
            Settings::default()
        }
    }
}

fn atomic_save(path: &Path, value: &Settings) -> Result<(), String> {
    let parent = path.parent().ok_or("配置目录无效")?;
    fs::create_dir_all(parent).map_err(|e| format!("无法创建配置目录: {e}"))?;
    let temp = path.with_extension("json.tmp");
    let data = serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?;
    let mut file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(&temp)
        .map_err(|e| e.to_string())?;
    file.write_all(&data)
        .and_then(|_| file.sync_all())
        .map_err(|e| format!("无法写入配置: {e}"))?;
    replace_file(&temp, path)?;
    if let Ok(dir) = OpenOptions::new().read(true).open(parent) {
        let _ = dir.sync_all();
    }
    Ok(())
}

#[cfg(not(windows))]
fn replace_file(source: &Path, target: &Path) -> Result<(), String> {
    fs::rename(source, target).map_err(|e| format!("无法替换配置文件: {e}"))
}

#[cfg(windows)]
fn replace_file(source: &Path, target: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };
    let source: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
    let target: Vec<u16> = target.as_os_str().encode_wide().chain(Some(0)).collect();
    let result = unsafe {
        MoveFileExW(
            source.as_ptr(),
            target.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if result == 0 {
        Err(format!(
            "无法替换配置文件: {}",
            std::io::Error::last_os_error()
        ))
    } else {
        Ok(())
    }
}

fn validate_settings(settings: &Settings, check_port: bool) -> Result<(), String> {
    let path = Path::new(&settings.share_path);
    if settings.share_path.trim().is_empty() || !path.is_dir() {
        return Err("请选择一个存在的共享文件夹".into());
    }
    if settings.bind != "127.0.0.1" && settings.bind != "0.0.0.0" {
        return Err("监听地址无效".into());
    }
    if settings.port == 0 {
        return Err("端口必须在 1 到 65535 之间".into());
    }
    fs::read_dir(path).map_err(|e| format!("无法读取共享文件夹: {e}"))?;
    if check_port {
        TcpListener::bind((settings.bind.as_str(), settings.port))
            .map_err(|e| format!("端口 {} 无法使用: {e}", settings.port))?;
    }
    Ok(())
}

fn health_check(port: u16) -> bool {
    let address = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), port);
    let Ok(mut stream) = TcpStream::connect_timeout(&address, Duration::from_millis(500)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
    if stream
        .write_all(b"GET /__dufs__/health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
        .is_err()
    {
        return false;
    }
    let mut response = [0_u8; 64];
    stream
        .read(&mut response)
        .map(|n| String::from_utf8_lossy(&response[..n]).contains(" 200 "))
        .unwrap_or(false)
}

fn lan_urls(settings: &Settings) -> Vec<String> {
    if settings.bind == "127.0.0.1" {
        return Vec::new();
    }
    let mut urls: Vec<String> = get_if_addrs()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|iface| match iface.addr {
            IfAddr::V4(v4) if !v4.ip.is_loopback() && !v4.ip.is_link_local() => {
                Some(format!("http://{}:{}", v4.ip, settings.port))
            }
            _ => None,
        })
        .collect();
    urls.sort();
    urls.dedup();
    urls
}

fn stop_managed(app: &AppHandle, state: &AppState) -> Result<(), String> {
    let mut slot = state.child.lock().map_err(|_| "服务状态锁已损坏")?;
    if let Some(child) = slot.take() {
        child
            .child
            .kill()
            .map_err(|e| format!("无法停止服务: {e}"))?;
        log_event(app, format!("服务已停止 (PID {})", child.pid));
    }
    Ok(())
}

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    state
        .settings
        .lock()
        .map(|v| v.clone())
        .map_err(|_| "配置状态锁已损坏".into())
}

#[tauri::command]
fn validate_path(path: String) -> PathValidation {
    let target = Path::new(&path);
    let exists = target.exists();
    let is_directory = target.is_dir();
    let readable = is_directory && fs::read_dir(target).is_ok();
    let writable = if is_directory {
        let probe = target.join(format!(".dufs-write-test-{}", std::process::id()));
        OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&probe)
            .and_then(|_| fs::remove_file(&probe))
            .is_ok()
    } else {
        false
    };
    let warning = if target.parent().is_none() {
        Some("不建议直接共享磁盘或系统根目录".into())
    } else {
        None
    };
    PathValidation {
        exists,
        is_directory,
        readable,
        writable,
        available_space: is_directory
            .then(|| fs2::available_space(target).ok())
            .flatten(),
        warning,
    }
}

#[tauri::command]
fn check_port(bind: String, port: u16) -> Result<(), String> {
    if port == 0 {
        return Err("端口必须在 1 到 65535 之间".into());
    }
    TcpListener::bind((bind.as_str(), port))
        .map(|_| ())
        .map_err(|e| format!("端口 {port} 已被占用或不可用: {e}"))
}

#[tauri::command]
fn save_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    mut settings: Settings,
) -> Result<(), String> {
    validate_settings(
        &settings,
        state
            .child
            .lock()
            .map_err(|_| "服务状态锁已损坏")?
            .is_none(),
    )?;
    settings.schema_version = CONFIG_VERSION;
    atomic_save(&config_path(&app)?, &settings)?;
    if settings.autostart_app {
        app.autolaunch().enable().map_err(|e| e.to_string())?;
    } else {
        app.autolaunch().disable().map_err(|e| e.to_string())?;
    }
    *state.settings.lock().map_err(|_| "配置状态锁已损坏")? = settings;
    log_event(&app, "配置已保存");
    Ok(())
}

#[tauri::command]
async fn start_service(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<ServiceStatus, String> {
    {
        let settings = state
            .settings
            .lock()
            .map_err(|_| "配置状态锁已损坏")?
            .clone();
        let mut slot = state.child.lock().map_err(|_| "服务状态锁已损坏")?;
        if slot.is_some() && health_check(settings.port) {
            return Err("服务已经在运行".into());
        }
        if let Some(stale) = slot.take() {
            let _ = stale.child.kill();
            log_event(
                &app,
                format!("已清理失去响应的服务进程 (PID {})", stale.pid),
            );
        }
    }
    let settings = state
        .settings
        .lock()
        .map_err(|_| "配置状态锁已损坏")?
        .clone();
    validate_settings(&settings, true)?;
    let mut args = vec![
        settings.share_path.clone(),
        "--bind".into(),
        settings.bind.clone(),
        "--port".into(),
        settings.port.to_string(),
    ];
    if !settings.permissions.upload {
        args.push("--no-upload".into());
    }
    if !settings.permissions.archive {
        args.push("--no-archive".into());
    }
    if settings.permissions.manage {
        args.push("--allow-delete".into());
    }
    let command = app
        .shell()
        .sidecar("dufs")
        .map_err(|e| format!("无法定位 Dufs 服务程序: {e}"))?
        .args(args);
    let (mut events, child) = command
        .spawn()
        .map_err(|e| format!("无法启动 Dufs 服务: {e}"))?;
    let pid = child.pid();
    *state.child.lock().map_err(|_| "服务状态锁已损坏")? = Some(ManagedChild {
        child,
        pid,
        started: Instant::now(),
    });
    let monitor = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            if let CommandEvent::Terminated(payload) = event {
                let state = monitor.state::<AppState>();
                if let Ok(mut slot) = state.child.lock() {
                    if slot.as_ref().is_some_and(|managed| managed.pid == pid) {
                        *slot = None;
                        log_event(
                            &monitor,
                            format!("服务进程意外退出 (PID {pid}, code {:?})", payload.code),
                        );
                    }
                }
                break;
            }
        }
    });
    log_event(&app, format!("正在启动服务 (PID {pid})"));
    for _ in 0..30 {
        if health_check(settings.port) {
            log_event(&app, "服务健康检查通过");
            return service_status(state);
        }
        tokio_sleep(Duration::from_millis(200)).await;
    }
    let _ = stop_managed(&app, &state);
    log_event(&app, "服务启动失败：健康检查超时");
    Err("Dufs 已启动但健康检查超时，请检查运行日志".into())
}

async fn tokio_sleep(duration: Duration) {
    tauri::async_runtime::spawn_blocking(move || std::thread::sleep(duration))
        .await
        .ok();
}

#[tauri::command]
fn stop_service(app: AppHandle, state: State<'_, AppState>) -> Result<ServiceStatus, String> {
    stop_managed(&app, &state)?;
    service_status(state)
}

#[tauri::command]
async fn restart_service(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<ServiceStatus, String> {
    stop_managed(&app, &state)?;
    tokio_sleep(Duration::from_millis(300)).await;
    start_service(app, state).await
}

#[tauri::command]
fn service_status(state: State<'_, AppState>) -> Result<ServiceStatus, String> {
    let settings = state
        .settings
        .lock()
        .map_err(|_| "配置状态锁已损坏")?
        .clone();
    let slot = state.child.lock().map_err(|_| "服务状态锁已损坏")?;
    let healthy = slot.is_some() && health_check(settings.port);
    let (pid, uptime) = slot
        .as_ref()
        .map(|c| (Some(c.pid), Some(c.started.elapsed().as_secs())))
        .unwrap_or((None, None));
    Ok(ServiceStatus {
        state: if healthy {
            "running"
        } else if slot.is_some() {
            "error"
        } else {
            "stopped"
        },
        healthy,
        pid,
        uptime_seconds: uptime,
        local_url: format!("http://127.0.0.1:{}", settings.port),
        lan_urls: lan_urls(&settings),
        message: if healthy {
            "服务运行正常".into()
        } else if slot.is_some() {
            "服务进程存在，但健康检查失败".into()
        } else {
            "服务已停止".into()
        },
    })
}

#[tauri::command]
fn read_logs(app: AppHandle) -> Result<String, String> {
    let path = log_path(&app)?;
    let content = fs::read_to_string(path).unwrap_or_default();
    Ok(content
        .lines()
        .rev()
        .take(1000)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<Vec<_>>()
        .join("\n"))
}

#[tauri::command]
fn export_logs(app: AppHandle, path: String) -> Result<(), String> {
    let content = read_logs(app)?;
    fs::write(path, content).map_err(|e| format!("无法导出日志: {e}"))
}

#[tauri::command]
fn open_log_folder(app: AppHandle) -> Result<(), String> {
    let path = log_path(&app)?
        .parent()
        .ok_or("日志目录无效")?
        .to_path_buf();
    app.opener()
        .open_path(path.to_string_lossy().into_owned(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn open_share_folder(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let path = state
        .settings
        .lock()
        .map_err(|_| "配置状态锁已损坏")?
        .share_path
        .clone();
    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn open_web(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let port = state.settings.lock().map_err(|_| "配置状态锁已损坏")?.port;
    app.opener()
        .open_url(format!("http://127.0.0.1:{port}"), None::<&str>)
        .map_err(|e| e.to_string())
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            show_main(app)
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .setup(|app| {
            let settings = load_settings(app.handle());
            app.manage(AppState {
                settings: Mutex::new(settings.clone()),
                child: Mutex::new(None),
            });
            let show = MenuItem::with_id(app, "show", "显示管理窗口", true, None::<&str>)?;
            let open = MenuItem::with_id(app, "open", "打开网盘", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出程序", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &open, &quit])?;
            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main(app),
                    "open" => {
                        let state = app.state::<AppState>();
                        let _ = open_web(app.clone(), state);
                    }
                    "quit" => {
                        let state = app.state::<AppState>();
                        let _ = stop_managed(app, &state);
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if matches!(
                        event,
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        }
                    ) {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;
            if settings.configured && settings.start_service {
                let handle = app.handle().clone();
                let open_browser = settings.open_browser;
                tauri::async_runtime::spawn(async move {
                    let state = handle.state::<AppState>();
                    if start_service(handle.clone(), state).await.is_ok() && open_browser {
                        let state = handle.state::<AppState>();
                        let _ = open_web(handle.clone(), state);
                    }
                });
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let state = window.app_handle().state::<AppState>();
                let keep = state
                    .settings
                    .lock()
                    .map(|s| s.keep_in_tray)
                    .unwrap_or(false);
                if keep {
                    api.prevent_close();
                    let _ = window.hide();
                } else {
                    let _ = stop_managed(window.app_handle(), &state);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            validate_path,
            check_port,
            save_settings,
            start_service,
            stop_service,
            restart_service,
            service_status,
            read_logs,
            export_logs,
            open_log_folder,
            open_share_folder,
            open_web
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Dufs desktop");
}
