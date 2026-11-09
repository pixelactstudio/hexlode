/**
 * What the service worker does, as plain functions over Cache Storage and the network, so tests
 * can run it with a fake network. `service-worker.ts` wires it to the worker's events (ADR 0015).
 */
import {
  APP_CACHE_PREFIX,
  APP_SHELL_PATH,
  NETWORK_ONLY_PREFIXES,
  PAGE_CACHE_PREFIX,
} from '#/features/offline/constants'

/** What the build hands the worker: its version and the files and pages to keep. */
export interface PrecacheManifest {
  /** Changes whenever any build file changes; names this build's caches. */
  version: string
  /** Every build file, as root-relative URLs. */
  urls: string[]
  /** Pages downloaded on install, so they open offline before they are first visited. */
  pages: string[]
  /** Build files kept the first time they are used, not on install. */
  onFirstUse?: string[]
}

export interface WorkerDeps {
  caches: CacheStorage
  fetch: typeof fetch
  /** The site's origin; the worker answers nothing from other origins. */
  origin: string
}

type WaitUntil = (promise: Promise<unknown>) => void

/** The build's own scripts and styles a page loads, as root-relative paths. */
const BUILD_FILE = /(?:src|href)="(\/assets\/[^"?#]+)"/g

export function createOfflineWorker(manifest: PrecacheManifest, deps: WorkerDeps) {
  const appCache = `${APP_CACHE_PREFIX}${manifest.version}`
  const pageCache = `${PAGE_CACHE_PREFIX}${manifest.version}`
  const precached = new Set(manifest.urls)
  const onFirstUse = new Set(manifest.onFirstUse ?? [])

  /**
   * Keeps a copy of a page, unless it loads build files this worker lacks: a page served by a
   * newer deploy than this worker could not start offline.
   */
  async function keepPage(url: string, response: Response) {
    const html = await response.text()
    for (const [, path] of html.matchAll(BUILD_FILE)) if (!precached.has(path)) return
    const cache = await deps.caches.open(pageCache)
    // The body is already decoded, so only its type carries over.
    const type = response.headers.get('content-type') ?? 'text/html; charset=utf-8'
    await cache.put(url, new Response(html, { headers: { 'content-type': type } }))
  }

  async function downloadPage(path: string) {
    const url = new URL(path, deps.origin).href
    try {
      const response = await deps.fetch(new Request(url, { cache: 'no-cache' }))
      if (response.ok) await keepPage(url, response)
    } catch {
      // A page that fails to download opens from the app shell instead.
    }
  }

  /** The copy of a page, the same page with another query, or the app shell. */
  async function offlinePage(request: Request) {
    const pages = await deps.caches.open(pageCache)
    const copy =
      (await pages.match(request.url)) ??
      (await pages.match(request.url, { ignoreSearch: true })) ??
      (await pages.match(new URL(APP_SHELL_PATH, deps.origin).href))
    return copy ?? Response.error()
  }

  async function answerPage(request: Request, waitUntil: WaitUntil) {
    let response: Response
    try {
      response = await deps.fetch(request)
    } catch {
      return offlinePage(request)
    }
    if (response.ok && response.type !== 'opaqueredirect') {
      waitUntil(keepPage(request.url, response.clone()))
    }
    return response
  }

  async function answerFile(request: Request) {
    const cached = await deps.caches.match(request.url, { cacheName: appCache })
    return cached ?? deps.fetch(request)
  }

  /** The copy kept on an earlier use, or the network's answer, which is then kept. */
  async function answerFirstUse(request: Request, waitUntil: WaitUntil) {
    const cached = await deps.caches.match(request.url, { cacheName: appCache })
    if (cached) return cached
    const response = await deps.fetch(request)
    if (response.ok) {
      const copy = response.clone()
      waitUntil(deps.caches.open(appCache).then((cache) => cache.put(request.url, copy)))
    }
    return response
  }

  return {
    /** Downloads every build file and the main pages. Fails, so the worker retries later, if a build file is missing. */
    async install() {
      const cache = await deps.caches.open(appCache)
      await Promise.all(
        manifest.urls.map(async (url) => {
          const request = new Request(new URL(url, deps.origin), { cache: 'no-cache' })
          const response = await deps.fetch(request)
          if (!response.ok) throw new Error(`${url} answered ${response.status}`)
          await cache.put(request, response)
        }),
      )
      await Promise.all(manifest.pages.map(downloadPage))
    },
    /** Deletes the files and pages of earlier builds. Caches of other features stay. */
    async activate() {
      const current = new Set([appCache, pageCache])
      const names = await deps.caches.keys()
      await Promise.all(
        names
          .filter((name) => name.startsWith(APP_CACHE_PREFIX) || name.startsWith(PAGE_CACHE_PREFIX))
          .filter((name) => !current.has(name))
          .map((name) => deps.caches.delete(name)),
      )
    },
    /**
     * The response to a request the worker answers, or undefined to leave the request to the
     * network untouched.
     */
    respond(request: Request, waitUntil: WaitUntil): Promise<Response> | undefined {
      const url = new URL(request.url)
      if (url.origin !== deps.origin || request.method !== 'GET') return undefined
      if (NETWORK_ONLY_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return undefined
      if (request.mode === 'navigate') return answerPage(request, waitUntil)
      if (precached.has(url.pathname)) return answerFile(request)
      if (onFirstUse.has(url.pathname)) return answerFirstUse(request, waitUntil)
      return undefined
    },
  }
}
