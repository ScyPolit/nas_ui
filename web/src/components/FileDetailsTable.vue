<script setup lang="ts">
import { Archive, File, FileCode2, FileText, Folder, Image, Music, Video } from '@lucide/vue'
import { usePreferencesStore } from '@/stores/preferences'
import type { PathItem, SortField, SortOrder } from '@/types'
import { categoryOf, displayName, extensionOf, fileTypeLabel, isDirectory } from '@/utils/files'
import { formatBytes, formatDate } from '@/utils/format'

defineProps<{ items: PathItem[]; selected: Set<string>; sortField: SortField; sortOrder: SortOrder }>()
const emit = defineEmits<{
  open: [item: PathItem]
  select: [item: PathItem, index: number, event: MouseEvent]
  context: [item: PathItem, event: MouseEvent]
  sort: [field: SortField]
}>()
const preferences = usePreferencesStore()

function iconFor(item: PathItem) {
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
</script>

<template>
  <div class="details-table-wrap">
    <table class="details-table">
      <thead>
        <tr>
          <th class="name-column" @click="emit('sort', 'name')">名称 <span v-if="sortField === 'name'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span></th>
          <th @click="emit('sort', 'mtime')">修改日期 <span v-if="sortField === 'mtime'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span></th>
          <th @click="emit('sort', 'type')">类型 <span v-if="sortField === 'type'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span></th>
          <th class="size-column" @click="emit('sort', 'size')">大小 <span v-if="sortField === 'size'">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(item, index) in items"
          :key="item.name"
          :class="{ selected: selected.has(item.name) }"
          tabindex="0"
          @click="emit('select', item, index, $event)"
          @dblclick="emit('open', item)"
          @keydown.enter="emit('open', item)"
          @contextmenu.prevent.stop="emit('context', item, $event)"
        >
          <td class="name-cell"><component :is="iconFor(item)" :size="19" :stroke-width="1.5" /><span>{{ displayName(item.name, preferences.showExtensions) }}</span></td>
          <td>{{ formatDate(item.mtime) }}</td>
          <td>{{ fileTypeLabel(item) }}</td>
          <td>{{ isDirectory(item) ? `${item.size} 项` : formatBytes(item.size) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
