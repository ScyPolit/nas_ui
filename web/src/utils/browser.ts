function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.getRandomValues === 'function') {
    try {
      return cryptoApi.getRandomValues(bytes)
    } catch {
      // Some embedded browsers expose crypto but disable it in their current context.
    }
  }

  for (let index = 0; index < length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256)
  }
  return bytes
}

/** Creates a UI-only task identifier without requiring a secure context. */
export function createId(): string {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === 'function') {
    try {
      return cryptoApi.randomUUID()
    } catch {
      // Fall through when a browser advertises randomUUID but blocks the call.
    }
  }

  const bytes = randomBytes(16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function legacyCopy(text: string): void {
  if (typeof document?.execCommand !== 'function' || !document.body) {
    throw new Error('当前浏览器不支持自动复制，请手动复制')
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.setAttribute('aria-hidden', 'true')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    if (!document.execCommand('copy')) {
      throw new Error('当前浏览器不支持自动复制，请手动复制')
    }
  } finally {
    textarea.remove()
  }
}

/** Copies text in HTTPS/localhost and ordinary LAN HTTP pages. */
export async function copyText(text: string): Promise<void> {
  const writeText = globalThis.navigator?.clipboard?.writeText
  if (typeof writeText === 'function') {
    try {
      await writeText.call(globalThis.navigator.clipboard, text)
      return
    } catch {
      // Permission denial and non-secure contexts can still use the legacy path.
    }
  }

  legacyCopy(text)
}
