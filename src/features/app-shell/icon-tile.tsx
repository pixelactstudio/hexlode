import { Icon } from '@astryxdesign/core/Icon'
import type { ComponentType, SVGProps } from 'react'

export type Tone = 'blue' | 'green' | 'purple' | 'teal' | 'orange' | 'pink' | 'gray'

const TONES: Record<Tone, string> = {
  blue: 'bg-blue-subtle text-blue-vivid',
  green: 'bg-green-subtle text-green-vivid',
  purple: 'bg-purple-subtle text-purple-vivid',
  teal: 'bg-teal-subtle text-teal-vivid',
  orange: 'bg-orange-subtle text-orange-vivid',
  pink: 'bg-pink-subtle text-pink-vivid',
  gray: 'bg-gray-subtle text-gray-vivid',
}

const SIZES = { sm: 'size-7 rounded-md', md: 'size-9 rounded-lg', lg: 'size-12 rounded-xl' }

/** An icon on a tinted square, used to tell tools and node categories apart at a glance. */
export function IconTile({
  icon,
  tone = 'gray',
  size = 'md',
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  tone?: Tone
  size?: keyof typeof SIZES
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${SIZES[size]} ${TONES[tone]}`}
    >
      <Icon icon={icon} size={size === 'lg' ? 'md' : 'sm'} color="inherit" />
    </span>
  )
}
