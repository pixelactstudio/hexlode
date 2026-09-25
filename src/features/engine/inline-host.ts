import {
  createFlowPlan,
  type FlowDeps,
  type FlowPlan,
  flowCombining,
  flowSource,
  type KindHandlers,
} from '#/features/engine/flow'
import { createMemoryOutputStore } from '#/features/engine/memory-output-store'
import type { RunHost } from '#/features/engine/runner'
import type { StepCache } from '#/features/engine/step-cache'
import { createMemorySpillStore, type OutputStore } from '#/features/engine/stores'
import type { EngineServices, NodeRegistry } from '#/features/engine/types'

export interface InlineHostOptions {
  registry: NodeRegistry
  concurrency?: number
  cache?: StepCache
  output?: OutputStore
  services?: Omit<EngineServices, 'output'>
  kinds?: KindHandlers
}

/** Runs flows on the calling thread. Used by tests and by previews inside a worker. */
export function createInlineHost(options: InlineHostOptions): RunHost & { output: OutputStore } {
  const output = options.output ?? createMemoryOutputStore()
  let plan: FlowPlan | undefined
  let spill = createMemorySpillStore()

  const deps = (emit: FlowDeps['emit'], signal: AbortSignal): FlowDeps => {
    if (!plan) throw new Error('The run has not started.')
    return {
      plan,
      services: { ...options.services, output },
      spill,
      cache: options.cache,
      kinds: options.kinds,
      signal,
      emit,
    }
  }

  return {
    output,
    concurrency: options.concurrency ?? 1,
    async begin(run) {
      plan = run.plan ?? createFlowPlan(run.pipeline, options.registry)
      spill = createMemorySpillStore()
    },
    async runSource(source, emit, signal) {
      const load = source.load
      if (!load) throw new Error('Inline runs need a loader for each source item.')
      await flowSource(deps(emit, signal), source, load)
    },
    async runCombining(nodeId, emit, signal) {
      await flowCombining(deps(emit, signal), nodeId)
    },
    deliver: (nodeId) => output.deliver(nodeId),
    async end() {},
  }
}
