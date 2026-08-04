import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { ButtonGroup } from '@astryxdesign/core/ButtonGroup'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { List, ListItem } from '@astryxdesign/core/List'
import { VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Token } from '@astryxdesign/core/Token'

import type { BatchItem, BatchItemStatus } from '#/features/processing/types'
import { formatBytes } from '#/lib/format-bytes'

const STATUS_COLORS: Record<BatchItemStatus, 'blue' | 'gray' | 'green' | 'orange' | 'red'> = {
  cancelled: 'orange',
  complete: 'green',
  failed: 'red',
  processing: 'blue',
  ready: 'gray',
}

interface BatchPanelProps {
  deliveryMessage: string | null
  isProcessing: boolean
  items: BatchItem[]
  onDownloadArchive: () => void
  onRetryFailed: () => void
  onWriteFolder: () => void
  renameTemplate: string
  setRenameTemplate: (value: string) => void
}

export function BatchPanel({
  deliveryMessage,
  isProcessing,
  items,
  onDownloadArchive,
  onRetryFailed,
  onWriteFolder,
  renameTemplate,
  setRenameTemplate,
}: BatchPanelProps) {
  const completed = items.filter(({ status }) => status === 'complete')
  const failed = items.filter(({ status }) => status === 'failed')

  return (
    <VStack gap={5}>
      <VStack gap={1}>
        <Heading level={2}>Batch queue</Heading>
        <Text color="secondary">One worker processes files in order to keep memory bounded.</Text>
      </VStack>
      <TextInput
        label="Rename template"
        value={renameTemplate}
        onChange={setRenameTemplate}
        description="Use {name} and {index}. Folder hierarchy is preserved when available."
        isDisabled={isProcessing}
        width="100%"
      />
      {deliveryMessage ? (
        <Banner status="info" title="Output delivery" description={deliveryMessage} />
      ) : null}
      {items.length ? (
        <List density="compact" hasDividers header={<Text type="label">Files</Text>}>
          {items.map((item) => {
            const detail = item.error
              ? item.error
              : item.output
                ? `${item.output.outputName} · ${formatBytes(item.output.size)}`
                : `${item.info.width} × ${item.info.height} · ${item.progress}%`

            return (
              <ListItem
                key={item.id}
                label={item.relativePath}
                description={detail}
                endContent={
                  <Token label={item.status} color={STATUS_COLORS[item.status]} size="sm" />
                }
              />
            )
          })}
        </List>
      ) : (
        <EmptyState
          title="No files queued"
          description="Choose images or a folder in the Files node."
          isCompact
        />
      )}
      <ButtonGroup label="Batch outputs" size="sm">
        <Button
          label="Download ZIP"
          variant="secondary"
          isDisabled={!completed.length || isProcessing}
          onClick={onDownloadArchive}
        />
        <Button
          label="Save folder"
          variant="secondary"
          isDisabled={!completed.length || isProcessing}
          onClick={onWriteFolder}
        />
        <Button
          label={`Retry failed${failed.length ? ` (${failed.length})` : ''}`}
          variant="secondary"
          isDisabled={!failed.length || isProcessing}
          onClick={onRetryFailed}
        />
      </ButtonGroup>
    </VStack>
  )
}
