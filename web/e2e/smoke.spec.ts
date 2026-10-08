import { expect, test } from '@playwright/test'
import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const screenshots = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url))

test.beforeAll(async () => {
  await mkdir(screenshots, { recursive: true })
})

test('modern dashboard and file workflows use the real server', async ({ page }) => {
  await page.goto('/#/')
  await expect(page.getByRole('heading', { name: '你好，欢迎回来' })).toBeVisible()
  await expect(page.locator('.storage-metrics strong').first()).not.toHaveText('未知')
  await expect(page.locator('.scan-status')).not.toContainText('正在后台统计', { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: '文件目录' })).toBeVisible()
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${screenshots}/home-light.png`, fullPage: true })

  await page.getByRole('button', { name: '全部文件', exact: true }).click()
  await expect(page.locator('.file-tile').first()).toBeVisible()
  await page.screenshot({ path: `${screenshots}/files-medium.png`, fullPage: true })

  await page.locator('.view-selector').click()
  await page.getByText('详细信息', { exact: true }).click()
  await expect(page.locator('.details-table')).toBeVisible()
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${screenshots}/files-details.png`, fullPage: true })

  const readmeRow = page.locator('.details-table tbody tr').filter({ hasText: '欢迎使用.md' })
  await expect(readmeRow).toBeVisible()
  await readmeRow.dblclick()
  await expect(page.locator('.file-preview-dialog')).toBeVisible()
  await expect(page.locator('.markdown-body')).toContainText('局域网共享空间')
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${screenshots}/preview-markdown.png`, fullPage: true })
  await page.locator('.file-preview-dialog .el-dialog__headerbtn').click()
  await expect(page.locator('.file-preview-dialog')).toBeHidden()

  const uploadName = `自动化验收-${Date.now()}.txt`
  await page.locator('input[type="file"]').first().setInputFiles({
    name: uploadName,
    mimeType: 'text/plain',
    buffer: Buffer.from('Dufs 端到端上传验收\n', 'utf8'),
  })
  await expect(page.locator('.upload-task').filter({ hasText: uploadName })).toContainText('上传完成')
  await page.waitForTimeout(150)
  await page.screenshot({ path: `${screenshots}/upload-manager.png`, fullPage: true })
  await rm(fileURLToPath(new URL(`../../artifacts/e2e-share/${uploadName}`, import.meta.url)), { force: true })

  await page.getByRole('button', { name: '首页' }).click()
  await page.getByTitle('切换到深色').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.screenshot({ path: `${screenshots}/home-dark.png`, fullPage: true })
})

test('mobile layout keeps navigation and core content usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/')
  await expect(page.getByRole('heading', { name: '你好，欢迎回来' })).toBeVisible()
  await page.getByRole('button', { name: '打开导航' }).click()
  await expect(page.getByRole('button', { name: '全部文件', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '全部文件', exact: true }).click()
  await expect(page.locator('.file-tile').first()).toBeVisible()
  await page.screenshot({ path: `${screenshots}/mobile-files.png`, fullPage: true })
})
