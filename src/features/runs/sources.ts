/**
 * Turns dropped files into source items: reads each header, refuses files that are not usable
 * images or that no branch accepts, and keys each file by its identity for the step cache.
 */
import { describeTypes, itemType } from '#/features/engine/item-types'
import { fileKey } from '#/features/engine/keys'
import type { SourceItem } from '#/features/engine/runner'
import type { ItemTypeSet } from '#/features/engine/types'
import { HEADER_READ_BYTES } from '#/features/image-input/constants'
import { ImageValidationError, inspectImageHeader } from '#/features/image-input/validators'
import { FORMAT_NAMES } from '#/features/images/image-item'
import { readMetadata } from '#/features/images/metadata/containers'
import { parseExif } from '#/features/images/metadata/exif'

export interface InputFile {
  file: File
  relativePath: string
}

export interface RefusedFile {
  name: string
  code: string
  reason: string
}

async function readHeader(file: File) {
  const bytes = new Uint8Array(await file.slice(0, HEADER_READ_BYTES).arrayBuffer())
  try {
    return { info: inspectImageHeader(bytes.buffer, file.type, file.size), bytes }
  } catch (reason) {
    // Some JPEGs keep large thumbnails before the frame header; read the whole file once.
    const truncated = reason instanceof ImageValidationError && file.size > HEADER_READ_BYTES
    if (!truncated || reason.code !== 'unsupported_format') throw reason
    const whole = new Uint8Array(await file.arrayBuffer())
    return { info: inspectImageHeader(whole.buffer, file.type, file.size), bytes: whole }
  }
}

async function orientationOf(format: Parameters<typeof readMetadata>[0], bytes: Uint8Array) {
  try {
    return parseExif((await readMetadata(format, bytes)).exif).orientation
  } catch {
    return 1
  }
}

export async function prepareSources(inputs: InputFile[], accepts: ItemTypeSet) {
  const sources: SourceItem[] = []
  const refused: RefusedFile[] = []
  for (const { file, relativePath } of inputs) {
    const name = relativePath || file.name
    if (accepts.size === 0) {
      refused.push({
        name,
        code: 'no_branches',
        reason: 'Connect the Files node to another node first.',
      })
      continue
    }
    try {
      const { info, bytes } = await readHeader(file)
      if (!accepts.has(itemType('image', info.format))) {
        refused.push({
          name,
          code: 'not_accepted',
          reason: `No branch takes ${FORMAT_NAMES[info.format]} images. This pipeline accepts ${describeTypes(accepts)}.`,
        })
        continue
      }
      sources.push({
        index: sources.length,
        key: fileKey({ name, size: file.size, lastModified: file.lastModified }),
        file,
        meta: {
          kind: 'image',
          format: info.format,
          name,
          size: file.size,
          width: info.width,
          height: info.height,
          orientation: await orientationOf(info.format, bytes),
          source: { size: file.size, format: info.format, width: info.width, height: info.height },
        },
      })
    } catch (reason) {
      refused.push({
        name,
        code: reason instanceof ImageValidationError ? reason.code : 'unreadable',
        reason: reason instanceof Error ? reason.message : 'The file could not be read.',
      })
    }
  }
  return { sources, refused }
}
