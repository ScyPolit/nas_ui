import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { PathItem } from '@/types'
import { addRecentViewed } from '@/services/recentDb'
import { baseName, joinPath, parentPath } from '@/utils/files'

export interface PreviewEntry extends PathItem {
  fullPath: string
}

export const usePreviewStore = defineStore('preview', () => {
  const visible = ref(false)
  const entries = ref<PreviewEntry[]>([])
  const index = ref(0)
  const current = computed(() => entries.value[index.value] ?? null)
  const hasPrevious = computed(() => index.value > 0)
  const hasNext = computed(() => index.value < entries.value.length - 1)

  function open(item: PathItem | PreviewEntry, directory = '', siblings: PathItem[] = []): void {
    const source = siblings.filter((candidate) => !candidate.path_type.endsWith('Dir'))
    entries.value = (source.length ? source : [item]).map((candidate) => ({
      ...candidate,
      fullPath:
        typeof (candidate as Partial<PreviewEntry>).fullPath === 'string'
          ? (candidate as PreviewEntry).fullPath
          : joinPath(directory, candidate.name),
    }))
    const requestedPath =
      typeof (item as Partial<PreviewEntry>).fullPath === 'string'
        ? (item as PreviewEntry).fullPath
        : joinPath(directory, item.name)
    index.value = Math.max(entries.value.findIndex((candidate) => candidate.fullPath === requestedPath), 0)
    visible.value = true
    void rememberCurrent()
  }

  function close(): void {
    visible.value = false
  }

  function previous(): void {
    if (!hasPrevious.value) return
    index.value -= 1
    void rememberCurrent()
  }

  function next(): void {
    if (!hasNext.value) return
    index.value += 1
    void rememberCurrent()
  }

  async function rememberCurrent(): Promise<void> {
    const item = current.value
    if (!item) return
    await addRecentViewed({
      path: item.fullPath,
      name: baseName(item.fullPath),
      parent: parentPath(item.fullPath) || '/',
      size: item.size,
      mtime: item.mtime,
      viewedAt: Date.now(),
    }).catch(() => undefined)
  }

  return { visible, entries, index, current, hasPrevious, hasNext, open, close, previous, next }
})
