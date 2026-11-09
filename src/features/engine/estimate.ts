/**
 * Predicts the work of a run before it starts: how many items decode and encode, which skip, what
 * the step cache already holds, and roughly how long it takes on this device.
 */
import { createFlowPlan } from '#/features/engine/flow'
import { itemType } from '#/features/engine/item-types'
import { entryKey, outputKey } from '#/features/engine/keys'
import type { StepCacheEntry } from '#/features/engine/step-cache'
import type { ImageFormat, ItemMeta, NodeRegistry, Pipeline } from '#/features/engine/types'
import { DECODE_MS_PER_MEGAPIXEL, megapixels } from '#/features/nodes/cost'
import { formatBytes } from '#/lib/format'

export interface EstimateOptions {
  pipeline: Pipeline
  registry: NodeRegistry
  sources: { key: string; meta: ItemMeta }[]
  workers: number
  lookup?: (entryKey: string) => StepCacheEntry | undefined
  /** Measured time divided by estimated time in earlier runs on this device. */
  speedFactor?: number
  /** What the page knows about each on-device model the pipeline may run, by model ID. */
  models?: Record<string, ModelTiming>
}

export interface ModelTiming {
  /** One run on this device's backend. */
  msPerRun: number
  /** Reading the model and preparing it for the backend, once per run. */
  startMs: number
  /** The one-time download, while the model is not in this browser yet. */
  download?: { bytes: number; ms: number }
}

export interface Estimate {
  items: number
  decodes: number
  encodes: number
  skipped: number
  cached: number
  seconds: number
  /** Bytes of models the run must download first, included in `seconds`. */
  downloadBytes: number
  /** Entry keys of every node step the run would take. */
  entryKeys: string[]
}

interface State {
  key: string
  meta: ItemMeta
  weight: number
  decoded: boolean
  encoded: boolean
}

export function estimateRun(options: EstimateOptions): Estimate {
  const plan = createFlowPlan(options.pipeline, options.registry)
  const totals = { decodes: 0, encodes: 0, skipped: 0, cached: 0, ms: 0, serialMs: 0 }
  const entryKeys: string[] = []
  const modelsUsed = new Set<string>()

  /** Model runs wait for the one inference worker, so they add up instead of being shared. */
  const countModel = (model: { id: string; runs: number } | undefined, weight: number) => {
    const timing = model ? options.models?.[model.id] : undefined
    if (!model || !timing) return
    modelsUsed.add(model.id)
    totals.serialMs += timing.msPerRun * model.runs * weight
  }

  const visit = (nodeId: string, state: State) => {
    const planned = plan.nodes.get(nodeId)
    if (!planned) return
    if (!planned.accepts.has(itemType(state.meta.kind, state.meta.format))) {
      totals.skipped += state.weight
      return
    }
    const { definition, settings } = planned
    if (definition.mode === 'all') {
      passThrough(nodeId, state)
      return
    }
    const entry = entryKey(planned.key, [state.key])
    entryKeys.push(entry)
    const cached = definition.cacheable ? options.lookup?.(entry) : undefined
    let outputs: { port: string; meta: ItemMeta; key: string }[]
    let next: Pick<State, 'decoded' | 'encoded'> = state
    if (cached) {
      totals.cached += state.weight
      outputs = cached.outputs
      next = { decoded: false, encoded: cached.outputs.every((o) => o.meta.size !== undefined) }
    } else {
      const cost = definition.cost?.(settings, state.meta, { encoded: state.encoded }) ?? {
        ms: 0,
        encodes: 0,
        needsPixels: false,
      }
      let decoded = state.decoded
      if (cost.needsPixels && !decoded) {
        totals.decodes += state.weight
        totals.ms +=
          DECODE_MS_PER_MEGAPIXEL[state.meta.format as ImageFormat] *
          megapixels(state.meta) *
          state.weight
        decoded = true
      }
      totals.encodes += cost.encodes * state.weight
      totals.ms += cost.ms * state.weight
      countModel(cost.model, state.weight)
      const simulated = definition.simulate?.(settings, state.meta)
      const ports = definition.ports(settings)
      outputs = (
        simulated ??
        ports.map((port) => ({ port: port.id, meta: state.meta, share: 1 / ports.length }))
      ).map((output, index) => ({ ...output, key: outputKey(entry, index) }))
      const pixelOnly = outputs.some((output) => output.meta.size === undefined)
      const encodes = cost.encodes > 0
      next = {
        decoded: pixelOnly || (decoded && !encodes),
        encoded: !pixelOnly && (state.encoded || encodes),
      }
      if (!simulated) {
        for (const output of outputs) {
          forward(nodeId, output.port, {
            ...state,
            ...next,
            key: output.key,
            weight: state.weight / outputs.length,
          })
        }
        return
      }
    }
    for (const output of outputs) {
      forward(nodeId, output.port, {
        ...next,
        key: output.key,
        meta: output.meta,
        weight: state.weight,
      })
    }
  }

  /**
   * A combining node that passes items on by reference simulates where each item leaves. The item
   * keeps its key, and waited without its pixels. Other combining nodes end the estimate.
   */
  const passThrough = (nodeId: string, state: State) => {
    const planned = plan.nodes.get(nodeId)
    if (!planned) return
    const { definition, settings } = planned
    const passed = definition.simulate?.(settings, state.meta)
    if (!passed) return
    const cost = definition.cost?.(settings, state.meta, { encoded: state.encoded })
    if (cost?.needsPixels && !state.decoded) {
      totals.decodes += state.weight
      totals.ms +=
        DECODE_MS_PER_MEGAPIXEL[state.meta.format as ImageFormat] *
        megapixels(state.meta) *
        state.weight
    }
    totals.ms += (cost?.ms ?? 0) * state.weight
    countModel(cost?.model, state.weight)
    for (const output of passed) {
      forward(nodeId, output.port, { ...state, meta: output.meta, decoded: false })
    }
  }

  const forward = (nodeId: string, port: string, state: State) => {
    const planned = plan.nodes.get(nodeId)
    for (const connection of planned?.outgoing.get(port) ?? []) visit(connection.target, state)
  }

  for (const source of options.sources) {
    forward(plan.filesId, 'out', {
      key: source.key,
      meta: source.meta,
      weight: 1,
      decoded: false,
      encoded: true,
    })
  }

  let startMs = 0
  let downloadMs = 0
  let downloadBytes = 0
  for (const id of modelsUsed) {
    const timing = options.models?.[id]
    startMs += timing?.startMs ?? 0
    downloadMs += timing?.download?.ms ?? 0
    downloadBytes += timing?.download?.bytes ?? 0
  }
  const workMs = totals.ms / Math.max(1, options.workers) + totals.serialMs + startMs
  const round = (value: number) => Math.round(value)
  return {
    items: options.sources.length,
    decodes: round(totals.decodes),
    encodes: round(totals.encodes),
    skipped: round(totals.skipped),
    cached: round(totals.cached),
    // The download depends on the connection, not on how fast this device computes.
    seconds: (workMs * (options.speedFactor ?? 1) + downloadMs) / 1000,
    downloadBytes,
    entryKeys,
  }
}

const count = new Intl.NumberFormat('en')

function describeDuration(seconds: number) {
  if (seconds < 20) return 'a few seconds'
  if (seconds < 90) return `roughly ${Math.round(seconds / 10) * 10} seconds`
  const minutes = Math.round(seconds / 60)
  if (minutes < 90) return `roughly ${minutes} minute${minutes === 1 ? '' : 's'}`
  const hours = Math.round(minutes / 6) / 10
  return `roughly ${hours} hours`
}

/** "about 2,000 encodes, roughly 12 minutes on this device" */
export function describeEstimate(
  estimate: Pick<Estimate, 'encodes' | 'seconds'> & { downloadBytes?: number },
) {
  const encodes =
    estimate.encodes === 0
      ? 'no encodes'
      : `about ${count.format(estimate.encodes)} encode${estimate.encodes === 1 ? '' : 's'}`
  const download = estimate.downloadBytes
    ? `, after a one-time ${formatBytes(estimate.downloadBytes)} download`
    : ''
  return `${encodes}, ${describeDuration(estimate.seconds)} on this device${download}`
}
