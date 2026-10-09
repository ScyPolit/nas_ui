import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText, createId } from '@/utils/browser'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

describe('createId', () => {
  it('uses randomUUID when it is available', () => {
    const randomUUID = vi.fn(() => '123e4567-e89b-42d3-a456-426614174000' as `${string}-${string}-${string}-${string}-${string}`)
    vi.stubGlobal('crypto', { randomUUID })
    expect(createId()).toBe('123e4567-e89b-42d3-a456-426614174000')
    expect(randomUUID).toHaveBeenCalledOnce()
  })

  it('creates a UUID v4 with getRandomValues when randomUUID is missing', () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(17)
      return bytes
    })
    vi.stubGlobal('crypto', { getRandomValues })
    expect(createId()).toMatch(UUID_V4)
    expect(getRandomValues).toHaveBeenCalledOnce()
  })

  it('still creates a UUID v4 when crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined)
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect(createId()).toMatch(UUID_V4)
  })
})

describe('copyText', () => {
  it('prefers the Clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await copyText('局域网链接')
    expect(writeText).toHaveBeenCalledWith('局域网链接')
  })

  it.each(['missing', 'rejected'] as const)('uses execCommand when Clipboard API is %s', async (mode) => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    vi.stubGlobal('navigator', mode === 'missing' ? {} : { clipboard: { writeText } })
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })

    await copyText('需要复制的文本')

    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('reports an actionable error and always removes the temporary textarea', async () => {
    vi.stubGlobal('navigator', {})
    Object.defineProperty(document, 'execCommand', { configurable: true, value: vi.fn().mockReturnValue(false) })
    await expect(copyText('内容')).rejects.toThrow('当前浏览器不支持自动复制，请手动复制')
    expect(document.querySelector('textarea')).toBeNull()
  })
})
