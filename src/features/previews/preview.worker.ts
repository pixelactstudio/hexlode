/// <reference lib="webworker" />
/**
 * Renders live previews: runs the pipeline on the sample image and returns a thumbnail per node.
 * Keeps a step cache in memory, so a settings change renders only that node and those after it.
 */
import {
  PREVIEW_CACHE_BUDGET_BYTES,
  PREVIEW_COMPARE_EDGE,
  PREVIEW_SAMPLE_EDGE,
  PREVIEW_THUMBNAIL_EDGE,
} from '#/features/engine/constants'
import { createFlowPlan, flowGather, flowSource } from '#/features/engine/flow'
import { createMemoryStepCache } from '#/features/engine/memory-step-cache'
import { createMemorySpillStore } from '#/features/engine/stores'
import type { Item, Pipeline } from '#/features/engine/types'
import { jsquashCodecs } from '#/features/images/codecs'
import { asImage, imageKind, loadImageItem, pixelsOf } from '#/features/images/image-item'
import { displayBlob, scaleDown } from '#/features/images/thumbnail'
import type { ImageItem } from '#/features/images/types'
import { productRegistry } from '#/features/nodes/registry'
import {
  type NodePreview,
  type PreviewRequest,
  type PreviewResponse,
  previewRequestSchema,
} from '#/features/previews/protocol'

const scope = self as unknown as DedicatedWorkerGlobalScope
const post = (message: PreviewResponse) => scope.postMessage(message)
const cache = createMemoryStepCache({ budgetBytes: PREVIEW_CACHE_BUDGET_BYTES })
const thumbnails = new Map<string, Blob>()

let sample: { item: ImageItem; key: string; before?: Blob } | undefined
let sampleCounter = 0
let pendingRender: Extract<PreviewRequest, { type: 'render' }> | undefined
let busy = false

async function renderPixels(item: ImageItem, edge: number) {
  const copy: ImageItem = { meta: item.meta, payload: { ...item.payload } }
  return displayBlob(await scaleDown(await pixelsOf(copy, jsquashCodecs), edge, jsquashCodecs))
}

async function setSample(file: Blob, name: string) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let item = await loadImageItem(bytes, name)
  const longest = Math.max(item.meta.width ?? 0, item.meta.height ?? 0)
  if (longest > PREVIEW_SAMPLE_EDGE) {
    const pixels = await scaleDown(
      await pixelsOf(item, jsquashCodecs),
      PREVIEW_SAMPLE_EDGE,
      jsquashCodecs,
    )
    item = {
      meta: { ...item.meta, width: pixels.width, height: pixels.height, size: undefined },
      payload: { pixels, metadata: item.payload.metadata, metadataChanged: true },
    }
  }
  sampleCounter += 1
  thumbnails.clear()
  cache.clear()
  sample = { item, key: `sample-${sampleCounter}` }
  return item
}

async function render(pipeline: Pipeline): Promise<NodePreview[]> {
  if (!sample) return []
  const current = sample
  const plan = createFlowPlan(pipeline, productRegistry)
  const previews = new Map<string, NodePreview>()
  const entry = (nodeId: string) => {
    let preview = previews.get(nodeId)
    if (!preview) {
      preview = { nodeId, status: 'processed', warnings: [] }
      previews.set(nodeId, preview)
    }
    return preview
  }
  const compareNodes = new Set(
    pipeline.nodes.filter((node) => node.type === 'compare').map((node) => node.id),
  )
  const deps = {
    plan,
    services: { codecs: jsquashCodecs, output: { write: async () => undefined } },
    spill: createMemorySpillStore(),
    cache,
    kinds: { image: imageKind },
    signal: new AbortController().signal,
    emit: (event: Parameters<Parameters<typeof flowSource>[0]['emit']>[0]) => {
      if (event.type === 'node-item' && (event.status === 'skipped' || event.status === 'failed')) {
        const preview = entry(event.nodeId)
        if (preview.status === 'processed' || preview.status === 'cached') {
          if (!preview.thumbnail) preview.status = event.status
        }
        if (event.error) preview.error = event.error
      }
      if (event.type === 'node-warning') entry(event.nodeId).warnings.push(event.warning.message)
    },
    observe: async (nodeId: string, _port: string, item: Item, status: 'processed' | 'cached') => {
      const preview = entry(nodeId)
      if (preview.thumbnail) return
      const image = asImage(item)
      preview.status = status
      preview.format = image.meta.format
      preview.width = image.meta.width
      preview.height = image.meta.height
      preview.size = image.meta.size
      const key = `${current.key}:${nodeId}:${image.meta.format}:${image.meta.size}:${image.meta.width}x${image.meta.height}:${status === 'cached' ? 'c' : Math.random()}`
      let thumbnail = thumbnails.get(key)
      if (!thumbnail) {
        thumbnail = await renderPixels(image, PREVIEW_THUMBNAIL_EDGE)
        if (status === 'cached') thumbnails.set(key, thumbnail)
      }
      preview.thumbnail = thumbnail
      if (compareNodes.has(nodeId)) {
        current.before ??= await renderPixels(current.item, PREVIEW_COMPARE_EDGE)
        preview.before = current.before
        preview.after = await renderPixels(image, PREVIEW_COMPARE_EDGE)
      }
    },
  }
  const source = { index: 0, key: current.key, meta: current.item.meta }
  const item: ImageItem = { meta: current.item.meta, payload: { ...current.item.payload } }
  const filesPreview = entry(plan.filesId)
  filesPreview.format = current.item.meta.format
  filesPreview.width = current.item.meta.width
  filesPreview.height = current.item.meta.height
  filesPreview.size = current.item.meta.size
  filesPreview.thumbnail = await renderPixels(current.item, PREVIEW_THUMBNAIL_EDGE)
  await flowSource(deps, source, async () => item)
  for (const gather of plan.gathers) await flowGather(deps, gather)
  return [...previews.values()]
}

async function pump() {
  if (busy || !pendingRender) return
  busy = true
  const request = pendingRender
  pendingRender = undefined
  try {
    post({
      type: 'render',
      requestId: request.requestId,
      nodes: await render(request.pipeline as unknown as Pipeline),
    })
  } catch (reason) {
    post({
      type: 'render',
      requestId: request.requestId,
      nodes: [],
      error: reason instanceof Error ? reason.message : 'The preview failed.',
    })
  } finally {
    busy = false
    void pump()
  }
}

let sampleQueue = Promise.resolve()

scope.onmessage = (event: MessageEvent<unknown>) => {
  const parsed = previewRequestSchema.safeParse(event.data)
  if (!parsed.success) return
  const request = parsed.data
  if (request.type === 'render') {
    if (pendingRender) {
      post({ type: 'render', requestId: pendingRender.requestId, nodes: [], superseded: true })
    }
    pendingRender = request
    sampleQueue = sampleQueue.then(pump)
    return
  }
  sampleQueue = sampleQueue.then(async () => {
    try {
      const item = await setSample(request.file, request.name)
      post({
        type: 'sample',
        requestId: request.requestId,
        name: request.name,
        width: item.meta.source.width,
        height: item.meta.source.height,
        format: item.meta.format,
      })
    } catch (reason) {
      post({
        type: 'sample',
        requestId: request.requestId,
        error: reason instanceof Error ? reason.message : 'This file cannot be used as a sample.',
      })
    }
  })
}
