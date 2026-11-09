/**
 * The build step: a real Vite build of a small app with the plugin, then the `sw.js` it emits,
 * run in a sandbox with a fake network and Cache Storage, to see what it downloads on install.
 */
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { build, type Rolldown } from 'vite'
import { afterAll, describe, expect, it } from 'vitest'

import { serviceWorker } from '#/features/offline/build-plugin'

const FIXTURE = join(import.meta.dirname, 'fixtures/app')
const ENTRY = join(import.meta.dirname, '../service-worker.ts')
const copies: string[] = []

afterAll(() => {
  for (const copy of copies) rmSync(copy, { recursive: true, force: true })
})

/** A copy of the fixture app, so a test can change its public files. */
function fixtureCopy() {
  const root = mkdtempSync(join(tmpdir(), 'hexlode-sw-'))
  cpSync(FIXTURE, root, { recursive: true })
  copies.push(root)
  return root
}

async function buildApp(root: string) {
  const result = (await build({
    configFile: false,
    root,
    logLevel: 'silent',
    plugins: [serviceWorker({ entry: ENTRY, pages: ['/', '/studio'] })],
    build: {
      write: false,
      sourcemap: true,
      assetsInlineLimit: 0,
      rollupOptions: { input: join(root, 'main.js') },
    },
  })) as Rolldown.RolldownOutput
  const worker = result.output.find((file) => file.fileName === 'sw.js')
  if (!worker || worker.type !== 'asset') throw new Error('The build emitted no sw.js')
  return String(worker.source)
}

/** Minimal Cache Storage: enough for the worker to fill and empty its caches. */
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>()
  const open = async (name: string) => {
    const store = stores.get(name) ?? new Map<string, Response>()
    stores.set(name, store)
    return {
      put: async (request: RequestInfo | URL, response: Response) => {
        store.set(new Request(request).url, response)
      },
      match: async (request: RequestInfo | URL) => store.get(new Request(request).url),
      keys: async () => [...store.keys()].map((url) => new Request(url)),
    }
  }
  return {
    stores,
    storage: {
      open,
      keys: async () => [...stores.keys()],
      delete: async (name: string) => stores.delete(name),
      match: async (request: RequestInfo | URL, options?: { cacheName?: string }) =>
        options?.cacheName
          ? stores.get(options.cacheName)?.get(new Request(request).url)
          : undefined,
    },
  }
}

/** Runs the emitted worker in a sandbox and returns its event listeners and what it did. */
function startWorker(code: string) {
  const origin = 'https://hexlode.test'
  const listeners = new Map<string, (event: unknown) => void>()
  const calls: string[] = []
  const caches = fakeCaches()
  const scope = {
    location: new URL(`${origin}/sw.js`),
    caches: caches.storage,
    fetch: async (input: RequestInfo | URL) => {
      const url = new URL(new Request(input).url)
      return new Response(url.pathname.endsWith('.wasm') ? 'wasm' : '<html></html>', {
        headers: { 'content-type': url.pathname.includes('.') ? 'text/plain' : 'text/html' },
      })
    },
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners.set(type, listener)
    },
    skipWaiting: async () => {
      calls.push('skipWaiting')
    },
    clients: {
      claim: async () => {
        calls.push('claim')
      },
    },
  }
  runInNewContext(code, { self: scope, Request, Response, Headers, URL, FormData, File, Blob })
  const dispatch = async (type: string) => {
    const pending: Promise<unknown>[] = []
    listeners.get(type)?.({ waitUntil: (promise: Promise<unknown>) => pending.push(promise) })
    await Promise.all(pending)
  }
  return { origin, caches, calls, dispatch }
}

function cachedPaths(store: Map<string, Response> | undefined) {
  return [...(store?.keys() ?? [])].map((url) => new URL(url).pathname).sort()
}

describe('the service worker build step', () => {
  it('emits a worker that downloads every build and public file on install', async () => {
    const worker = startWorker(await buildApp(fixtureCopy()))
    await worker.dispatch('install')
    const [app] = [...worker.caches.stores].filter(([name]) => name.startsWith('hexlode-app-'))
    const paths = cachedPaths(app?.[1])
    expect(paths).toContain('/icons/icon.png')
    expect(paths.filter((path) => /^\/assets\/main-[\w-]+\.js$/.test(path))).toHaveLength(1)
    expect(paths.filter((path) => /^\/assets\/lazy-[\w-]+\.js$/.test(path))).toHaveLength(1)
    expect(paths.filter((path) => /^\/assets\/codec-[\w-]+\.wasm$/.test(path))).toHaveLength(1)
    expect(paths.some((path) => path.endsWith('.map') || path.startsWith('/og/'))).toBe(false)
  })

  it('downloads the main pages on install', async () => {
    const worker = startWorker(await buildApp(fixtureCopy()))
    await worker.dispatch('install')
    const [pages] = [...worker.caches.stores].filter(([name]) => name.startsWith('hexlode-pages-'))
    expect(cachedPaths(pages?.[1])).toEqual(['/', '/studio'])
  })

  it('takes over from the previous worker at once, so no page waits on an old build', async () => {
    const worker = startWorker(await buildApp(fixtureCopy()))
    await worker.dispatch('install')
    await worker.dispatch('activate')
    expect(worker.calls).toEqual(['skipWaiting', 'claim'])
  })

  it('names its caches after a version that changes when any file changes', async () => {
    const root = fixtureCopy()
    const before = startWorker(await buildApp(root))
    const again = startWorker(await buildApp(root))
    writeFileSync(join(root, 'public/icons/icon.png'), 'a new icon')
    const after = startWorker(await buildApp(root))
    for (const worker of [before, again, after]) await worker.dispatch('install')
    const names = (worker: typeof before) => [...worker.caches.stores.keys()].sort()
    expect(names(again)).toEqual(names(before))
    expect(names(after)).not.toEqual(names(before))
  })
})
