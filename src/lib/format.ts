const KIBIBYTE = 1024
const MEBIBYTE = KIBIBYTE * KIBIBYTE
const GIBIBYTE = MEBIBYTE * KIBIBYTE

export function formatBytes(bytes: number) {
  if (bytes < KIBIBYTE) return `${bytes} B`
  if (bytes < MEBIBYTE) return `${(bytes / KIBIBYTE).toFixed(1)} KB`
  if (bytes < GIBIBYTE) return `${(bytes / MEBIBYTE).toFixed(1)} MB`
  return `${(bytes / GIBIBYTE).toFixed(2)} GB`
}

export function formatDuration(ms: number) {
  if (ms < 1000) return `${Math.round(ms)} ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes} min ${Math.round(seconds % 60)} s`
}

/** "−42%" when smaller, "+8%" when larger. */
export function formatChange(before: number, after: number) {
  if (before === 0) return '—'
  const change = Math.round(((after - before) / before) * 100)
  if (change === 0) return '0%'
  return change < 0 ? `−${Math.abs(change)}%` : `+${change}%`
}

const counter = new Intl.NumberFormat('en')
export const formatCount = (value: number) => counter.format(value)
