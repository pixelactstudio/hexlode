import { describe, expect, it } from 'vitest'

import { decodeFile, fixtureBytes, near, pixelAt } from '#/features/nodes/__tests__/harness'
import { readLogo } from '#/features/studio/logo'
import { base64ToBytes } from '#/lib/base64'

describe('choosing a logo', () => {
  it('draws an SVG logo to a PNG at 1024 pixels on its longest edge', async () => {
    const svg = new File(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="#ff0000"/></svg>',
      ],
      'logo.svg',
      { type: 'image/svg+xml' },
    )
    const logo = await readLogo(svg)
    expect(logo).toMatchObject({ name: 'logo.svg', width: 1024, height: 512 })
    const image = await decodeFile(base64ToBytes(logo.data))
    expect(image).toMatchObject({ format: 'png', width: 1024, height: 512 })
    // Browsers may round a drawn colour by a level.
    expect(near(pixelAt(image, 512, 256), [255, 0, 0, 255], 2)).toBe(true)
  })

  it('keeps PNG and WebP logos as they are', async () => {
    const bytes = await fixtureBytes('alpha.webp')
    const logo = await readLogo(new File([bytes], 'mark.webp', { type: 'image/webp' }))
    expect(logo).toMatchObject({ name: 'mark.webp', width: 48, height: 32 })
    expect(base64ToBytes(logo.data)).toEqual(bytes)
  })

  it('refuses other formats', async () => {
    const jpeg = new File([await fixtureBytes('photo.jpg')], 'photo.jpg', { type: 'image/jpeg' })
    await expect(readLogo(jpeg)).rejects.toThrow('Choose a PNG, WebP or SVG logo.')
  })
})
