<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { Clock3, Trash2 } from '@lucide/vue'
import RecentFiles from '@/components/RecentFiles.vue'
import { clearRecentViewed, getRecentViewed, removeRecentViewed } from '@/services/recentDb'
import { usePreviewStore } from '@/stores/preview'
import type { RecentListItem, RecentViewedFile } from '@/types'
import { categoryOf, parentPath } from '@/utils/files'

const router = useRouter()
const preview = usePreviewStore()
const records = ref<RecentViewedFile[]>([])
const items = ref<RecentListItem[]>([])

async function load(): Promise<void> {
  records.value = await getRecentViewed(100)
  items.value = records.value.map((item) => ({ ...item, time: item.viewedAt, category: categoryOf(item.name) }))
}

function open(item: RecentListItem): void {
  preview.open({ name: item.name, fullPath: item.path, path_type: 'File', size: item.size, mtime: item.time })
}

function locate(item: RecentListItem): void {
  void router.push({ name: 'files', params: { path: parentPath(item.path) } })
}

async function remove(item: RecentListItem): Promise<void> {
  await removeRecentViewed(item.path)
  await load()
}

async function clear(): Promise<void> {
  await ElMessageBox.confirm('确定清空此浏览器的最近查看历史吗？', '清空历史', { type: 'warning', confirmButtonText: '清空', cancelButtonText: '取消' })
  await clearRecentViewed()
  await load()
}

onMounted(() => void load())
</script>

<template>
  <section class="simple-page">
    <header class="page-header">
      <div><p class="eyebrow">保存在此浏览器</p><h1><Clock3 :size="26" />最近看过</h1><p>只有成功打开过的文件会出现在这里，不会向服务器上传浏览历史。</p></div>
      <el-button :icon="Trash2" :disabled="!items.length" @click="clear">清空历史</el-button>
    </header>
    <div class="dashboard-card spacious-card">
      <RecentFiles :items="items" removable empty-text="还没有查看过文件" @open="open" @locate="locate" @remove="remove" />
    </div>
  </section>
</template>
