import { expect, test } from '@playwright/test'

const rootDirectory = {
  href: '/',
  kind: 'Index',
  uri_prefix: '/',
  allow_upload: true,
  allow_delete: true,
  allow_search: true,
  allow_archive: true,
  dir_exists: true,
  auth: false,
  user: null,
  paths: [{ name: 'large-folder', path_type: 'Dir', mtime: 0, size: 12000 }],
}

test('slow folder navigation is blocked from stacking the same path', async ({ page }) => {
  await page.route('**/*?json=*', async (route) => {
    const url = new URL(route.request().url())
    const isLargeFolder = url.pathname === '/large-folder/'
    if (isLargeFolder) await new Promise((resolve) => setTimeout(resolve, 1200))
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ...rootDirectory, href: url.pathname, paths: isLargeFolder ? [] : rootDirectory.paths }),
    })
  })

  await page.goto('/#/files')
  const folder = page.locator('.file-tile').filter({ hasText: 'large-folder' })
  await expect(folder).toBeVisible()

  await folder.dblclick()
  await expect(page.getByRole('status')).toContainText('正在打开文件夹')
  await expect(page.getByRole('status')).toContainText('large-folder')
  await folder.dblclick({ force: true })

  await expect(page).toHaveURL(/#\/files\/large-folder$/)
  await expect(page.getByRole('status')).toBeHidden()
  expect(new URL(page.url()).hash).toBe('#/files/large-folder')
})
