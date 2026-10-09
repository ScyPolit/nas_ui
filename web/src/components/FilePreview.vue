<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { Download, Info, Maximize, RotateCw, ZoomIn, ZoomOut } from '@lucide/vue'
import { ElMessage } from 'element-plus'
import { api } from '@/api/dufs'
import { usePreviewStore } from '@/stores/preview'
import { fileTypeLabel, previewKind } from '@/utils/files'
import { formatBytes, formatDate } from '@/utils/format'

const PdfPreview = defineAsyncComponent(() => import('@/components/preview/PdfPreview.vue'))
const TextPreview = defineAsyncComponent(() => import('@/components/preview/TextPreview.vue'))
const OfficePreview = defineAsyncComponent(() => import('@/components/preview/OfficePreview.vue'))

const preview = usePreviewStore()
const rotation = ref(0)
const imageScale = ref(1)
const imageFit = ref(true)
const showInfo = ref(false)
const currentKind = computed(() => (preview.current ? previewKind(preview.current.name) : 'unknown'))
const source = computed(() => (preview.current ? api.fileUrl(preview.current.fullPath) : ''))
const downloadUrl = computed(() => (preview.current ? api.fileUrl(preview.current.fullPath) : ''))
const isTooLargeForDocumentPreview = computed(() => {
  if (!preview.current) return false
  return ['docx', 'xlsx'].includes(currentKind.value) && preview.current.size > 25 * 1024 * 1024
})

watch(
  () => preview.current?.fullPath,
  () => {
    rotation.value = 0
    imageScale.value = 1
    imageFit.value = true
    showInfo.value = false
  },
)

async function toggleFullscreen(): Promise<void> {
  const element = document.querySelector('.file-preview-dialog')
  if (!element) return
  try {
    if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
      await document.exitFullscreen()
    } else if (typeof element.requestFullscreen === 'function') {
      await element.requestFullscreen()
    } else {
      throw new Error('当前浏览器不支持全屏预览')
    }
  } catch (reason) {
    ElMessage.warning(reason instanceof Error ? reason.message : '无法进入全屏预览')
  }
}
</script>

<template>
  <el-dialog
    v-model="preview.visible"
    class="file-preview-dialog"
    width="min(1180px, 94vw)"
    destroy-on-close
    append-to-body
    :close-on-click-modal="false"
  >
    <template #header>
      <div class="preview-header">
        <div class="preview-heading">
          <strong>{{ preview.current?.name }}</strong>
          <span>{{ preview.current ? fileTypeLabel(preview.current) : '' }}</span>
        </div>
        <div class="preview-actions">
          <template v-if="currentKind === 'image'">
            <button class="icon-button" title="缩小" @click="imageScale = Math.max(0.2, imageScale - 0.2)"><ZoomOut :size="18" /></button>
            <button class="icon-button" title="放大" @click="imageScale = Math.min(5, imageScale + 0.2)"><ZoomIn :size="18" /></button>
            <button class="icon-button" title="旋转" @click="rotation += 90"><RotateCw :size="18" /></button>
          </template>
          <button class="icon-button" title="文件信息" @click="showInfo = !showInfo"><Info :size="18" /></button>
          <button class="icon-button" title="全屏" @click="toggleFullscreen"><Maximize :size="18" /></button>
          <a class="icon-button" :href="downloadUrl" :download="preview.current?.name" title="下载"><Download :size="18" /></a>
        </div>
      </div>
    </template>

    <div v-if="preview.current" class="preview-stage">
      <div class="preview-content">
        <div v-if="currentKind === 'image'" class="image-preview" @dblclick="imageFit = !imageFit">
          <img
            :src="source"
            :alt="preview.current.name"
            :class="{ fit: imageFit }"
            :style="{ transform: `rotate(${rotation}deg) scale(${imageScale})` }"
          />
        </div>
        <PdfPreview v-else-if="currentKind === 'pdf'" :src="source" />
        <video v-else-if="currentKind === 'video'" class="media-preview" :src="source" controls autoplay />
        <div v-else-if="currentKind === 'audio'" class="audio-preview">
          <div class="audio-art">♫</div>
          <strong>{{ preview.current.name }}</strong>
          <audio :src="source" controls autoplay />
        </div>
        <TextPreview
          v-else-if="['markdown', 'json', 'code', 'text'].includes(currentKind)"
          :key="preview.current.fullPath"
          :src="source"
          :kind="currentKind as 'markdown' | 'json' | 'code' | 'text'"
          :file-name="preview.current.name"
          :file-size="preview.current.size"
        />
        <OfficePreview
          v-else-if="['docx', 'xlsx'].includes(currentKind) && !isTooLargeForDocumentPreview"
          :key="preview.current.fullPath"
          :src="source"
          :kind="currentKind as 'docx' | 'xlsx'"
        />
        <el-result
          v-else
          icon="info"
          :title="isTooLargeForDocumentPreview ? '文件过大，未在浏览器中打开' : '暂不支持预览此文件类型'"
          sub-title="你仍然可以安全地下载原文件。"
        >
          <template #extra>
            <el-button tag="a" type="primary" :href="downloadUrl" :download="preview.current.name">下载文件</el-button>
          </template>
        </el-result>
      </div>

      <aside v-if="showInfo" class="preview-info">
        <h3>文件属性</h3>
        <dl>
          <dt>名称</dt><dd>{{ preview.current.name }}</dd>
          <dt>类型</dt><dd>{{ fileTypeLabel(preview.current) }}</dd>
          <dt>大小</dt><dd>{{ formatBytes(preview.current.size) }}</dd>
          <dt>修改日期</dt><dd>{{ formatDate(preview.current.mtime) }}</dd>
          <dt>位置</dt><dd>{{ preview.current.fullPath }}</dd>
        </dl>
      </aside>
    </div>

    <template #footer>
      <div class="preview-footer">
        <el-button :disabled="!preview.hasPrevious" @click="preview.previous">上一项</el-button>
        <span>{{ preview.index + 1 }} / {{ preview.entries.length }}</span>
        <el-button :disabled="!preview.hasNext" @click="preview.next">下一项</el-button>
      </div>
    </template>
  </el-dialog>
</template>
