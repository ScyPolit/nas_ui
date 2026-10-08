<script setup lang="ts">
import { Archive, File, FileText, Image, Music, Video, X } from '@lucide/vue'
import type { Component } from 'vue'
import type { FileCategory, RecentListItem } from '@/types'
import { formatBytes, formatDate } from '@/utils/format'

defineProps<{ items: RecentListItem[]; removable?: boolean; emptyText?: string }>()
const emit = defineEmits<{ open: [item: RecentListItem]; locate: [item: RecentListItem]; remove: [item: RecentListItem] }>()

function iconFor(category: FileCategory | undefined): Component {
  if (category === 'image') return Image
  if (category === 'video') return Video
  if (category === 'audio') return Music
  if (category === 'document') return FileText
  if (category === 'archive') return Archive
  return File
}
</script>

<template>
  <div v-if="items.length" class="recent-list">
    <article v-for="item in items" :key="item.path" class="recent-item" @dblclick="emit('open', item)">
      <button class="recent-main" type="button" @click="emit('open', item)">
        <span class="recent-icon"><component :is="iconFor(item.category)" :size="21" /></span>
        <span class="recent-copy"><strong :title="item.name">{{ item.name }}</strong><small>{{ item.parent || '/' }} · {{ formatBytes(item.size) }}</small></span>
      </button>
      <time>{{ formatDate(item.time) }}</time>
      <button class="locate-button" type="button" title="打开所在位置" @click="emit('locate', item)">定位</button>
      <button v-if="removable" class="icon-button compact" type="button" title="移除记录" @click="emit('remove', item)"><X :size="14" /></button>
    </article>
  </div>
  <el-empty v-else :image-size="72" :description="emptyText ?? '暂无最近文件'" />
</template>
