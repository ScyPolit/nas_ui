<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import { marked } from 'marked'

const props = defineProps<{ src: string; kind: 'markdown' | 'json' | 'code' | 'text'; fileName: string; fileSize: number }>()
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('css', css)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('python', python)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('xml', xml)
const loading = ref(true)
const error = ref<string | null>(null)
const text = ref('')
const truncated = ref(false)
let controller: AbortController | null = null

const rendered = computed(() => {
  if (props.kind === 'markdown') {
    return DOMPurify.sanitize(marked.parse(text.value, { async: false }) as string, {
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'style'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick'],
    })
  }
  let content = text.value
  if (props.kind === 'json') {
    try {
      content = JSON.stringify(JSON.parse(content), null, 2)
    } catch {
      // Invalid JSON is still useful as plain text.
    }
  }
  return hljs.highlightAuto(content).value
})

async function load(): Promise<void> {
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  error.value = null
  text.value = ''
  try {
    const response = await fetch(props.src, {
      signal: controller.signal,
      headers: props.fileSize > 2 * 1024 * 1024 ? { Range: 'bytes=0-2097151' } : undefined,
      cache: 'no-store',
    })
    if (!response.ok && response.status !== 206) throw new Error(`HTTP ${response.status}`)
    text.value = await response.text()
    truncated.value = props.fileSize > 2 * 1024 * 1024
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === 'AbortError') return
    error.value = '文本内容加载失败'
  } finally {
    loading.value = false
  }
}

async function copy(): Promise<void> {
  await navigator.clipboard.writeText(text.value)
}

watch(() => props.src, () => void load(), { immediate: true })
onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <div v-loading="loading" class="text-preview">
    <div v-if="!error" class="preview-subtoolbar">
      <span v-if="truncated" class="preview-limit-note">文件较大，仅显示前 2 MB</span>
      <span v-else />
      <el-button size="small" @click="copy">复制文本</el-button>
    </div>
    <el-result v-if="error" icon="warning" title="加载失败" :sub-title="error" />
    <article v-else-if="kind === 'markdown'" class="markdown-body" v-html="rendered" />
    <pre v-else class="code-preview"><code v-html="rendered" /></pre>
  </div>
</template>
