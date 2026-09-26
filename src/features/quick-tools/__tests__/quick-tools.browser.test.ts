/**
 * Exit gate: every quick tool and every available template runs on real JPEG, PNG, WebP, AVIF,
 * JPEG XL and QOI files, and every file it produces decodes.
 */
import { describe, expect, it } from 'vitest'

import {
  ALL_FORMAT_FIXTURES,
  decodeFile,
  fixtureBytes,
  near,
  pixelAt,
  RED,
  run,
} from '#/features/nodes/__tests__/harness'
import { productRegistry } from '#/features/nodes/registry'
import { availableTemplates } from '#/features/pipelines/templates'
import {
  OUTPUT_NODE_ID,
  QUICK_TOOL_DEFINITIONS,
  type QuickTool,
  quickToolPipeline,
} from '#/features/quick-tools/tools'

const EXTENSION_FORMAT: Record<string, string> = {
  jpg: 'jpeg',
  png: 'png',
  webp: 'webp',
  avif: 'avif',
  jxl: 'jxl',
  qoi: 'qoi',
}

const CASES: [
  QuickTool,
  Record<string, unknown>,
  expected: { width: number; height: number; format?: string },
][] = [
  ['convert', {}, { width: 48, height: 32, format: 'webp' }],
  ['convert', { format: 'jxl', lossless: true }, { width: 48, height: 32, format: 'jxl' }],
  ['compress', {}, { width: 48, height: 32 }],
  [
    'compress',
    { mode: 'target', targetKilobytes: 1, format: 'webp' },
    { width: 48, height: 32, format: 'webp' },
  ],
  ['resize', { mode: 'width', width: 24 }, { width: 24, height: 16 }],
  ['strip-metadata', {}, { width: 48, height: 32 }],
]

describe('quick tools on every input format', () => {
  it.each(CASES)('%s %o', async (tool, changes, expected) => {
    const settings = { ...QUICK_TOOL_DEFINITIONS[tool].defaults, ...changes }
    const { files, statuses } = await run(
      quickToolPipeline(tool, settings as never),
      ALL_FORMAT_FIXTURES,
    )
    expect(statuses('step')).toEqual(Array(6).fill('processed'))
    const delivered = files(OUTPUT_NODE_ID)
    expect(delivered).toHaveLength(6)
    for (const [index, file] of delivered.entries()) {
      const image = await decodeFile(file.bytes)
      const sourceFormat = EXTENSION_FORMAT[ALL_FORMAT_FIXTURES[index].split('.').pop() as string]
      expect(image).toMatchObject({
        width: expected.width,
        height: expected.height,
        format: expected.format ?? sourceFormat,
      })
      expect(near(pixelAt(image, 0, expected.height - 1), RED, 64)).toBe(true)
    }
  })

  it('Strip metadata removes metadata from every file that had it', async () => {
    const settings = QUICK_TOOL_DEFINITIONS['strip-metadata'].defaults
    const { files } = await run(quickToolPipeline('strip-metadata', settings), [
      'photo.jpg',
      'location.png',
    ])
    for (const file of files(OUTPUT_NODE_ID)) {
      expect((await decodeFile(file.bytes)).metadata).toEqual({})
    }
  })
})

describe('templates on every input format', () => {
  it.each(
    availableTemplates(productRegistry).map((template) => [template.name, template] as const),
  )('%s', async (_name, template) => {
    const { result, files, events } = await run(template.pipeline, [
      ...ALL_FORMAT_FIXTURES,
      'oriented.jpg',
    ])
    expect(result.status).toBe('complete')
    const failures = events.filter(
      (event) => event.type === 'node-item' && event.status === 'failed',
    )
    expect(failures).toEqual([])
    const outputs = template.pipeline.nodes.filter((node) => node.type === 'output')
    for (const output of outputs) {
      const delivered = files(output.id)
      expect(delivered).toHaveLength(7)
      for (const file of delivered) {
        const image = await decodeFile(file.bytes)
        expect(image.format).toBe('webp')
        expect(image.exif.hasGps).toBe(false)
      }
      const upright = delivered.find((file) => file.name === 'oriented.webp') as {
        bytes: Uint8Array
      }
      expect(await decodeFile(upright.bytes)).toMatchObject({ width: 32, height: 48 })
    }
  })

  it('the photo fixture keeps its copyright through Web-ready photos', async () => {
    const template = availableTemplates(productRegistry).find((t) => t.id === 'web-ready-photos')
    if (!template) throw new Error('missing')
    const { files } = await run(template.pipeline, ['photo.jpg'])
    const image = await decodeFile(files('output')[0].bytes)
    expect(image.exif).toMatchObject({ copyright: '(c) 2026 Ada Example', make: null })
    expect(await fixtureBytes('photo.jpg')).toBeDefined()
  })
})
