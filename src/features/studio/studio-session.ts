/**
 * Joins the Studio's parts: the pipeline store, the run controller for the Files node's images,
 * and live previews on the sample image. Plain TypeScript; the page subscribes.
 */

import { track } from '#/features/analytics/analytics'
import type { NodeRegistry } from '#/features/engine/types'
import {
  createPreviewer,
  type NodePreview,
  type Previewer,
  type SampleInfo,
} from '#/features/previews/previewer'
import { createPreviewWorker } from '#/features/runs/engine-runtime'
import { createRunController } from '#/features/runs/run-controller'
import { PREVIEW_DEBOUNCE_MS } from '#/features/studio/constants'
import { createStudioStore } from '#/features/studio/studio-store'

export interface PreviewView extends Omit<NodePreview, 'thumbnail' | 'before' | 'after'> {
  thumbnail?: string
  before?: string
  after?: string
}

export interface PreviewState {
  sample: SampleInfo | null
  sampleFile: File | null
  nodes: Record<string, PreviewView>
  rendering: boolean
  error: string | null
}

export function createStudioSession(registry: NodeRegistry) {
  const store = createStudioStore(registry)
  const runs = createRunController({ registry, surface: 'studio' })
  const listeners = new Set<() => void>()
  const urls = new Map<Blob, string>()
  let previewer: Previewer | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let previews: PreviewState = {
    sample: null,
    sampleFile: null,
    nodes: {},
    rendering: false,
    error: null,
  }

  const setPreviews = (changes: Partial<PreviewState>) => {
    previews = { ...previews, ...changes }
    for (const listener of listeners) listener()
  }

  const urlOf = (blob: Blob | undefined, keep: Set<Blob>) => {
    if (!blob) return undefined
    keep.add(blob)
    let url = urls.get(blob)
    if (!url) {
      url = URL.createObjectURL(blob)
      urls.set(blob, url)
    }
    return url
  }

  const render = async () => {
    if (!previewer || !previews.sample) return
    setPreviews({ rendering: true })
    try {
      const result = await previewer.render(store.getState().pipeline)
      if (!result) return
      const keep = new Set<Blob>()
      const nodes: Record<string, PreviewView> = {}
      for (const preview of result) {
        nodes[preview.nodeId] = {
          ...preview,
          thumbnail: urlOf(preview.thumbnail, keep),
          before: urlOf(preview.before, keep),
          after: urlOf(preview.after, keep),
        }
      }
      for (const [blob, url] of urls) {
        if (keep.has(blob)) continue
        URL.revokeObjectURL(url)
        urls.delete(blob)
      }
      setPreviews({ nodes, rendering: false, error: null })
    } catch (reason) {
      setPreviews({
        rendering: false,
        error: reason instanceof Error ? reason.message : 'Preview failed.',
      })
    }
  }

  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      void runs.setPipeline(store.getState().pipeline)
      void render()
    }, PREVIEW_DEBOUNCE_MS)
  }

  let lastPipeline = store.getState().pipeline
  store.subscribe(() => {
    const { pipeline } = store.getState()
    if (pipeline === lastPipeline) return
    lastPipeline = pipeline
    schedule()
  })

  const setSample = async (file: File, source: 'first-file' | 'picked') => {
    previewer ??= createPreviewer(createPreviewWorker)
    try {
      const sample = await previewer.setSample(file, file.name)
      setPreviews({ sample, sampleFile: file, error: null })
      track('sample_chosen', { source })
      await render()
    } catch (reason) {
      setPreviews({
        error: reason instanceof Error ? reason.message : 'This file cannot be a sample.',
      })
    }
  }

  // The first usable image becomes the sample until the user picks one.
  runs.subscribe(() => {
    if (previews.sampleFile) return
    const first = runs.getState().sources[0]?.file
    if (first instanceof File) void setSample(first, 'first-file')
  })

  return {
    store,
    runs,
    getPreviews: () => previews,
    subscribePreviews(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setSample: (file: File) => setSample(file, 'picked'),
    refresh: schedule,
    /** Releases workers. The session stays usable, so remounting a component works. */
    dispose() {
      clearTimeout(timer)
      previewer?.dispose()
      previewer = null
      runs.dispose()
      if (previews.sampleFile) {
        const file = previews.sampleFile
        previews = { ...previews, sampleFile: null, sample: null }
        // Recreate the preview worker with the same sample if the page is still shown.
        queueMicrotask(() => {
          if (listeners.size > 0) void setSample(file, 'picked')
        })
      }
    },
  }
}

export type StudioSession = ReturnType<typeof createStudioSession>
