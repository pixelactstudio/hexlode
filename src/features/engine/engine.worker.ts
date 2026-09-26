/// <reference lib="webworker" />
/**
 * An engine worker. Carries source items through the pipeline, one at a time, reading and writing
 * the step cache, output files and waiting items in OPFS.
 */
import { createFlowPlan, type FlowDeps, flowCombining, flowSource } from '#/features/engine/flow'
import { appDirectory } from '#/features/engine/opfs/files'
import { createOpfsOutputSink, createOpfsSpillStore } from '#/features/engine/opfs/run-stores'
import { createOpfsStepCache } from '#/features/engine/opfs/step-cache'
import type { Pipeline, RunEvent } from '#/features/engine/types'
import {
  type WorkerRequest,
  type WorkerResponse,
  workerRequestSchema,
} from '#/features/engine/worker-protocol'
import { jsquashCodecs } from '#/features/images/codecs'
import { imageKind, loadImageItem } from '#/features/images/image-item'
import { productRegistry } from '#/features/nodes/registry'

const scope = self as unknown as DedicatedWorkerGlobalScope
const post = (message: WorkerResponse) => scope.postMessage(message)
const kinds = { image: imageKind }

let current: Omit<FlowDeps, 'emit' | 'signal'> | undefined
let queue = Promise.resolve()

async function begin(runId: string, pipeline: Pipeline, stepCache: boolean) {
  const root = await appDirectory()
  current = {
    plan: createFlowPlan(pipeline, productRegistry),
    services: {
      codecs: jsquashCodecs,
      output: createOpfsOutputSink(root, runId, (written) => post({ type: 'output', written })),
    },
    spill: createOpfsSpillStore(root, runId, (item) =>
      item.meta.kind === 'image' ? imageKind.storable(item.payload) : item.payload,
    ),
    cache: stepCache
      ? createOpfsStepCache(root, {
          used: (key) => post({ type: 'cache-used', key }),
          stored: (key, bytes, entry) => post({ type: 'cache-stored', key, bytes, entry }),
        })
      : undefined,
    kinds,
  }
}

function depsFor(taskId: string): FlowDeps {
  if (!current) throw new Error('The run has not started.')
  return {
    ...current,
    signal: new AbortController().signal,
    emit: (event: RunEvent) => post({ type: 'event', taskId, event }),
  }
}

async function handle(request: WorkerRequest) {
  if (request.type === 'begin') {
    await begin(request.runId, request.pipeline as Pipeline, request.stepCache)
    return
  }
  try {
    if (request.type === 'source') {
      const { source } = request
      const load = async () => {
        const bytes = new Uint8Array(await source.file.arrayBuffer())
        return loadImageItem(bytes, source.meta.name)
      }
      await flowSource(depsFor(request.taskId), { ...source, meta: source.meta as never }, load)
    } else {
      await flowCombining(depsFor(request.taskId), request.nodeId)
    }
    post({ type: 'done', taskId: request.taskId })
  } catch (reason) {
    post({
      type: 'failed',
      taskId: request.taskId,
      message: reason instanceof Error ? reason.message : 'The worker failed.',
    })
  }
}

scope.onmessage = (event: MessageEvent<unknown>) => {
  const parsed = workerRequestSchema.safeParse(event.data)
  if (!parsed.success) return
  queue = queue.then(() => handle(parsed.data))
}
