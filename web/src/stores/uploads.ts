import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api/dufs'
import { filesChanged } from '@/stores/files'
import { extensionOf, joinPath } from '@/utils/files'
import { createId } from '@/utils/browser'

export type UploadStatus = 'queued' | 'checking' | 'conflict' | 'uploading' | 'completed' | 'failed' | 'canceled' | 'skipped'

export interface UploadTask {
  id: string
  file: File
  destination: string
  status: UploadStatus
  loaded: number
  total: number
  speed: number
  error: string | null
  startedAt: number | null
  updatedAt: number
  request: XMLHttpRequest | null
  allowOverwrite: boolean
}

const CONCURRENCY = 3

export const useUploadsStore = defineStore('uploads', () => {
  const tasks = ref<UploadTask[]>([])
  const panelOpen = ref(false)

  const activeCount = computed(() => tasks.value.filter((task) => task.status === 'checking' || task.status === 'uploading').length)
  const pendingCount = computed(() => tasks.value.filter((task) => !['completed', 'canceled', 'skipped'].includes(task.status)).length)
  const totalProgress = computed(() => {
    const measurable = tasks.value.filter((task) => task.total > 0 && task.status !== 'skipped')
    const total = measurable.reduce((sum, task) => sum + task.total, 0)
    const loaded = measurable.reduce((sum, task) => sum + Math.min(task.loaded, task.total), 0)
    return total > 0 ? Math.round((loaded / total) * 100) : 0
  })

  function addFiles(files: File[], targetPath: string, allowOverwrite: boolean): void {
    const created = files.map((file) => {
      const relative = file.webkitRelativePath || file.name
      return {
        id: createId(),
        file,
        destination: joinPath(targetPath, relative),
        status: 'queued' as const,
        loaded: 0,
        total: file.size,
        speed: 0,
        error: null,
        startedAt: null,
        updatedAt: Date.now(),
        request: null,
        allowOverwrite,
      }
    })
    tasks.value.push(...created)
    panelOpen.value = true
    pump()
  }

  function pump(): void {
    while (activeCount.value < CONCURRENCY) {
      const task = tasks.value.find((candidate) => candidate.status === 'queued')
      if (!task) break
      task.status = 'checking'
      void prepare(task)
    }
  }

  async function prepare(task: UploadTask): Promise<void> {
    try {
      if (await api.exists(task.destination)) {
        task.status = 'conflict'
        task.error = '目标位置已存在同名文件'
        pump()
        return
      }
      start(task)
    } catch (reason) {
      fail(task, reason instanceof Error ? reason.message : '无法检查目标文件')
    }
  }

  function start(task: UploadTask, offset = 0): void {
    task.status = 'uploading'
    task.error = null
    task.loaded = offset
    task.startedAt = Date.now()
    task.updatedAt = task.startedAt
    let previousLoaded = task.loaded
    let previousTime = task.startedAt
    task.request = api.upload(task.destination, task.file, offset, {
      onProgress(loaded) {
        const now = Date.now()
        task.loaded = loaded
        const elapsed = Math.max(now - previousTime, 1)
        task.speed = ((loaded - previousLoaded) * 1000) / elapsed
        if (elapsed >= 500) {
          previousLoaded = loaded
          previousTime = now
        }
        task.updatedAt = now
      },
      onComplete() {
        task.loaded = task.total
        task.status = 'completed'
        task.speed = 0
        task.request = null
        task.updatedAt = Date.now()
        filesChanged.dispatchEvent(new Event('changed'))
        pump()
      },
      onError(message) {
        if (task.status === 'canceled') return
        fail(task, message)
      },
    })
  }

  function fail(task: UploadTask, message: string): void {
    task.status = 'failed'
    task.error = message
    task.speed = 0
    task.request = null
    task.updatedAt = Date.now()
    pump()
  }

  function cancel(id: string): void {
    const task = tasks.value.find((candidate) => candidate.id === id)
    if (!task || ['completed', 'canceled', 'skipped'].includes(task.status)) return
    task.status = 'canceled'
    task.error = null
    task.request?.abort()
    task.request = null
    task.speed = 0
    pump()
  }

  function retry(id: string): void {
    const task = tasks.value.find((candidate) => candidate.id === id)
    if (!task) return
    task.status = 'checking'
    task.speed = 0
    task.error = null
    task.request = null
    void resume(task)
  }

  async function resume(task: UploadTask): Promise<void> {
    try {
      const remoteSize = await api.size(task.destination)
      if (remoteSize === task.total) {
        task.loaded = task.total
        task.status = 'completed'
        filesChanged.dispatchEvent(new Event('changed'))
      } else if (remoteSize !== null && remoteSize > 0 && remoteSize < task.total) {
        start(task, remoteSize)
        return
      } else if (remoteSize !== null && remoteSize > task.total) {
        task.status = 'conflict'
        task.error = '目标文件大小与上传任务不一致'
      } else {
        start(task)
        return
      }
    } catch (reason) {
      fail(task, reason instanceof Error ? reason.message : '无法恢复上传任务')
      return
    }
    pump()
  }

  function skip(id: string): void {
    const task = tasks.value.find((candidate) => candidate.id === id)
    if (!task) return
    task.status = 'skipped'
    task.error = null
    pump()
  }

  function overwrite(id: string): void {
    const task = tasks.value.find((candidate) => candidate.id === id)
    if (!task || !task.allowOverwrite) return
    start(task)
  }

  async function keepBoth(id: string): Promise<void> {
    const task = tasks.value.find((candidate) => candidate.id === id)
    if (!task) return
    const extension = extensionOf(task.destination)
    const suffixLength = extension ? extension.length + 1 : 0
    const stem = suffixLength ? task.destination.slice(0, -suffixLength) : task.destination
    for (let index = 1; index <= 999; index += 1) {
      const candidate = `${stem} (${index})${extension ? `.${extension}` : ''}`
      if (!(await api.exists(candidate))) {
        task.destination = candidate
        start(task)
        return
      }
    }
    fail(task, '无法生成可用的新文件名')
  }

  function clearFinished(): void {
    tasks.value = tasks.value.filter((task) => !['completed', 'canceled', 'skipped'].includes(task.status))
  }

  window.addEventListener('beforeunload', (event) => {
    if (activeCount.value === 0) return
    event.preventDefault()
  })

  return {
    tasks,
    panelOpen,
    activeCount,
    pendingCount,
    totalProgress,
    addFiles,
    cancel,
    retry,
    skip,
    overwrite,
    keepBoth,
    clearFinished,
  }
})
