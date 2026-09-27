import { describe, expect, it } from 'vitest'

import { checkConnection, filesAccepts } from '#/features/engine/compatibility'
import {
  createTestRegistry,
  dataOnlyNode,
  pipelineOf,
  pngOnlyNode,
  sourceNode,
  toWebpNode,
} from './test-nodes'

const registry = createTestRegistry([sourceNode, pngOnlyNode, toWebpNode, dataOnlyNode])

describe('checkConnection', () => {
  it('allows a connection whose target accepts everything upstream produces', () => {
    const pipeline = pipelineOf(
      [
        ['files', 'source'],
        ['convert', 'to-webp'],
      ],
      [],
    )
    expect(
      checkConnection(pipeline, registry, {
        source: 'files',
        sourcePort: 'out',
        target: 'convert',
      }),
    ).toEqual({ status: 'ok' })
  })

  it('labels a connection that narrows the stream and explains the skip', () => {
    const pipeline = pipelineOf(
      [
        ['files', 'source'],
        ['optimize', 'png-only'],
      ],
      [],
    )
    expect(
      checkConnection(pipeline, registry, {
        source: 'files',
        sourcePort: 'out',
        target: 'optimize',
      }),
    ).toEqual({
      status: 'narrows',
      label: 'PNG only',
      message: 'Only PNG images enter Optimize PNG. Other items skip this branch.',
    })
  })

  it('refuses a connection that can never carry an accepted item, and suggests a fix', () => {
    const pipeline = pipelineOf(
      [
        ['files', 'source'],
        ['convert', 'to-webp'],
        ['optimize', 'png-only'],
      ],
      [['files', 'convert']],
    )
    expect(
      checkConnection(pipeline, registry, {
        source: 'convert',
        sourcePort: 'out',
        target: 'optimize',
      }),
    ).toEqual({
      status: 'refused',
      message: 'Optimize PNG needs PNG images. Add Convert to PNG before it.',
    })
  })

  it('refuses image streams into a node that needs data, without an image suggestion', () => {
    const pipeline = pipelineOf(
      [
        ['files', 'source'],
        ['sum', 'data-only'],
      ],
      [],
    )
    expect(
      checkConnection(pipeline, registry, { source: 'files', sourcePort: 'out', target: 'sum' }),
    ).toEqual({ status: 'refused', message: 'Summarise data needs data.' })
  })

  it('refuses loops, duplicates and connections into a node without an input', () => {
    const pipeline = pipelineOf(
      [
        ['files', 'source'],
        ['a', 'to-webp'],
        ['b', 'to-webp'],
      ],
      [
        ['files', 'a'],
        ['a', 'b'],
      ],
    )
    expect(
      checkConnection(pipeline, registry, { source: 'b', sourcePort: 'out', target: 'a' }).status,
    ).toBe('refused')
    expect(
      checkConnection(pipeline, registry, { source: 'a', sourcePort: 'out', target: 'b' }).status,
    ).toBe('refused')
    expect(
      checkConnection(pipeline, registry, { source: 'a', sourcePort: 'out', target: 'files' }),
    ).toEqual({ status: 'refused', message: 'Files starts a pipeline and has no input.' })
  })

  it('carries narrowing through the pipeline to later connections', () => {
    const pipeline = pipelineOf(
      [
        ['files', 'source'],
        ['optimize', 'png-only'],
        ['again', 'png-only'],
      ],
      [['files', 'optimize']],
    )
    expect(
      checkConnection(pipeline, registry, {
        source: 'optimize',
        sourcePort: 'out',
        target: 'again',
      }),
    ).toEqual({ status: 'ok' })
  })
})

describe('filesAccepts', () => {
  it('accepts every format that at least one branch accepts', () => {
    const pipeline = pipelineOf(
      [
        ['files', 'source'],
        ['optimize', 'png-only'],
        ['sum', 'data-only'],
      ],
      [
        ['files', 'optimize'],
        ['files', 'sum'],
      ],
    )
    expect([...filesAccepts(pipeline, registry, 'files')]).toEqual(['image:png'])
  })

  it('accepts nothing when Files has no branches', () => {
    const pipeline = pipelineOf([['files', 'source']], [])
    expect(filesAccepts(pipeline, registry, 'files').size).toBe(0)
  })
})
