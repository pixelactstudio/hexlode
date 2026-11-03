import { describe, expect, it } from 'vitest'
import { chain } from '#/features/nodes/__tests__/harness'
import { productRegistry } from '#/features/nodes/registry'
import {
  exportPipelineFile,
  importPipelineFile,
  PipelineFileError,
} from '#/features/pipelines/pipeline-file'
import { availableTemplates, TEMPLATES } from '#/features/pipelines/templates'

const webReady = TEMPLATES.find((template) => template.id === 'web-ready-photos')

describe('pipeline file', () => {
  it('round-trips a pipeline without changes', () => {
    if (!webReady) throw new Error('missing template')
    const text = exportPipelineFile({ name: 'My photos', pipeline: webReady.pipeline })
    const imported = importPipelineFile(text, productRegistry)
    expect(imported).toEqual({ name: 'My photos', pipeline: webReady.pipeline })
    expect(exportPipelineFile(imported)).toBe(text)
  })

  it('writes versioned JSON', () => {
    const parsed = JSON.parse(
      exportPipelineFile({ name: 'Empty', pipeline: { nodes: [], connections: [] } }),
    )
    expect(parsed).toEqual({
      format: 'hexlode-pipeline',
      version: 1,
      name: 'Empty',
      pipeline: { nodes: [], connections: [] },
    })
  })

  it('migrates older versions on import', () => {
    const old = JSON.stringify({
      format: 'hexlode-pipeline',
      version: 0,
      title: 'Old',
      graph: { nodes: [], connections: [] },
    })
    const migrations = {
      0: (file: Record<string, unknown>) => ({
        format: file.format,
        version: 1,
        name: file.title,
        pipeline: file.graph,
      }),
    }
    expect(importPipelineFile(old, productRegistry, migrations)).toEqual({
      name: 'Old',
      pipeline: { nodes: [], connections: [] },
    })
  })

  it.each([
    ['not json', 'This is not a .hexlode file.'],
    [JSON.stringify({ format: 'other', version: 1 }), 'This is not a .hexlode file.'],
    [
      JSON.stringify({
        format: 'hexlode-pipeline',
        version: 99,
        name: 'x',
        pipeline: { nodes: [], connections: [] },
      }),
      'This file was made by a newer version of Hexlode.',
    ],
    [
      JSON.stringify({
        format: 'hexlode-pipeline',
        version: 1,
        name: 'x',
        pipeline: {
          nodes: [{ id: 'a', type: 'dither', settings: {}, position: { x: 0, y: 0 } }],
          connections: [],
        },
      }),
      'This pipeline uses nodes this version of Hexlode does not have: dither.',
    ],
    [
      JSON.stringify({
        format: 'hexlode-pipeline',
        version: 1,
        name: 'x',
        pipeline: {
          nodes: [
            {
              id: 'a',
              type: 'resize',
              settings: { percent: -4, mode: 'percent' },
              position: { x: 0, y: 0 },
            },
          ],
          connections: [],
        },
      }),
      'The settings of Resize are not valid.',
    ],
    [
      JSON.stringify({
        format: 'hexlode-pipeline',
        version: 1,
        name: 'x',
        pipeline: {
          nodes: [{ id: 'a', type: 'files', settings: {}, position: { x: 0, y: 0 } }],
          connections: [{ id: 'c', source: 'a', sourcePort: 'out', target: 'missing' }],
        },
      }),
      'A connection points to a node that does not exist.',
    ],
  ])('refuses %s', (text, message) => {
    expect(() => importPipelineFile(text, productRegistry)).toThrow(new PipelineFileError(message))
  })
})

describe('pipelines with later nodes', () => {
  it('keeps a watermark logo and the other settings through export and import', () => {
    const logo = { name: 'logo.png', data: 'iVBORw0KGgoAAAANSUhEUg==', width: 64, height: 32 }
    const pipeline = chain(
      ['image-watermark', { logo, position: 'top-left', opacity: 55 }],
      ['responsive-set', { widths: [320, 640], sizes: '50vw' }],
    )
    const text = exportPipelineFile({ name: 'Branded', pipeline })
    expect(importPipelineFile(text, productRegistry).pipeline).toEqual(pipeline)
  })

  it('refuses a file whose node settings are not valid', () => {
    const pipeline = chain(['background', { colour: 'red' }])
    const text = exportPipelineFile({ name: 'Broken', pipeline })
    expect(() => importPipelineFile(text, productRegistry)).toThrow(
      new PipelineFileError('The settings of Background are not valid.'),
    )
  })
})

describe('templates', () => {
  it('offers every template whose nodes all exist, with Blank last', () => {
    expect(availableTemplates(productRegistry).map((template) => template.id)).toEqual([
      'web-ready-photos',
      'email-photos',
      'remove-location',
      'square-thumbnails',
      'webp-and-avif',
      'responsive-images',
      'watermark-and-compress',
      'instagram-carousel',
      'blank',
    ])
  })

  it('hides templates that need nodes the registry does not have', () => {
    const registry = {
      get: (type: string) => (type === 'files' ? productRegistry.get(type) : undefined),
      list: () => [],
    }
    expect(availableTemplates(registry).map((template) => template.id)).toEqual(['blank'])
  })

  it('every template is a valid pipeline file', () => {
    for (const template of TEMPLATES) {
      const text = exportPipelineFile({ name: template.name, pipeline: template.pipeline })
      expect(importPipelineFile(text, productRegistry).pipeline).toEqual(template.pipeline)
    }
  })
})
