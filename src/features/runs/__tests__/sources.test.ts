import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { ALL_IMAGE_TYPES, typesOf } from '#/features/engine/item-types'
import { prepareSources } from '#/features/runs/sources'

function file(name: string, as = name) {
  const bytes = readFileSync(new URL(`../../images/__tests__/fixtures/${name}`, import.meta.url))
  return { file: new File([bytes], as, { lastModified: 5 }), relativePath: as }
}

describe('prepareSources', () => {
  it('reads format, dimensions and orientation, and keys files by identity', async () => {
    const { sources, refused } = await prepareSources(
      [file('photo.jpg'), file('oriented.jpg', 'trip/oriented.jpg')],
      ALL_IMAGE_TYPES,
    )
    expect(refused).toEqual([])
    expect(
      sources.map(({ index, meta }) => [
        index,
        meta.name,
        meta.format,
        meta.width,
        meta.orientation,
      ]),
    ).toEqual([
      [0, 'photo.jpg', 'jpeg', 48, 1],
      [1, 'trip/oriented.jpg', 'jpeg', 48, 6],
    ])
    const again = await prepareSources([file('photo.jpg')], ALL_IMAGE_TYPES)
    expect(again.sources[0].key).toBe(sources[0].key)
  })

  it('refuses files no branch accepts and says what the pipeline accepts', async () => {
    const { sources, refused } = await prepareSources(
      [file('photo.jpg'), file('photo.png')],
      typesOf('image', ['jpeg', 'webp']),
    )
    expect(sources.map(({ meta }) => meta.name)).toEqual(['photo.jpg'])
    expect(refused).toEqual([
      {
        name: 'photo.png',
        code: 'not_accepted',
        reason: 'No branch takes PNG images. This pipeline accepts JPEG or WebP images.',
      },
    ])
  })

  it('refuses files that are not supported images', async () => {
    const text = { file: new File(['hello'], 'notes.txt'), relativePath: 'notes.txt' }
    const { refused } = await prepareSources([text], ALL_IMAGE_TYPES)
    expect(refused).toEqual([
      {
        name: 'notes.txt',
        code: 'unsupported_format',
        reason: 'Choose a JPEG, PNG, WebP, AVIF, JPEG XL or QOI image.',
      },
    ])
  })

  it('refuses everything when Files has no branch yet', async () => {
    const { refused } = await prepareSources([file('photo.jpg')], new Set())
    expect(refused[0]).toMatchObject({ code: 'no_branches' })
  })
})
