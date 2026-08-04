const KIBIBYTE = 1024
const MEBIBYTE = KIBIBYTE * KIBIBYTE

export function formatBytes(bytes: number) {
  if (bytes < KIBIBYTE) return `${bytes} B`
  if (bytes < MEBIBYTE) return `${(bytes / KIBIBYTE).toFixed(1)} KB`
  return `${(bytes / MEBIBYTE).toFixed(1)} MB`
}
