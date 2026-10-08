import { describe, expect, it } from 'vitest'
import { DufsApi, encodePath } from '@/api/dufs'

describe('DufsApi paths', () => {
  it('encodes each path segment without losing hierarchy', () => {
    expect(encodePath('中文 文件/100%/a#b.txt')).toBe('%E4%B8%AD%E6%96%87%20%E6%96%87%E4%BB%B6/100%25/a%23b.txt')
  })

  it('honors a configured path prefix', () => {
    const api = new DufsApi('/nas/')
    expect(api.pathUrl('共享/文件.txt')).toBe('/nas/%E5%85%B1%E4%BA%AB/%E6%96%87%E4%BB%B6.txt')
    expect(api.pathUrl('共享', true)).toBe('/nas/%E5%85%B1%E4%BA%AB/')
  })
})
