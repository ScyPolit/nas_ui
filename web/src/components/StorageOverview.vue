<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AlertTriangle, CheckCircle2, Clock3, File, Folder, RefreshCw } from '@lucide/vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { init, type ECharts } from 'echarts/core'
import { t } from '@/locales/zh-CN'
import type { FileCategory, StorageSnapshot } from '@/types'
import { formatBytes, formatDate, formatNumber } from '@/utils/format'

use([CanvasRenderer, PieChart, TooltipComponent])

const props = defineProps<{ value: StorageSnapshot | null; loading?: boolean }>()
const emit = defineEmits<{ refresh: [] }>()
const chartElement = ref<HTMLElement | null>(null)
const distributionOpen = ref(false)
let chart: ECharts | null = null
let observer: ResizeObserver | null = null
let themeObserver: MutationObserver | null = null

const usage = computed(() => {
  const disk = props.value?.disk
  return disk && disk.total_bytes > 0 ? Math.round((disk.used_bytes / disk.total_bytes) * 1000) / 10 : null
})
const health = computed(() => {
  if (usage.value === null) return { level: 'unknown', label: '容量数据暂不可用', icon: AlertTriangle }
  if (usage.value >= 90) return { level: 'danger', label: t('storage.danger'), icon: AlertTriangle }
  if (usage.value >= 80) return { level: 'warning', label: t('storage.warning'), icon: AlertTriangle }
  return { level: 'normal', label: t('storage.normal'), icon: CheckCircle2 }
})
const categoryLabels: Record<FileCategory, string> = {
  image: '图片', video: '视频', audio: '音频', document: '文档', archive: '压缩包', other: '其他',
}
const categoryColors: Record<FileCategory, string> = {
  image: '#4f7cf3', video: '#7357d9', audio: '#2da9a0', document: '#5b8def', archive: '#d69b35', other: '#8993a4',
}

function renderChart(): void {
  if (!chartElement.value || !props.value?.disk) return
  chart ??= init(chartElement.value)
  const disk = props.value.disk
  const dark = document.documentElement.classList.contains('dark')
  const usedPercent = disk.total_bytes > 0 ? (disk.used_bytes / disk.total_bytes) * 100 : 0
  const freePercent = Math.max(100 - usedPercent, 0)
  chart.setOption({
    animationDuration: 500,
    tooltip: {
      trigger: 'item',
      formatter: (params: { name: string; percent: number; data: { bytes: number } }) => `${params.name}<br/>${formatBytes(params.data.bytes)}（${params.percent}%）`,
      backgroundColor: dark ? '#25282e' : '#ffffff',
      borderColor: dark ? '#3a3e47' : '#e5e8ee',
      textStyle: { color: dark ? '#f2f4f8' : '#20242c' },
    },
    series: [{
      type: 'pie',
      radius: [72, 91],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      silent: false,
      label: { show: false },
      emphasis: { scaleSize: 5 },
      data: [
        { name: '已使用', value: usedPercent, bytes: disk.used_bytes, itemStyle: { color: '#4f7cf3' } },
        { name: '剩余', value: freePercent, bytes: disk.free_bytes, itemStyle: { color: dark ? '#363a43' : '#e9edf4' } },
      ],
    }],
  })
}

watch(() => props.value?.disk, () => void nextTick(renderChart), { deep: true })
onMounted(() => {
  renderChart()
  if (chartElement.value) {
    observer = new ResizeObserver(() => chart?.resize())
    observer.observe(chartElement.value)
  }
  themeObserver = new MutationObserver(renderChart)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})
onBeforeUnmount(() => {
  observer?.disconnect()
  themeObserver?.disconnect()
  chart?.dispose()
})
</script>

<template>
  <section class="storage-card" v-loading="loading">
    <header class="card-heading">
      <div><p class="eyebrow">真实文件系统容量</p><h2>{{ t('storage.title') }}</h2></div>
      <el-button :icon="RefreshCw" :loading="value?.status === 'scanning'" @click="emit('refresh')">{{ t('storage.refresh') }}</el-button>
    </header>

    <el-alert v-if="value?.disk_error" type="warning" :title="value.disk_error" show-icon :closable="false" />
    <div class="storage-main">
      <div class="capacity-chart">
        <div ref="chartElement" class="capacity-chart-canvas" />
        <div class="capacity-chart-label"><strong>{{ usage === null ? '—' : `${usage}%` }}</strong><span>磁盘使用率</span></div>
      </div>
      <div class="storage-metrics">
        <div><span>{{ t('storage.diskTotal') }}</span><strong>{{ formatBytes(value?.disk?.total_bytes) }}</strong></div>
        <div><span>{{ t('storage.diskUsed') }}</span><strong>{{ formatBytes(value?.disk?.used_bytes) }}</strong></div>
        <div><span>{{ t('storage.diskFree') }}</span><strong>{{ formatBytes(value?.disk?.free_bytes) }}</strong></div>
        <div><span>{{ t('storage.available') }}</span><strong>{{ formatBytes(value?.disk?.available_bytes) }}</strong></div>
      </div>
      <div class="shared-metrics">
        <div class="shared-size"><span>{{ t('storage.sharedUsed') }}</span><strong>{{ formatBytes(value?.shared.total_bytes) }}</strong></div>
        <div class="shared-counts">
          <span><File :size="17" />{{ formatNumber(value?.shared.file_count ?? 0) }} 个文件</span>
          <span><Folder :size="17" />{{ formatNumber(value?.shared.directory_count ?? 0) }} 个文件夹</span>
        </div>
        <div class="scan-status">
          <Clock3 :size="15" />
          <span v-if="value?.status === 'scanning'">{{ t('storage.scanning') }}</span>
          <span v-else>{{ t('storage.scannedAt') }}：{{ formatDate(value?.shared.scanned_at) }}</span>
        </div>
        <div class="storage-health" :class="health.level"><component :is="health.icon" :size="17" />{{ health.label }}</div>
      </div>
    </div>

    <button class="distribution-toggle" type="button" @click="distributionOpen = !distributionOpen">
      <span>{{ t('storage.distribution') }}</span><span>{{ distributionOpen ? '收起' : '展开' }}</span>
    </button>
    <div v-if="distributionOpen" class="distribution-list">
      <div v-for="category in value?.shared.categories ?? []" :key="category.key" class="distribution-item">
        <span class="distribution-dot" :style="{ background: categoryColors[category.key] }" />
        <strong>{{ categoryLabels[category.key] }}</strong>
        <div class="distribution-bar"><i :style="{ width: value?.shared.total_bytes ? `${(category.bytes / value.shared.total_bytes) * 100}%` : '0%', background: categoryColors[category.key] }" /></div>
        <span>{{ formatBytes(category.bytes) }}</span>
        <small>{{ formatNumber(category.count) }} 个</small>
      </div>
    </div>
    <el-alert v-if="value?.scan_error" class="storage-error" type="error" :title="value.scan_error" show-icon :closable="false" />
  </section>
</template>
