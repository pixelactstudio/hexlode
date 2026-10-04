/**
 * The share card template: the picture Open Graph, X and Discord show when someone posts a link.
 * `pnpm seo:build` renders it to HTML for every page in `SEO_PAGES`, takes a screenshot in
 * Chromium and saves it to `public/og/<page>.png`. Edit the page's `card` in `constants.ts` to
 * change one card, or this file to change them all.
 *
 * Inline styles only: the screenshot is taken from a bare HTML page without the app's CSS.
 */
import { ShieldCheck, Workflow } from 'lucide-react'
import type { ComponentType, CSSProperties, SVGProps } from 'react'

import { QUICK_TOOL_ICONS } from '#/features/quick-tools/tool-ui'
import { SEO_PAGES, SHARE_CARD, SITE_URL } from '#/features/seo/constants'
import type { SeoPage } from '#/features/seo/types'

/** The dark theme's values, so the card looks like the app. */
const INK = {
  page: '#0a0a0a',
  card: '#111111',
  muted: '#171717',
  border: 'rgba(255, 255, 255, 0.09)',
  primary: '#fafafa',
  secondary: '#a3a3a3',
  red: '#ff6f6c',
  pink: '#f273aa',
  orange: '#ff9a5c',
}

const FONT = 'Figtree, sans-serif'

const PAGE_ICONS: Record<SeoPage, ComponentType<SVGProps<SVGSVGElement>>> = {
  ...QUICK_TOOL_ICONS,
  home: Workflow,
  studio: Workflow,
  privacy: ShieldCheck,
}

export interface ShareCardAssets {
  /** The logomark, as a data URL. */
  mark: string
  /** The dark Studio screenshot, as a data URL. */
  studio: string
}

export function ShareCard({ page, assets }: { page: SeoPage; assets: ShareCardAssets }) {
  const { card } = SEO_PAGES[page]
  const withShot = card.art === 'studio'
  return (
    <div
      style={{
        position: 'relative',
        width: SHARE_CARD.width,
        height: SHARE_CARD.height,
        overflow: 'hidden',
        background: INK.page,
        color: INK.primary,
        fontFamily: FONT,
      }}
    >
      <Backdrop />
      {withShot ? <StudioShot src={assets.studio} /> : <IconArt page={page} />}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: '56px 64px',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={assets.mark} alt="" width={44} height={44} />
          <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>Hexlode</span>
          <span style={{ marginLeft: 'auto', color: INK.secondary, fontSize: 20 }}>
            {SITE_URL.replace('https://', '')}
          </span>
        </header>
        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            maxWidth: withShot ? 560 : 680,
          }}
        >
          <span
            style={{
              color: INK.red,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}
          >
            {card.eyebrow}
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: withShot ? 62 : 66,
              fontWeight: 700,
              lineHeight: 1.04,
              letterSpacing: '-0.045em',
            }}
          >
            <span style={{ display: 'block' }}>{card.title}</span>
            <span
              style={{
                display: 'block',
                paddingBottom: 6,
                background: `linear-gradient(90deg, ${INK.red}, ${INK.pink})`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              {card.accent}
            </span>
          </h1>
          <p
            style={{
              margin: 0,
              color: INK.secondary,
              fontSize: 25,
              lineHeight: 1.4,
              textWrap: 'pretty',
            }}
          >
            {card.body}
          </p>
        </div>
        <footer
          style={{
            marginTop: 36,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            maxWidth: withShot ? 580 : 760,
          }}
        >
          {card.chips.map((chip) => (
            <span key={chip} style={chipStyle}>
              {chip}
            </span>
          ))}
        </footer>
      </div>
    </div>
  )
}

const chipStyle: CSSProperties = {
  border: `1px solid ${INK.border}`,
  background: INK.card,
  borderRadius: 999,
  padding: '7px 16px',
  fontSize: 18,
  fontWeight: 500,
  color: INK.primary,
}

/** The home page hero's grid and glow, faded towards the bottom. */
function Backdrop() {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(to right, ${INK.border} 1px, transparent 1px), linear-gradient(to bottom, ${INK.border} 1px, transparent 1px)`,
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 30% 0%, black, transparent)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: -320,
          left: 80,
          width: 1000,
          height: 560,
          borderRadius: '50%',
          background: `linear-gradient(90deg, ${INK.orange}, ${INK.red}, ${INK.pink})`,
          opacity: 0.22,
          filter: 'blur(110px)',
        }}
      />
    </>
  )
}

/** The real Studio, in a window frame that runs off the right edge. */
function StudioShot({ src }: { src: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 128,
        left: 660,
        width: 820,
        padding: 8,
        borderRadius: 18,
        border: `1px solid ${INK.border}`,
        background: INK.card,
        boxShadow: '0 40px 80px rgba(0, 0, 0, 0.6)',
      }}
    >
      <div style={{ display: 'flex', gap: 7, padding: '4px 8px 10px' }}>
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            style={{ width: 11, height: 11, borderRadius: '50%', background: '#3d3d3d' }}
          />
        ))}
      </div>
      <img
        src={src}
        alt=""
        style={{
          display: 'block',
          width: '100%',
          borderRadius: 10,
          border: `1px solid ${INK.border}`,
        }}
      />
    </div>
  )
}

/** The page's icon on a large tinted tile, inside rings that fade out. */
function IconArt({ page }: { page: SeoPage }) {
  const PageIcon = PAGE_ICONS[page]
  const centre = { x: 960, y: 290 }
  return (
    <>
      {[420, 330, 240].map((size, index) => (
        <div
          key={size}
          style={{
            position: 'absolute',
            left: centre.x - size / 2,
            top: centre.y - size / 2,
            width: size,
            height: size,
            borderRadius: size * 0.28,
            border: `1px solid rgba(255, 255, 255, ${0.05 + index * 0.03})`,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: centre.x - 80,
          top: centre.y - 80,
          width: 160,
          height: 160,
          borderRadius: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(140deg, ${INK.red}, ${INK.pink})`,
          boxShadow: `0 30px 90px rgba(255, 22, 22, 0.35)`,
          color: INK.page,
        }}
      >
        <PageIcon width={76} height={76} strokeWidth={1.75} />
      </div>
    </>
  )
}
