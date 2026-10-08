import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, bootstrap } from '@/api/dufs'
import type { IndexData, PathItem, SortField, SortOrder } from '@/types'
import { extensionOf, isDirectory } from '@/utils/files'

export const filesChanged = new EventTarget()

export const useFilesStore = defineStore('files', () => {
  const currentPath = ref('')
  const data = ref<IndexData>(bootstrap)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const search = ref('')
  const requestController = ref<AbortController | null>(null)

  const items = computed(() => data.value.paths)
  const permissions = computed(() => ({
    upload: data.value.allow_upload,
    remove: data.value.allow_delete,
    search: data.value.allow_search,
    archive: data.value.allow_archive,
  }))

  async function load(path = currentPath.value, query = search.value): Promise<void> {
    requestController.value?.abort()
    const controller = new AbortController()
    requestController.value = controller
    loading.value = true
    error.value = null
    try {
      data.value = await api.list(path, { search: query, signal: controller.signal })
      currentPath.value = path
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      error.value = reason instanceof Error ? reason.message : '无法读取文件目录'
    } finally {
      if (requestController.value === controller) loading.value = false
    }
  }

  function sortedItems(field: SortField, order: SortOrder): PathItem[] {
    return [...items.value].sort((left, right) => {
      const directoryOrder = Number(isDirectory(right)) - Number(isDirectory(left))
      if (directoryOrder !== 0) return directoryOrder
      let result = 0
      if (field === 'name') result = left.name.localeCompare(right.name, 'zh-CN', { numeric: true })
      if (field === 'mtime') result = left.mtime - right.mtime
      if (field === 'size') result = left.size - right.size
      if (field === 'type') result = extensionOf(left.name).localeCompare(extensionOf(right.name), 'zh-CN')
      return order === 'asc' ? result : -result
    })
  }

  filesChanged.addEventListener('changed', () => void load())

  return { currentPath, data, items, permissions, loading, error, search, load, sortedItems }
})
