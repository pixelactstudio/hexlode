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
  expected: { width: number; height: number; format?: string; red?: [x: number, y: number] },
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
  ['crop', {}, { width: 32, height: 32 }],
  ['crop', { aspect: '16:9', position: 'top' }, { width: 48, height: 27 }],
  ['rotate', { auto: false, rotate: 90 }, { width: 32, height: 48, red: [0, 0] }],
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
      const [x, y] = expected.red ?? [0, expected.height - 1]
      expect(near(pixelAt(image, x, y), RED, 64)).toBe(true)
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

/**
 * What each template delivers: the format per Output node, whether location is removed, and
 * optional fixed dimensions.
 */
const TEMPLATE_RESULTS: Record<
  string,
  {
    outputs: Record<string, string | 'source'>
    removesLocation?: boolean
    size?: { width: number; height: number }
  }
> = {
  'web-ready-photos': { outputs: { output: 'webp' }, removesLocation: true },
  'email-photos': { outputs: { output: 'jpeg' } },
  'remove-location': { outputs: { output: 'source' }, removesLocation: true },
  'square-thumbnails': { outputs: { output: 'webp' }, size: { width: 32, height: 32 } },
  'webp-and-avif': { outputs: { 'output-webp': 'webp', 'output-avif': 'avif' } },
  blank: { outputs: {} },
}

const TEMPLATE_FIXTURES = [...ALL_FORMAT_FIXTURES, 'oriented.jpg', 'location.png']

describe('templates on every input format', () => {
  it('every template has expected results', () => {
    expect(Object.keys(TEMPLATE_RESULTS).sort()).toEqual(
      availableTemplates(productRegistry)
        .map((template) => template.id)
        .sort(),
    )
  })

  it.each(
    availableTemplates(productRegistry)
      .filter((template) => template.id !== 'blank')
      .map((template) => [template.name, template] as const),
  )('%s', async (_name, template) => {
    const expected = TEMPLATE_RESULTS[template.id]
    const { result, files, events } = await run(template.pipeline, TEMPLATE_FIXTURES)
    expect(result.status).toBe('complete')
    const failures = events.filter(
      (event) => event.type === 'node-item' && event.status === 'failed',
    )
    expect(failures).toEqual([])
    const outputs = template.pipeline.nodes.filter((node) => node.type === 'output')
    expect(outputs.map((node) => node.id).sort()).toEqual(Object.keys(expected.outputs).sort())
    for (const output of outputs) {
      const delivered = files(output.id)
      expect(delivered).toHaveLength(TEMPLATE_FIXTURES.length)
      for (const [index, file] of delivered.entries()) {
        const image = await decodeFile(file.bytes)
        const format = expected.outputs[output.id]
        const sourceFormat = EXTENSION_FORMAT[TEMPLATE_FIXTURES[index].split('.').pop() as string]
        expect(image.format).toBe(format === 'source' ? sourceFormat : format)
        if (expected.removesLocation) expect(image.exif.hasGps).toBe(false)
        if (expected.size) expect(image).toMatchObject(expected.size)
      }
      const upright = delivered.find((file) => file.name.startsWith('oriented.')) as {
        bytes: Uint8Array
      }
      const turned = expected.size ?? { width: 32, height: 48 }
      const orientedImage = await decodeFile(upright.bytes)
      // Remove location keeps pixels, so the file stays sideways with its orientation tag.
      if (template.id === 'remove-location')
        expect(orientedImage.exif.orientation).toBeGreaterThanOrEqual(5)
      else expect(orientedImage).toMatchObject(turned)
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
