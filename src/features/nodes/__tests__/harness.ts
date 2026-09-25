import { createInlineHost } from '#/features/engine/inline-host'
import { fileKey } from '#/features/engine/keys'
import { runPipeline, type SourceItem } from '#/features/engine/runner'
import type { StepCache } from '#/features/engine/step-cache'
import type { Pipeline, RunEvent } from '#/features/engine/types'
import { inspectImageHeader } from '#/features/image-input/validators'
import { jsquashCodecs } from '#/features/images/codecs'
import { imageKind, loadImageItem } from '#/features/images/image-item'
import { readMetadata } from '#/features/images/metadata/containers'
import { parseExif } from '#/features/images/metadata/exif'
import { productRegistry } from '#/features/nodes/registry'

export async function fixtureBytes(name: string) {
  const response = await fetch(new URL(`../../images/__tests__/fixtures/${name}`, import.meta.url))
  if (!response.ok) throw new Error(`Missing fixture ${name}`)
  return new Uint8Array(await response.arrayBuffer())
}

export const ALL_FORMAT_FIXTURES = [
  'photo.jpg',
  'photo.png',
  'photo.webp',
  'photo.avif',
  'photo.jxl',
  'photo.qoi',
]

export async function sourceFromBytes(
  name: string,
  bytes: Uint8Array,
  index: number,
): Promise<SourceItem> {
  const { meta } = await loadImageItem(bytes, name)
  return {
    index,
    key: fileKey({ name, size: bytes.byteLength, lastModified: index }),
    meta,
    load: () => loadImageItem(bytes, name),
  }
}

type NodeSpec = [type: string, settings?: Record<string, unknown>]

/** Files, then the given nodes in a line, then Output. */
export function chain(...nodes: NodeSpec[]): Pipeline {
  const all: NodeSpec[] = [['files'], ...nodes, ['output']]
  const ids = all.map(([type], index) => (index === all.length - 1 ? 'out' : `${type}-${index}`))
  return {
    nodes: all.map(([type, settings], index) => ({
      id: ids[index],
      type,
      settings: settings ?? {},
      position: { x: index * 200, y: 0 },
    })),
    connections: ids.slice(1).map((target, index) => ({
      id: `c${index}`,
      source: ids[index],
      sourcePort: 'out',
      target,
    })),
  }
}

export async function run(
  pipeline: Pipeline,
  inputs: (string | { name: string; bytes: Uint8Array })[],
  options: { cache?: StepCache } = {},
) {
  const sources = await Promise.all(
    inputs.map(async (input, index) =>
      typeof input === 'string'
        ? sourceFromBytes(input, await fixtureBytes(input), index)
        : sourceFromBytes(input.name, input.bytes, index),
    ),
  )
  const host = createInlineHost({
    registry: productRegistry,
    services: { codecs: jsquashCodecs },
    kinds: { image: imageKind },
    cache: options.cache,
  })
  const events: RunEvent[] = []
  const result = await runPipeline({
    pipeline,
    registry: productRegistry,
    sources,
    host,
    onEvent: (event) => events.push(event),
  })
  const output = host.output as ReturnType<
    typeof import('#/features/engine/memory-output-store').createMemoryOutputStore
  >
  return {
    result,
    events,
    files: (nodeId = 'out') => output.files(nodeId),
    statuses: (nodeId: string) =>
      events.flatMap((event) =>
        event.type === 'node-item' && event.nodeId === nodeId ? [event.status] : [],
      ),
    warnings: () =>
      events.flatMap((event) => (event.type === 'node-warning' ? [event.warning] : [])),
    records: (nodeId: string) =>
      events.flatMap((event) =>
        event.type === 'node-record' && event.nodeId === nodeId ? [event.record] : [],
      ),
  }
}

export async function decodeFile(bytes: Uint8Array) {
  const info = inspectImageHeader(bytes.slice().buffer)
  const pixels = await jsquashCodecs.decode(info.format, bytes)
  const metadata = await readMetadata(info.format, bytes)
  return {
    format: info.format,
    width: pixels.width,
    height: pixels.height,
    pixels,
    metadata,
    exif: parseExif(metadata.exif),
  }
}

export function pixelAt(
  image: { pixels: { data: Uint8ClampedArray; width: number } },
  x: number,
  y: number,
) {
  const offset = (y * image.pixels.width + x) * 4
  return Array.from(image.pixels.data.subarray(offset, offset + 4))
}

/** True when a pixel is close to the colour, allowing for lossy encoders. */
export function near(actual: number[], expected: number[], tolerance = 48) {
  return expected.every((value, index) => Math.abs(actual[index] - value) <= tolerance)
}

export const RED = [255, 0, 0, 255]
export const BLUE = [0, 0, 255, 255]

/** Names of the files stored in a ZIP, read from its local file headers. */
export async function zipEntries(archive: Blob) {
  const bytes = new Uint8Array(await archive.arrayBuffer())
  const view = new DataView(bytes.buffer)
  const names: string[] = []
  for (let at = 0; at + 30 < bytes.length; ) {
    if (view.getUint32(at, true) !== 0x04034b50) break
    const flags = view.getUint16(at + 6, true)
    const nameLength = view.getUint16(at + 26, true)
    const extraLength = view.getUint16(at + 28, true)
    names.push(new TextDecoder().decode(bytes.subarray(at + 30, at + 30 + nameLength)))
    // client-zip streams entries with a data descriptor, so find the next header by signature.
    let next = at + 30 + nameLength + extraLength
    if (flags & 0x08) {
      while (next + 4 <= bytes.length && view.getUint32(next, true) !== 0x04034b50) {
        if (view.getUint32(next, true) === 0x02014b50) return names
        next += 1
      }
    }
    at = next
  }
  return names
}

/** A 256x256 image with noise, so lossy encoders produce files of a few tens of kilobytes. */
export function noisyPixels(size = 256) {
  const data = new Uint8ClampedArray(size * size * 4)
  let seed = 7
  for (let index = 0; index < data.length; index += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    data[index] = seed & 0xff
    data[index + 1] = (seed >> 8) & 0xff
    data[index + 2] = (seed >> 16) & 0xff
    data[index + 3] = 255
  }
  return { data, width: size, height: size }
}

/** Reads every entry of a ZIP (stored, as client-zip writes it) through its central directory. */
export async function unzip(archive: Blob) {
  const bytes = new Uint8Array(await archive.arrayBuffer())
  const view = new DataView(bytes.buffer)
  let end = bytes.length - 22
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end -= 1
  const count = view.getUint16(end + 10, true)
  let at = view.getUint32(end + 16, true)
  const entries: { name: string; bytes: Uint8Array }[] = []
  for (let index = 0; index < count; index += 1) {
    const size = view.getUint32(at + 20, true)
    const nameLength = view.getUint16(at + 28, true)
    const extraLength = view.getUint16(at + 30, true)
    const commentLength = view.getUint16(at + 32, true)
    const local = view.getUint32(at + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength))
    const dataStart =
      local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
    entries.push({ name, bytes: bytes.slice(dataStart, dataStart + size) })
    at += 46 + nameLength + extraLength + commentLength
  }
  return entries
}
