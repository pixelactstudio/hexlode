import {
  DropdownMenu,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@astryxdesign/core/DropdownMenu'
import { Icon } from '@astryxdesign/core/Icon'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useSyncExternalStore } from 'react'

import { colourModeStore } from '#/features/theme/colour-mode'
import { DEFAULT_COLOUR_MODE } from '#/features/theme/constants'
import type { ColourMode } from '#/features/theme/types'
import { colourModeSchema } from '#/features/theme/validators'

const MODES: { value: ColourMode; label: string; icon: typeof Moon }[] = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
]

/** The colour mode the user picked. Dark during server rendering, like the first paint. */
export function useColourMode() {
  const store = colourModeStore()
  return useSyncExternalStore(store.subscribe, store.get, () => DEFAULT_COLOUR_MODE)
}

/** A top bar button that switches between dark, light and the system's mode. */
export function ColourModeMenu() {
  const mode = useColourMode()
  const current = MODES.find((entry) => entry.value === mode) ?? MODES[0]
  return (
    <DropdownMenu
      button={{
        label: `Theme: ${current.label}`,
        icon: <Icon icon={current.icon} size="sm" />,
        isIconOnly: true,
        variant: 'ghost',
        size: 'sm',
        tooltip: 'Theme',
      }}
      hasChevron={false}
      menuWidth={160}
      placement="below"
    >
      <DropdownMenuRadioGroup
        aria-label="Theme"
        value={mode}
        onChange={(value) => colourModeStore().set(colourModeSchema.parse(value))}
      >
        {MODES.map((entry) => (
          <DropdownMenuRadioItem
            key={entry.value}
            value={entry.value}
            label={entry.label}
            icon={<Icon icon={entry.icon} size="sm" />}
          />
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenu>
  )
}
