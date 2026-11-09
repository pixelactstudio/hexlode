/**
 * The service worker that keeps Hexlode working offline (ADR 0015). These constants are shared by
 * the worker, the page that registers it and the build step that writes its precache list, so this
 * file imports nothing.
 */

/** Where the worker is served. At the root, so its scope covers every page. */
export const SERVICE_WORKER_PATH = '/sw.js'

/**
 * A page the server renders with only the root route: the frame, with the page left to the
 * browser. Offline, a page that was never cached gets this shell, and the router renders the page.
 */
export const APP_SHELL_PATH = '/app-shell'

/** Every cache the worker owns starts with this, so it never deletes another feature's cache. */
export const CACHE_PREFIX = 'hexlode-'

/** The build's files, named per build version: `hexlode-app-<version>`. */
export const APP_CACHE_PREFIX = `${CACHE_PREFIX}app-`

/** Copies of pages, named per build version: `hexlode-pages-<version>`. */
export const PAGE_CACHE_PREFIX = `${CACHE_PREFIX}pages-`

/**
 * Paths the worker never answers, even for a page load: server routes (health, auth) and the
 * on-device model files, which manage their own cache.
 */
export const NETWORK_ONLY_PREFIXES = ['/api/', '/models/'] as const

/**
 * Build output the worker does not download: source maps, the share cards only link previews
 * show, hidden files such as Vite's manifest, and the worker itself.
 */
export const PRECACHE_SKIPPED: readonly RegExp[] = [/\.map$/, /^og\//, /(^|\/)\./, /^sw\.js$/]
