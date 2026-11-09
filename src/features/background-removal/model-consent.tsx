/**
 * Asks before the one-time model download, says how large it is and where it comes from, and
 * shows its progress. Pages run the pipeline once the model is kept.
 */
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList'
import { ProgressBar } from '@astryxdesign/core/ProgressBar'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { createContext, useContext, useRef, useState } from 'react'

import { MODEL_CREDIT, RUNTIME_BYTES } from '#/features/background-removal/constants'
import type { ModelNeed } from '#/features/background-removal/device'
import { formatBytes } from '#/lib/format'

export interface ModelConsentProps {
  isOpen: boolean
  /** Models the pipeline needs that this browser does not have. */
  needs: ModelNeed[]
  /** Bytes received while the download runs. */
  progress: { received: number; total: number } | null
  /** Downloads and keeps the models. Rejects with a message when it fails. */
  onDownload: (signal: AbortSignal) => Promise<void>
  /** The models are kept: close and carry on with what needed them. */
  onDownloaded: () => void
  /** The person closed the dialog without the models: before downloading, or by cancelling. */
  onDecline: (cancelledDownload: boolean) => void
}

export function ModelConsentDialog({
  isOpen,
  needs,
  progress,
  onDownload,
  onDownloaded,
  onDecline,
}: ModelConsentProps) {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  const bytes = needs.reduce((sum, need) => sum + need.bytes, 0)
  const size = formatBytes(bytes)

  const download = async () => {
    controller.current = new AbortController()
    setDownloading(true)
    setError(null)
    try {
      await onDownload(controller.current.signal)
      onDownloaded()
    } catch (reason) {
      if (!controller.current.signal.aborted) {
        setError(reason instanceof Error ? reason.message : 'The model could not be downloaded.')
      }
    } finally {
      setDownloading(false)
    }
  }

  const close = () => {
    controller.current?.abort()
    setError(null)
    onDecline(downloading)
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => (open ? undefined : close())}
      purpose="form"
      width={480}
    >
      <DialogHeader
        title="Download the background removal model?"
        subtitle="Needed once. This browser keeps it for later runs."
        onOpenChange={(open) => (open ? undefined : close())}
      />
      <VStack gap={4} padding={4}>
        <Text type="body" color="secondary">
          Remove background finds the subject with a model that runs on this device, so your images
          can be processed without uploading them. The model itself comes from Hexlode's server.
        </Text>
        <MetadataList label={{ position: 'start', width: 96 }}>
          <MetadataListItem label="Size">
            <Text type="body" hasTabularNumbers>
              {size}, and up to {formatBytes(RUNTIME_BYTES.webgpu)} more for the engine that runs it
            </Text>
          </MetadataListItem>
          <MetadataListItem label="From">
            <Text type="body">Hexlode's server, checked before it is kept</Text>
          </MetadataListItem>
          <MetadataListItem label="Model">
            <Text type="body">{MODEL_CREDIT}</Text>
          </MetadataListItem>
        </MetadataList>
        {downloading ? (
          <VStack gap={1}>
            <ProgressBar
              label="Download progress"
              isLabelHidden
              value={progress?.received ?? 0}
              max={progress?.total ?? Math.max(1, bytes)}
            />
            <Text type="supporting" hasTabularNumbers>
              {formatBytes(progress?.received ?? 0)} of {size}
            </Text>
          </VStack>
        ) : null}
        {error ? <Banner status="error" title="The download stopped" description={error} /> : null}
        <HStack gap={2} hAlign="end">
          <Button label={downloading ? 'Cancel' : 'Not now'} variant="ghost" onClick={close} />
          <Button
            label={error ? 'Try again' : `Download ${size}`}
            variant="primary"
            isLoading={downloading}
            clickAction={download}
          />
        </HStack>
      </VStack>
    </Dialog>
  )
}

/** Lets a Studio editor offer the download its page performs. */
export const ModelDownloadContext = createContext<{
  needs: ModelNeed[]
  request: () => void
} | null>(null)

export function useModelDownload() {
  return useContext(ModelDownloadContext)
}
