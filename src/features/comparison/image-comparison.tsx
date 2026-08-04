import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { Thumbnail } from '@astryxdesign/core/Thumbnail'

interface Preview {
  height: number
  label: string
  size: number
  url: string
  width: number
}

interface ImageComparisonProps {
  source: Preview
  result: Preview | null
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function ImageComparison({ source, result }: ImageComparisonProps) {
  return (
    <VStack gap={3}>
      <HStack gap={3}>
        <VStack gap={1}>
          <Thumbnail
            src={source.url}
            label="Source image"
            alt="Source image preview"
            className="size-24"
          />
          <Text type="supporting">Source</Text>
        </VStack>
        {result ? (
          <VStack gap={1}>
            <Thumbnail
              src={result.url}
              label="WebP output"
              alt="WebP output preview"
              className="size-24"
            />
            <Text type="supporting">WebP</Text>
          </VStack>
        ) : (
          <VStack gap={1}>
            <Thumbnail label="WebP output not ready" className="size-24" />
            <Text type="supporting" color="secondary">
              WebP pending
            </Text>
          </VStack>
        )}
      </HStack>
      <MetadataList columns="single" label={{ position: 'start', width: 96 }}>
        <MetadataListItem label="Source">
          {source.width} × {source.height} · {formatBytes(source.size)}
        </MetadataListItem>
        <MetadataListItem label="WebP">
          {result
            ? `${result.width} × ${result.height} · ${formatBytes(result.size)}`
            : 'Run the pipeline to create an output.'}
        </MetadataListItem>
      </MetadataList>
    </VStack>
  )
}
