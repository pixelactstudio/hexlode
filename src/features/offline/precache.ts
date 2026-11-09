/**
 * Which files of the client build the service worker keeps: every script, style, font, codec and
 * public file, so the whole app works offline after the first visit, including the codecs the
 * visitor has not used yet. A few large files that need the user's consent are kept on first use.
 */
import { CACHED_ON_FIRST_USE, PRECACHE_SKIPPED } from '#/features/offline/constants'

/** Turns client build file names, relative to the output folder, into the URLs to cache. */
export function precacheUrls(files: Iterable<string>): string[] {
  const urls = new Set<string>()
  for (const file of files) {
    const path = file.replaceAll('\\', '/').replace(/^\/+/, '')
    if (PRECACHE_SKIPPED.some((pattern) => pattern.test(path))) continue
    urls.add(`/${path}`)
  }
  return [...urls].sort()
}

/** Whether the worker keeps a build file the first time it is used rather than on install. */
export function cachedOnFirstUse(url: string) {
  return CACHED_ON_FIRST_USE.some((pattern) => pattern.test(url))
}
