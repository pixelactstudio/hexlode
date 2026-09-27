import { Button } from '@astryxdesign/core/Button'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Lightbox } from '@astryxdesign/core/Lightbox'
import { List, ListItem } from '@astryxdesign/core/List'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { StatusDot } from '@astryxdesign/core/StatusDot'
import { Text } from '@astryxdesign/core/Text'
import { Thumbnail } from '@astryxdesign/core/Thumbnail'
import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { SourceItem } from '#/features/engine/runner'
import { FORMAT_NAMES } from '#/features/images/image-item'
import type { RunController, RunControllerState } from '#/features/runs/run-controller'
import { formatBytes, formatCount } from '#/lib/format'

/** Rows shown before "Show all"; thumbnails decode the full image, so long lists stay short. */
const VISIBLE_ROWS = 8
/** Formats every current browser can show in an image element. */
const BROWSER_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif'])

function formatName(format: string | undefined) {
  return FORMAT_NAMES[format as keyof typeof FORMAT_NAMES] ?? format ?? ''
}

/** Object URLs for the files shown, released when they leave the list. */
function useObjectUrls(sources: SourceItem[]) {
  const [urls, setUrls] = useState<Map<string, string>>(() => new Map())
  useEffect(() => {
    const next = new Map<string, string>()
    for (const source of sources) {
      if (source.file instanceof File && BROWSER_FORMATS.has(String(source.meta.format))) {
        next.set(source.key, URL.createObjectURL(source.file))
      }
    }
    setUrls(next)
    return () => {
      for (const url of next.values()) URL.revokeObjectURL(url)
    }
  }, [sources])
  return urls
}

/**
 * The images added to a run: a thumbnail, the size and format of each, a full-size preview on
 * click, and a remove button per image. Refused files are listed with the reason.
 */
export function SourceList({
  controller,
  state,
}: {
  controller: RunController
  state: RunControllerState
}) {
  const { sources, refused, running } = state
  const [showAll, setShowAll] = useState(false)
  const [preview, setPreview] = useState<number | null>(null)
  const total = sources.length + refused.length
  const visible = useMemo(
    () => (showAll ? sources : sources.slice(0, VISIBLE_ROWS)),
    [sources, showAll],
  )
  const urls = useObjectUrls(visible)
  const viewable = visible.filter((source) => urls.has(source.key))
  const bytes = sources.reduce((sum, source) => sum + (source.meta.size ?? 0), 0)

  if (total === 0) return null
  const hidden = sources.length - visible.length
  const refusedRows = showAll
    ? refused
    : refused.slice(0, Math.max(0, VISIBLE_ROWS - visible.length))

  return (
    <VStack gap={2}>
      <HStack gap={2} vAlign="center" hAlign="between">
        <Text type="supporting" hasTabularNumbers>
          {`${formatCount(sources.length)} image${sources.length === 1 ? '' : 's'} · ${formatBytes(bytes)}${
            refused.length > 0 ? ` · ${formatCount(refused.length)} refused` : ''
          }`}
        </Text>
        <Button
          label="Remove all"
          size="sm"
          variant="ghost"
          onClick={() => void controller.clearFiles()}
          isDisabled={running}
        />
      </HStack>
      <List density="compact" hasDividers>
        {visible.map((source) => {
          const url = urls.get(source.key)
          const { width, height, format, size, name } = source.meta
          return (
            <ListItem
              key={source.key}
              label={name}
              description={[
                formatName(format),
                width && height ? `${width} × ${height}` : null,
                size !== undefined ? formatBytes(size) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              startContent={
                <Thumbnail
                  src={url}
                  alt={url ? name : undefined}
                  label={url ? `Preview ${name}` : `${formatName(format)} has no preview here`}
                  onClick={url ? () => setPreview(viewable.indexOf(source)) : undefined}
                />
              }
              endContent={
                <IconButton
                  label={`Remove ${name}`}
                  tooltip="Remove"
                  icon={<X size={16} />}
                  variant="ghost"
                  size="sm"
                  onClick={() => void controller.removeFile(name)}
                  isDisabled={running}
                />
              }
            />
          )
        })}
        {refusedRows.map((file) => (
          <ListItem
            key={`refused:${file.name}`}
            label={file.name}
            description={file.reason}
            startContent={<StatusDot variant="error" label="Refused" />}
            endContent={
              <IconButton
                label={`Remove ${file.name}`}
                tooltip="Remove"
                icon={<X size={16} />}
                variant="ghost"
                size="sm"
                onClick={() => void controller.removeFile(file.name)}
                isDisabled={running}
              />
            }
          />
        ))}
      </List>
      {hidden > 0 || refusedRows.length < refused.length ? (
        <HStack>
          <Button
            label={showAll ? 'Show fewer' : `Show all ${formatCount(total)}`}
            size="sm"
            variant="ghost"
            onClick={() => setShowAll((current) => !current)}
          />
        </HStack>
      ) : null}
      {preview !== null && viewable[preview] ? (
        <Lightbox
          isOpen
          onOpenChange={(open) => {
            if (!open) setPreview(null)
          }}
          media={viewable.map((source) => ({
            src: urls.get(source.key) as string,
            alt: source.meta.name,
            caption: source.meta.name,
          }))}
          index={preview}
          onIndexChange={setPreview}
          hasZoom
        />
      ) : null}
    </VStack>
  )
}
