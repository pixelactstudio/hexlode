import { describe, expect, it } from 'vitest'

import { createRunStats } from '#/features/runs/run-stats'

describe('run stats', () => {
  it('counts per node, keeping skipped apart from failed', () => {
    const stats = createRunStats()
    stats.apply({ type: 'run-started', runId: 'r', itemCount: 3 })
    stats.apply({
      type: 'node-item',
      nodeId: 'a',
      source: 0,
      status: 'processed',
      bytesIn: 100,
      bytesOut: 40,
      ms: 5,
    })
    stats.apply({ type: 'node-item', nodeId: 'a', source: 1, status: 'skipped', ms: 0 })
    stats.apply({
      type: 'node-item',
      nodeId: 'a',
      source: 2,
      status: 'failed',
      ms: 1,
      error: 'Corrupt',
    })
    stats.apply({
      type: 'node-item',
      nodeId: 'a',
      source: 3,
      status: 'cached',
      bytesIn: 10,
      bytesOut: 5,
      ms: 0,
    })
    expect(stats.snapshot().nodes.a).toEqual({
      processed: 1,
      cached: 1,
      skipped: 1,
      failed: 1,
      bytesIn: 110,
      bytesOut: 45,
      ms: 6,
      warnings: 0,
    })
  })

  it('ignores recomputed steps so items are not counted twice', () => {
    const stats = createRunStats()
    stats.apply({ type: 'node-item', nodeId: 'a', status: 'cached', ms: 0 })
    stats.apply({ type: 'node-item', nodeId: 'a', status: 'processed', ms: 3, recomputed: true })
    expect(stats.snapshot().nodes.a).toMatchObject({ processed: 0, cached: 1, ms: 3 })
  })

  it('labels connections with item count, formats and size saved', () => {
    const stats = createRunStats()
    stats.apply({
      type: 'connection-item',
      connectionId: 'c',
      format: 'png',
      bytes: 60,
      sourceBytes: 100,
    })
    stats.apply({
      type: 'connection-item',
      connectionId: 'c',
      format: 'webp',
      bytes: 20,
      sourceBytes: 100,
    })
    expect(stats.snapshot().connections.c).toEqual({
      items: 2,
      formats: ['png', 'webp'],
      bytes: 80,
      sourceBytes: 200,
    })
  })

  it('builds a row per source file from the Output node', () => {
    const stats = createRunStats({ outputNodeId: 'out' })
    stats.apply({
      type: 'node-item',
      nodeId: 'convert',
      source: 0,
      status: 'processed',
      ms: 1,
      bytesOut: 50,
    })
    stats.apply({
      type: 'node-item',
      nodeId: 'out',
      source: 0,
      status: 'processed',
      ms: 1,
      bytesIn: 50,
      bytesOut: 50,
    })
    stats.apply({
      type: 'node-item',
      nodeId: 'convert',
      source: 1,
      status: 'failed',
      ms: 1,
      error: 'Bad data',
    })
    stats.apply({
      type: 'node-warning',
      nodeId: 'convert',
      source: 2,
      warning: { code: 'metadata_dropped', message: 'QOI cannot keep EXIF.' },
    })
    expect(stats.snapshot().sources[2]).toEqual({
      status: 'pending',
      warnings: ['QOI cannot keep EXIF.'],
    })
    stats.apply({ type: 'item-finished', index: 2 })
    expect(stats.snapshot().sources[2].status).toBe('skipped')
    stats.apply({
      type: 'node-warning',
      nodeId: 'convert',
      source: 0,
      warning: { code: 'metadata_dropped', message: 'QOI cannot keep EXIF.' },
    })
    expect(stats.snapshot().sources).toMatchObject({
      0: { status: 'done', outputBytes: 50, warnings: ['QOI cannot keep EXIF.'] },
      1: { status: 'failed', error: 'Bad data', warnings: [] },
    })
    expect(stats.snapshot().warningCodes).toEqual(['metadata_dropped'])
    expect(stats.snapshot().nodes.convert.warnings).toBe(2)
  })

  it('keeps records and deliveries, and tells subscribers', () => {
    const stats = createRunStats()
    let changes = 0
    stats.subscribe(() => {
      changes += 1
    })
    stats.apply({
      type: 'node-record',
      nodeId: 'inspect',
      source: 0,
      record: { name: 'a.jpg', fields: { width: 1 } },
    })
    stats.apply({
      type: 'delivery-ready',
      nodeId: 'out',
      delivery: { nodeId: 'out', files: [], bytes: 0 },
    })
    stats.apply({ type: 'item-finished', index: 0 })
    stats.apply({ type: 'run-finished', runId: 'r', status: 'complete', ms: 10 })
    const snapshot = stats.snapshot()
    expect(snapshot.records.inspect).toHaveLength(1)
    expect(snapshot.deliveries.out.nodeId).toBe('out')
    expect(snapshot.finishedItems).toBe(1)
    expect(snapshot.status).toBe('complete')
    expect(changes).toBe(4)
  })
})
