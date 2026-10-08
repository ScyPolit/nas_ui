<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowRight, Folder, FolderOpen, UploadCloud } from '@lucide/vue'
import { api } from '@/api/dufs'
import RecentFiles from '@/components/RecentFiles.vue'
import StorageOverview from '@/components/StorageOverview.vue'
import { t } from '@/locales/zh-CN'
import { filesFromDataTransfer } from '@/services/dropFiles'
import { getRecentViewed, removeRecentViewed } from '@/services/recentDb'
import { useFilesStore } from '@/stores/files'
import { usePreviewStore, type PreviewEntry } from '@/stores/preview'
import { useUploadsStore } from '@/stores/uploads'
import type { IndexData, RecentListItem, RecentViewedFile, StorageSnapshot } from '@/types'
import { categoryOf, joinPath, parentPath } from '@/utils/files'

const router = useRouter()
const filesStore = useFilesStore()
const preview = usePreviewStore()
const uploads = useUploadsStore()
const storage = ref<StorageSnapshot | null>(null)
const storageLoading = ref(true)
const storageError = ref<string | null>(null)
const rootData = ref<IndexData | null>(null)
const recentViewed = ref<RecentViewedFile[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const folderInput = ref<HTMLInputElement | null>(null)
const dropActive = ref(false)
let refreshTimer: number | null = null
let scanPollTimer: number | null = null

const folders = computed(() => rootData.value?.paths.filter((item) => item.path_type.endsWith('Dir')).slice(0, 10) ?? [])
const recentViewedList = computed<RecentListItem[]>(() => recentViewed.value.slice(0, 8).map((item) => ({
  path: item.path,
  name: item.name,
  parent: item.parent,
  size: item.size,
  time: item.viewedAt,
  category: categoryOf(item.name),
})))
const recentSavedList = computed<RecentListItem[]>(() => (storage.value?.shared.recent_files ?? []).slice(0, 8).map((item) => ({
  path: item.path,
  name: item.name,
  parent: item.parent,
  size: item.size,
  time: item.mtime,
  category: item.category,
})))
const canUpload = computed(() => rootData.value?.allow_upload ?? filesStore.data.allow_upload)
const canOverwrite = computed(() => rootData.value?.allow_delete ?? filesStore.data.allow_delete)

async function loadStorage(force = false): Promise<void> {
  storageLoading.value = !storage.value
  storageError.value = null
  try {
    storage.value = await api.storage(force)
    if (storage.value.status === 'scanning') scheduleScanPoll()
  } catch (reason) {
    storageError.value = reason instanceof Error ? reason.message : '无法读取存储信息'
  } finally {
    storageLoading.value = false
  }
}

function scheduleScanPoll(): void {
  if (scanPollTimer !== null) window.clearTimeout(scanPollTimer)
  scanPollTimer = window.setTimeout(() => void loadStorage(), 1500)
}

async function loadPage(): Promise<void> {
  const [root, viewed] = await Promise.allSettled([api.list(''), getRecentViewed(12)])
  if (root.status === 'fulfilled') {
    rootData.value = root.value
    filesStore.data = root.value
  }
  if (viewed.status === 'fulfilled') recentViewed.value = viewed.value
  await loadStorage()
}

function toPreview(item: RecentListItem): PreviewEntry {
  return { name: item.name, fullPath: item.path, path_type: 'File', size: item.size, mtime: item.time }
}

async function openRecent(item: RecentListItem, viewed = false): Promise<void> {
  try {
    if (!(await api.exists(item.path))) {
      if (viewed) {
        await removeRecentViewed(item.path)
        recentViewed.value = recentViewed.value.filter((entry) => entry.path !== item.path)
      }
      ElMessage.warning('文件已被移动或删除')
      return
    }
    preview.open(toPreview(item))
  } catch (reason) {
    ElMessage.error(reason instanceof Error ? reason.message : '无法打开文件')
  }
}

function locate(item: RecentListItem): void {
  void router.push({ name: 'files', params: { path: parentPath(item.path) } })
}

async function removeViewed(item: RecentListItem): Promise<void> {
  await removeRecentViewed(item.path)
  recentViewed.value = recentViewed.value.filter((entry) => entry.path !== item.path)
}

function collectFiles(event: Event): void {
  const input = event.target as HTMLInputElement
  if (input.files?.length) uploads.addFiles([...input.files], '', canOverwrite.value)
  input.value = ''
}

async function drop(event: DragEvent): Promise<void> {
  dropActive.value = false
  if (!canUpload.value || !event.dataTransfer) return
  const dropped = await filesFromDataTransfer(event.dataTransfer)
  if (dropped.length) uploads.addFiles(dropped, '', canOverwrite.value)
}

onMounted(() => {
  void loadPage()
  refreshTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void loadStorage()
  }, 45_000)
})
onBeforeUnmount(() => {
  if (refreshTimer !== null) window.clearInterval(refreshTimer)
  if (scanPollTimer !== null) window.clearTimeout(scanPollTimer)
})
</script>

<template>
  <section class="dashboard-view">
    <header class="dashboard-hero">
      <div>
        <p class="eyebrow">局域网文件空间</p>
        <h1>{{ t('home.title') }}</h1>
        <p>{{ t('home.description') }}</p>
      </div>
      <el-button type="primary" size="large" :icon="FolderOpen" @click="router.push({ name: 'files', params: { path: '' } })">
        {{ t('home.allFiles') }}
      </el-button>
    </header>

    <el-alert v-if="storageError" type="error" :title="storageError" show-icon :closable="false" />
    <StorageOverview :value="storage" :loading="storageLoading" @refresh="loadStorage(true)" />

    <div class="dashboard-grid recent-grid">
      <section class="dashboard-card">
        <header class="card-heading"><div><p class="eyebrow">此浏览器的历史</p><h2>{{ t('home.recentViewed') }}</h2></div><el-button text @click="router.push({ name: 'recent-viewed' })">{{ t('home.viewAll') }}</el-button></header>
        <RecentFiles :items="recentViewedList" removable empty-text="打开或预览文件后会显示在这里" @open="openRecent($event, true)" @locate="locate" @remove="removeViewed" />
      </section>
      <section class="dashboard-card">
        <header class="card-heading"><div><p class="eyebrow">服务器真实元数据</p><h2>{{ t('home.recentSaved') }}</h2></div><el-button text @click="router.push({ name: 'recent-saved' })">{{ t('home.viewAll') }}</el-button></header>
        <RecentFiles :items="recentSavedList" empty-text="统计完成后显示最近修改的文件" @open="openRecent" @locate="locate" />
      </section>
    </div>

    <div class="dashboard-grid action-grid">
      <section
        class="dashboard-card upload-dropzone"
        :class="{ active: dropActive, disabled: !canUpload }"
        @dragenter.prevent="dropActive = canUpload"
        @dragover.prevent
        @dragleave.self="dropActive = false"
        @drop.prevent="drop"
      >
        <span class="upload-orb"><UploadCloud :size="30" /></span>
        <h2>{{ t('home.dropTitle') }}</h2>
        <p>{{ canUpload ? t('home.dropHint') : '服务器未开放上传权限' }}</p>
        <div v-if="canUpload" class="drop-actions">
          <el-button type="primary" plain @click="fileInput?.click()">选择文件</el-button>
          <el-button @click="folderInput?.click()">选择文件夹</el-button>
        </div>
      </section>

      <section class="dashboard-card folder-shortcuts">
        <header class="card-heading"><div><p class="eyebrow">共享根目录</p><h2>{{ t('home.folders') }}</h2><span>{{ t('home.foldersHint') }}</span></div><el-button text @click="router.push({ name: 'files', params: { path: '' } })">全部 <ArrowRight :size="15" /></el-button></header>
        <div v-if="folders.length" class="folder-grid">
          <button v-for="folder in folders" :key="folder.name" type="button" @click="router.push({ name: 'files', params: { path: joinPath(folder.name) } })">
            <span class="folder-card-icon"><Folder :size="23" /></span><span><strong>{{ folder.name }}</strong><small>{{ folder.size }} 个项目</small></span>
          </button>
        </div>
        <el-empty v-else :image-size="70" description="共享根目录中还没有文件夹" />
      </section>
    </div>

    <input ref="fileInput" class="visually-hidden" type="file" multiple @change="collectFiles" />
    <input ref="folderInput" class="visually-hidden" type="file" multiple webkitdirectory @change="collectFiles" />
  </section>
</template>
