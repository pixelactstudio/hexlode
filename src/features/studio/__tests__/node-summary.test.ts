import { describe, expect, it } from 'vitest'

import { productRegistry } from '#/features/nodes/registry'
import { summariseNode } from '#/features/studio/node-summary'

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

  it('returns nothing for nodes without settings', () => {
    expect(summary('files')).toBe('')
  })
})
