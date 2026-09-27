import { Icon } from '@astryxdesign/core/Icon'
import { Heading, Text } from '@astryxdesign/core/Text'
import type { ComponentType, ReactNode, SVGProps } from 'react'

import { Crosshair, Reveal } from '#/features/home/motion-kit'

/** The home page's 1200px column, drawn with hairline rails down both sides. */
export function Rails({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1248px] md:border-border md:border-x">{children}</div>
  )
}

/** One band of the home page, separated from the one above by a line with marks at the rails. */
export function Section({
  id,
  children,
  className = '',
}: {
  id?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} className={`relative scroll-mt-24 border-border border-t ${className}`}>
      <Crosshair side="start" />
      <Crosshair side="end" />
      {children}
    </section>
  )
}

/** A rounded label with an icon, above a section's heading. */
export function Pill({
  icon,
  children,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  children: ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 font-medium text-primary text-sm">
      <span className="inline-flex text-red-vivid">
        <Icon icon={icon} size="sm" color="inherit" />
      </span>
      {children}
    </span>
  )
}

/** A centred pill, heading and line that open a section. */
export function SectionHeader({
  icon,
  pill,
  title,
  text,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  pill: string
  title: ReactNode
  text: string
}) {
  return (
    <Reveal className="flex flex-col items-center gap-5 px-6 py-16 text-center md:py-24">
      <Pill icon={icon}>{pill}</Pill>
      <Heading level={2} type="display-2">
        <span className="block max-w-3xl text-balance text-[clamp(2rem,3.4vw,3.25rem)] leading-[1.08] tracking-[-0.035em]">
          {title}
        </span>
      </Heading>
      <span className="block max-w-2xl text-pretty">
        <Text type="large" color="secondary" weight="normal">
          {text}
        </Text>
      </span>
    </Reveal>
  )
}

/**
 * A cell of a bordered grid: a moving picture on top, then a title and a line. Grids draw the
 * lines between cells with a one-pixel gap over the border colour.
 */
export function Cell({
  title,
  text,
  children,
  className = '',
}: {
  title: string
  text: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col overflow-hidden bg-surface ${className}`}>
      <div className="relative flex min-h-64 items-center justify-center overflow-hidden py-8 md:h-72 md:py-0">
        {children}
      </div>
      <div className="flex flex-col gap-2 px-6 pt-2 pb-8 md:px-8">
        <Heading level={3}>{title}</Heading>
        <Text type="body" color="secondary">
          {text}
        </Text>
      </div>
    </div>
  )
}
