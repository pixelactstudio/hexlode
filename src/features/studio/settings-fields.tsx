/** Fields that several node settings forms share. */
import { Collapsible } from '@astryxdesign/core/Collapsible'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { type ReactNode, useEffect, useState } from 'react'

import { HEX_COLOUR } from '#/features/images/colour'
import { Field, POSITIONS, PositionGrid } from '#/features/quick-tools/settings-panels'
import type { CropToolSettings } from '#/features/quick-tools/tools'

export type Settings = Record<string, unknown>

export interface EditorProps {
  settings: Settings
  onChange: (changes: Settings) => void
  isDisabled?: boolean
}

/** Options most people never change, closed until opened. */
export function MoreOptions({ children }: { children: ReactNode }) {
  return (
    <Collapsible
      defaultIsOpen={false}
      trigger={
        <Text type="label" color="secondary">
          More options
        </Text>
      }
    >
      <VStack gap={4} paddingBlock={2}>
        {children}
      </VStack>
    </Collapsible>
  )
}

/**
 * A colour as a swatch that opens the system picker, beside its hex code. The code also takes
 * `#rrggbbaa` for a colour with transparency.
 */
export function ColourField({
  label,
  value,
  onChange,
  isDisabled,
  disabledMessage,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  isDisabled?: boolean
  disabledMessage?: string
}) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const isValid = HEX_COLOUR.test(text)
  return (
    <Field label={label}>
      <HStack gap={2} vAlign="center">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={value.slice(0, 7)}
          onChange={(event) => onChange(`${event.target.value}${value.slice(7)}`)}
          disabled={isDisabled}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-border bg-surface p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <TextInput
          label={label}
          isLabelHidden
          value={text}
          onChange={(next) => {
            setText(next)
            if (HEX_COLOUR.test(next)) onChange(next.toLowerCase())
          }}
          status={isValid ? undefined : { type: 'error', message: 'Use a colour like #ff8800.' }}
          isDisabled={isDisabled}
          disabledMessage={disabledMessage}
          width={140}
        />
      </HStack>
    </Field>
  )
}

/** Where something sits in the image, as a grid of nine buttons with the place named below. */
export function PositionField({
  label,
  value,
  onChange,
  isDisabled,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  isDisabled?: boolean
  hint?: string
}) {
  const position = POSITIONS.find((option) => option.value === value)
  return (
    <Field label={label} hint={hint ?? position?.label}>
      <PositionGrid
        value={value as CropToolSettings['position']}
        onChange={onChange}
        isDisabled={isDisabled}
      />
    </Field>
  )
}
