<script setup lang="ts">
import { computed } from 'vue'
import { Check, ChevronDown, ChevronUp, CircleAlert, RotateCcw, Trash2, X } from '@lucide/vue'
import { t } from '@/locales/zh-CN'
import { useUploadsStore } from '@/stores/uploads'
import { formatBytes, formatDuration, formatSpeed } from '@/utils/format'

const uploads = useUploadsStore()
const visible = computed(() => uploads.tasks.length > 0)

const statusLabel: Record<string, string> = {
  queued: t('upload.waiting'),
  checking: '正在检查',
  conflict: t('upload.conflict'),
  uploading: t('upload.uploading'),
  completed: t('upload.completed'),
  failed: t('upload.failed'),
  canceled: t('upload.canceled'),
  skipped: '已跳过',
}
</script>

<template>
  <section v-if="visible" class="upload-manager" :class="{ collapsed: !uploads.panelOpen }" aria-label="上传任务">
    <header @click="uploads.panelOpen = !uploads.panelOpen">
      <div>
        <strong>{{ t('upload.title') }}</strong>
        <span v-if="uploads.activeCount">{{ uploads.totalProgress }}%</span>
        <span v-else>{{ uploads.tasks.length }} 项</span>
      </div>
      <button class="icon-button" type="button" :aria-label="uploads.panelOpen ? '折叠' : '展开'">
        <ChevronDown v-if="uploads.panelOpen" :size="17" />
        <ChevronUp v-else :size="17" />
      </button>
    </header>
    <div v-if="uploads.panelOpen" class="upload-body">
      <div v-if="uploads.activeCount" class="overall-progress">
        <el-progress :percentage="uploads.totalProgress" :stroke-width="5" :show-text="false" />
      </div>
      <div class="upload-list">
        <article v-for="task in uploads.tasks" :key="task.id" class="upload-task">
          <div class="task-icon" :class="task.status">
            <Check v-if="task.status === 'completed'" :size="17" />
            <CircleAlert v-else-if="task.status === 'failed' || task.status === 'conflict'" :size="17" />
            <span v-else>{{ task.file.name.slice(0, 1).toUpperCase() }}</span>
          </div>
          <div class="task-main">
            <div class="task-title"><strong :title="task.destination">{{ task.file.name }}</strong><span>{{ statusLabel[task.status] }}</span></div>
            <el-progress
              v-if="task.status === 'uploading'"
              :percentage="task.total ? Math.round((task.loaded / task.total) * 100) : 0"
              :stroke-width="4"
              :show-text="false"
            />
            <div class="task-meta">
              <span>{{ formatBytes(task.loaded) }} / {{ formatBytes(task.total) }}</span>
              <span v-if="task.status === 'uploading' && task.speed">
                {{ formatSpeed(task.speed) }} · {{ formatDuration((task.total - task.loaded) / task.speed) }}
              </span>
              <span v-if="task.error">{{ task.error }}</span>
            </div>
            <div v-if="task.status === 'conflict'" class="conflict-actions">
              <el-button size="small" @click="uploads.keepBoth(task.id)">{{ t('upload.keepBoth') }}</el-button>
              <el-button size="small" :disabled="!task.allowOverwrite" @click="uploads.overwrite(task.id)">{{ t('upload.overwrite') }}</el-button>
              <el-button size="small" @click="uploads.skip(task.id)">{{ t('upload.skip') }}</el-button>
            </div>
          </div>
          <button
            v-if="['queued', 'checking', 'uploading'].includes(task.status)"
            class="icon-button compact"
            type="button"
            title="取消"
            @click="uploads.cancel(task.id)"
          ><X :size="15" /></button>
          <button
            v-else-if="['failed', 'canceled'].includes(task.status)"
            class="icon-button compact"
            type="button"
            title="重试"
            @click="uploads.retry(task.id)"
          ><RotateCcw :size="15" /></button>
        </article>
      </div>
      <footer>
        <el-button :icon="Trash2" text size="small" @click="uploads.clearFinished">清理已完成任务</el-button>
      </footer>
    </div>
  </section>
</template>
