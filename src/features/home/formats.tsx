import { Text } from '@astryxdesign/core/Text'

import { Section } from '#/features/home/section'

const FORMATS = [
  { name: 'JPEG', note: 'Photos that open anywhere' },
  { name: 'PNG', note: 'Lossless, with transparency' },
  { name: 'WebP', note: 'Small, in every browser' },
  { name: 'AVIF', note: 'The smallest files' },
  { name: 'JPEG XL', note: 'Small and sharp' },
  { name: 'QOI', note: 'Fast and lossless' },
]

/** Every format Hexlode opens and saves, in a grid of cells. */
export function Formats() {
  return (
    <Section>
      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="flex items-center px-6 py-10 md:border-border md:border-r md:px-10">
          <span className="block max-w-xs text-balance">
            <Text type="large" color="secondary" weight="normal">
              Opens and saves the formats <span className="text-primary">you actually use</span>,
              with each codec's own settings.
            </Text>
          </span>
        </div>
        <ul className="grid grid-cols-2 gap-px border-border border-t bg-border sm:grid-cols-3 md:border-t-0">
          {FORMATS.map((format) => (
            <li
              key={format.name}
              className="group flex flex-col items-center justify-center gap-1 bg-surface px-4 py-9 transition-colors hover:bg-muted"
            >
              <span className="font-semibold text-[1.75rem] text-secondary tracking-[-0.03em] transition-colors group-hover:text-primary">
                {format.name}
              </span>
              <Text type="supporting">{format.note}</Text>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}
