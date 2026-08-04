/// <reference lib="webworker" />

import { calculateTargetSize } from '#/features/processing/processing-plan'
import {
  processImageRequestSchema,
  type WorkerResponse,
} from '#/features/processing/worker/protocol'

const workerScope = self as unknown as DedicatedWorkerGlobalScope

const OUTPUT_MIME_TYPES = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const

function post(message: WorkerResponse, transfer: Transferable[] = []) {
  workerScope.postMessage(message, transfer)
}

workerScope.onmessage = async (event: MessageEvent<unknown>) => {
  const parsed = processImageRequestSchema.safeParse(event.data)
  if (!parsed.success) {
    post({
      type: 'error',
      id: 'unknown',
      code: 'invalid_message',
      message: 'The processing request was invalid.',
    })
    return
  }

  const request = parsed.data
  const startedAt = performance.now()
  let bitmap: ImageBitmap | undefined
  let failureCode: 'decode_failed' | 'encode_failed' = 'decode_failed'

  try {
    if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') {
      post({
        type: 'error',
        id: request.id,
        code: 'unsupported_browser',
        message: 'This browser cannot process images away from the main interface.',
      })
      return
    }

    post({ type: 'progress', id: request.id, stage: 'decode', progress: 12 })
    bitmap = await createImageBitmap(
      new Blob([request.input.buffer], { type: request.input.mimeType }),
      { imageOrientation: 'from-image' },
    )
    post({ type: 'progress', id: request.id, stage: 'resize', progress: 45 })

    const target = calculateTargetSize(bitmap.width, bitmap.height, request.options.maxDimension)
    const canvas = new OffscreenCanvas(target.width, target.height)
    const preservesTransparency = request.options.format !== 'jpeg'
    const context = canvas.getContext('2d', { alpha: preservesTransparency })
    if (!context) throw new Error('A 2D image context is not available.')

    if (!preservesTransparency) {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, target.width, target.height)
    }
    context.drawImage(bitmap, 0, 0, target.width, target.height)
    bitmap.close()
    bitmap = undefined
    failureCode = 'encode_failed'
    post({ type: 'progress', id: request.id, stage: 'encode', progress: 72 })

    const mimeType = OUTPUT_MIME_TYPES[request.options.format]
    const output = await canvas.convertToBlob({
      type: mimeType,
      quality: request.options.quality / 100,
    })
    if (output.type !== mimeType) {
      post({
        type: 'error',
        id: request.id,
        code: 'encode_failed',
        message: `This browser could not create a ${request.options.format.toUpperCase()} image.`,
      })
      return
    }

    const outputBuffer = await output.arrayBuffer()
    const warnings = ['Embedded metadata is removed from the output.']
    if (!preservesTransparency) {
      warnings.push('Transparent pixels are flattened onto white for JPEG output.')
    }
    if (output.size >= request.input.buffer.byteLength) {
      warnings.push('The output is not smaller than the source image.')
    }

    post(
      {
        type: 'result',
        id: request.id,
        output: outputBuffer,
        mimeType,
        width: target.width,
        height: target.height,
        durationMs: performance.now() - startedAt,
        warnings,
      },
      [outputBuffer],
    )
  } catch (error) {
    post({
      type: 'error',
      id: request.id,
      code: failureCode,
      message: error instanceof Error ? error.message : 'The browser could not process this image.',
    })
  } finally {
    bitmap?.close()
  }
}
