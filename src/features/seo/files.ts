/**
 * The crawler and install files the server answers at `/robots.txt`, `/sitemap.xml` and
 * `/manifest.webmanifest`. Each is built from the page list in `constants.ts`, so a new page shows
 * up in all of them.
 */
import { ICON_SIZES, SEO_PAGES, SITE_NAME, SITE_URL, THEME_COLOUR } from '#/features/seo/constants'
import { absoluteUrl } from '#/features/seo/head'

/**
 * Production lets crawlers in, except on server routes and saved pipeline tools, which live in one
 * visitor's browser. Every other deployment shuts them out.
 */
export function robotsTxt({ indexable }: { indexable: boolean }) {
  if (!indexable) return 'User-agent: *\nDisallow: /\n'
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /tools/',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n')
}

export function sitemapXml() {
  const urls = Object.values(SEO_PAGES).map(
    ({ path, changeFrequency, priority }) =>
      `  <url>\n    <loc>${absoluteUrl(path)}</loc>\n    <changefreq>${changeFrequency}</changefreq>\n    <priority>${priority.toFixed(1)}</priority>\n  </url>`,
  )
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}

export function webManifest() {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SEO_PAGES.home.description,
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: THEME_COLOUR,
    theme_color: THEME_COLOUR,
    categories: ['photo', 'productivity', 'utilities'],
    icons: [
      {
        src: `/icons/icon-${ICON_SIZES.small}.png`,
        sizes: `${ICON_SIZES.small}x${ICON_SIZES.small}`,
        type: 'image/png',
      },
      {
        src: `/icons/icon-${ICON_SIZES.large}.png`,
        sizes: `${ICON_SIZES.large}x${ICON_SIZES.large}`,
        type: 'image/png',
      },
      {
        src: `/icons/maskable-${ICON_SIZES.large}.png`,
        sizes: `${ICON_SIZES.large}x${ICON_SIZES.large}`,
        type: 'image/png',
        purpose: 'maskable',
      },
      { src: '/hexlode-mark.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }
}
