/**
 * Files carried into a tool page in memory, such as images opened from the file manager and then
 * sent to Compress from the open page. The router changes pages without a reload, so the files
 * never leave the tab. Each handover is for one page and is taken once.
 */
let pending: { path: string; files: File[] } | undefined

/** Holds files for the page at `path`, replacing any handover that page never took. */
export function handOver(path: string, files: File[]) {
  pending = { path, files }
}

/** The files handed to the page at `path`, once; an empty list for any other page. */
export function takeHandover(path: string): File[] {
  if (!pending || pending.path !== path) return []
  const { files } = pending
  pending = undefined
  return files
}
