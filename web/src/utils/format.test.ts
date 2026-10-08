import { describe, expect, it } from 'vitest'
import { formatBytes, formatNumber } from '@/utils/format'

describe('formatBytes', () => {
  it('formats binary units with Chinese number formatting', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1024 ** 3)).toBe('1 GB')
  })

  it('does not present unavailable data as zero', () => {
    expect(formatBytes(null)).toBe('未知')
    expect(formatBytes(Number.NaN)).toBe('未知')
  })
})

describe('formatNumber', () => {
  it('uses zh-CN grouping', () => {
    expect(formatNumber(1234567)).toMatch(/1,234,567|123万/)
  })
})
