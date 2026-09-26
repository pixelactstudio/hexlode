import { describe, expect, it } from 'vitest'

import { productRegistry } from '#/features/nodes/registry'
import { validatePipeline } from '#/features/pipelines/pipeline-file'
import { QUICK_TOOL_DEFINITIONS, quickToolPipeline } from '#/features/quick-tools/tools'

const settingsOf = (pipeline: ReturnType<typeof quickToolPipeline>, type: string) =>
  pipeline.nodes.find((node) => node.type === type)?.settings

describe('quick tool pipelines', () => {
  it.each(Object.keys(QUICK_TOOL_DEFINITIONS))('%s builds a valid fixed pipeline', (tool) => {
    const definition = QUICK_TOOL_DEFINITIONS[tool as keyof typeof QUICK_TOOL_DEFINITIONS]
    const pipeline = quickToolPipeline(tool as never, definition.defaults as never)
    expect(() => validatePipeline(pipeline, productRegistry)).not.toThrow()
    expect(pipeline.nodes.map((node) => node.type).at(0)).toBe('files')
    expect(pipeline.nodes.map((node) => node.type).at(-1)).toBe('output')
  })

  it('Convert encodes to the chosen format with its quality', () => {
    const pipeline = quickToolPipeline('convert', { format: 'avif', quality: 45, lossless: false })
    expect(settingsOf(pipeline, 'convert')).toEqual({
      format: 'avif',
      avif: { quality: 45, lossless: false },
    })
  })

  it('Compress by quality keeps each format and applies the quality to every lossy encoder', () => {
    const pipeline = quickToolPipeline('compress', {
      mode: 'quality',
      quality: 60,
      targetKilobytes: 200,
      format: 'original',
    })
    expect(settingsOf(pipeline, 'convert')).toMatchObject({
      format: 'original',
      keepSmaller: true,
      jpeg: { quality: 60 },
      webp: { quality: 60 },
      avif: { quality: 60 },
      jxl: { quality: 60 },
      png: { optimisationLevel: 3 },
    })
  })

  it('Compress by target size uses Compress to size', () => {
    const pipeline = quickToolPipeline('compress', {
      mode: 'target',
      quality: 60,
      targetKilobytes: 150,
      format: 'webp',
    })
    expect(settingsOf(pipeline, 'compress-to-size')).toEqual({
      targetKilobytes: 150,
      format: 'webp',
    })
  })

  it('Resize and Strip metadata pass their settings through', () => {
    expect(
      settingsOf(
        quickToolPipeline('resize', {
          mode: 'width',
          width: 800,
          height: 600,
          percent: 50,
          longestEdge: 1920,
          fit: 'fit',
          method: 'lanczos3',
          allowUpscale: false,
        }),
        'resize',
      ),
    ).toMatchObject({ mode: 'width', width: 800 })
    expect(
      settingsOf(
        quickToolPipeline('strip-metadata', { mode: 'location', keepColourProfile: true }),
        'strip-metadata',
      ),
    ).toEqual({ mode: 'location', keepColourProfile: true })
  })
})
