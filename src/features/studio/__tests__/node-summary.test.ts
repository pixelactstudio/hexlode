import { describe, expect, it } from 'vitest'

import { productRegistry } from '#/features/nodes/registry'
import { TEMPLATES } from '#/features/pipelines/templates'
import { pipelineSteps, summariseNode } from '#/features/studio/node-summary'
import { NODE_ICONS } from '#/features/studio/node-ui'

function summary(type: string, settings: Record<string, unknown> = {}) {
  const definition = productRegistry.get(type)
  if (!definition) throw new Error(`No node ${type}`)
  return summariseNode(type, definition.parseSettings(settings))
}

describe('summariseNode', () => {
  it('describes resize by its mode', () => {
    expect(summary('resize', { mode: 'longestEdge', longestEdge: 2048 })).toBe(
      'Longest edge 2048 px',
    )
    expect(summary('resize', { mode: 'width', width: 800 })).toBe('Width 800 px')
    expect(summary('resize', { mode: 'percent', percent: 50 })).toBe('50% of the original')
    expect(summary('resize', { mode: 'box', width: 400, height: 300, fit: 'fill' })).toBe(
      '400×300 px, fill',
    )
  })

  it('describes convert by format and quality', () => {
    expect(summary('convert', { format: 'webp', webp: { quality: 80 } })).toBe('WebP, quality 80')
    expect(summary('convert', { format: 'avif', avif: { lossless: true } })).toBe('AVIF, lossless')
    expect(summary('convert', { format: 'png' })).toBe('PNG, lossless')
    expect(summary('convert', { format: 'original' })).toBe('Same format as the input')
  })

  it('describes the other batch 1 nodes', () => {
    expect(summary('strip-metadata', { mode: 'copyright' })).toBe('Keeps only copyright')
    expect(summary('rotate', { auto: true })).toBe('Upright from the camera tag')
    expect(summary('rotate', { auto: false, rotate: 90, flipHorizontal: true })).toBe(
      'Rotate 90°, flip horizontally',
    )
    expect(summary('crop', { aspect: '16:9', position: 'top' })).toBe('16:9 from the top')
    expect(summary('compress-to-size', { targetKilobytes: 200, format: 'webp' })).toBe(
      'Under 200 KB as WebP',
    )
    expect(summary('output', { destination: 'zip', archiveName: 'photos' })).toBe(
      'ZIP named photos.zip',
    )
    expect(summary('output', { destination: 'folder' })).toBe('Saves to a folder')
    expect(summary('rename', { template: '{name}-{width}w' })).toBe('{name}-{width}w')
    expect(summary('filter')).toBe('1 rule')
  })

  it('describes the batch 2 nodes', () => {
    expect(summary('deduplicate')).toBe('Near duplicates, keeps the first')
    expect(summary('deduplicate', { mode: 'exact', keep: 'largest' })).toBe(
      'Exact duplicates, keeps the largest',
    )
    expect(summary('auto-trim', { tolerance: 10 })).toBe('Tolerance 10%')
    expect(summary('auto-trim', { tolerance: 0, padding: 4 })).toBe('Tolerance 0%, keeps 4 px')
    expect(summary('pad', { aspect: '1:1', colour: '#ffffff' })).toBe('1:1, filled with #ffffff')
    expect(summary('pad', { aspect: '9:16', fill: 'blur' })).toBe('9:16, blurred fill')
    expect(summary('pixel-art', { scale: 3, method: 'smooth' })).toBe('3x, smooth diagonals')
    expect(summary('pixel-art')).toBe('2x, hard pixels')
    expect(summary('split', { columns: 3, rows: 1 })).toBe('3 × 1 grid')
    expect(summary('adjust')).toBe('No change')
    expect(summary('adjust', { brightness: 20, contrast: -10, exposure: 0.5 })).toBe(
      'Brightness +20, contrast −10, exposure +0.5',
    )
    expect(summary('filters', { filter: 'sepia' })).toBe('Sepia')
    expect(summary('filters', { filter: 'invert', strength: 40 })).toBe('Invert at 40%')
    expect(summary('sharpen-blur', { effect: 'sharpen', amount: 150, radius: 1 })).toBe(
      'Sharpen 150% at 1 px',
    )
    expect(summary('sharpen-blur', { effect: 'blur', radius: 6, region: 'area' })).toBe(
      'Blur 6 px, in an area',
    )
    expect(summary('background', { colour: '#000000' })).toBe('Fills transparency with #000000')
    expect(summary('text-watermark', { text: '© Ada', position: 'bottom-right' })).toBe(
      '“© Ada”, bottom right',
    )
    expect(summary('text-watermark', { text: 'Draft', tile: true })).toBe('“Draft”, tiled')
    expect(summary('image-watermark')).toBe('No logo chosen')
    expect(
      summary('image-watermark', {
        logo: { name: 'logo.svg', data: 'AA==', width: 1, height: 1 },
        position: 'top-left',
      }),
    ).toBe('logo.svg, top left')
    expect(summary('border', { unit: 'pixels', border: 8, radius: 0 })).toBe('8 px border')
    expect(summary('border', { unit: 'percent', border: 0, radius: 5 })).toBe('5% corners')
    expect(summary('border', { border: 0, radius: 0 })).toBe('No change')
  })

  it('describes the batch 3 nodes', () => {
    expect(summary('set-copyright', { copyright: '© 2026 Ada' })).toBe('© 2026 Ada')
    expect(summary('set-copyright', { artist: 'Ada', copyright: '© 2026 Ada' })).toBe(
      'Ada, © 2026 Ada',
    )
    expect(summary('set-copyright')).toBe('Nothing set')
    expect(summary('best-format')).toBe('Smallest of WebP and AVIF')
    expect(summary('best-format', { formats: ['jpeg', 'png', 'jxl'], keepOriginal: true })).toBe(
      'Smallest of JPEG, PNG, JPEG XL or the original',
    )
    expect(summary('responsive-set')).toBe('4 widths as WebP')
    expect(summary('responsive-set', { widths: [800], format: 'original' })).toBe(
      '1 width, same format',
    )
    expect(summary('favicon')).toBe('Fits each icon')
    expect(summary('favicon', { fit: 'cover', padding: 10 })).toBe('Fills each icon, 10% padding')
    expect(summary('placeholder')).toBe('Data URI, 16 px')
    expect(summary('placeholder', { method: 'blurhash' })).toBe('BlurHash, 4 × 3')
    expect(summary('palette')).toBe('6 colours as JSON')
    expect(summary('palette', { count: 1, format: 'css' })).toBe('1 colour as CSS variables')
    expect(summary('contact-sheet')).toBe('4 columns of 320 px, JPEG')
    expect(summary('images-to-pdf')).toBe('A4 pages, images.pdf')
    expect(summary('images-to-pdf', { pageSize: 'image', name: 'album' })).toBe(
      'Pages fit each image, album.pdf',
    )
  })

  it('describes every node that has settings, and every node has an icon', () => {
    const withoutSettings = ['files', 'inspect', 'compare']
    for (const node of productRegistry.list()) {
      expect(NODE_ICONS[node.type], node.type).toBeDefined()
      if (withoutSettings.includes(node.type)) continue
      expect(summariseNode(node.type, node.defaults), node.type).not.toBe('')
    }
  })

  it('returns nothing for nodes without settings', () => {
    expect(summary('files')).toBe('')
  })
})

describe('pipelineSteps', () => {
  it('lists node types in the order items reach them, without Files', () => {
    const template = TEMPLATES.find((candidate) => candidate.id === 'web-ready-photos')
    if (!template) throw new Error('missing template')
    expect(pipelineSteps(template.pipeline)).toEqual([
      { type: 'rotate', count: 1 },
      { type: 'resize', count: 1 },
      { type: 'strip-metadata', count: 1 },
      { type: 'convert', count: 1 },
      { type: 'output', count: 1 },
    ])
  })

  it('counts a node type used on several branches once', () => {
    const template = TEMPLATES.find((candidate) => candidate.id === 'webp-and-avif')
    if (!template) throw new Error('missing template')
    expect(pipelineSteps(template.pipeline)).toEqual([
      { type: 'rotate', count: 1 },
      { type: 'resize', count: 1 },
      { type: 'convert', count: 2 },
      { type: 'output', count: 2 },
    ])
  })

  it('lists unconnected nodes too', () => {
    expect(
      pipelineSteps({
        nodes: [
          { id: 'files', type: 'files', settings: {}, position: { x: 0, y: 0 } },
          { id: 'crop', type: 'crop', settings: {}, position: { x: 0, y: 0 } },
        ],
        connections: [],
      }),
    ).toEqual([{ type: 'crop', count: 1 }])
  })
})
