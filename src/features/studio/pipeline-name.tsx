import { Button } from '@astryxdesign/core/Button'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useState } from 'react'

import { MAX_PIPELINE_NAME_LENGTH } from '#/features/pipelines/constants'

/**
 * The pipeline's name as plain text, with no icon. Clicking it turns it into a field: Enter or leaving the field
 * keeps the new name, Escape keeps the old one.
 */
export function PipelineName({
  name,
  onRename,
}: {
  name: string
  onRename: (name: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    const next = draft?.trim()
    if (next && next !== name) onRename(next)
    setDraft(null)
  }

  if (draft !== null) {
    return (
      <TextInput
        label="Pipeline name"
        isLabelHidden
        size="sm"
        width={240}
        value={draft}
        hasAutoFocus
        onChange={(value) => setDraft(value.slice(0, MAX_PIPELINE_NAME_LENGTH))}
        onEnter={commit}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setDraft(null)
        }}
      />
    )
  }
  return (
    <Button
      label={`Rename ${name}`}
      variant="ghost"
      size="sm"
      tooltip="Click to rename"
      onClick={() => setDraft(name)}
    >
      <span className="block max-w-60 truncate font-semibold">{name}</span>
    </Button>
  )
}
