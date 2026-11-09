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
import { createThumbnailer, type Thumbnailer } from '#/features/previews/thumbnailer'
import { createThumbnailWorker } from '#/features/runs/engine-runtime'
import type { RunController, RunControllerState } from '#/features/runs/run-controller'
import { formatBytes, formatCount } from '#/lib/format'

/** Rows shown before "Show all"; thumbnails decode the full image, so long lists stay short. */
const VISIBLE_ROWS = 8
/** Formats every current browser can show in an image element. A worker draws the others. */
const BROWSER_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif'])
/** Drawn previews kept while the page is open, so a list that changes does not draw again. */
const MAX_DRAWN = 64

let thumbnailer: Thumbnailer | undefined
const drawn = new Map<string, Promise<Blob>>()

/** A preview drawn by a worker, for a file the browser cannot show, such as HEIC. */
function drawnPreview(key: string, file: Blob, name: string) {
  let preview = drawn.get(key)
  if (!preview) {
    thumbnailer ??= createThumbnailer(createThumbnailWorker)
    preview = thumbnailer.render(file, name)
    drawn.set(key, preview)
    const oldest = drawn.keys().next().value
    if (drawn.size > MAX_DRAWN && oldest !== undefined) drawn.delete(oldest)
  }
  return preview
}

function formatName(format: string | undefined) {
  return FORMAT_NAMES[format as keyof typeof FORMAT_NAMES] ?? format ?? ''
}

/**
 * Object URLs for the files shown, released when they leave the list: the file itself when the
 * browser can show it, otherwise a drawn preview once it is ready. `null` means it cannot be drawn.
 */
function useObjectUrls(sources: SourceItem[]) {
  const [urls, setUrls] = useState<Map<string, string | null>>(() => new Map())
  useEffect(() => {
    let current = true
    const created: string[] = []
    const next = new Map<string, string | null>()
    for (const source of sources) {
      if (source.file instanceof File && BROWSER_FORMATS.has(String(source.meta.format))) {
        const url = URL.createObjectURL(source.file)
        created.push(url)
        next.set(source.key, url)
      }
    }
    setUrls(next)
    for (const source of sources) {
      const { file, key, meta } = source
      if (!(file instanceof Blob) || next.has(key)) continue
      drawnPreview(key, file, meta.name).then(
        (image) => {
          if (!current) return
          const url = URL.createObjectURL(image)
          created.push(url)
          setUrls((urls) => new Map(urls).set(key, url))
        },
        () => {
          if (current) setUrls((urls) => new Map(urls).set(key, null))
        },
      )
    }
    return () => {
      current = false
      for (const url of created) URL.revokeObjectURL(url)
    }
  }, [sources])
  return urls
}

function thumbnailLabel(url: string | null | undefined, name: string, format: string | undefined) {
  if (url) return `Preview ${name}`
  if (url === undefined) return `Drawing a preview of ${name}`
  return `${formatName(format)} has no preview here`
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
  const viewable = visible.filter((source) => urls.get(source.key))
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
                  src={url ?? undefined}
                  alt={url ? name : undefined}
                  label={thumbnailLabel(url, name, format)}
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
