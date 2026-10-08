import type { FileCategory, PathItem } from '@/types'

const IMAGE_EXTENSIONS = new Set(['apng', 'avif', 'bmp', 'gif', 'heic', 'heif', 'jpeg', 'jpg', 'png', 'tif', 'tiff', 'webp'])
const VIDEO_EXTENSIONS = new Set(['avi', 'flv', 'm4v', 'mkv', 'mov', 'mp4', 'mpeg', 'mpg', 'webm', 'wmv'])
const AUDIO_EXTENSIONS = new Set(['aac', 'flac', 'm4a', 'mp3', 'ogg', 'opus', 'wav', 'wma'])
const DOCUMENT_EXTENSIONS = new Set(['csv', 'doc', 'docx', 'epub', 'json', 'md', 'ods', 'odt', 'pdf', 'ppt', 'pptx', 'rtf', 'txt', 'xls', 'xlsx', 'xml'])
const ARCHIVE_EXTENSIONS = new Set(['7z', 'bz2', 'gz', 'iso', 'rar', 'tar', 'tgz', 'xz', 'zip'])
const CODE_EXTENSIONS = new Set(['c', 'cpp', 'cs', 'css', 'go', 'h', 'html', 'java', 'js', 'jsx', 'kt', 'php', 'py', 'rb', 'rs', 'scss', 'sh', 'sql', 'swift', 'toml', 'ts', 'tsx', 'vue', 'yaml', 'yml'])
const TEXT_EXTENSIONS = new Set(['csv', 'ini', 'log', 'md', 'json', 'txt', 'xml', 'yaml', 'yml', ...CODE_EXTENSIONS])

export function extensionOf(name: string): string {
  const base = name.split('/').at(-1) ?? name
  const index = base.lastIndexOf('.')
  return index > 0 ? base.slice(index + 1).toLowerCase() : ''
}

export function categoryOf(name: string): FileCategory {
  const extension = extensionOf(name)
  if (IMAGE_EXTENSIONS.has(extension)) return 'image'
  if (VIDEO_EXTENSIONS.has(extension)) return 'video'
  if (AUDIO_EXTENSIONS.has(extension)) return 'audio'
  if (DOCUMENT_EXTENSIONS.has(extension) || CODE_EXTENSIONS.has(extension)) return 'document'
  if (ARCHIVE_EXTENSIONS.has(extension)) return 'archive'
  return 'other'
}

export function previewKind(name: string): 'image' | 'pdf' | 'video' | 'audio' | 'markdown' | 'json' | 'code' | 'text' | 'docx' | 'xlsx' | 'unknown' {
  const extension = extensionOf(name)
  if (IMAGE_EXTENSIONS.has(extension)) return 'image'
  if (extension === 'pdf') return 'pdf'
  if (VIDEO_EXTENSIONS.has(extension)) return 'video'
  if (AUDIO_EXTENSIONS.has(extension)) return 'audio'
  if (extension === 'md') return 'markdown'
  if (extension === 'json') return 'json'
  if (CODE_EXTENSIONS.has(extension)) return 'code'
  if (TEXT_EXTENSIONS.has(extension)) return 'text'
  if (extension === 'docx') return 'docx'
  if (extension === 'xlsx') return 'xlsx'
  return 'unknown'
}

export function isDirectory(item: PathItem): boolean {
  return item.path_type.endsWith('Dir')
}

export function fileTypeLabel(item: Pick<PathItem, 'name' | 'path_type'>): string {
  if (item.path_type.endsWith('Dir')) return '文件夹'
  const extension = extensionOf(item.name)
  return extension ? `${extension.toUpperCase()} 文件` : '文件'
}

export function baseName(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? ''
}

export function parentPath(path: string): string {
  const parts = path.split('/').filter(Boolean)
  parts.pop()
  return parts.join('/')
}

export function joinPath(...parts: string[]): string {
  return parts.flatMap((part) => part.split('/')).filter(Boolean).join('/')
}

export function displayName(name: string, showExtension: boolean): string {
  if (showExtension) return baseName(name)
  const base = baseName(name)
  const extension = extensionOf(base)
  return extension ? base.slice(0, -(extension.length + 1)) : base
}
