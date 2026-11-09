/**
 * Connects every pair of node types and checks that the Studio's accept or refuse decision matches
 * what the engine does when it runs that pair. Every node added to the registry joins the matrix.
 * The pairs run as interleaved shards, one test file each, so browsers run them in parallel.
 */
import { describe, expect, it } from 'vitest'

import { redSubjectSegmenter } from '#/features/background-removal/__tests__/stand-in-segmenter'
import { type ConnectionCheck, checkConnection } from '#/features/engine/compatibility'
import { createInlineHost } from '#/features/engine/inline-host'
import { createMemoryStepCache } from '#/features/engine/memory-step-cache'
import { runPipeline } from '#/features/engine/runner'
import type { NodeRegistry, Pipeline, RunEvent } from '#/features/engine/types'
import { fileKind } from '#/features/file-items/file-item'
import { jsquashCodecs } from '#/features/images/codecs'
import { imageKind } from '#/features/images/image-item'
import { createRegistry, PRODUCT_NODES } from '#/features/nodes/registry'
import {
  ALL_FORMAT_FIXTURES,
  fixtureBytes,
  noisyPixels,
  pngInput,
  sourceFromBytes,
} from './harness'
import { TEST_ONLY_NODES } from './test-only-nodes'

const registry: NodeRegistry = createRegistry([...PRODUCT_NODES, ...TEST_ONLY_NODES])
const types = registry.list().map((node) => node.type)
const cache = createMemoryStepCache()
/** Remove background reaches the inference worker through this service; a stand-in here. */
const segmenter = redSubjectSegmenter()

function node(id: string, type: string) {
  return { id, type, settings: {}, position: { x: 0, y: 0 } }
}

/** The shortest chain of node types that lets Files feed `type`. */
function feederFor(type: string): string[] {
  const queue: string[][] = [[]]
  while (queue.length > 0) {
    const chain = queue.shift() as string[]
    const nodes = [
      node('files', 'files'),
      ...chain.map((t, i) => node(`p${i}`, t)),
      node('a', type),
    ]
    const pipeline: Pipeline = { nodes, connections: [] }
    for (let index = 0; index < nodes.length - 1; index += 1) {
      pipeline.connections.push({
        id: `f${index}`,
        source: nodes[index].id,
        sourcePort: 'out',
        target: nodes[index + 1].id,
      })
    }
    const last = pipeline.connections.pop()
    if (!last) return chain
    const check = checkConnection(pipeline, registry, last)
    if (check.status !== 'refused') return chain
    if (chain.length < 2) {
      for (const next of types) if (next !== 'files') queue.push([...chain, next])
    }
  }
  throw new Error(`No way to feed ${type}`)
}

function pairPipeline(source: string, target: string, port: string) {
  const feeder = source === 'files' ? [] : feederFor(source)
  const chainTypes = source === 'files' ? [] : [...feeder, source]
  const nodes = [
    node('files', 'files'),
    ...chainTypes.map((t, i) => node(i === chainTypes.length - 1 ? 'a' : `p${i}`, t)),
    node('b', target),
  ]
  const sourceId = source === 'files' ? 'files' : 'a'
  const connections = nodes.slice(1, -1).map((current, index) => ({
    id: `c${index}`,
    source: nodes[index].id,
    sourcePort: 'out',
    target: current.id,
  }))
  const pipeline: Pipeline = { nodes, connections }
  const candidate = { source: sourceId, sourcePort: port, target: 'b' }
  return { pipeline, candidate }
}

/**
 * One fixture per format, all the same picture, then one different picture. Nodes that route by
 * content, such as Deduplicate, then send several formats down each of their outputs.
 */
async function matrixSources() {
  const fixtures = await Promise.all(
    ALL_FORMAT_FIXTURES.map(async (name) => ({ name, bytes: await fixtureBytes(name) })),
  )
  const different = await pngInput('noise.png', noisyPixels(48))
  return Promise.all(
    [...fixtures, different].map(({ name, bytes }, index) => sourceFromBytes(name, bytes, index)),
  )
}

async function runCounts(pipeline: Pipeline) {
  const sources = await matrixSources()
  const events: RunEvent[] = []
  await runPipeline({
    pipeline,
    registry,
    sources,
    host: createInlineHost({
      registry,
      cache,
      services: { codecs: jsquashCodecs, segmenter },
      kinds: { image: imageKind, data: fileKind, document: fileKind },
    }),
    onEvent: (event) => events.push(event),
  })
  const at = (status: string) =>
    events.filter((e) => e.type === 'node-item' && e.nodeId === 'b' && e.status === status).length
  return {
    entered: at('processed') + at('cached') + at('failed'),
    skipped: at('skipped'),
    failed: at('failed'),
  }
}

const pairs = types.flatMap((source) => {
  const definition = registry.get(source)
  if (!definition) return []
  const ports = definition.ports(definition.defaults).map((port) => port.id)
  return ports.flatMap((port) => types.map((target) => [source, port, target] as const))
})

export const MATRIX_SHARDS = 4

/** Runs every `MATRIX_SHARDS`th pair, starting at `shard`, so costly nodes spread evenly. */
export function describePairMatrix(shard: number) {
  const mine = pairs.filter((_pair, index) => index % MATRIX_SHARDS === shard - 1)
  describe(`node pair matrix, shard ${shard} of ${MATRIX_SHARDS}`, () => {
    it.each(mine)('%s (%s) → %s', async (source, port, target) => {
      const { pipeline, candidate } = pairPipeline(source, target, port)
      const decision: ConnectionCheck = checkConnection(pipeline, registry, candidate)
      if (target === 'files') {
        expect(decision.status).toBe('refused')
        return
      }
      pipeline.connections.push({ id: 'pair', ...candidate })
      const counts = await runCounts(pipeline)
      expect(counts.failed).toBe(0)
      if (decision.status === 'refused') expect(counts.entered).toBe(0)
      if (decision.status === 'ok') {
        expect(counts.skipped).toBe(0)
        expect(counts.entered).toBeGreaterThan(0)
      }
      if (decision.status === 'narrows') expect(counts.entered).toBeGreaterThan(0)
    })
  })
}
