/**
 * Everything a page needs to run a pipeline on the user's files: preparing sources, the estimate,
 * starting and cancelling runs, statistics and deliveries. Plain TypeScript; pages subscribe.
 */

import { track } from '#/features/analytics/analytics'
import type { QUICK_TOOLS } from '#/features/analytics/events'
import { pipelineShape } from '#/features/analytics/pipeline-shape'
import { filesAccepts } from '#/features/engine/compatibility'
import { type Estimate, estimateRun } from '#/features/engine/estimate'
import type { FolderTarget } from '#/features/engine/opfs/run-stores'
import { createWorkerPoolHost } from '#/features/engine/pool-host'
import { choosePoolSize, deviceProfile } from '#/features/engine/pool-size'
import { runPipeline, type SourceItem } from '#/features/engine/runner'
import type { Delivery, ItemTypeSet, NodeRegistry, Pipeline } from '#/features/engine/types'
import { recordRunSpeed, speedFactor } from '#/features/runs/calibration'
import { createEngineWorker, engineRuntime } from '#/features/runs/engine-runtime'
import { createRunStats, type RunSnapshot } from '#/features/runs/run-stats'
import { type InputFile, prepareSources, type RefusedFile } from '#/features/runs/sources'
import { downloadBlob } from '#/lib/download'

type Surface = 'quick-tool' | 'pipeline-tool' | 'studio'

export interface RunControllerState {
  files: InputFile[]
  sources: SourceItem[]
  refused: RefusedFile[]
  accepts: ItemTypeSet
  estimate: Estimate | null
  workers: number
  preparing: boolean
  running: boolean
  stats: RunSnapshot
  error: string | null
}

export interface StartOptions {
  folders?: Map<string, FolderTarget>
  singleFileAsIs?: boolean
}

function filesNodeId(pipeline: Pipeline, registry: NodeRegistry) {
  return pipeline.nodes.find((node) => registry.get(node.type)?.hasInput === false)?.id
}

function sameFile(a: InputFile, b: InputFile) {
  return (
    a.relativePath === b.relativePath &&
    a.file.size === b.file.size &&
    a.file.lastModified === b.file.lastModified
  )
}

export function createRunController(options: {
  registry: NodeRegistry
  surface: Surface
  tool?: (typeof QUICK_TOOLS)[number]
  outputNodeId?: string
}) {
  const { registry, surface, tool } = options
  const stats = createRunStats({ outputNodeId: options.outputNodeId })
  const listeners = new Set<() => void>()
  let pipeline: Pipeline | undefined
  let controller: AbortController | undefined
  let host: ReturnType<typeof createWorkerPoolHost> | undefined
  let preparation = 0
  let state: RunControllerState = {
    files: [],
    sources: [],
    refused: [],
    accepts: new Set(),
    estimate: null,
    workers: 1,
    preparing: false,
    running: false,
    stats: stats.snapshot(),
    error: null,
  }

  const set = (changes: Partial<RunControllerState>) => {
    state = { ...state, ...changes }
    for (const listener of listeners) listener()
  }

  stats.subscribe(() => set({ stats: stats.snapshot() }))

  const prepare = async () => {
    if (!pipeline) return
    const current = ++preparation
    const filesId = filesNodeId(pipeline, registry)
    const accepts = filesId ? filesAccepts(pipeline, registry, filesId) : new Set<never>()
    set({ preparing: true, accepts })
    try {
      const { sources, refused } = await prepareSources(state.files, accepts)
      if (current !== preparation) return
      const largest = Math.max(
        0,
        ...sources.map((s) => (s.meta.width ?? 0) * (s.meta.height ?? 0) * 4),
      )
      const workers = choosePoolSize(deviceProfile(largest))
      const { index } = await engineRuntime()
      let estimate: Estimate | null = null
      try {
        estimate = estimateRun({
          pipeline,
          registry,
          sources,
          workers,
          lookup: index ? (key) => index.entry(key) : undefined,
          speedFactor: speedFactor(),
        })
      } catch {
        estimate = null
      }
      if (current !== preparation) return
      set({ sources, refused, workers, estimate, preparing: false, error: null })
    } catch (reason) {
      if (current !== preparation) return
      set({
        preparing: false,
        error: reason instanceof Error ? reason.message : 'Files could not be read.',
      })
    }
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    /** Sets the pipeline to run. Recomputes what Files accepts and the estimate. */
    async setPipeline(next: Pipeline) {
      pipeline = next
      await prepare()
    },
    async addFiles(inputs: InputFile[]) {
      const fresh = inputs.filter((input) => !state.files.some((file) => sameFile(file, input)))
      set({ files: [...state.files, ...fresh] })
      await prepare()
      track('files_added', {
        surface,
        accepted: state.sources.length,
        refused: state.refused.length,
        refusalCodes: [...new Set(state.refused.map((file) => file.code))],
      })
    },
    async removeFile(relativePath: string) {
      set({ files: state.files.filter((file) => file.relativePath !== relativePath) })
      await prepare()
    },
    async clearFiles() {
      set({ files: [], sources: [], refused: [], estimate: null })
      stats.reset()
    },
    async start(startOptions: StartOptions = {}) {
      if (!pipeline || state.running || state.sources.length === 0) return undefined
      const runPipelineNow = pipeline
      const { index } = await engineRuntime()
      controller = new AbortController()
      host?.dispose()
      host = createWorkerPoolHost({
        size: state.workers,
        createWorker: createEngineWorker,
        index,
        folders: startOptions.folders,
        singleFileAsIs: startOptions.singleFileAsIs,
        archiveNames: new Map(
          runPipelineNow.nodes
            .filter((node) => node.type === 'output')
            .map((node) => [node.id, String(node.settings.archiveName ?? 'hexlode')]),
        ),
      })
      const estimate = state.estimate
      set({ running: true, error: null })
      track('run_started', {
        surface,
        tool,
        itemCount: state.sources.length,
        workers: state.workers,
        estimatedEncodes: estimate?.encodes ?? 0,
        estimatedSeconds: Math.round(estimate?.seconds ?? 0),
        pipeline: pipelineShape(runPipelineNow, registry),
      })
      const autoDownload = new Set(
        runPipelineNow.nodes
          .filter((node) => node.type === 'output' && node.settings.autoDownload === true)
          .map((node) => node.id),
      )
      const result = await runPipeline({
        pipeline: runPipelineNow,
        registry,
        sources: state.sources,
        host,
        signal: controller.signal,
        onEvent: (event) => {
          stats.apply(event)
          if (event.type === 'delivery-ready' && autoDownload.has(event.nodeId)) {
            void deliver(event.delivery, true)
          }
        },
      })
      const snapshot = stats.snapshot()
      const totals = Object.values(snapshot.nodes)
      const outputs = runPipelineNow.nodes.filter((node) => node.type === 'output')
      const outputStats = outputs.map((node) => snapshot.nodes[node.id]).filter(Boolean)
      if (result.status === 'complete' && estimate) {
        recordRunSpeed(estimate.seconds, result.ms / 1000)
      }
      track('run_finished', {
        surface,
        tool,
        status: result.status,
        itemCount: state.sources.length,
        processed: outputStats.reduce((sum, node) => sum + node.processed, 0),
        skipped: totals.reduce((sum, node) => sum + node.skipped, 0),
        failed: totals.reduce((sum, node) => sum + node.failed, 0),
        cached: totals.reduce((sum, node) => sum + node.cached, 0),
        durationMs: Math.round(result.ms),
        inputBytes: state.sources.reduce((sum, source) => sum + (source.meta.size ?? 0), 0),
        outputBytes: result.deliveries.reduce((sum, delivery) => sum + delivery.bytes, 0),
        failureCodes: result.error ? ['run_error'] : [],
        warningCodes: snapshot.warningCodes,
      })
      set({ running: false, error: result.error ?? null })
      void prepare()
      return result
    },
    cancel() {
      controller?.abort()
    },
    /** Stops work and releases workers. The controller stays usable; a new run starts fresh. */
    dispose() {
      controller?.abort()
      host?.dispose()
      host = undefined
    },
  }

  async function deliver(delivery: Delivery, automatic: boolean) {
    if (!delivery.archive) return
    const name = delivery.archive instanceof File ? delivery.archive.name : 'hexlode.zip'
    downloadBlob(delivery.archive, name)
    track('delivery_downloaded', {
      surface,
      destination: delivery.files.length === 1 && !name.endsWith('.zip') ? 'file' : 'zip',
      automatic,
      fileCount: delivery.files.length,
      bytes: delivery.bytes,
    })
  }
}

export type RunController = ReturnType<typeof createRunController>

/** Downloads a delivery on request. */
export function downloadDelivery(delivery: Delivery, surface: Surface) {
  if (!delivery.archive) return
  const name = delivery.archive instanceof File ? delivery.archive.name : 'hexlode.zip'
  downloadBlob(delivery.archive, name)
  track('delivery_downloaded', {
    surface,
    destination: name.endsWith('.zip') ? 'zip' : 'file',
    automatic: false,
    fileCount: delivery.files.length,
    bytes: delivery.bytes,
  })
}
