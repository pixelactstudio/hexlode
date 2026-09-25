/**
 * Runs a pipeline over source items. The host decides where the work happens (inline or in a
 * worker pool) and where results are stored; this module owns the order of work: sources
 * stream through with bounded concurrency, combining nodes run once everything upstream is done,
 * and each Output node delivers as soon as nothing more can reach it.
 */
import { createFlowPlan, type FlowPlan, type SourceItem } from '#/features/engine/flow'
import { runQueue } from '#/features/engine/queue'
import type { Delivery, NodeRegistry, Pipeline, RunEvent, RunStatus } from '#/features/engine/types'
import { createId } from '#/lib/create-id'

export type { SourceItem } from '#/features/engine/flow'

export interface RunHost {
  /** How many source items may be in flight at once. */
  concurrency: number
  begin(run: { runId: string; pipeline: Pipeline; plan: FlowPlan }): Promise<void>
  runSource(source: SourceItem, emit: (event: RunEvent) => void, signal: AbortSignal): Promise<void>
  runGather(nodeId: string, emit: (event: RunEvent) => void, signal: AbortSignal): Promise<void>
  deliver(nodeId: string): Promise<Delivery>
  end(status: RunStatus): Promise<void>
}

export interface RunOptions {
  pipeline: Pipeline
  registry: NodeRegistry
  sources: SourceItem[]
  host: RunHost
  signal?: AbortSignal
  onEvent?: (event: RunEvent) => void
}

export interface RunResult {
  runId: string
  status: RunStatus
  ms: number
  deliveries: Delivery[]
  error?: string
}

export async function runPipeline(options: RunOptions): Promise<RunResult> {
  const { host, sources } = options
  const runId = createId()
  const started = performance.now()
  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal?.addEventListener('abort', abort)
  if (options.signal?.aborted) abort()
  const emit = (event: RunEvent) => options.onEvent?.(event)

  const plan = createFlowPlan(options.pipeline, options.registry)
  const deliveries: Delivery[] = []
  const delivered = new Set<string>()
  const finishedGathers = new Set<string>()
  let status: RunStatus = 'complete'
  let error: string | undefined

  const deliverReady = async (force: boolean) => {
    for (const [nodeId, waitsFor] of plan.deliveries) {
      if (delivered.has(nodeId)) continue
      if (!force && !waitsFor.every((gather) => finishedGathers.has(gather))) continue
      delivered.add(nodeId)
      const delivery = await host.deliver(nodeId)
      deliveries.push(delivery)
      emit({ type: 'delivery-ready', nodeId, delivery })
    }
  }

  emit({ type: 'run-started', runId, itemCount: sources.length })
  try {
    await host.begin({ runId, pipeline: options.pipeline, plan })
    const errors = await runQueue(
      sources,
      host.concurrency,
      async (source) => {
        await host.runSource(source, emit, controller.signal)
        if (!controller.signal.aborted) emit({ type: 'item-finished', index: source.index })
      },
      () => controller.signal.aborted,
    )
    if (errors.length > 0 && !controller.signal.aborted) throw errors[0]
    if (!controller.signal.aborted) await deliverReady(false)
    for (const gather of plan.gathers) {
      if (controller.signal.aborted) break
      await host.runGather(gather, emit, controller.signal)
      finishedGathers.add(gather)
      await deliverReady(false)
    }
    if (controller.signal.aborted) status = 'cancelled'
  } catch (reason) {
    status = controller.signal.aborted ? 'cancelled' : 'failed'
    error = reason instanceof Error ? reason.message : 'The run failed.'
  }
  try {
    await deliverReady(true)
  } catch (reason) {
    status = 'failed'
    error = reason instanceof Error ? reason.message : 'The delivery failed.'
  }
  await host.end(status)
  options.signal?.removeEventListener('abort', abort)
  const ms = performance.now() - started
  emit({ type: 'run-finished', runId, status, ms })
  return { runId, status, ms, deliveries, error }
}
