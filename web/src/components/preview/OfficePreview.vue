<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import { readSheet } from 'read-excel-file/browser'
import { renderAsync } from 'docx-preview'

const props = defineProps<{ src: string; kind: 'docx' | 'xlsx' }>()
const loading = ref(true)
const error = ref<string | null>(null)
const docxContainer = ref<HTMLElement | null>(null)
const spreadsheetRows = ref<unknown[][]>([])
let controller: AbortController | null = null

async function load(): Promise<void> {
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  error.value = null
  spreadsheetRows.value = []
  if (docxContainer.value) docxContainer.value.replaceChildren()
  try {
    const response = await fetch(props.src, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const blob = await response.blob()
    if (props.kind === 'docx') {
      await nextTick()
      if (!docxContainer.value) return
      await renderAsync(blob, docxContainer.value, undefined, {
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        renderHeaders: true,
        renderFooters: true,
      })
      sanitizeDocx(docxContainer.value)
    } else {
      spreadsheetRows.value = (await readSheet(blob)).slice(0, 1000)
    }
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === 'AbortError') return
    error.value = 'Office 文档预览失败，请下载后使用桌面应用查看。'
  } finally {
    loading.value = false
  }
}

function sanitizeDocx(container: HTMLElement): void {
  const sanitized = DOMPurify.sanitize(container.innerHTML, {
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
  })
  container.innerHTML = sanitized
}

watch(() => [props.src, props.kind], () => void load(), { immediate: true })
onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <div v-loading="loading" class="office-preview">
    <el-result v-if="error" icon="warning" title="无法预览" :sub-title="error" />
    <div v-show="kind === 'docx' && !error" ref="docxContainer" class="docx-container" />
    <div v-if="kind === 'xlsx' && !error" class="sheet-wrap">
      <table class="sheet-table">
        <tbody>
          <tr v-for="(row, rowIndex) in spreadsheetRows" :key="rowIndex">
            <td v-for="(cell, columnIndex) in row" :key="columnIndex">{{ cell }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="spreadsheetRows.length >= 1000" class="preview-limit-note">为保证性能，仅显示前 1,000 行。</p>
    </div>
  </div>
</template>
