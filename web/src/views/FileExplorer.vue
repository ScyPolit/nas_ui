<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  Grid2X2,
  List,
  PanelLeft,
  RefreshCw,
  Search,
  Upload,
} from '@lucide/vue'
import { api } from '@/api/dufs'
import ContextMenu from '@/components/ContextMenu.vue'
import DirectoryTree from '@/components/DirectoryTree.vue'
import FileDetailsTable from '@/components/FileDetailsTable.vue'
import FileGrid from '@/components/FileGrid.vue'
import { t } from '@/locales/zh-CN'
import { filesFromDataTransfer } from '@/services/dropFiles'
import { useFilesStore } from '@/stores/files'
import { usePreferencesStore } from '@/stores/preferences'
import { usePreviewStore } from '@/stores/preview'
import { useUploadsStore } from '@/stores/uploads'
import type { PathItem, SortField, ViewMode } from '@/types'
import { baseName, fileTypeLabel, isDirectory, joinPath, parentPath } from '@/utils/files'
import { formatBytes, formatDate } from '@/utils/format'

const props = defineProps<{ path?: string }>()
const router = useRouter()
const route = useRoute()
const files = useFilesStore()
const preferences = usePreferencesStore()
const preview = usePreviewStore()
const uploads = useUploadsStore()
const searchText = ref(String(route.query.q ?? ''))
const viewMode = ref<ViewMode>(preferences.defaultView)
const selected = ref<Set<string>>(new Set())
const lastSelectedIndex = ref<number | null>(null)
const treeVisible = ref(true)
const context = ref<{ x: number; y: number; item: PathItem | null } | null>(null)
const propertyItem = ref<PathItem | null>(null)
const propertyOpen = ref(false)
const dropActive = ref(false)
let refreshTimer: number | null = null

const currentPath = computed(() => String(props.path ?? '').split('/').filter(Boolean).join('/'))
const sortedItems = computed(() => files.sortedItems(preferences.sortField, preferences.sortOrder))
const breadcrumbs = computed(() => {
  const parts = currentPath.value.split('/').filter(Boolean)
  return [
    { label: '共享空间', path: '' },
    ...parts.map((label, index) => ({ label, path: parts.slice(0, index + 1).join('/') })),
  ]
})
const selectedItems = computed(() => sortedItems.value.filter((item) => selected.value.has(item.name)))
const canRename = computed(() => files.permissions.upload && files.permissions.remove)
const contextActions = computed(() => {
  const item = context.value?.item
  if (!item) return [{ key: 'refresh' as const, label: t('action.refresh') }]
  return [
    { key: 'open' as const, label: t('action.open') },
    ...(!isDirectory(item) ? [{ key: 'preview' as const, label: t('action.preview') }] : []),
    { key: 'download' as const, label: isDirectory(item) ? t('action.downloadFolder') : t('action.download'), disabled: isDirectory(item) && !files.permissions.archive },
    { key: 'copy-link' as const, label: t('action.copyLink') },
    { key: 'rename' as const, label: t('action.rename'), disabled: !canRename.value },
    { key: 'delete' as const, label: t('action.remove'), danger: true, disabled: !files.permissions.remove },
    { key: 'properties' as const, label: t('action.properties') },
  ]
})

async function load(): Promise<void> {
  files.search = String(route.query.q ?? '')
  searchText.value = files.search
  selected.value = new Set()
  lastSelectedIndex.value = null
  await files.load(currentPath.value, files.search)
}

function open(item: PathItem): void {
  if (isDirectory(item)) {
    void router.push({ name: 'files', params: { path: joinPath(currentPath.value, item.name) } })
  } else {
    preview.open(item, currentPath.value, sortedItems.value)
  }
}

function select(item: PathItem, index: number, event: MouseEvent): void {
  const next = new Set(selected.value)
  if (event.shiftKey && lastSelectedIndex.value !== null) {
    const [start, end] = [lastSelectedIndex.value, index].sort((left, right) => left - right)
    if (!event.ctrlKey && !event.metaKey) next.clear()
    for (let cursor = start; cursor <= end; cursor += 1) next.add(sortedItems.value[cursor].name)
  } else if (event.ctrlKey || event.metaKey) {
    if (next.has(item.name)) next.delete(item.name)
    else next.add(item.name)
  } else {
    next.clear()
    next.add(item.name)
  }
  selected.value = next
  lastSelectedIndex.value = index
}

function showContext(item: PathItem | null, event: MouseEvent): void {
  if (item && !selected.value.has(item.name)) selected.value = new Set([item.name])
  context.value = { x: event.clientX, y: event.clientY, item }
}

async function handleContext(action: string): Promise<void> {
  const item = context.value?.item
  context.value = null
  if (action === 'refresh') return load()
  if (!item) return
  if (action === 'open') return open(item)
  if (action === 'preview' && !isDirectory(item)) return preview.open(item, currentPath.value, sortedItems.value)
  if (action === 'download') return download(item)
  if (action === 'copy-link') return copyLink(item)
  if (action === 'rename') return rename(item)
  if (action === 'delete') return remove([item])
  if (action === 'properties') {
    propertyItem.value = item
    propertyOpen.value = true
  }
}

function download(item: PathItem): void {
  const path = joinPath(currentPath.value, item.name)
  const anchor = document.createElement('a')
  anchor.href = isDirectory(item) ? api.archiveUrl(path) : api.fileUrl(path)
  anchor.download = isDirectory(item) ? `${baseName(item.name)}.zip` : baseName(item.name)
  anchor.click()
}

async function copyLink(item: PathItem): Promise<void> {
  const path = joinPath(currentPath.value, item.name)
  const url = new URL(isDirectory(item) ? api.pathUrl(path, true) : api.fileUrl(path), location.origin)
  await navigator.clipboard.writeText(url.toString())
  ElMessage.success('链接已复制')
}

async function rename(item: PathItem): Promise<void> {
  if (!canRename.value) return
  try {
    const { value } = await ElMessageBox.prompt('请输入新名称', t('action.rename'), {
      inputValue: baseName(item.name),
      confirmButtonText: '保存',
      cancelButtonText: t('action.cancel'),
      inputPattern: /^(?!\.?\.?$)[^\\/:*?"<>|]+$/,
      inputErrorMessage: '名称不能包含 \\ / : * ? " < > |',
    })
    const source = joinPath(currentPath.value, item.name)
    const destination = joinPath(parentPath(source), value.trim())
    if (await api.exists(destination)) throw new Error('目标位置已存在同名文件')
    await api.move(source, destination)
    ElMessage.success('重命名成功')
    await load()
  } catch (reason) {
    if (reason === 'cancel' || reason === 'close') return
    ElMessage.error(reason instanceof Error ? reason.message : '重命名失败')
  }
}

async function remove(items: PathItem[]): Promise<void> {
  if (!files.permissions.remove || items.length === 0) return
  try {
    await ElMessageBox.confirm(
      items.length === 1 ? `确定永久删除“${baseName(items[0].name)}”吗？` : `确定永久删除选中的 ${items.length} 项吗？`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: t('action.cancel') },
    )
    for (const item of items) await api.remove(joinPath(currentPath.value, item.name))
    ElMessage.success('删除成功')
    await load()
  } catch (reason) {
    if (reason === 'cancel' || reason === 'close') return
    ElMessage.error(reason instanceof Error ? reason.message : '删除失败')
  }
}

function runSearch(): void {
  const query = searchText.value.trim()
  void router.replace({ query: query ? { q: query } : {} })
}

function goUp(): void {
  void router.push({ name: 'files', params: { path: parentPath(currentPath.value) } })
}

function toggleSort(field: SortField): void {
  if (preferences.sortField === field) preferences.sortOrder = preferences.sortOrder === 'asc' ? 'desc' : 'asc'
  else {
    preferences.sortField = field
    preferences.sortOrder = 'asc'
  }
}

async function handleDrop(event: DragEvent): Promise<void> {
  dropActive.value = false
  if (!files.permissions.upload || !event.dataTransfer) return
  const dropped = await filesFromDataTransfer(event.dataTransfer)
  if (dropped.length) uploads.addFiles(dropped, currentPath.value, files.permissions.remove)
}

function keyboard(event: KeyboardEvent): void {
  if ((event.target as HTMLElement).matches('input, textarea, [contenteditable="true"]')) return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
    event.preventDefault()
    selected.value = new Set(sortedItems.value.map((item) => item.name))
  }
  if (event.key === 'Enter' && selectedItems.value.length === 1) open(selectedItems.value[0])
  if (event.key === 'Delete' && files.permissions.remove) void remove(selectedItems.value)
  if (event.key === 'F2' && selectedItems.value.length === 1) void rename(selectedItems.value[0])
}

function startAutoRefresh(): void {
  if (refreshTimer !== null) window.clearInterval(refreshTimer)
  refreshTimer = window.setInterval(() => {
    if (preferences.autoRefresh && document.visibilityState === 'visible' && !files.loading) void files.load()
  }, 30_000)
}

watch(() => [props.path, route.query.q], () => void load(), { immediate: true })
watch(() => preferences.autoRefresh, startAutoRefresh)
onMounted(() => {
  window.addEventListener('keydown', keyboard)
  startAutoRefresh()
  void nextTick(() => document.querySelector<HTMLElement>('.explorer-surface')?.focus())
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', keyboard)
  if (refreshTimer !== null) window.clearInterval(refreshTimer)
})
</script>

<template>
  <section
    class="explorer-view"
    :class="{ 'drop-active': dropActive }"
    @dragenter.prevent="dropActive = files.permissions.upload"
    @dragover.prevent
    @dragleave.self="dropActive = false"
    @drop.prevent="handleDrop"
  >
    <header class="page-header compact-header">
      <div>
        <p class="eyebrow">文件资源管理器</p>
        <h1>{{ currentPath ? baseName(currentPath) : t('explorer.title') }}</h1>
      </div>
      <div v-if="selected.size" class="selection-summary">
        <Check :size="16" />{{ t('explorer.selected', { count: selected.size }) }}
      </div>
    </header>

    <div class="explorer-toolbar">
      <el-button-group>
        <el-button :icon="ArrowLeft" title="后退" @click="router.back()" />
        <el-button :icon="ArrowUp" :disabled="!currentPath" :title="t('explorer.up')" @click="goUp" />
        <el-button :icon="RefreshCw" :loading="files.loading" :title="t('action.refresh')" @click="load" />
      </el-button-group>

      <nav class="breadcrumbs" aria-label="当前位置">
        <template v-for="(crumb, index) in breadcrumbs" :key="crumb.path">
          <button type="button" @click="router.push({ name: 'files', params: { path: crumb.path } })">{{ crumb.label }}</button>
          <span v-if="index < breadcrumbs.length - 1">/</span>
        </template>
      </nav>

      <form class="directory-search" @submit.prevent="runSearch">
        <Search :size="16" />
        <input v-model="searchText" :disabled="!files.permissions.search" :placeholder="t('explorer.searchPlaceholder')" />
      </form>

      <button class="icon-button desktop-action" type="button" :class="{ active: treeVisible }" title="目录树" @click="treeVisible = !treeVisible">
        <PanelLeft :size="18" />
      </button>

      <el-dropdown trigger="click">
        <button class="view-selector" type="button"><List v-if="viewMode === 'details' || viewMode === 'list'" :size="18" /><Grid2X2 v-else :size="18" /><ChevronDown :size="14" /></button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="mode in (['extra-large', 'large', 'medium', 'small', 'list', 'details'] as ViewMode[])" :key="mode" @click="viewMode = mode">
              <span class="view-option"><Check :class="{ invisible: viewMode !== mode }" :size="15" />{{ t(`explorer.views.${mode}`) }}</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <div class="explorer-layout">
      <aside v-if="treeVisible" class="tree-panel"><DirectoryTree /></aside>
      <div
        class="explorer-surface"
        tabindex="-1"
        @click.self="selected = new Set()"
        @contextmenu.prevent.self="showContext(null, $event)"
      >
        <el-skeleton v-if="files.loading && !files.items.length" :rows="8" animated />
        <el-alert v-else-if="files.error" type="error" :title="files.error" show-icon :closable="false">
          <template #default><el-button size="small" @click="load">重试</el-button></template>
        </el-alert>
        <el-empty
          v-else-if="!sortedItems.length"
          :description="files.search ? t('explorer.noResults') : t('explorer.empty')"
        />
        <FileDetailsTable
          v-else-if="viewMode === 'details'"
          :items="sortedItems"
          :selected="selected"
          :sort-field="preferences.sortField"
          :sort-order="preferences.sortOrder"
          @open="open"
          @select="select"
          @context="showContext"
          @sort="toggleSort"
        />
        <FileGrid
          v-else
          :items="sortedItems"
          :directory="currentPath"
          :mode="viewMode"
          :selected="selected"
          @open="open"
          @select="select"
          @context="showContext"
        />
      </div>
    </div>

    <div v-if="dropActive" class="drop-overlay"><Upload :size="36" /><strong>释放鼠标以上传到当前文件夹</strong></div>

    <ContextMenu
      v-if="context"
      :x="context.x"
      :y="context.y"
      :actions="contextActions"
      @select="handleContext"
      @close="context = null"
    />

    <el-dialog v-model="propertyOpen" title="文件属性" width="min(460px, 90vw)">
      <dl v-if="propertyItem" class="property-list">
        <dt>名称</dt><dd>{{ baseName(propertyItem.name) }}</dd>
        <dt>类型</dt><dd>{{ fileTypeLabel(propertyItem) }}</dd>
        <dt>{{ isDirectory(propertyItem) ? '包含项目' : '大小' }}</dt><dd>{{ isDirectory(propertyItem) ? `${propertyItem.size} 项` : formatBytes(propertyItem.size) }}</dd>
        <dt>修改日期</dt><dd>{{ formatDate(propertyItem.mtime) }}</dd>
        <dt>位置</dt><dd>{{ joinPath(currentPath, propertyItem.name) || '/' }}</dd>
      </dl>
    </el-dialog>
  </section>
</template>
