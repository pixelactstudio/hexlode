import { describe, expect, it, vi } from 'vitest'

import { COLOUR_MODE_SCRIPT, createColourModeStore } from '#/features/theme/colour-mode'
import { COLOUR_MODE_ATTRIBUTE, COLOUR_MODE_KEY } from '#/features/theme/constants'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    values,
  }
}

function fakeRoot() {
  const attributes = new Map<string, string>()
  return {
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
    attributes,
  }
}

describe('colour mode', () => {
  it('is dark until the user picks another mode', () => {
    expect(createColourModeStore(memoryStorage(), fakeRoot()).get()).toBe('dark')
  })

  it('remembers the mode the user picked and applies it to the page', () => {
    const storage = memoryStorage()
    const root = fakeRoot()
    createColourModeStore(storage, root).set('light')
    expect(createColourModeStore(storage, fakeRoot()).get()).toBe('light')
    expect(root.attributes.get(COLOUR_MODE_ATTRIBUTE)).toBe('light')
  })

  it('tells subscribers when the mode changes', () => {
    const modes = createColourModeStore(memoryStorage(), fakeRoot())
    const listener = vi.fn()
    const unsubscribe = modes.subscribe(listener)
    modes.set('system')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(modes.get()).toBe('system')
    unsubscribe()
    modes.set('dark')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('ignores a stored value that is not a mode', () => {
    const storage = memoryStorage()
    storage.setItem(COLOUR_MODE_KEY, 'sepia')
    expect(createColourModeStore(storage, fakeRoot()).get()).toBe('dark')
  })

  it('still switches the page when storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    const root = fakeRoot()
    const modes = createColourModeStore(blocked, root)
    expect(modes.get()).toBe('dark')
    modes.set('light')
    expect(root.attributes.get(COLOUR_MODE_ATTRIBUTE)).toBe('light')
    expect(modes.get()).toBe('light')
  })

  it('applies the stored mode before the page paints', () => {
    const run = (stored: string | null) => {
      const root = fakeRoot()
      const storage = memoryStorage()
      if (stored !== null) storage.setItem(COLOUR_MODE_KEY, stored)
      new Function('localStorage', 'document', COLOUR_MODE_SCRIPT)(storage, {
        documentElement: root,
      })
      return root.attributes.get(COLOUR_MODE_ATTRIBUTE)
    }
    expect(run('light')).toBe('light')
    expect(run('system')).toBe('system')
    expect(run(null)).toBe('dark')
    expect(run('sepia')).toBe('dark')
  })
})
