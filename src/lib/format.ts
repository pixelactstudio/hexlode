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

/** "−42%" when smaller, "+8%" when larger. Only an empty file reads −100%. */
export function formatChange(before: number, after: number) {
  if (before === 0) return '—'
  const rounded = Math.round(((after - before) / before) * 100)
  const change = rounded === -100 && after > 0 ? -99 : rounded
  if (change === 0) return '0%'
  return change < 0 ? `−${Math.abs(change)}%` : `+${change}%`
}

const counter = new Intl.NumberFormat('en')
export const formatCount = (value: number) => counter.format(value)

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'always' })

/** "5 minutes ago" or "2 hours ago": how long ago something happened, in whole units. */
export function formatAge(ms: number) {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return relativeTime.format(-minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return relativeTime.format(-hours, 'hour')
  return relativeTime.format(-Math.floor(hours / 24), 'day')
}
