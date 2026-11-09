/**
 * The service worker's decisions, run against the browser's real Cache Storage with a fake
 * network, so each test can take the network away.
 */
import { afterEach, describe, expect, it } from 'vitest'

import { createOfflineWorker, type PrecacheManifest } from '#/features/offline/worker'

const ORIGIN = location.origin
const TEST_PREFIX = 'hexlode-'

/** A fake network: answers the paths it knows, and fails every request while offline. */
function network(files: Record<string, string | (() => Response)>) {
  const state = { online: true, requested: [] as string[] }
  const fetcher = async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input), ORIGIN)
    state.requested.push(url.pathname + url.search)
    if (!state.online) throw new TypeError('Failed to fetch')
    const file = files[url.pathname]
    if (file === undefined) return new Response('Not found', { status: 404 })
    if (typeof file === 'function') return file()
    const type = url.pathname.endsWith('.html') || !url.pathname.includes('.') ? 'text/html' : ''
    return new Response(file, { headers: type ? { 'content-type': type } : {} })
  }
  return { state, fetch: fetcher as typeof fetch }
}

function page(script: string, body: string) {
  return `<!DOCTYPE html><html><head><link rel="modulepreload" href="${script}"/></head><body>${body}<script type="module" src="${script}"></script></body></html>`
}

const MANIFEST: PrecacheManifest = {
  version: 'v1',
  urls: ['/assets/index-1.js', '/assets/codec-1.wasm'],
  pages: ['/', '/compress', '/app-shell'],
}

const FILES = {
  '/app-shell': page('/assets/index-1.js', 'shell'),
  '/assets/index-1.js': 'console.log(1)',
  '/assets/codec-1.wasm': 'wasm',
  '/': page('/assets/index-1.js', 'home'),
  '/compress': page('/assets/index-1.js', 'compress'),
}

function navigation(path: string) {
  // A page load. Pages cannot build navigation requests, so the mode is set on this one.
  const request = new Request(new URL(path, ORIGIN))
  Object.defineProperty(request, 'mode', { value: 'navigate' })
  return request
}

/** Runs a request through the worker and waits for the work it hands to `waitUntil`. */
async function respond(worker: ReturnType<typeof createOfflineWorker>, request: Request) {
  const pending: Promise<unknown>[] = []
  const response = worker.respond(request, (promise) => pending.push(promise))
  const result = response ? await response : undefined
  await Promise.all(pending)
  return result
}

afterEach(async () => {
  for (const name of await caches.keys()) {
    if (name.startsWith(TEST_PREFIX) || name.startsWith('other-')) await caches.delete(name)
  }
})

describe('installing', () => {
  it('downloads every build file into a cache named for the build', async () => {
    const net = network(FILES)
    const worker = createOfflineWorker(MANIFEST, { caches, fetch: net.fetch, origin: ORIGIN })
    await worker.install()
    const cache = await caches.open('hexlode-app-v1')
    const cached = (await cache.keys()).map((request) => new URL(request.url).pathname).sort()
    expect(cached).toEqual(['/assets/codec-1.wasm', '/assets/index-1.js'])
    expect(await (await cache.match('/assets/codec-1.wasm'))?.text()).toBe('wasm')
  })
})

describe('activating', () => {
  it('deletes the caches of earlier builds and keeps every other cache', async () => {
    for (const name of ['hexlode-app-v0', 'hexlode-pages-v0', 'hexlode-share', 'other-models']) {
      await (await caches.open(name)).put(new URL('/x', ORIGIN).href, new Response('x'))
    }
    const net = network(FILES)
    const worker = createOfflineWorker(MANIFEST, { caches, fetch: net.fetch, origin: ORIGIN })
    await worker.install()
    await worker.activate()
    expect((await caches.keys()).sort()).toEqual([
      'hexlode-app-v1',
      'hexlode-pages-v1',
      'hexlode-share',
      'other-models',
    ])
  })
})

describe('offline', () => {
  async function installedOffline() {
    const net = network(FILES)
    const worker = createOfflineWorker(MANIFEST, { caches, fetch: net.fetch, origin: ORIGIN })
    await worker.install()
    net.state.online = false
    return worker
  }

  it('opens a page downloaded on install, before it was ever visited', async () => {
    const worker = await installedOffline()
    const response = await respond(worker, navigation('/compress'))
    expect(await response?.text()).toContain('compress')
  })

  it('opens the app shell for a page it has never seen', async () => {
    const worker = await installedOffline()
    const response = await respond(worker, navigation('/tools/abc123'))
    expect(await response?.text()).toContain('shell')
  })

  it('answers nothing it has no copy of, such as a server route', async () => {
    const worker = await installedOffline()
    expect(await respond(worker, new Request(new URL('/_serverFn/abc', ORIGIN)))).toBeUndefined()
  })

  it('serves build files from the cache', async () => {
    const worker = await installedOffline()
    const response = await respond(worker, new Request(new URL('/assets/codec-1.wasm', ORIGIN)))
    expect(await response?.text()).toBe('wasm')
  })
})

describe('online', () => {
  it('loads pages from the network, so a new deploy shows up on the next load', async () => {
    const files: Record<string, string> = { ...FILES }
    const net = network(files)
    const worker = createOfflineWorker(MANIFEST, { caches, fetch: net.fetch, origin: ORIGIN })
    await worker.install()
    files['/compress'] = page('/assets/index-1.js', 'compress, deployed again')
    const online = await respond(worker, navigation('/compress'))
    expect(await online?.text()).toContain('deployed again')
    net.state.online = false
    const offline = await respond(worker, navigation('/compress'))
    expect(await offline?.text()).toContain('deployed again')
  })

  it('keeps no copy of a page whose scripts belong to another build', async () => {
    const files: Record<string, string> = { ...FILES }
    const net = network(files)
    const worker = createOfflineWorker(MANIFEST, { caches, fetch: net.fetch, origin: ORIGIN })
    await worker.install()
    // The server was updated before this worker: its page needs scripts this worker lacks.
    files['/compress'] = page('/assets/index-2.js', 'compress from the next build')
    await respond(worker, navigation('/compress'))
    net.state.online = false
    const offline = await respond(worker, navigation('/compress'))
    expect(await offline?.text()).not.toContain('next build')
  })

  it.each([
    ['a server route page', navigation('/api/auth/callback')],
    ['a model file', new Request(new URL('/models/segment.onnx', ORIGIN))],
    ['another site', new Request('https://us.i.posthog.com/static/array.js')],
    ['an upload', new Request(new URL('/x7k2m9qa', ORIGIN), { method: 'POST', body: '{}' })],
  ])('leaves %s to the network', async (_name, request) => {
    const net = network(FILES)
    const worker = createOfflineWorker(MANIFEST, { caches, fetch: net.fetch, origin: ORIGIN })
    await worker.install()
    expect(await respond(worker, request)).toBeUndefined()
  })
})
