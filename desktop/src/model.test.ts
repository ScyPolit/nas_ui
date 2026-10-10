import { describe, expect, it } from 'vitest'
import { formatUptime, statusTitle } from './model'

describe('desktop status model', () => {
  it('formats a stable non-negative uptime', () => {
    expect(formatUptime(3725)).toBe('1 小时 2 分钟')
    expect(formatUptime(-1)).toBe('0 小时 0 分钟')
  })

  it('maps process states to Chinese labels', () => {
    expect(statusTitle('running')).toBe('服务运行中')
    expect(statusTitle('unknown')).toBe('状态检查中')
  })
})
