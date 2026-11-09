import { mkdtemp, readdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { BACKGROUND_MODEL } from '#/features/background-removal/constants'
import { createModelServer } from '#/features/background-removal/model-server'

const fixture = () => readFile(new URL('./fixtures/threshold.onnx', import.meta.url))

async function setUp(options: { corrupt?: boolean } = {}) {
  const bytes = new Uint8Array(await fixture())
  const model = {
    ...BACKGROUND_MODEL,
    bytes: bytes.byteLength,
    sha256: '88faaa3049f5bdccf2573b9eb35905ddf41134660e021cda851ea4341dad8ccf',
    upstream: 'https://models.example/threshold.onnx',
  }
  const fetched: string[] = []
  const directory = await mkdtemp(join(tmpdir(), 'hexlode-models-'))
  const server = createModelServer({
    directory,
    models: [model],
    fetch: async (input) => {
      fetched.push(String(input))
      const body = options.corrupt ? bytes.map((value) => value ^ 1) : bytes
      return new Response(body)
    },
  })
  const get = (file = model.file, headers: Record<string, string> = {}) =>
    server.respond(file, new Request(`http://hexlode.test/models/${file}`, { headers }))
  return { model, bytes, fetched, directory, get }
}

describe('the model server', () => {
  it('fetches the pinned file once, then serves it from disk for a year', async () => {
    const { model, bytes, fetched, get } = await setUp()
    const [first, second] = await Promise.all([get(), get()])
    const third = await get()
    expect(fetched).toEqual(['https://models.example/threshold.onnx'])
    for (const response of [first, second, third]) {
      expect(response.status).toBe(200)
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
    }
    expect(third.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(third.headers.get('content-length')).toBe(String(model.bytes))
    expect(third.headers.get('etag')).toBe(`"${model.sha256}"`)
  })

  it('answers a browser that already has the file with 304', async () => {
    const { model, get } = await setUp()
    const response = await get(model.file, { 'if-none-match': `"${model.sha256}"` })
    expect(response.status).toBe(304)
  })

  it('keeps and serves nothing when the fetched file fails its checksum', async () => {
    const { directory, fetched, get } = await setUp({ corrupt: true })
    expect((await get()).status).toBe(502)
    expect(await readdir(directory)).toEqual([])
    // The next request tries again rather than serving a bad file.
    expect((await get()).status).toBe(502)
    expect(fetched).toHaveLength(2)
  })

  it('serves only the pinned models', async () => {
    const { fetched, get } = await setUp()
    expect((await get('other.onnx')).status).toBe(404)
    expect((await get('../package.json')).status).toBe(404)
    expect(fetched).toEqual([])
  })
})
