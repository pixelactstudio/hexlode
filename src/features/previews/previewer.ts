/**
 * Main-thread side of live previews. The latest render request wins; older ones resolve to null.
 */
import { modelsOf } from '#/features/engine/models'
import type { Pipeline } from '#/features/engine/types'
import { productRegistry } from '#/features/nodes/registry'
import {
  type NodePreview,
  type PreviewResponse,
  previewResponseSchema,
} from '#/features/previews/protocol'

export type { NodePreview } from '#/features/previews/protocol'

export interface SampleInfo {
  name: string
  width: number
  height: number
  format: string
}

export interface PreviewerOptions {
  /** A port to the shared inference worker, asked for once a pipeline runs an on-device model. */
  connectInference?: () => MessagePort
}

export function createPreviewer(createWorker: () => Worker, options: PreviewerOptions = {}) {
  const worker = createWorker()
  let connected = false
  let counter = 0
  let latestRender = 0
  const waiting = new Map<number, (response: PreviewResponse) => void>()

  worker.onmessage = (event: MessageEvent<unknown>) => {
    const parsed = previewResponseSchema.safeParse(event.data)
    if (!parsed.success) return
    waiting.get(parsed.data.requestId)?.(parsed.data)
    waiting.delete(parsed.data.requestId)
  }

  const request = (message: Record<string, unknown>) => {
    counter += 1
    const requestId = counter
    const response = new Promise<PreviewResponse>((resolve) => waiting.set(requestId, resolve))
    worker.postMessage({ ...message, requestId })
    return { requestId, response }
  }

  return {
    async setSample(file: Blob, name: string): Promise<SampleInfo> {
      const { response } = request({ type: 'sample', file, name })
      const result = await response
      if (result.type !== 'sample' || result.error) {
        throw new Error(result.type === 'sample' ? result.error : 'The sample failed.')
      }
      return {
        name: result.name ?? name,
        width: result.width ?? 0,
        height: result.height ?? 0,
        format: result.format ?? '',
      }
    },
    /** Resolves to null when a newer render was requested before this one finished. */
    async render(pipeline: Pipeline): Promise<NodePreview[] | null> {
      if (
        !connected &&
        options.connectInference &&
        modelsOf(pipeline, productRegistry).length > 0
      ) {
        connected = true
        const port = options.connectInference()
        worker.postMessage({ type: 'inference', port }, [port])
      }
      const { requestId, response } = request({ type: 'render', pipeline })
      latestRender = requestId
      const result = await response
      if (result.type !== 'render' || result.superseded || requestId !== latestRender) return null
      if (result.error) throw new Error(result.error)
      return result.nodes
    },
    dispose() {
      worker.terminate()
      waiting.clear()
    },
  }
}

export type Previewer = ReturnType<typeof createPreviewer>
