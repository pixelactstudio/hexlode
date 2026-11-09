/**
 * The crawler and install files the server answers at `/robots.txt`, `/sitemap.xml` and
 * `/manifest.webmanifest`. Each is built from the page list in `constants.ts`, so a new page shows
 * up in all of them.
 */
import { OPEN_PATH, SHARE_FILES_FIELD, SHARE_TARGET_PATH } from '#/features/handover/constants'
import { openableFiles, openableImages } from '#/features/handover/file-types'
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

/**
 * The web app manifest. Installed, Hexlode opens images and `.hexlode` files from the file manager
 * on desktop Chromium and receives photos shared on Android.
 */
export function webManifest() {
  const images = openableImages()
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
    // Opened files get a new window, so a launch never replaces work open in another.
    launch_handler: { client_mode: 'navigate-new' },
    file_handlers: [{ action: OPEN_PATH, accept: openableFiles(), launch_type: 'single-client' }],
    share_target: {
      action: SHARE_TARGET_PATH,
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        files: [
          {
            name: SHARE_FILES_FIELD,
            accept: [...Object.keys(images), ...Object.values(images).flat()],
          },
        ],
      },
    },
  }
}
