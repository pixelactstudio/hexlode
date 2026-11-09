/**
 * Files opened from the file manager into the installed app, on desktop Chromium. The manifest's
 * file handlers open `/open`, and the browser hands the files over through `window.launchQueue`.
 */
import { productRegistry } from '#/features/nodes/registry'
import { PIPELINE_FILE_EXTENSION } from '#/features/pipelines/constants'
import type { createDraftStore } from '#/features/pipelines/draft'
import { importPipelineFile } from '#/features/pipelines/pipeline-file'
import type { NamedPipeline } from '#/features/pipelines/types'

/** The parts of the File Handling API Hexlode uses. */
export interface LaunchedHandle {
  kind: 'file' | 'directory'
  getFile?: () => Promise<File>
}

export interface LaunchQueueLike {
  setConsumer(consumer: (params: { files: readonly LaunchedHandle[] }) => void): void
}

export interface LaunchedFiles {
  /** `.hexlode` pipeline files, which open in the Studio. */
  pipelines: File[]
  /** Everything else, for a tool page to check and add. */
  images: File[]
}

function isPipelineFile(file: File) {
  return file.name.toLowerCase().endsWith(PIPELINE_FILE_EXTENSION)
}

/** Calls `onLaunch` with the files of each launch. Does nothing where the browser has no queue. */
export function listenForLaunches(
  queue: LaunchQueueLike | undefined,
  onLaunch: (files: LaunchedFiles) => void,
) {
  queue?.setConsumer(async ({ files }) => {
    const opened = await Promise.all(
      files.flatMap((handle) =>
        handle.kind === 'file' && handle.getFile ? [handle.getFile()] : [],
      ),
    )
    if (opened.length === 0) return
    onLaunch({
      pipelines: opened.filter(isPipelineFile),
      images: opened.filter((file) => !isPipelineFile(file)),
    })
  })
}

/**
 * Opens a launched `.hexlode` file the way the Studio's import does: it becomes the tab's draft,
 * which the Studio opens. Throws PipelineFileError, leaving the draft alone, if the file is damaged.
 */
export async function openLaunchedPipeline(
  file: File,
  drafts: ReturnType<typeof createDraftStore>,
): Promise<NamedPipeline> {
  const imported = importPipelineFile(await file.text(), productRegistry)
  drafts.write({ ...imported, savedId: null, dirty: false })
  return imported
}
