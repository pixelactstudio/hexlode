import type { ItemFormat, ItemKind, ItemType, ItemTypeSet } from '#/features/engine/types'

export const IMAGE_FORMATS = ['jpeg', 'png', 'webp', 'avif', 'jxl', 'qoi'] as const
export const DATA_FORMATS = ['json', 'text'] as const
export const DOCUMENT_FORMATS = ['pdf'] as const

export const FORMAT_LABELS: Record<ItemFormat, string> = {
  jpeg: 'JPEG',
  png: 'PNG',
  webp: 'WebP',
  avif: 'AVIF',
  jxl: 'JPEG XL',
  qoi: 'QOI',
  json: 'JSON',
  text: 'text',
  pdf: 'PDF',
}

const KIND_NOUNS: Record<ItemKind, string> = {
  image: 'images',
  data: 'data',
  document: 'documents',
}

const KIND_FORMATS: Record<ItemKind, readonly ItemFormat[]> = {
  image: IMAGE_FORMATS,
  data: DATA_FORMATS,
  document: DOCUMENT_FORMATS,
}

export function itemType(kind: ItemKind, format: ItemFormat): ItemType {
  return `${kind}:${format}`
}

export function typesOf(kind: ItemKind, formats: readonly ItemFormat[] = KIND_FORMATS[kind]) {
  return new Set<ItemType>(formats.map((format) => itemType(kind, format)))
}

export const ALL_IMAGE_TYPES: ItemTypeSet = typesOf('image')

export function splitItemType(type: ItemType) {
  const [kind, format] = type.split(':') as [ItemKind, ItemFormat]
  return { kind, format }
}

export function intersect(a: ItemTypeSet, b: ItemTypeSet): ItemTypeSet {
  return new Set([...a].filter((type) => b.has(type)))
}

export function union(sets: Iterable<ItemTypeSet>): ItemTypeSet {
  const result = new Set<ItemType>()
  for (const set of sets) for (const type of set) result.add(type)
  return result
}

export function isSubset(a: ItemTypeSet, b: ItemTypeSet) {
  return [...a].every((type) => b.has(type))
}

function joinWords(words: string[], conjunction: 'and' | 'or') {
  if (words.length <= 1) return words.join('')
  return `${words.slice(0, -1).join(', ')} ${conjunction} ${words.at(-1)}`
}

function groupByKind(types: ItemTypeSet) {
  const groups = new Map<ItemKind, ItemFormat[]>()
  for (const type of types) {
    const { kind, format } = splitItemType(type)
    groups.set(kind, [...(groups.get(kind) ?? []), format])
  }
  return groups
}

function orderedFormats(kind: ItemKind, formats: ItemFormat[]) {
  return KIND_FORMATS[kind].filter((format) => formats.includes(format))
}

/** "PNG images", "JPEG or PNG images", "images", "JSON or text data". */
export function describeTypes(types: ItemTypeSet, conjunction: 'and' | 'or' = 'or') {
  const parts = [...groupByKind(types)].map(([kind, formats]) => {
    if (formats.length === KIND_FORMATS[kind].length) return KIND_NOUNS[kind]
    const labels = orderedFormats(kind, formats).map((format) => FORMAT_LABELS[format])
    return `${joinWords(labels, conjunction)} ${KIND_NOUNS[kind]}`
  })
  return joinWords(parts, conjunction)
}

/** Short connection label: "PNG only", "JPEG and PNG only", "Images only". */
export function narrowingLabel(types: ItemTypeSet) {
  const groups = groupByKind(types)
  const parts = [...groups].map(([kind, formats]) => {
    if (formats.length === KIND_FORMATS[kind].length) return KIND_NOUNS[kind]
    return joinWords(
      orderedFormats(kind, formats).map((format) => FORMAT_LABELS[format]),
      'and',
    )
  })
  const label = `${joinWords(parts, 'and')} only`
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function firstFormat(types: ItemTypeSet, kind: ItemKind) {
  const formats = groupByKind(types).get(kind)
  return formats ? orderedFormats(kind, formats)[0] : undefined
}
