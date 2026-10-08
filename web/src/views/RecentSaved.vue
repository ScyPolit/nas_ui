<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { FileClock, RefreshCw } from '@lucide/vue'
import { api } from '@/api/dufs'
import RecentFiles from '@/components/RecentFiles.vue'
import { usePreviewStore } from '@/stores/preview'
import type { RecentListItem, StorageSnapshot } from '@/types'
import { parentPath } from '@/utils/files'

const router = useRouter()
const preview = usePreviewStore()
const storage = ref<StorageSnapshot | null>(null)
const loading = ref(true)
let pollTimer: number | null = null

const items = computed(() => (storage.value?.shared.recent_files ?? []).map((item) => ({
  path: item.path,
  name: item.name,
  parent: item.parent,
  size: item.size,
  time: item.mtime,
  category: item.category,
})))

async function load(force = false): Promise<void> {
  loading.value = true
  try {
    storage.value = await api.storage(force)
    if (storage.value.status === 'scanning') {
      if (pollTimer !== null) window.clearTimeout(pollTimer)
      pollTimer = window.setTimeout(() => void load(), 1500)
    }
  } finally {
    loading.value = false
  }
}

function open(item: RecentListItem): void {
  preview.open({ name: item.name, fullPath: item.path, path_type: 'File', size: item.size, mtime: item.time })
}

function locate(item: RecentListItem): void {
  void router.push({ name: 'files', params: { path: parentPath(item.path) } })
}

onMounted(() => void load())
onBeforeUnmount(() => {
  if (pollTimer !== null) window.clearTimeout(pollTimer)
})
</script>

<template>
  <section class="simple-page">
    <header class="page-header">
      <div><p class="eyebrow">来自服务器真实文件元数据</p><h1><FileClock :size="26" />最近保存</h1><p>包含网页上传，以及直接在 Windows 或 Linux 共享目录中新增、修改的文件。</p></div>
      <el-button :icon="RefreshCw" :loading="storage?.status === 'scanning'" @click="load(true)">重新统计</el-button>
    </header>
    <div class="dashboard-card spacious-card" v-loading="loading && !storage">
      <RecentFiles :items="items" empty-text="目录统计完成后会显示最近修改的文件" @open="open" @locate="locate" />
    </div>
  </section>
</template>
