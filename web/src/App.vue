<script setup lang="ts">
import { onErrorCaptured } from 'vue'
import { ElMessage } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import AppShell from '@/components/AppShell.vue'

onErrorCaptured((error) => {
  console.error(error)
  ElMessage.error(error instanceof Error ? error.message : '页面发生未知错误')
  return false
})
</script>

<template>
  <el-config-provider :locale="zhCn">
    <AppShell />
  </el-config-provider>
</template>
