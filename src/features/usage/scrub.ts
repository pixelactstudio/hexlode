/**
 * Removes file names and paths from text before it leaves the device in an error report.
 */
const EXTENSIONS =
  'jpe?g|jfif|png|webp|avif|jxl|qoi|heic|heif|gif|bmp|tiff?|svg|hexlode|zip|json|txt|pdf'
const PATH = /(?:[a-z]:)?(?:[\\/][^\\/\s"'<>|]+){2,}/gi
const QUOTED_FILE = new RegExp(`(["'])[^"'\\n]*\\.(?:${EXTENSIONS})\\1`, 'gi')
const FILE = new RegExp(`[^\\s"'<>|/\\\\]+\\.(?:${EXTENSIONS})\\b`, 'gi')

export function scrubText(text: string) {
  return text.replace(PATH, '[path]').replace(QUOTED_FILE, '$1[file]$1').replace(FILE, '[file]')
}

interface SentryLikeEvent {
  message?: string
  exception?: { values?: { type?: string; value?: string }[] }
  breadcrumbs?: { message?: string }[]
  user?: unknown
  request?: unknown
}

export function scrubSentryEvent<T extends SentryLikeEvent>(event: T): T {
  const scrubbed: T = { ...event }
  delete scrubbed.user
  delete scrubbed.request
  if (event.message) scrubbed.message = scrubText(event.message)
  if (event.exception?.values) {
    scrubbed.exception = {
      ...event.exception,
      values: event.exception.values.map((value) => ({
        ...value,
        ...(value.value ? { value: scrubText(value.value) } : {}),
      })),
    }
  }
  if (event.breadcrumbs) {
    scrubbed.breadcrumbs = event.breadcrumbs.map((crumb) => ({
      ...crumb,
      ...(crumb.message ? { message: scrubText(crumb.message) } : {}),
    }))
  }
  return scrubbed
}
