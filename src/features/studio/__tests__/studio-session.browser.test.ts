import { afterEach, describe, expect, it, vi } from 'vitest'

import { chain, decodeFile, fixtureBytes, unzip } from '#/features/nodes/__tests__/harness'
import { productRegistry } from '#/features/nodes/registry'
import { createStudioSession, type StudioSession } from '#/features/studio/studio-session'

let session: StudioSession | undefined

afterEach(() => {
  session?.dispose()
  session = undefined
})

describe('studio session', () => {
  it('runs the pipeline as edited, even right after an edit', async () => {
    session = createStudioSession(productRegistry)
    const { store, runs } = session
    store.load({ name: 'Test', pipeline: chain(['convert', { format: 'png' }]) })
    const bytes = await fixtureBytes('photo.jpg')
    await runs.addFiles([{ file: new File([bytes], 'photo.jpg'), relativePath: 'photo.jpg' }])
    await vi.waitFor(() => expect(runs.getState().sources).toHaveLength(1))
    store.updateSettings('convert-1', { format: 'webp' })
    const result = await session.start()
    expect(result?.status).toBe('complete')
    const [entry] = await unzip(result?.deliveries[0].archive as Blob)
    expect(entry.name).toBe('photo.webp')
    expect(await decodeFile(entry.bytes)).toMatchObject({ format: 'webp', width: 48, height: 32 })
  })
})
