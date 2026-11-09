/**
 * Main-thread side of file previews: asks a worker to draw files the browser cannot show. The
 * worker starts on the first request.
 */
import { FILE_PREVIEW_EDGE } from '#/features/previews/constants'
import { type ThumbnailResponse, thumbnailResponseSchema } from '#/features/previews/protocol'

export function createThumbnailer(
  createWorker: () => Worker,
  { edge = FILE_PREVIEW_EDGE }: { edge?: number } = {},
) {
  let worker: Worker | undefined
  let counter = 0
  const waiting = new Map<number, (response: ThumbnailResponse) => void>()

  const started = () => {
    if (worker) return worker
    worker = createWorker()
    worker.onmessage = (event: MessageEvent<unknown>) => {
      const parsed = thumbnailResponseSchema.safeParse(event.data)
      if (!parsed.success) return
      waiting.get(parsed.data.id)?.(parsed.data)
      waiting.delete(parsed.data.id)
    }
    return worker
  }

  return {
    /** A PNG of the file, upright and no larger than the edge. */
    async render(file: Blob, name: string): Promise<Blob> {
      counter += 1
      const id = counter
      const response = new Promise<ThumbnailResponse>((resolve) => waiting.set(id, resolve))
      started().postMessage({ id, file, name, edge })
      const { image, error } = await response
      if (!image) throw new Error(error ?? 'The preview failed.')
      return image
    },
    dispose() {
      worker?.terminate()
      worker = undefined
      waiting.clear()
    },
  }
}

export type Thumbnailer = ReturnType<typeof createThumbnailer>
