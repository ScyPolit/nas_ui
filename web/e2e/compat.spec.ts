import { expect, test } from '@playwright/test'
import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    ;(globalThis as typeof globalThis & { __unhandledRejections: string[] }).__unhandledRejections = []
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason
      ;(globalThis as typeof globalThis & { __unhandledRejections: string[] }).__unhandledRejections.push(
        reason instanceof Error ? reason.message : String(reason),
      )
    })
    Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: undefined })
    Object.defineProperty(Navigator.prototype, 'clipboard', { configurable: true, get: () => undefined })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: (command: string) => command === 'copy',
    })
  })
})

test('LAN HTTP works without randomUUID or Clipboard API', async ({ page }) => {
  const runtimeErrors: string[] = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))
  await page.goto('/#/files')

  const uploadName = `兼容性验收-${Date.now()}.txt`
  await page.locator('input[type="file"]').first().setInputFiles({
    name: uploadName,
    mimeType: 'text/plain',
    buffer: Buffer.from('普通局域网 HTTP 兼容性验收\n', 'utf8'),
  })
  await expect(page.locator('.upload-task').filter({ hasText: uploadName })).toContainText('上传完成')

  const firstItem = page.locator('.file-tile').first()
  await expect(firstItem).toBeVisible()
  await firstItem.click({ button: 'right' })
  await page.getByText('复制链接', { exact: true }).click()
  await expect(page.getByText('链接已复制', { exact: true })).toBeVisible()

  const readme = page.locator('.file-tile').filter({ hasText: '欢迎使用.md' })
  await expect(readme).toBeVisible()
  await readme.dblclick()
  await expect(page.locator('.markdown-body')).toContainText('局域网共享空间')
  await page.getByRole('button', { name: '复制文本' }).click()
  await expect(page.getByText('文本已复制', { exact: true })).toBeVisible()

  expect(runtimeErrors).toEqual([])
  expect(await page.evaluate(() => (globalThis as typeof globalThis & { __unhandledRejections: string[] }).__unhandledRejections)).toEqual([])
  await rm(fileURLToPath(new URL(`../../artifacts/e2e-share/${uploadName}`, import.meta.url)), { force: true })
})
