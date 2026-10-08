import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  outputDir: '../artifacts/playwright',
  reporter: [['list'], ['html', { outputFolder: '../artifacts/playwright-report', open: 'never' }]],
  use: {
    baseURL: process.env.DUFS_E2E_URL ?? 'http://127.0.0.1:5099',
    channel: 'msedge',
    viewport: { width: 1440, height: 1000 },
    locale: 'zh-CN',
    colorScheme: 'light',
    trace: 'retain-on-failure',
  },
  timeout: 30_000,
  expect: { timeout: 8_000 },
})
