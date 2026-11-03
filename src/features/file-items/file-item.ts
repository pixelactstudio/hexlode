/**
 * Data items (JSON and text) and document items (PDF and ICO): files a node makes from images,
 * such as a palette or a PDF. Output saves their bytes as they are.
 */
import type { Item, ItemKindHandler, ItemMeta } from '#/features/engine/types'
import type { FileItem, FileKind, FilePayload } from '#/features/file-items/types'

export function fileItem(
  type: FileKind,
  name: string,
  bytes: Uint8Array,
  source: ItemMeta['source'],
): FileItem {
  return {
    meta: { kind: type.kind, format: type.format, name, size: bytes.byteLength, source },
    payload: { bytes },
  }
}

export function textItem(
  format: 'json' | 'text',
  name: string,
  content: string,
  source: ItemMeta['source'],
) {
  return fileItem({ kind: 'data', format }, name, new TextEncoder().encode(content), source)
}

export function jsonItem(name: string, value: unknown, source: ItemMeta['source']) {
  return textItem('json', name, `${JSON.stringify(value, null, 2)}\n`, source)
}

export function isFileItem(item: Item): item is FileItem {
  return item.meta.kind !== 'image'
}

/** The file's bytes, for items that are already finished files. */
export function fileBytes(item: Item) {
  return (item.payload as FilePayload).bytes
}

export const fileKind: ItemKindHandler = {
  storable: (payload) => payload,
  memoryBytes: (item) => fileBytes(item).byteLength,
}

/** `trip/photo.jpg` becomes `trip/photo.palette.json` with ending `.palette.json`. */
export function nameWithEnding(name: string, ending: string) {
  const slash = name.lastIndexOf('/')
  const dot = name.lastIndexOf('.')
  return `${dot > slash + 1 ? name.slice(0, dot) : name}${ending}`
}

/** The name without folders or extension, for labels and CSS names. */
export function stemOf(name: string) {
  const leaf = name.slice(name.lastIndexOf('/') + 1)
  const dot = leaf.lastIndexOf('.')
  return dot > 0 ? leaf.slice(0, dot) : leaf
}
