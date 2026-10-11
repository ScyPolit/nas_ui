export function formatUptime(seconds?: number): string {
  const value = Math.max(0, Math.floor(seconds ?? 0))
  return `${Math.floor(value / 3600)} 小时 ${Math.floor((value % 3600) / 60)} 分钟`
}

export function statusTitle(state: string): string {
  return ({ running: '服务运行中', error: '服务异常', stopped: '服务已停止' } as Record<string, string>)[state] || '状态检查中'
}

export function cloneSettings<T extends { permissions: Record<string, boolean> }>(value: T): T {
  return { ...value, permissions: { ...value.permissions } }
}
