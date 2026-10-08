<script setup lang="ts">
import type { Component } from 'vue'
import { Archive, File, FileCode2, FileText, Folder, Image, Music, Video } from '@lucide/vue'
import { api } from '@/api/dufs'
import { usePreferencesStore } from '@/stores/preferences'
import type { PathItem, ViewMode } from '@/types'
import { categoryOf, displayName, extensionOf, isDirectory, joinPath } from '@/utils/files'
import { formatBytes, formatDate } from '@/utils/format'

const props = defineProps<{
  items: PathItem[]
  directory: string
  mode: Exclude<ViewMode, 'details'>
  selected: Set<string>
}>()
const emit = defineEmits<{
  open: [item: PathItem]
  select: [item: PathItem, index: number, event: MouseEvent]
  context: [item: PathItem, event: MouseEvent]
}>()
const preferences = usePreferencesStore()

function iconFor(item: PathItem): Component {
  if (isDirectory(item)) return Folder
  const category = categoryOf(item.name)
  if (category === 'image') return Image
  if (category === 'video') return Video
  if (category === 'audio') return Music
  if (category === 'archive') return Archive
  if (['js', 'ts', 'tsx', 'jsx', 'vue', 'rs', 'py', 'go', 'java', 'html', 'css'].includes(extensionOf(item.name))) return FileCode2
  if (category === 'document') return FileText
  return File
}

function thumbnail(item: PathItem): string {
  const dimension = props.mode === 'extra-large' ? 320 : props.mode === 'large' ? 240 : 160
  return api.fileUrl(joinPath(props.directory, item.name), { thumbnail: dimension, version: item.mtime })
}
</script>

<template>
  <div class="file-grid" :class="`view-${mode}`" role="grid" @contextmenu.prevent>
    <article
      v-for="(item, index) in items"
      :key="item.name"
      class="file-tile"
      :class="{ selected: selected.has(item.name), directory: isDirectory(item) }"
      role="gridcell"
      tabindex="0"
      @click="emit('select', item, index, $event)"
      @dblclick="emit('open', item)"
      @keydown.enter="emit('open', item)"
      @contextmenu.prevent.stop="emit('context', item, $event)"
    >
      <div class="file-visual">
        <img
          v-if="preferences.showThumbnails && categoryOf(item.name) === 'image' && !isDirectory(item)"
          :src="thumbnail(item)"
          :alt="item.name"
          loading="lazy"
          decoding="async"
        />
        <component :is="iconFor(item)" v-else class="file-icon" :stroke-width="1.45" />
      </div>
      <div class="file-label">
        <strong :title="item.name">{{ displayName(item.name, preferences.showExtensions) }}</strong>
        <span v-if="mode === 'list' || mode === 'small'">
          {{ isDirectory(item) ? `${item.size} 项` : formatBytes(item.size) }}
        </span>
        <span v-else-if="mode === 'extra-large' || mode === 'large'">{{ formatDate(item.mtime, false) }}</span>
      </div>
    </article>
  </div>
</template>
