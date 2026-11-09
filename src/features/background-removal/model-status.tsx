/**
 * The Remove background node's inspector: it has no settings, so it says what the node runs and
 * whether the model is in this browser, and offers the download for live previews.
 */
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Icon } from '@astryxdesign/core/Icon'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { StatusDot } from '@astryxdesign/core/StatusDot'
import { Text } from '@astryxdesign/core/Text'
import { Cpu } from 'lucide-react'

import { BACKGROUND_MODEL, MODEL_CREDIT } from '#/features/background-removal/constants'
import { useModelDownload } from '#/features/background-removal/model-consent'
import { formatBytes } from '#/lib/format'

export function RemoveBackgroundEditor({ isDisabled }: { isDisabled?: boolean }) {
  const download = useModelDownload()
  const need = download?.needs.find((entry) => entry.id === BACKGROUND_MODEL.id)
  const size = formatBytes(BACKGROUND_MODEL.bytes)
  return (
    <VStack gap={4}>
      <Card variant="muted" padding={3}>
        <VStack gap={3}>
          <HStack gap={3} vAlign="center">
            <Icon icon={Cpu} size="md" color="secondary" />
            <VStack gap={0.5}>
              <Text type="body">{MODEL_CREDIT}</Text>
              <HStack gap={2} vAlign="center">
                <StatusDot
                  variant={need?.stored ? 'success' : 'neutral'}
                  label={need?.stored ? 'Kept in this browser' : 'Not downloaded yet'}
                />
                <Text type="supporting" hasTabularNumbers>
                  {need?.stored ? 'Kept in this browser' : `Not downloaded yet, ${size}`}
                </Text>
              </HStack>
            </VStack>
          </HStack>
          {download && need && !need.stored ? (
            <Button
              label={`Download ${size}`}
              size="sm"
              variant="secondary"
              isDisabled={isDisabled}
              onClick={download.request}
            />
          ) : null}
        </VStack>
      </Card>
      <Text type="supporting">
        The model runs on this device: on the graphics card where the browser offers WebGPU, on the
        processor otherwise. JPEG cut-outs become PNG, because JPEG has no transparency.
      </Text>
    </VStack>
  )
}
