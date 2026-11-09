import { useNavigate } from '@tanstack/react-router'
import { useEffect, useEffectEvent } from 'react'

import { SHARE_PAGE, SHARED_SEARCH } from '#/features/handover/constants'
import { takeHandover } from '#/features/handover/handover'
import { type SharedPhotos, takeSharedPhotos } from '#/features/handover/share'
import type { InputFile } from '#/features/runs/sources'
import { track } from '#/features/usage/usage'

/**
 * Lets a tool page start with files already added: files handed over from the open page, and on
 * Strip metadata, photos shared to the installed app, with the settings they open with.
 */
export function useArrivingFiles({
  path,
  onFiles,
  onShare,
}: {
  /** The page's own address, such as `/compress` or `/tools/<id>`. */
  path: string
  onFiles: (files: InputFile[]) => void
  /** Strip metadata takes shared photos and their settings here. */
  onShare?: (share: SharedPhotos) => void
}) {
  const navigate = useNavigate()
  const deliverFiles = useEffectEvent(onFiles)
  const deliverShare = useEffectEvent((share: SharedPhotos) => onShare?.(share))

  useEffect(() => {
    const handed = takeHandover(path)
    if (handed.length > 0) deliverFiles(handed.map((file) => ({ file, relativePath: file.name })))
    if (path !== SHARE_PAGE || typeof caches === 'undefined') return
    if (!new URLSearchParams(window.location.search).has(SHARED_SEARCH)) return
    void takeSharedPhotos(caches).then((share) => {
      if (share) {
        deliverShare(share)
        track('files_opened', { source: 'share', images: share.files.length, pipelineFiles: 0 })
      }
      // A reload then starts empty instead of looking for the share again.
      void navigate({ to: path, replace: true })
    })
  }, [path, navigate])
}
