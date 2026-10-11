import { describe, expect, it } from 'vitest'
import { isReactive, reactive } from 'vue'
import { cloneSettings, formatUptime, statusTitle } from './model'

describe('desktop status model', () => {
  it('formats a stable non-negative uptime', () => {
    expect(formatUptime(3725)).toBe('1 小时 2 分钟')
    expect(formatUptime(-1)).toBe('0 小时 0 分钟')
  })

  it('maps process states to Chinese labels', () => {
    expect(statusTitle('running')).toBe('服务运行中')
    expect(statusTitle('unknown')).toBe('状态检查中')
  })

  it('copies reactive-shaped settings without sharing permissions', () => {
    const source = reactive({ port: 5000, permissions: { upload: true, manage: false } })
    const copy = cloneSettings(source)
    copy.permissions.upload = false

    expect(isReactive(source)).toBe(true)
    expect(isReactive(copy)).toBe(false)
    expect(copy).not.toBe(source)
    expect(copy.permissions).not.toBe(source.permissions)
    expect(source.permissions.upload).toBe(true)
  })
})
