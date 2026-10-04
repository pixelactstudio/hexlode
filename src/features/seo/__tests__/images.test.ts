import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { ICON_SIZES, SEO_PAGES, SHARE_CARD, SHARE_CARD_DIRECTORY } from '#/features/seo/constants'
import { webManifest } from '#/features/seo/files'
import { rootHead } from '#/features/seo/head'

const PNG_SIGNATURE = '89504e470d0a1a0a'

/** Reads a PNG's dimensions from its header chunk. */
function pngSize(path: string) {
  const bytes = readFileSync(path)
  expect(bytes.subarray(0, 8).toString('hex')).toBe(PNG_SIGNATURE)
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

describe('generated images (rerun `pnpm seo:build` when one is missing)', () => {
  it.each(Object.keys(SEO_PAGES))('has a %s share card at the Open Graph size', (page) => {
    expect(pngSize(`public${SHARE_CARD_DIRECTORY}/${page}.png`)).toEqual(SHARE_CARD)
  })

  it('has every icon the manifest and the page head link to, at its size', () => {
    const icons = [
      ...webManifest().icons.filter((icon) => icon.type === 'image/png'),
      {
        src: `/icons/icon-${ICON_SIZES.apple}.png`,
        sizes: `${ICON_SIZES.apple}x${ICON_SIZES.apple}`,
      },
    ]
    for (const { src, sizes } of icons) {
      const [width, height] = sizes.split('x').map(Number)
      expect(pngSize(`public${src}`)).toEqual({ width, height })
    }
    const files = rootHead({ environment: 'production' }).links.filter(
      (link) => link.rel !== 'manifest',
    )
    for (const { href } of files) {
      expect(existsSync(`public${href}`), href).toBe(true)
    }
  })

  it('has a favicon.ico with a 32 pixel image', () => {
    const bytes = readFileSync('public/favicon.ico')
    expect(bytes.readUInt16LE(2)).toBe(1)
    const count = bytes.readUInt16LE(4)
    const sizes = Array.from({ length: count }, (_, index) => bytes.readUInt8(6 + index * 16))
    expect(sizes).toContain(32)
  })
})
