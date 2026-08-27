const ENTITIES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ENTITIES[c]!)
}

export function formatInt(value: number): string {
  return Number.isFinite(value) ? new Intl.NumberFormat('pl-PL').format(Math.round(value)) : '—'
}

export function formatPercent(part: number, whole: number): string {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole === 0) return '—'
  return `${new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format((part / whole) * 100)} %`
}
