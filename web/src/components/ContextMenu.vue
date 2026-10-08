<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { Copy, Download, Eye, FolderOpen, Info, Pencil, RefreshCw, Trash2 } from '@lucide/vue'

interface ContextAction {
  key: 'open' | 'preview' | 'download' | 'copy-link' | 'rename' | 'delete' | 'properties' | 'refresh'
  label: string
  danger?: boolean
  disabled?: boolean
}

const props = defineProps<{ x: number; y: number; actions: ContextAction[] }>()
const emit = defineEmits<{ select: [action: ContextAction['key']]; close: [] }>()
const icons = { open: FolderOpen, preview: Eye, download: Download, 'copy-link': Copy, rename: Pencil, delete: Trash2, properties: Info, refresh: RefreshCw }
const position = computed(() => ({
  left: `${Math.min(props.x, window.innerWidth - 210)}px`,
  top: `${Math.min(props.y, window.innerHeight - props.actions.length * 38 - 18)}px`,
}))

function close(event: Event): void {
  if (!(event.target as HTMLElement).closest('.context-menu')) emit('close')
}

onMounted(() => {
  window.addEventListener('pointerdown', close)
  window.addEventListener('blur', () => emit('close'), { once: true })
})
onBeforeUnmount(() => window.removeEventListener('pointerdown', close))
</script>

<template>
  <Teleport to="body">
    <div class="context-menu" :style="position" role="menu" @contextmenu.prevent>
      <button
        v-for="action in actions"
        :key="action.key"
        type="button"
        :class="{ danger: action.danger }"
        :disabled="action.disabled"
        @click="emit('select', action.key)"
      >
        <component :is="icons[action.key]" :size="16" />
        <span>{{ action.label }}</span>
      </button>
    </div>
  </Teleport>
</template>
