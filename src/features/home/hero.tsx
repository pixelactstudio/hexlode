import { Button } from '@astryxdesign/core/Button'
import { Icon } from '@astryxdesign/core/Icon'
import { Heading, Text } from '@astryxdesign/core/Text'
import { ArrowRight, ChevronRight, Workflow } from 'lucide-react'

import { BorderBeam } from '#/features/home/motion-kit'
import { RouterLink } from '#/lib/router-link'

/**
 * The Studio screenshots in public/home, taken at twice the pixel density from a real run in each
 * colour mode, in three widths so every screen gets a sharp copy.
 */
const SHOTS = [
  { mode: 'dark', className: 'only-dark' },
  { mode: 'light', className: 'only-light' },
] as const

const WIDTHS = [1200, 1920, 3840]

/**
 * The Studio as it looks after a run, in a window frame that grows past the text column on large
 * screens so its text stays legible, with a streak running round its edge. It rises and settles flat once as the page opens. The entrance is a CSS
 * animation, so it plays the same way on every load and never waits for scripts.
 */
function ProductShot() {
  return (
    <div className="relative pb-16 [perspective:1800px] md:pb-24">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[12%] top-[8%] bottom-[10%] rounded-full bg-red-ring/15 blur-[110px]"
      />
      <div className="relative left-1/2 w-[calc(100vw-24px)] max-w-[1440px] -translate-x-1/2 origin-top animate-shot-in rounded-lg border border-border bg-card p-1.5 shadow-lg motion-reduce:animate-none md:w-[calc(100vw-64px)]">
        <div className="flex items-center gap-2 px-2.5 pt-1 pb-2.5">
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="mx-auto rounded-sm bg-muted px-3 py-0.5 text-secondary text-xs">
            Hexlode · Studio
          </span>
          <span className="w-12" />
        </div>
        <div className="overflow-hidden rounded-sm border border-border">
          {SHOTS.map((shot) => (
            <img
              key={shot.mode}
              className={`block h-auto w-full ${shot.className}`}
              src={`/home/studio-${shot.mode}-1920.webp`}
              srcSet={WIDTHS.map(
                (width) => `/home/studio-${shot.mode}-${width}.webp ${width}w`,
              ).join(', ')}
              sizes="(min-width: 1504px) 1426px, (min-width: 768px) calc(100vw - 78px), calc(100vw - 38px)"
              width={3840}
              height={2160}
              loading="lazy"
              decoding="async"
              alt="The Studio running a pipeline of thirteen steps on eight photos: rotate, remove location, then three branches that resize and save WebP, crop square AVIF thumbnails, and compress JPEGs for email."
            />
          ))}
        </div>
        <BorderBeam />
      </div>
    </div>
  )
}

/** The first screen: what Hexlode is, the two ways in, and the Studio at work. */
export function Hero() {
  return (
    <section className="relative">
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
        <span className="absolute -top-56 left-1/2 h-[560px] w-[min(1000px,100%)] -translate-x-1/2 rounded-full bg-linear-to-r from-orange-ring/25 via-red-ring/30 to-pink-ring/25 blur-[120px]" />
      </span>
      <div className="relative flex flex-col items-center gap-7 px-6 pt-20 pb-14 text-center md:pt-28 md:pb-20">
        <RouterLink
          href="/studio"
          className="group inline-flex animate-rise items-center gap-2 rounded-full border border-border bg-surface py-1 ps-1 pe-3 text-sm no-underline shadow-sm outline-accent transition-colors hover:bg-muted focus-visible:outline-2 motion-reduce:animate-none"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-vivid/15 px-2 py-0.5 font-semibold text-red-vivid text-xs">
            <Icon icon={Workflow} size="xsm" color="inherit" />
            Studio
          </span>
          <span className="text-primary">Pipelines you can run again and again</span>
          <span className="inline-flex text-secondary transition-transform group-hover:translate-x-0.5">
            <Icon icon={ChevronRight} size="xsm" color="inherit" />
          </span>
        </RouterLink>
        <span className="block animate-rise [animation-delay:90ms] motion-reduce:animate-none">
          <Heading level={1} type="display-1">
            <span className="block text-[clamp(2.6rem,6.4vw,5rem)] leading-[1.02] tracking-[-0.045em]">
              Batch image editing,
            </span>
            <span className="block bg-linear-to-r from-red-vivid to-pink-vivid bg-clip-text pb-1 text-[clamp(2.6rem,6.4vw,5rem)] text-transparent leading-[1.02] tracking-[-0.045em]">
              right in your browser.
            </span>
          </Heading>
        </span>
        <span className="block max-w-2xl animate-rise text-pretty [animation-delay:180ms] motion-reduce:animate-none">
          <Text type="large" color="secondary" weight="normal">
            Resize, convert, compress, crop and clean up hundreds of images at once. Chain the steps
            in the Studio, or open a quick tool for a single job. It can all run on your device,
            without uploading a file.
          </Text>
        </span>
        <span className="flex animate-rise flex-wrap items-center justify-center gap-3 [animation-delay:270ms] motion-reduce:animate-none">
          <Button
            label="Open the Studio"
            href="/studio"
            variant="primary"
            size="lg"
            endContent={<Icon icon={ArrowRight} size="sm" />}
          />
          <Button label="Browse quick tools" href="#tools" variant="secondary" size="lg" />
        </span>
      </div>
      <ProductShot />
    </section>
  )
}
