import { describe, expect, it } from 'vitest'

import { fromOwnerPage } from '#/lib/worker-message'

const scope = { location: { origin: 'https://hexlode.damnlabs.com' } }
const message = (origin: string) => new MessageEvent('message', { data: {}, origin })

describe('fromOwnerPage', () => {
  it('accepts what the page that started the worker posts, which carries no origin', () => {
    expect(fromOwnerPage(message(''), scope)).toBe(true)
  })

  it("accepts a message marked with the worker's own origin", () => {
    expect(fromOwnerPage(message('https://hexlode.damnlabs.com'), scope)).toBe(true)
  })

  it('refuses a message from any other origin', () => {
    expect(fromOwnerPage(message('https://elsewhere.example'), scope)).toBe(false)
    expect(fromOwnerPage(message('null'), scope)).toBe(false)
  })
})
