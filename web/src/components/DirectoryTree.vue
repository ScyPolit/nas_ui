<script setup lang="ts">
import type { LoadFunction } from 'element-plus'
import { api } from '@/api/dufs'
import { isDirectory, joinPath } from '@/utils/files'

interface TreeItem {
  label: string
  path: string
  leaf: boolean
}

defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ navigate: [path: string, label: string] }>()

const load: LoadFunction = async (node, resolve) => {
  const path = node.level === 0 ? '' : (node.data as TreeItem).path
  try {
    const data = await api.list(path)
    resolve(
      data.paths
        .filter(isDirectory)
        .map((item) => ({ label: item.name, path: joinPath(path, item.name), leaf: false } satisfies TreeItem)),
    )
  } catch {
    resolve([])
  }
}

function open(data: TreeItem): void {
  emit('navigate', data.path, data.label)
}
</script>

<template>
  <el-tree
    class="directory-tree"
    lazy
    :load="load"
    :class="{ disabled }"
    node-key="path"
    :props="{ label: 'label', isLeaf: 'leaf' }"
    @node-click="disabled ? undefined : open($event)"
  >
    <template #default="{ data }">
      <span class="tree-node"><span class="folder-glyph small">◆</span>{{ data.label }}</span>
    </template>
  </el-tree>
</template>
