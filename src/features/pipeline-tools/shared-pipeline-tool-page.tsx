import { Button } from '@astryxdesign/core/Button'
import { HStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { useToast } from '@astryxdesign/core/Toast'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { productRegistry } from '#/features/nodes/registry'
import { openInStudio } from '#/features/pipeline-tools/open-in-studio'
import { Missing, PipelineToolBody } from '#/features/pipeline-tools/pipeline-tool-page'
import { PipelineFileError } from '#/features/pipelines/pipeline-file'
import { readPipelineLink } from '#/features/pipelines/pipeline-link'
import { pipelineStore } from '#/features/pipelines/storage'
import type { NamedPipeline } from '#/features/pipelines/types'
import { ToolPageFrame } from '#/features/quick-tools/quick-tool-page'
import { track } from '#/features/usage/usage'
import { usePageView } from '#/features/usage/use-page-view'

type Opened =
  | { status: 'reading' }
  | { status: 'ready'; named: NamedPipeline }
  | { status: 'failed'; message: string }

/** Reads the pipeline from the address after `#`, again whenever that part changes. */
function useLinkedPipeline(): Opened {
  const [opened, setOpened] = useState<Opened>({ status: 'reading' })
  useEffect(() => {
    let current = 0
    const read = async () => {
      const attempt = ++current
      setOpened({ status: 'reading' })
      try {
        const named = await readPipelineLink(window.location.hash, productRegistry)
        if (attempt !== current) return
        setOpened({ status: 'ready', named })
        track('pipeline_link', {
          action: 'open',
          result: 'ok',
          nodeCount: named.pipeline.nodes.length,
        })
      } catch (reason) {
        if (attempt !== current) return
        const message =
          reason instanceof PipelineFileError ? reason.message : 'This link could not be read.'
        setOpened({ status: 'failed', message })
        track('pipeline_link', {
          action: 'open',
          result: 'error',
          nodeCount: 0,
          errorCode: 'invalid_link',
        })
      }
    }
    void read()
    window.addEventListener('hashchange', read)
    return () => {
      current += 1
      window.removeEventListener('hashchange', read)
    }
  }, [])
  return opened
}

/** A pipeline someone shared as a link, opened as a tool at `/tools/shared#…`. */
export function SharedPipelineToolPage() {
  usePageView({ page: 'pipeline-tool' })
  const navigate = useNavigate()
  const showToast = useToast()
  const opened = useLinkedPipeline()
  const [savedId, setSavedId] = useState<string | null>(null)

  if (opened.status === 'reading') return null
  if (opened.status === 'failed') {
    return <Missing title="This link cannot be opened" description={opened.message} />
  }
  const { named } = opened
  const save = () => {
    try {
      const saved = pipelineStore().save(named)
      setSavedId(saved.id)
      showToast({ body: `Saved “${saved.name}” in this browser.`, uniqueID: 'saved' })
    } catch (reason) {
      const body = reason instanceof Error ? reason.message : 'The pipeline could not be saved.'
      showToast({ body, type: 'error', uniqueID: 'saved' })
    }
  }
  return (
    <ToolPageFrame
      title={named.name}
      eyebrow="Shared tool"
      description={
        <HStack gap={3} vAlign="center" wrap="wrap">
          <Text type="large" color="secondary" weight="normal">
            A pipeline someone shared as a link. It runs here, in your browser.
          </Text>
          <HStack gap={1} vAlign="center">
            {savedId ? (
              <Button
                label="Open my saved copy"
                size="sm"
                variant="ghost"
                onClick={() =>
                  void navigate({ to: '/tools/$pipelineId', params: { pipelineId: savedId } })
                }
              />
            ) : (
              <Button label="Save to my tools" size="sm" variant="ghost" onClick={save} />
            )}
            <Button
              label="Open in the Studio"
              size="sm"
              variant="ghost"
              onClick={() => {
                openInStudio(named)
                void navigate({ to: '/studio', search: { pipeline: undefined } })
              }}
            />
          </HStack>
        </HStack>
      }
    >
      <PipelineToolBody pipeline={named.pipeline} />
    </ToolPageFrame>
  )
}
