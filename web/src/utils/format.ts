const sizeFormatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 })
const numberFormatter = new Intl.NumberFormat('zh-CN')

export function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '未知'
  if (value < 1024) return `${value} B`
  const units = ['KB', 'MB', 'GB', 'TB', 'PB']
  let current = value
  let unit = -1
  do {
    current /= 1024
    unit += 1
  } while (current >= 1024 && unit < units.length - 1)
  return `${sizeFormatter.format(current)} ${units[unit]}`
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

export function formatDate(value: number | null | undefined, withTime = true): string {
  if (!value) return '未知'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(value))
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '即将完成'
  if (seconds < 60) return `约 ${Math.ceil(seconds)} 秒`
  if (seconds < 3600) return `约 ${Math.ceil(seconds / 60)} 分钟`
  return `约 ${Math.ceil(seconds / 3600)} 小时`
}

export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/秒`
}
