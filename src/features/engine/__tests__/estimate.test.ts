import { describe, expect, it } from 'vitest'

import { describeEstimate, estimateRun } from '#/features/engine/estimate'
import { choosePoolSize } from '#/features/engine/pool-size'
import type { ItemMeta } from '#/features/engine/types'
import { chain } from '#/features/nodes/__tests__/harness'
import { productRegistry } from '#/features/nodes/registry'

const TWELVE_MP: ItemMeta = {
  kind: 'image',
  format: 'jpeg',
  name: 'photo.jpg',
  size: 4_000_000,
  width: 4000,
  height: 3000,
  source: { size: 4_000_000, format: 'jpeg', width: 4000, height: 3000 },
}

const sources = (count: number, meta = TWELVE_MP) =>
  Array.from({ length: count }, (_, index) => ({
    key: `file-${index}`,
    meta: { ...meta, name: `${index}.jpg` },
  }))

describe('estimateRun', () => {
  it('counts decodes and encodes and divides the time across workers', () => {
    const estimate = estimateRun({
      pipeline: chain(['convert', { format: 'webp' }]),
      registry: productRegistry,
      sources: sources(10),
      workers: 2,
    })
    // Per item: decode JPEG 12 ms/MP and encode WebP 120 ms/MP, at 12 MP: 1,584 ms.
    expect(estimate).toMatchObject({ items: 10, decodes: 10, encodes: 10, skipped: 0, cached: 0 })
    expect(estimate.seconds).toBeCloseTo(7.92, 2)
  })

  it('counts the encode Output does when no node encoded the item', () => {
    const estimate = estimateRun({
      pipeline: chain(['resize', { mode: 'percent', percent: 50 }]),
      registry: productRegistry,
      sources: sources(4),
      workers: 1,
    })
    expect(estimate).toMatchObject({ decodes: 4, encodes: 4 })
  })

  it('counts items that will skip a branch', () => {
    const estimate = estimateRun({
      pipeline: chain(['optimize-png']),
      registry: productRegistry,
      sources: sources(3),
      workers: 1,
    })
    expect(estimate).toMatchObject({ skipped: 3, encodes: 0, decodes: 0 })
  })

  it('leaves out work the step cache already holds', () => {
    const pipeline = chain(['convert', { format: 'webp' }])
    const first = estimateRun({
      pipeline,
      registry: productRegistry,
      sources: sources(2),
      workers: 1,
    })
    const cachedKeys = new Set(first.entryKeys)
    const again = estimateRun({
      pipeline,
      registry: productRegistry,
      sources: sources(2),
      workers: 1,
      lookup: (key) =>
        cachedKeys.has(key)
          ? {
              nodeType: 'convert',
              outputs: [
                {
                  port: 'out',
                  key: `${key}-0`,
                  meta: { ...TWELVE_MP, format: 'webp' },
                  reusesInput: false,
                },
              ],
            }
          : undefined,
    })
    expect(again).toMatchObject({ encodes: 0, decodes: 0, cached: 2 })
  })

  it('scales by what this device measured', () => {
    const base = {
      pipeline: chain(['convert', { format: 'webp' }]),
      registry: productRegistry,
      sources: sources(10),
      workers: 2,
    }
    expect(estimateRun({ ...base, speedFactor: 2 }).seconds).toBeCloseTo(15.84, 2)
  })
})

describe('describeEstimate', () => {
  it('reads like a sentence', () => {
    expect(describeEstimate({ encodes: 2000, seconds: 720 })).toBe(
      'about 2,000 encodes, roughly 12 minutes on this device',
    )
    expect(describeEstimate({ encodes: 1, seconds: 3 })).toBe(
      'about 1 encode, a few seconds on this device',
    )
    expect(describeEstimate({ encodes: 0, seconds: 0.2 })).toBe(
      'no encodes, a few seconds on this device',
    )
  })
})

describe('choosePoolSize', () => {
  it('uses the cores but leaves one for the page', () => {
    expect(choosePoolSize({ cores: 8, deviceMemoryGb: 8, largestDecodeBytes: 1_000_000 })).toBe(7)
  })

  it('uses fewer workers when large items would not fit in memory', () => {
    // 12 MP decodes to 48 MB; a worker may need five times that.
    expect(choosePoolSize({ cores: 16, deviceMemoryGb: 2, largestDecodeBytes: 48_000_000 })).toBe(4)
  })

  it('always keeps at least one worker', () => {
    expect(choosePoolSize({ cores: 1, deviceMemoryGb: 0.5, largestDecodeBytes: 400_000_000 })).toBe(
      1,
    )
  })
})
