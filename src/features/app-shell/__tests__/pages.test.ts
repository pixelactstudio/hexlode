import { describe, expect, it } from 'vitest'

import { pageOf } from '#/features/app-shell/pages'

describe('pageOf', () => {
  it('names the fixed pages', () => {
    expect(pageOf('/')).toBe('home')
    expect(pageOf('/studio')).toBe('studio')
    expect(pageOf('/privacy')).toBe('privacy')
  })

  it('names each quick tool by its path', () => {
    expect(pageOf('/convert')).toBe('convert')
    expect(pageOf('/strip-metadata')).toBe('strip-metadata')
  })

  it('treats saved pipelines as tool pages', () => {
    expect(pageOf('/tools/abc123')).toBe('tool')
  })

  it('ignores a trailing slash', () => {
    expect(pageOf('/studio/')).toBe('studio')
    expect(pageOf('/crop/')).toBe('crop')
  })

  it('falls back for unknown paths', () => {
    expect(pageOf('/nowhere')).toBe('other')
  })
})
