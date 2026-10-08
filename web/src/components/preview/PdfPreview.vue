<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from '@lucide/vue'
import * as pdfjs from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

const props = defineProps<{ src: string }>()
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

const canvas = ref<HTMLCanvasElement | null>(null)
const loading = ref(true)
const pageNumber = ref(1)
const pageCount = ref(0)
const scale = ref(1.15)
let documentTask: ReturnType<typeof pdfjs.getDocument> | null = null
let document: pdfjs.PDFDocumentProxy | null = null
let renderTask: pdfjs.RenderTask | null = null

async function load(): Promise<void> {
  await cleanup()
  loading.value = true
  pageNumber.value = 1
  try {
    documentTask = pdfjs.getDocument({ url: props.src })
    document = await documentTask.promise
    pageCount.value = document.numPages
    await nextTick()
    await render()
  } catch (error) {
    if ((error as { name?: string }).name !== 'RenderingCancelledException') {
      ElMessage.error('PDF 加载失败')
    }
  } finally {
    loading.value = false
  }
}

async function render(): Promise<void> {
  if (!document || !canvas.value) return
  renderTask?.cancel()
  const page = await document.getPage(pageNumber.value)
  const viewport = page.getViewport({ scale: scale.value })
  const context = canvas.value.getContext('2d')
  if (!context) return
  const ratio = window.devicePixelRatio || 1
  canvas.value.width = Math.floor(viewport.width * ratio)
  canvas.value.height = Math.floor(viewport.height * ratio)
  canvas.value.style.width = `${viewport.width}px`
  canvas.value.style.height = `${viewport.height}px`
  renderTask = page.render({ canvas: canvas.value, canvasContext: context, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] })
  await renderTask.promise
}

async function changePage(offset: number): Promise<void> {
  pageNumber.value = Math.min(Math.max(pageNumber.value + offset, 1), pageCount.value)
  await render()
}

async function zoom(multiplier: number): Promise<void> {
  scale.value = Math.min(Math.max(scale.value * multiplier, 0.5), 3)
  await render()
}

async function cleanup(): Promise<void> {
  renderTask?.cancel()
  renderTask = null
  document = null
  await documentTask?.destroy()
  documentTask = null
}

watch(() => props.src, () => void load(), { immediate: true })
onBeforeUnmount(() => void cleanup())
</script>

<template>
  <div v-loading="loading" class="pdf-preview">
    <div class="preview-subtoolbar">
      <el-button-group>
        <el-button :icon="ChevronLeft" :disabled="pageNumber <= 1" aria-label="上一页" @click="changePage(-1)" />
        <el-button :icon="ChevronRight" :disabled="pageNumber >= pageCount" aria-label="下一页" @click="changePage(1)" />
      </el-button-group>
      <span>第 {{ pageNumber }} / {{ pageCount || '—' }} 页</span>
      <el-button-group>
        <el-button :icon="ZoomOut" aria-label="缩小" @click="zoom(0.85)" />
        <el-button :icon="ZoomIn" aria-label="放大" @click="zoom(1.15)" />
      </el-button-group>
    </div>
    <div class="pdf-canvas-wrap">
      <canvas ref="canvas" />
    </div>
  </div>
</template>
