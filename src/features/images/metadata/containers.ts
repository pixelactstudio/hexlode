import type { ImageFormat } from '#/features/engine/types'
import { readAvifMetadata, writeAvifMetadata } from '#/features/images/metadata/avif'
import { readJpegMetadata, writeJpegMetadata } from '#/features/images/metadata/jpeg'
import { readJxlMetadata, writeJxlMetadata } from '#/features/images/metadata/jxl'
import { readPngMetadata, writePngMetadata } from '#/features/images/metadata/png'
import type { ImageMetadata, MetadataPart } from '#/features/images/metadata/types'
import { readWebpMetadata, writeWebpMetadata } from '#/features/images/metadata/webp'

export async function readMetadata(format: ImageFormat, bytes: Uint8Array): Promise<ImageMetadata> {
  switch (format) {
    case 'jpeg':
      return readJpegMetadata(bytes)
    case 'png':
      return readPngMetadata(bytes)
    case 'webp':
      return readWebpMetadata(bytes)
    case 'jxl':
      return readJxlMetadata(bytes)
    case 'avif':
      return readAvifMetadata(bytes)
    case 'qoi':
      return {}
  }
}

export interface WrittenMetadata {
  bytes: Uint8Array
  /** Parts the format could not keep. The run reports a warning for each. */
  dropped: MetadataPart[]
}

/** Returns the file with its metadata replaced by `metadata`, without re-encoding the image. */
export async function writeMetadata(
  format: ImageFormat,
  bytes: Uint8Array,
  metadata: ImageMetadata,
): Promise<WrittenMetadata> {
  switch (format) {
    case 'jpeg':
      return writeJpegMetadata(bytes, metadata)
    case 'png':
      return writePngMetadata(bytes, metadata)
    case 'webp':
      return writeWebpMetadata(bytes, metadata)
    case 'jxl':
      return writeJxlMetadata(bytes, metadata)
    case 'avif':
      return writeAvifMetadata(bytes, metadata)
    case 'qoi': {
      const dropped = (['exif', 'xmp', 'icc'] as const).filter((part) => metadata[part])
      return { bytes, dropped }
    }
  }
}
