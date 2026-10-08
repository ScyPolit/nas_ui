<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Clock3,
  FileClock,
  Files,
  FolderPlus,
  HardDrive,
  Home,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sun,
  Upload,
} from '@lucide/vue'
import { api } from '@/api/dufs'
import FilePreview from '@/components/FilePreview.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import UploadManager from '@/components/UploadManager.vue'
import { t } from '@/locales/zh-CN'
import { useFilesStore } from '@/stores/files'
import { usePreferencesStore } from '@/stores/preferences'
import { useUploadsStore } from '@/stores/uploads'

const router = useRouter()
const route = useRoute()
const files = useFilesStore()
const preferences = usePreferencesStore()
const uploads = useUploadsStore()
const searchText = ref('')
const settingsOpen = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const folderInput = ref<HTMLInputElement | null>(null)
const mobileNavigationOpen = ref(false)

const navItems = [
  { route: { name: 'home' }, icon: Home, label: t('nav.home') },
  { route: { name: 'files', params: { path: '' } }, icon: Files, label: t('nav.files') },
  { route: { name: 'recent-viewed' }, icon: Clock3, label: t('nav.recentViewed') },
  { route: { name: 'recent-saved' }, icon: FileClock, label: t('nav.recentSaved') },
]

const currentDirectory = computed(() => (route.name === 'files' ? String(route.params.path ?? '') : ''))
const canUpload = computed(() => (route.name === 'files' ? files.permissions.upload : files.data.allow_upload))

function navigate(item: (typeof navItems)[number]): void {
  mobileNavigationOpen.value = false
  void router.push(item.route)
}

function search(): void {
  const query = searchText.value.trim()
  void router.push({
    name: 'files',
    params: { path: currentDirectory.value },
    query: query ? { q: query } : {},
  })
}

function collectFiles(event: Event): void {
  const input = event.target as HTMLInputElement
  if (input.files?.length) uploads.addFiles([...input.files], currentDirectory.value, files.permissions.remove)
  input.value = ''
}

async function createFolder(): Promise<void> {
  if (!canUpload.value) return
  try {
    const { value } = await ElMessageBox.prompt('请输入文件夹名称', t('action.newFolder'), {
      confirmButtonText: '创建',
      cancelButtonText: t('action.cancel'),
      inputPattern: /^(?!\.?\.?$)[^\\/:*?"<>|]+$/,
      inputErrorMessage: '名称不能包含 \\ / : * ? " < > |',
    })
    await api.createFolder(currentDirectory.value, value.trim())
    ElMessage.success('文件夹已创建')
    await files.load()
  } catch (reason) {
    if (reason === 'cancel' || reason === 'close') return
    ElMessage.error(reason instanceof Error ? reason.message : '新建文件夹失败')
  }
}

function toggleTheme(): void {
  preferences.theme = preferences.isDark ? 'light' : 'dark'
}
</script>

<template>
  <div class="app-shell">
    <aside
      class="app-sidebar"
      :class="{
        collapsed: preferences.sidebarCollapsed,
        'mobile-open': mobileNavigationOpen,
      }"
    >
      <div class="brand">
        <span class="brand-mark"><HardDrive :size="21" /></span>
        <div v-if="!preferences.sidebarCollapsed" class="brand-copy">
          <strong>Dufs</strong>
          <span>局域网网盘</span>
        </div>
      </div>

      <nav class="main-nav" aria-label="主导航">
        <button
          v-for="item in navItems"
          :key="String(item.route.name)"
          type="button"
          :class="{ active: route.name === item.route.name }"
          :title="preferences.sidebarCollapsed ? item.label : undefined"
          @click="navigate(item)"
        >
          <component :is="item.icon" :size="19" />
          <span v-if="!preferences.sidebarCollapsed">{{ item.label }}</span>
        </button>
      </nav>

      <button
        class="sidebar-collapse"
        type="button"
        :aria-label="preferences.sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'"
        @click="preferences.sidebarCollapsed = !preferences.sidebarCollapsed"
      >
        <PanelLeftOpen v-if="preferences.sidebarCollapsed" :size="18" />
        <PanelLeftClose v-else :size="18" />
        <span v-if="!preferences.sidebarCollapsed">折叠侧边栏</span>
      </button>
    </aside>

    <div v-if="mobileNavigationOpen" class="mobile-backdrop" @click="mobileNavigationOpen = false" />

    <div class="app-main">
      <header class="topbar">
        <button class="icon-button mobile-menu" type="button" aria-label="打开导航" @click="mobileNavigationOpen = true">
          <Menu :size="20" />
        </button>
        <form class="global-search" role="search" @submit.prevent="search">
          <Search :size="18" />
          <input v-model="searchText" type="search" placeholder="搜索共享文件" aria-label="搜索共享文件" />
          <kbd>Enter</kbd>
        </form>
        <div class="topbar-actions">
          <el-dropdown v-if="canUpload" trigger="click">
            <el-button type="primary" :icon="Upload">{{ t('action.upload') }}</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item :icon="Plus" @click="fileInput?.click()">{{ t('action.uploadFile') }}</el-dropdown-item>
                <el-dropdown-item :icon="FolderPlus" @click="folderInput?.click()">{{ t('action.uploadFolder') }}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <button v-if="canUpload" class="icon-button desktop-action" type="button" :title="t('action.newFolder')" @click="createFolder">
            <FolderPlus :size="19" />
          </button>
          <button class="icon-button" type="button" :title="preferences.isDark ? '切换到浅色' : '切换到深色'" @click="toggleTheme">
            <Sun v-if="preferences.isDark" :size="19" />
            <Moon v-else :size="19" />
          </button>
          <button class="icon-button" type="button" :title="t('action.settings')" @click="settingsOpen = true">
            <Settings :size="19" />
          </button>
        </div>
      </header>

      <main class="content-area">
        <router-view />
      </main>
    </div>

    <input ref="fileInput" class="visually-hidden" type="file" multiple @change="collectFiles" />
    <input ref="folderInput" class="visually-hidden" type="file" multiple webkitdirectory @change="collectFiles" />
    <SettingsPanel v-model="settingsOpen" />
    <UploadManager />
    <FilePreview />
  </div>
</template>
