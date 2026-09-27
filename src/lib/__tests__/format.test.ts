import { describe, expect, it } from 'vitest'

import { formatChange } from '#/lib/format'

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
