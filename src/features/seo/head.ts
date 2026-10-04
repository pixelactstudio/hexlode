/**
 * The tags each route puts in `<head>`: titles, descriptions, canonical links, share cards for
 * Open Graph (Facebook, LinkedIn, Discord, Slack, iMessage) and X, and structured data. The root
 * route sets what every page shares; each page route adds its own with `pageHead`. The router
 * keeps the deepest route's tag when two share a name or property.
 */
import {
  ICON_SIZES,
  KEYWORDS,
  PUBLISHER,
  SEO_PAGES,
  SHARE_CARD,
  SHARE_CARD_DIRECTORY,
  SITE_NAME,
  SITE_URL,
  THEME_COLOUR,
  TITLE_SEPARATOR,
} from '#/features/seo/constants'
import type { SeoPage } from '#/features/seo/types'

type HeadMeta = Record<string, unknown> & { title?: string; name?: string; property?: string }
type HeadLink = { rel: string; href: string; type?: string; sizes?: string }

/** A page's address on the production site. The home page has no trailing slash. */
export function absoluteUrl(path: string) {
  return path === '/' ? SITE_URL : `${SITE_URL}${path}`
}

export function shareCardUrl(page: SeoPage) {
  return `${SITE_URL}${SHARE_CARD_DIRECTORY}/${page}.png`
}

export function pageTitle(page: SeoPage) {
  const { title } = SEO_PAGES[page]
  return page === 'home' ? title : `${title}${TITLE_SEPARATOR}${SITE_NAME}`
}

export function pageHead(page: SeoPage): { meta: HeadMeta[]; links: HeadLink[] } {
  const { path, title, description, card } = SEO_PAGES[page]
  const url = absoluteUrl(path)
  const image = shareCardUrl(page)
  const imageAlt = `${card.title} ${card.accent}`
  return {
    meta: [
      { title: pageTitle(page) },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      { property: 'og:image', content: image },
      { property: 'og:image:type', content: 'image/png' },
      { property: 'og:image:width', content: String(SHARE_CARD.width) },
      { property: 'og:image:height', content: String(SHARE_CARD.height) },
      { property: 'og:image:alt', content: imageAlt },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: image },
      { name: 'twitter:image:alt', content: imageAlt },
    ],
    links: [{ rel: 'canonical', href: url }],
  }
}

/** Structured data for the home page: Hexlode as a free web application. */
export function applicationData() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url: SITE_URL,
    description: SEO_PAGES.home.description,
    applicationCategory: 'MultimediaApplication',
    applicationSubCategory: 'Image editor',
    operatingSystem: 'Any (runs in a web browser)',
    browserRequirements: 'Requires a browser with Web Workers and the Origin Private File System',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    image: shareCardUrl('home'),
    screenshot: `${SITE_URL}/home/studio-dark-1920.webp`,
    featureList: [
      'Convert images between JPEG, PNG, WebP, AVIF, JPEG XL and QOI',
      'Compress images to a target file size',
      'Resize images by width, height, percent or longest edge',
      'Crop images to aspect ratios such as 1:1, 4:5 and 16:9',
      'Rotate, flip and auto-orient photos',
      'Remove EXIF and GPS metadata',
      'Build node-based batch image pipelines',
    ],
    keywords: KEYWORDS.join(', '),
    publisher: { '@id': `${PUBLISHER.url}/#organization` },
  }
}

/** Structured data for a quick tool: where it sits under the home page. */
export function breadcrumbData(page: SeoPage) {
  const { path, title } = SEO_PAGES[page]
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: title, item: absoluteUrl(path) },
    ],
  }
}

/**
 * What every page shares. Outside production, pages ask not to be indexed, so a staging copy never
 * shows up in search results next to the real site.
 */
export function rootHead({ environment }: { environment?: string }): {
  meta: HeadMeta[]
  links: HeadLink[]
} {
  const home = pageHead('home')
  return {
    meta: [
      ...home.meta,
      { name: 'application-name', content: SITE_NAME },
      { name: 'apple-mobile-web-app-title', content: SITE_NAME },
      { name: 'theme-color', content: THEME_COLOUR },
      { name: 'color-scheme', content: 'dark light' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:type', content: 'website' },
      { property: 'og:locale', content: 'en_US' },
      { name: 'twitter:card', content: 'summary_large_image' },
      ...(environment === 'production' ? [] : [{ name: 'robots', content: 'noindex, nofollow' }]),
      {
        'script:ld+json': {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebSite',
              '@id': `${SITE_URL}/#website`,
              name: SITE_NAME,
              url: SITE_URL,
              inLanguage: 'en',
              publisher: { '@id': `${PUBLISHER.url}/#organization` },
            },
            {
              '@type': 'Organization',
              '@id': `${PUBLISHER.url}/#organization`,
              name: PUBLISHER.name,
              url: PUBLISHER.url,
            },
          ],
        },
      },
    ],
    links: [
      { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
      { rel: 'icon', href: '/hexlode-mark.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: `/icons/icon-${ICON_SIZES.apple}.png` },
      { rel: 'manifest', href: '/manifest.webmanifest' },
    ],
  }
}
