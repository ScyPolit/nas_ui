<script setup lang="ts">
import type { LoadFunction } from 'element-plus'
import { useRouter } from 'vue-router'
import { api } from '@/api/dufs'
import { isDirectory, joinPath } from '@/utils/files'

interface TreeItem {
  label: string
  path: string
  leaf: boolean
}

const router = useRouter()

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
  void router.push({ name: 'files', params: { path: data.path } })
}
</script>

<template>
  <el-tree
    class="directory-tree"
    lazy
    :load="load"
    node-key="path"
    :props="{ label: 'label', isLeaf: 'leaf' }"
    @node-click="open"
  >
    <template #default="{ data }">
      <span class="tree-node"><span class="folder-glyph small">◆</span>{{ data.label }}</span>
    </template>
  </el-tree>
</template>
