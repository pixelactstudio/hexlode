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

import { formatBytes } from '#/lib/format-bytes'

function previewDetails(preview: Preview) {
  return `${preview.width} × ${preview.height} · ${formatBytes(preview.size)}`
}

function ComparisonPreview({ preview }: { preview: Preview | null }) {
  if (!preview) {
    return (
      <VStack gap={1}>
        <Thumbnail label="WebP output not ready" className="size-24" />
        <Text type="supporting" color="secondary">
          WebP pending
        </Text>
      </VStack>
    )
  }

  return (
    <VStack gap={1}>
      <Thumbnail
        src={preview.url}
        label={`${preview.label} image`}
        alt={`${preview.label} image preview`}
        className="size-24"
      />
      <Text type="supporting">{preview.label}</Text>
    </VStack>
  )
}

export function ImageComparison({ source, result }: ImageComparisonProps) {
  const sourceDetails = previewDetails(source)
  const resultDetails = result ? previewDetails(result) : 'Run the pipeline to create an output.'

  return (
    <VStack gap={3}>
      <HStack gap={3}>
        <ComparisonPreview preview={source} />
        <ComparisonPreview preview={result} />
      </HStack>
      <MetadataList columns="single" label={{ position: 'start', width: 96 }}>
        <MetadataListItem label="Source">{sourceDetails}</MetadataListItem>
        <MetadataListItem label="WebP">{resultDetails}</MetadataListItem>
      </MetadataList>
    </VStack>
  )
}
