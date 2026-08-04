import { Button } from '@astryxdesign/core/Button'
import { ButtonGroup } from '@astryxdesign/core/ButtonGroup'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/Stack'
import { Token } from '@astryxdesign/core/Token'
import { Toolbar } from '@astryxdesign/core/Toolbar'

import { WORKFLOW_DEFINITIONS } from '#/features/canvas/workflow/constants'
import type { WorkflowKind } from '#/features/canvas/workflow/types'

interface WorkflowToolbarProps {
  canRedo: boolean
  canUndo: boolean
  error: string | null
  isComplete: boolean
  isNarrow: boolean
  isProcessing: boolean
  missingKind: WorkflowKind | undefined
  onAddMissingNode: () => void
  onCancel: () => void
  onDelete: () => void
  onProcess: () => void
  onRedo: () => void
  onUndo: () => void
}

export function WorkflowToolbar({
  canRedo,
  canUndo,
  error,
  isComplete,
  isNarrow,
  isProcessing,
  missingKind,
  onAddMissingNode,
  onCancel,
  onDelete,
  onProcess,
  onRedo,
  onUndo,
}: WorkflowToolbarProps) {
  const restoreLabel = missingKind
    ? `Restore ${WORKFLOW_DEFINITIONS[missingKind].label}`
    : 'All nodes present'
  const runLabel = isProcessing ? 'Cancel' : error ? 'Retry' : 'Run pipeline'

  return (
    <Toolbar
      label="Workflow actions"
      size="sm"
      variant="muted"
      startContent={
        <HStack gap={2} vAlign="center">
          <Heading level={2}>Image pipeline</Heading>
          <Token label="Local" size="sm" color="green" />
        </HStack>
      }
      endContent={
        <HStack gap={2} vAlign="center">
          {!isNarrow ? (
            <>
              <ButtonGroup label="Edit history" size="sm">
                <Button label="Undo" variant="secondary" isDisabled={!canUndo} onClick={onUndo} />
                <Button label="Redo" variant="secondary" isDisabled={!canRedo} onClick={onRedo} />
              </ButtonGroup>
              <Button
                label={restoreLabel}
                variant="secondary"
                isDisabled={!missingKind}
                onClick={onAddMissingNode}
              />
              <Button label="Delete" variant="secondary" onClick={onDelete} />
            </>
          ) : null}
          {!isComplete ? (
            <Button
              label={runLabel}
              variant="primary"
              onClick={isProcessing ? onCancel : onProcess}
            />
          ) : null}
        </HStack>
      }
    />
  )
}
