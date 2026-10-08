<script setup lang="ts">
import { ElMessageBox } from 'element-plus'
import { t } from '@/locales/zh-CN'
import { clearRecentViewed } from '@/services/recentDb'
import { usePreferencesStore } from '@/stores/preferences'
import type { ViewMode } from '@/types'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const preferences = usePreferencesStore()

const viewOptions: Array<{ value: ViewMode; label: string }> = [
  { value: 'extra-large', label: t('explorer.views.extra-large') },
  { value: 'large', label: t('explorer.views.large') },
  { value: 'medium', label: t('explorer.views.medium') },
  { value: 'small', label: t('explorer.views.small') },
  { value: 'list', label: t('explorer.views.list') },
  { value: 'details', label: t('explorer.views.details') },
]

async function clearHistory(): Promise<void> {
  await ElMessageBox.confirm('这会清空当前浏览器保存的全部最近查看记录。', '清空历史', {
    confirmButtonText: '清空',
    cancelButtonText: t('action.cancel'),
    type: 'warning',
  })
  await clearRecentViewed()
}
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    :title="t('settings.title')"
    size="min(420px, 92vw)"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="settings-form">
      <section>
        <h3>{{ t('settings.appearance') }}</h3>
        <div class="setting-row vertical">
          <label>{{ t('settings.theme') }}</label>
          <el-segmented
            v-model="preferences.theme"
            :options="[
              { label: t('settings.system'), value: 'system' },
              { label: t('settings.light'), value: 'light' },
              { label: t('settings.dark'), value: 'dark' },
            ]"
          />
        </div>
      </section>

      <section>
        <h3>文件显示</h3>
        <div class="setting-row vertical">
          <label>{{ t('settings.defaultView') }}</label>
          <el-select v-model="preferences.defaultView">
            <el-option v-for="option in viewOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </div>
        <div class="setting-row vertical">
          <label>{{ t('settings.defaultSort') }}</label>
          <div class="inline-fields">
            <el-select v-model="preferences.sortField">
              <el-option label="名称" value="name" />
              <el-option label="修改日期" value="mtime" />
              <el-option label="大小" value="size" />
              <el-option label="类型" value="type" />
            </el-select>
            <el-select v-model="preferences.sortOrder">
              <el-option label="升序" value="asc" />
              <el-option label="降序" value="desc" />
            </el-select>
          </div>
        </div>
        <div class="setting-row"><label>{{ t('settings.thumbnails') }}</label><el-switch v-model="preferences.showThumbnails" /></div>
        <div class="setting-row"><label>{{ t('settings.autoRefresh') }}</label><el-switch v-model="preferences.autoRefresh" /></div>
        <div class="setting-row"><label>{{ t('settings.showExtension') }}</label><el-switch v-model="preferences.showExtensions" /></div>
      </section>

      <section>
        <h3>隐私与历史</h3>
        <p class="setting-description">最近看过仅保存在此浏览器的 IndexedDB 中，不会上传到服务器。</p>
        <el-button type="danger" plain @click="clearHistory">{{ t('settings.clearHistory') }}</el-button>
      </section>
    </div>
  </el-drawer>
</template>
