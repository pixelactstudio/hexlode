/**
 * The engine or preview worker's side of the inference worker: a Segmenter that sends square
 * images through a MessagePort and waits for their masks. Only the small image crosses threads;
 * the full-size pixels stay in the worker that owns the item.
 */
import { BACKGROUND_MODEL } from '#/features/background-removal/constants'
import type { SegmentationModel, Segmenter } from '#/features/background-removal/types'
import { segmentResponseSchema } from '#/features/background-removal/validators'

export function createSegmenterClient(
  port: MessagePort,
  model: Pick<SegmentationModel, 'inputSize'> = BACKGROUND_MODEL,
): Segmenter {
  let counter = 0
  const waiting = new Map<number, { resolve(mask: Uint8Array): void; reject(e: Error): void }>()
  port.onmessage = (event: MessageEvent<unknown>) => {
    const parsed = segmentResponseSchema.safeParse(event.data)
    if (!parsed.success) return
    const response = parsed.data
    const entry = waiting.get(response.id)
    waiting.delete(response.id)
    if (response.type === 'mask') entry?.resolve(response.mask)
    else entry?.reject(new Error(response.message))
  }
  return {
    inputSize: model.inputSize,
    segment(pixels, signal) {
      counter += 1
      const id = counter
      const data = new Uint8ClampedArray(pixels.data)
      return new Promise<Uint8Array>((resolve, reject) => {
        if (signal?.aborted) {
          reject(new Error('The run was cancelled.'))
          return
        }
        waiting.set(id, { resolve, reject })
        port.postMessage(
          { type: 'segment', id, width: pixels.width, height: pixels.height, data },
          [data.buffer],
        )
      })
    },
  }
}
