/**
 * Step cache keys. A key combines a node's type, version and settings with the keys of its
 * inputs, so a settings change invalidates that node and every node after it.
 */

function cyrb53(text: string, seed: number) {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36).padStart(11, '0')
}

/** A 106-bit hash of the parts, as a filename-safe string. */
export function hashParts(...parts: string[]) {
  const text = parts.join('\u0000')
  return `${cyrb53(text, 1)}${cyrb53(text, 2)}`
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`
}

export function fileKey(file: { name: string; size: number; lastModified: number }) {
  return hashParts('file', file.name, String(file.size), String(file.lastModified))
}

export function nodeKey(type: string, version: number, settings: unknown) {
  return hashParts('node', type, String(version), stableStringify(settings))
}

export function entryKey(node: string, inputKeys: string[]) {
  return hashParts('entry', node, ...inputKeys)
}

export function outputKey(entry: string, index: number) {
  return hashParts('output', entry, String(index))
}
