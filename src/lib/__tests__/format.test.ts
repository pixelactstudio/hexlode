import { describe, expect, it } from 'vitest'

import { formatAge, formatChange } from '#/lib/format'

describe('formatChange', () => {
  it('shows how much smaller or larger a file got', () => {
    expect(formatChange(1000, 580)).toBe('−42%')
    expect(formatChange(1000, 1080)).toBe('+8%')
    expect(formatChange(1000, 1000)).toBe('0%')
  })

  it('never says a file that still has bytes shrank by 100%', () => {
    expect(formatChange(1_600_000, 7_500)).toBe('−99%')
    expect(formatChange(1000, 0)).toBe('−100%')
  })

  it('has no change to show without a size before', () => {
    expect(formatChange(0, 500)).toBe('—')
  })
})

describe('formatAge', () => {
  it('says how long ago something happened, in the largest whole unit', () => {
    expect(formatAge(20_000)).toBe('just now')
    expect(formatAge(5 * 60_000)).toBe('5 minutes ago')
    expect(formatAge(60 * 60_000)).toBe('1 hour ago')
    expect(formatAge(23 * 60 * 60_000)).toBe('23 hours ago')
  })
})
