import { describe, expect, it } from 'vitest'

import { handOver, takeHandover } from '#/features/handover/handover'

const photo = (name: string) => new File(['pixels'], name, { type: 'image/jpeg' })

describe('handing files to a page', () => {
  it('gives the files to the page they were handed to, once', () => {
    const files = [photo('a.jpg'), photo('b.jpg')]
    handOver('/compress', files)
    expect(takeHandover('/compress')).toEqual(files)
    expect(takeHandover('/compress')).toEqual([])
  })

  it('keeps them from every other page', () => {
    handOver('/tools/abc', [photo('a.jpg')])
    expect(takeHandover('/compress')).toEqual([])
    expect(takeHandover('/tools/abc').map((file) => file.name)).toEqual(['a.jpg'])
  })
})
