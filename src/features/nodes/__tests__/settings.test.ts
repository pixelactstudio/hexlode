/** Settings rules every product node follows, so saved pipelines and analytics stay stable. */
import { describe, expect, it } from 'vitest'

import { PRODUCT_NODES } from '#/features/nodes/registry'

const byType = new Map(PRODUCT_NODES.map((node) => [node.type, node]))
const COLOUR_SETTINGS = [
  ['background', 'colour'],
  ['pad', 'colour'],
  ['filters', 'shadows'],
  ['text-watermark', 'colour'],
  ['border', 'borderColour'],
  ['favicon', 'background'],
  ['contact-sheet', 'background'],
] as const

describe('node settings', () => {
  it('has all 33 nodes of the catalogue, once each', () => {
    expect(PRODUCT_NODES).toHaveLength(33)
    expect(byType.size).toBe(33)
  })

  it.each(
    PRODUCT_NODES.map((node) => [node.type, node] as const),
  )('%s fills every setting from defaults and reads its own output back unchanged', (_type, node) => {
    expect(node.parseSettings({})).toEqual(node.defaults)
    expect(node.parseSettings(node.defaults)).toEqual(node.defaults)
    expect(node.parseSettings(JSON.parse(JSON.stringify(node.defaults)))).toEqual(node.defaults)
  })

  it.each(COLOUR_SETTINGS)('%s takes %s as a hex colour, with or without alpha', (type, key) => {
    const node = byType.get(type)
    if (!node) throw new Error(`No node ${type}`)
    expect(node.parseSettings({ [key]: '#AABBCC' })[key]).toBe('#aabbcc')
    expect(node.parseSettings({ [key]: '#aabbcc80' })[key]).toBe('#aabbcc80')
    for (const invalid of ['red', '#abc', 'aabbcc', '#gggggg']) {
      expect(() => node.parseSettings({ [key]: invalid })).toThrow()
    }
  })

  it('keeps every setting the user types out of analytics', () => {
    const typed = {
      'text-watermark': ['text'],
      'image-watermark': ['logo'],
      'set-copyright': ['artist', 'copyright'],
      'responsive-set': ['sizes', 'path'],
      favicon: ['name', 'path'],
      'contact-sheet': ['name'],
      'images-to-pdf': ['name'],
    }
    for (const [type, keys] of Object.entries(typed)) {
      expect(byType.get(type)?.privateSettings).toEqual(keys)
    }
  })
})
