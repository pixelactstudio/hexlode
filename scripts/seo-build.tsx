/**
 * Renders the share cards and app icons into `public/`. Run `pnpm seo:build` after changing a
 * page's card in `src/features/seo/constants.ts`, the template in `share-card.tsx` or the logomark,
 * and commit the images. Docker builds skip the Chromium download, so the images are not rendered
 * there.
 *
 * Writes public/og/<page>.png, public/icons/icon-<size>.png, public/icons/maskable-512.png and
 * public/favicon.ico.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium, type Page } from 'playwright'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  ICON_SIZES,
  SEO_PAGES,
  SHARE_CARD,
  SHARE_CARD_DIRECTORY,
  THEME_COLOUR,
} from '#/features/seo/constants'
import { ShareCard, type ShareCardAssets } from '#/features/seo/share-card'
import type { SeoPage } from '#/features/seo/types'

const dataUrl = (path: string, type: string) =>
  `data:${type};base64,${readFileSync(path).toString('base64')}`

const assets: ShareCardAssets = {
  mark: dataUrl('public/hexlode-mark.svg', 'image/svg+xml'),
  studio: dataUrl('public/home/studio-dark-1200.webp', 'image/webp'),
}

const font = dataUrl(
  'node_modules/@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2',
  'font/woff2',
)

function documentFor(body: string, background = 'transparent') {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Figtree; src: url(${font}) format('woff2'); font-weight: 300 900; }
html, body { margin: 0; background: ${background}; }
* { box-sizing: border-box; }
</style></head><body>${body}</body></html>`
}

async function render(page: Page, html: string, size: { width: number; height: number }) {
  await page.setViewportSize(size)
  await page.setContent(html, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  return page.screenshot({ type: 'png', omitBackground: true })
}

/** The logomark on a square, `inset` of the side left as margin. */
function iconHtml(size: number, { inset = 0, background = 'transparent' } = {}) {
  const margin = Math.round(size * inset)
  return documentFor(
    `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:${background}">
<img src="${assets.mark}" style="width:${size - margin * 2}px;height:${size - margin * 2}px"></div>`,
  )
}

/** An ICO file holding PNG images, which every browser reads. */
function ico(images: { size: number; png: Buffer }[]) {
  const header = Buffer.alloc(6 + images.length * 16)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16
    header.writeUInt8(size >= 256 ? 0 : size, entry)
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1)
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...images.map(({ png }) => png)])
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
})
const page = await browser.newPage({ deviceScaleFactor: 1 })

mkdirSync(`public${SHARE_CARD_DIRECTORY}`, { recursive: true })
for (const name of Object.keys(SEO_PAGES) as SeoPage[]) {
  const html = documentFor(renderToStaticMarkup(<ShareCard page={name} assets={assets} />))
  writeFileSync(`public${SHARE_CARD_DIRECTORY}/${name}.png`, await render(page, html, SHARE_CARD))
  console.log(`public${SHARE_CARD_DIRECTORY}/${name}.png`)
}

mkdirSync('public/icons', { recursive: true })
const square = (size: number) => ({ width: size, height: size })
// iOS fills transparent corners with black, so the touch icon sits on the page tone.
const icons = [
  {
    name: `icon-${ICON_SIZES.apple}`,
    size: ICON_SIZES.apple,
    inset: 0.1,
    background: THEME_COLOUR,
  },
  { name: `icon-${ICON_SIZES.small}`, size: ICON_SIZES.small },
  { name: `icon-${ICON_SIZES.large}`, size: ICON_SIZES.large },
  // Android crops maskable icons to a circle that keeps the middle 80%.
  {
    name: `maskable-${ICON_SIZES.large}`,
    size: ICON_SIZES.large,
    inset: 0.2,
    background: THEME_COLOUR,
  },
]
for (const { name, size, ...options } of icons) {
  writeFileSync(
    `public/icons/${name}.png`,
    await render(page, iconHtml(size, options), square(size)),
  )
  console.log(`public/icons/${name}.png`)
}

const favicons = []
for (const size of [16, 32, 48]) {
  favicons.push({ size, png: await render(page, iconHtml(size), square(size)) })
}
writeFileSync('public/favicon.ico', ico(favicons))
console.log('public/favicon.ico')

await browser.close()
