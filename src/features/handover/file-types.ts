/**
 * The file types the installed app offers to open, for the manifest's file handlers and share
 * target. They follow the formats Hexlode reads, so a new input format joins both.
 */
import { PIPELINE_FILE_TYPE } from '#/features/handover/constants'
import { IMAGE_EXTENSIONS, IMAGE_MIME_TYPES } from '#/features/image-input/validators'
import { PIPELINE_FILE_EXTENSION } from '#/features/pipelines/constants'

/** Extensions people also use for a format, besides the one Hexlode writes. */
const OTHER_EXTENSIONS: Partial<Record<keyof typeof IMAGE_EXTENSIONS, string[]>> = {
  jpeg: ['jpeg'],
}

/** Each image type Hexlode reads, with its file extensions. */
export function openableImages(): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(IMAGE_MIME_TYPES).map(([format, type]) => {
      const key = format as keyof typeof IMAGE_EXTENSIONS
      const extensions = [IMAGE_EXTENSIONS[key], ...(OTHER_EXTENSIONS[key] ?? [])]
      return [type, extensions.map((extension) => `.${extension}`)]
    }),
  )
}

/** Images and `.hexlode` pipeline files, as the manifest's file handler accepts them. */
export function openableFiles(): Record<string, string[]> {
  return { ...openableImages(), [PIPELINE_FILE_TYPE]: [PIPELINE_FILE_EXTENSION] }
}
