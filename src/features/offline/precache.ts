/**
 * Which files of the client build the service worker downloads on the first visit: every script,
 * style, font, codec and public file, so the whole app works offline afterwards, including the
 * codecs the visitor has not used yet.
 */
import { PRECACHE_SKIPPED } from '#/features/offline/constants'

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
