/**
 * Photos shared to the installed app on Android. The service worker receives the share, keeps the
 * photos in Cache Storage and opens Strip metadata, which takes them once and deletes them.
 */
import {
  SHARE_CACHE,
  SHARE_FILES_FIELD,
  SHARE_PAGE,
  SHARE_SETTINGS,
  SHARE_TARGET_PATH,
  SHARED_SEARCH,
} from '#/features/handover/constants'
import type { InputFile } from '#/features/runs/sources'

const NAME_HEADER = 'x-hexlode-name'
const MODIFIED_HEADER = 'x-hexlode-last-modified'

/** Keeps the shared photos, replacing any earlier share nobody opened, and opens their page. */
async function receiveShare(request: Request, caches: CacheStorage) {
  let photos: File[] = []
  try {
    const form = await request.formData()
    photos = form
      .getAll(SHARE_FILES_FIELD)
      .filter((value): value is File => value instanceof File && value.size > 0)
  } catch {
    // A share without readable photos still opens the page, which then asks for images.
  }
  await caches.delete(SHARE_CACHE)
  if (photos.length > 0) {
    const cache = await caches.open(SHARE_CACHE)
    for (const [index, photo] of photos.entries()) {
      const headers = {
        'content-type': photo.type || 'application/octet-stream',
        [NAME_HEADER]: encodeURIComponent(photo.name),
        [MODIFIED_HEADER]: String(photo.lastModified),
      }
      await cache.put(
        new URL(`${SHARE_TARGET_PATH}/${index}`, request.url).href,
        new Response(photo, { headers }),
      )
    }
  }
  const page = new URL(SHARE_PAGE, request.url)
  page.searchParams.set(SHARED_SEARCH, '1')
  // 303 turns the share's POST into a page load, so a reload never posts the photos again.
  return Response.redirect(page.href, 303)
}

/** The worker's answer to a share, or undefined for every other request. */
export function shareResponse(request: Request, caches: CacheStorage) {
  const url = new URL(request.url)
  if (request.method !== 'POST' || url.pathname !== SHARE_TARGET_PATH) return undefined
  return receiveShare(request, caches)
}

export interface SharedPhotos {
  files: InputFile[]
  settings: typeof SHARE_SETTINGS
}

/** Takes the shared photos once, with the settings they open with, and deletes them. */
export async function takeSharedPhotos(caches: CacheStorage): Promise<SharedPhotos | null> {
  if (!(await caches.has(SHARE_CACHE))) return null
  const cache = await caches.open(SHARE_CACHE)
  const files: InputFile[] = []
  for (const request of await cache.keys()) {
    const response = await cache.match(request)
    if (!response) continue
    const name = decodeURIComponent(response.headers.get(NAME_HEADER) ?? 'shared-photo')
    const file = new File([await response.blob()], name, {
      type: response.headers.get('content-type') ?? '',
      lastModified: Number(response.headers.get(MODIFIED_HEADER)) || Date.now(),
    })
    files.push({ file, relativePath: name })
  }
  await caches.delete(SHARE_CACHE)
  return files.length > 0 ? { files, settings: SHARE_SETTINGS } : null
}
