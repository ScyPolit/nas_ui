import type { IndexData, PathItem, StorageSnapshot } from '@/types'
import { joinPath } from '@/utils/files'

function decodeBootstrap(): IndexData {
  const encoded = document.querySelector<HTMLTemplateElement>('#index-data')?.content.textContent?.trim()
  if (!encoded || encoded === '__INDEX_DATA__') {
    return {
      href: '/',
      kind: 'Index',
      uri_prefix: '/',
      allow_upload: true,
      allow_delete: false,
      allow_search: true,
      allow_archive: true,
      dir_exists: true,
      auth: false,
      user: null,
      paths: [],
    }
  }
  const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes)) as IndexData
}

export const bootstrap = decodeBootstrap()

export function encodePath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/')
}

export class DufsApi {
  readonly prefix: string

  constructor(prefix = bootstrap.uri_prefix) {
    this.prefix = prefix.endsWith('/') ? prefix : `${prefix}/`
  }

  pathUrl(path = '', directory = false): string {
    const encoded = encodePath(path)
    const url = `${this.prefix}${encoded}`
    if (directory && !url.endsWith('/')) return `${url}/`
    return url
  }

  fileUrl(path: string, options: { view?: boolean; thumbnail?: number; download?: boolean; version?: number } = {}): string {
    const url = new URL(this.pathUrl(path), window.location.origin)
    if (options.view) url.searchParams.set('view', '')
    if (options.thumbnail) url.searchParams.set('thumbnail', String(options.thumbnail))
    if (options.download) url.searchParams.set('download', '')
    if (options.version) url.searchParams.set('v', String(options.version))
    return url.pathname + url.search
  }

  archiveUrl(path: string): string {
    const url = new URL(this.pathUrl(path, true), window.location.origin)
    url.searchParams.set('zip', '')
    return url.pathname + url.search
  }

  async list(path = '', options: { search?: string; sort?: string; order?: string; signal?: AbortSignal } = {}): Promise<IndexData> {
    const url = new URL(this.pathUrl(path, true), window.location.origin)
    url.searchParams.set('json', '')
    if (options.search) url.searchParams.set('q', options.search)
    if (options.sort) url.searchParams.set('sort', options.sort)
    if (options.order) url.searchParams.set('order', options.order)
    const response = await fetch(url, {
      signal: options.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(await responseMessage(response, '无法读取文件目录'))
    return response.json() as Promise<IndexData>
  }

  async storage(refresh = false, signal?: AbortSignal): Promise<StorageSnapshot> {
    const url = new URL(`${this.prefix}__dufs__/storage`, window.location.origin)
    if (refresh) url.searchParams.set('refresh', '1')
    const response = await fetch(url, { signal, cache: 'no-store' })
    if (!response.ok) throw new Error(await responseMessage(response, '无法读取存储空间信息'))
    return response.json() as Promise<StorageSnapshot>
  }

  async createFolder(parent: string, name: string): Promise<void> {
    const path = joinPath(parent, name)
    const response = await fetch(this.pathUrl(path, true), { method: 'MKCOL' })
    if (!response.ok) throw new Error(await responseMessage(response, '无法新建文件夹'))
  }

  async remove(path: string): Promise<void> {
    const response = await fetch(this.pathUrl(path), { method: 'DELETE' })
    if (!response.ok) throw new Error(await responseMessage(response, '无法删除文件'))
  }

  async move(source: string, destination: string): Promise<void> {
    const destinationUrl = new URL(this.pathUrl(destination), window.location.origin)
    const response = await fetch(this.pathUrl(source), {
      method: 'MOVE',
      headers: { Destination: destinationUrl.toString() },
    })
    if (!response.ok) throw new Error(await responseMessage(response, '无法移动或重命名文件'))
  }

  async exists(path: string): Promise<boolean> {
    const response = await fetch(this.pathUrl(path), { method: 'HEAD', cache: 'no-store' })
    if (response.status === 404) return false
    if (response.ok) return true
    throw new Error(await responseMessage(response, '无法检查目标文件'))
  }

  async size(path: string): Promise<number | null> {
    const response = await fetch(this.pathUrl(path), { method: 'HEAD', cache: 'no-store' })
    if (response.status === 404) return null
    if (!response.ok) throw new Error(await responseMessage(response, '无法读取目标文件状态'))
    const value = Number(response.headers.get('content-length'))
    return Number.isFinite(value) ? value : 0
  }

  upload(
    path: string,
    file: Blob,
    offset: number,
    callbacks: {
      onProgress: (loaded: number, total: number) => void
      onComplete: () => void
      onError: (message: string) => void
    },
  ): XMLHttpRequest {
    const request = new XMLHttpRequest()
    request.open(offset > 0 ? 'PATCH' : 'PUT', this.pathUrl(path))
    if (offset > 0) request.setRequestHeader('X-Update-Range', 'append')
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) callbacks.onProgress(event.loaded + offset, event.total + offset)
    })
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) callbacks.onComplete()
      else callbacks.onError(request.responseText || `服务器返回 ${request.status}`)
    })
    request.addEventListener('error', () => callbacks.onError('网络连接中断'))
    request.addEventListener('abort', () => callbacks.onError('上传已取消'))
    request.send(file.slice(offset))
    return request
  }

  itemPath(directory: string, item: PathItem): string {
    return joinPath(directory, item.name)
  }
}

async function responseMessage(response: Response, fallback: string): Promise<string> {
  const text = await response.text().catch(() => '')
  if (!text) return `${fallback}（HTTP ${response.status}）`
  return `${fallback}：${text.slice(0, 300)}`
}

export const api = new DufsApi()
