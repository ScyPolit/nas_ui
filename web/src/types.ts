export type PathType = 'Dir' | 'SymlinkDir' | 'File' | 'SymlinkFile'

export interface PathItem {
  path_type: PathType
  name: string
  mtime: number
  size: number
}

export interface IndexData {
  href: string
  kind: 'Index' | 'Edit' | 'View'
  uri_prefix: string
  allow_upload: boolean
  allow_delete: boolean
  allow_search: boolean
  allow_archive: boolean
  dir_exists: boolean
  auth: boolean
  user: string | null
  paths: PathItem[]
}

export type FileCategory = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other'
export type ScanStatus = 'idle' | 'scanning' | 'ready' | 'error'

export interface DiskSpace {
  total_bytes: number
  used_bytes: number
  free_bytes: number
  available_bytes: number
}

export interface CategoryStats {
  key: FileCategory
  bytes: number
  count: number
}

export interface RecentSavedFile {
  name: string
  path: string
  parent: string
  size: number
  mtime: number
  category: FileCategory
}

export interface SharedStats {
  total_bytes: number
  file_count: number
  directory_count: number
  scanned_at: number | null
  categories: CategoryStats[]
  recent_files: RecentSavedFile[]
}

export interface StorageSnapshot {
  disk: DiskSpace | null
  shared: SharedStats
  status: ScanStatus
  disk_error: string | null
  scan_error: string | null
}

export type ViewMode = 'extra-large' | 'large' | 'medium' | 'small' | 'list' | 'details'
export type SortField = 'name' | 'mtime' | 'size' | 'type'
export type SortOrder = 'asc' | 'desc'
export type ThemeMode = 'system' | 'light' | 'dark'

export interface RecentViewedFile {
  path: string
  name: string
  parent: string
  size: number
  mtime: number
  viewedAt: number
}

export interface RecentListItem {
  path: string
  name: string
  parent: string
  size: number
  time: number
  category?: FileCategory
}
