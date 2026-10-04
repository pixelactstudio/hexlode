import { describe, expect, it } from 'vitest'

import { SEO_PAGES, SITE_URL } from '#/features/seo/constants'
import { pageHead, rootHead } from '#/features/seo/head'

type Meta = Record<string, unknown>

function content(meta: Meta[], key: string) {
  return meta.find((tag) => tag.name === key || tag.property === key)?.content
}

describe('pageHead', () => {
  it('names the page, then the site, with a plain bar between them', () => {
    const { meta } = pageHead('convert')
    expect(meta.find((tag) => 'title' in tag)?.title).toBe(
      'Convert images to WebP, AVIF, JPEG XL or PNG | Hexlode',
    )
  })

  it('uses the home title as it is', () => {
    const { meta } = pageHead('home')
    expect(meta.find((tag) => 'title' in tag)?.title).toBe(SEO_PAGES.home.title)
  })

  it('keeps every title free of long dashes', () => {
    for (const page of Object.keys(SEO_PAGES) as (keyof typeof SEO_PAGES)[]) {
      const title = pageHead(page).meta.find((tag) => 'title' in tag)?.title
      expect(title).not.toMatch(/[—–]/)
    }
  })

  it('points the canonical link and share URLs at the production address', () => {
    const { meta, links } = pageHead('strip-metadata')
    expect(links).toContainEqual({ rel: 'canonical', href: `${SITE_URL}/strip-metadata` })
    expect(content(meta, 'og:url')).toBe(`${SITE_URL}/strip-metadata`)
  })

  it('gives the home page a canonical link without a trailing path', () => {
    expect(pageHead('home').links).toContainEqual({ rel: 'canonical', href: SITE_URL })
  })

  it("shares the page's own card as an absolute PNG URL for Open Graph and X", () => {
    const { meta } = pageHead('crop')
    expect(content(meta, 'og:image')).toBe(`${SITE_URL}/og/crop.png`)
    expect(content(meta, 'twitter:image')).toBe(`${SITE_URL}/og/crop.png`)
    expect(content(meta, 'og:image:width')).toBe('1200')
    expect(content(meta, 'og:image:height')).toBe('630')
    expect(content(meta, 'og:image:alt')).toBeTruthy()
  })

  it('repeats the title and description for Open Graph and X', () => {
    const { meta } = pageHead('resize')
    const { description } = SEO_PAGES.resize
    expect(content(meta, 'description')).toBe(description)
    expect(content(meta, 'og:description')).toBe(description)
    expect(content(meta, 'twitter:description')).toBe(description)
    expect(content(meta, 'og:title')).toBe('Resize images in bulk by width, height or percent')
    expect(content(meta, 'twitter:title')).toBe(content(meta, 'og:title'))
  })

  it('keeps descriptions short enough for search results', () => {
    for (const { description } of Object.values(SEO_PAGES)) {
      expect(description.length).toBeGreaterThan(80)
      expect(description.length).toBeLessThanOrEqual(170)
    }
  })
})

describe('rootHead', () => {
  it('asks for large image cards and names the site', () => {
    const { meta } = rootHead({ environment: 'production' })
    expect(content(meta, 'twitter:card')).toBe('summary_large_image')
    expect(content(meta, 'og:site_name')).toBe('Hexlode')
    expect(content(meta, 'og:type')).toBe('website')
    expect(content(meta, 'theme-color')).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('keeps staging and development out of search results', () => {
    expect(content(rootHead({ environment: 'staging' }).meta, 'robots')).toBe('noindex, nofollow')
    expect(content(rootHead({ environment: 'development' }).meta, 'robots')).toBe(
      'noindex, nofollow',
    )
    expect(content(rootHead({ environment: 'production' }).meta, 'robots')).toBeUndefined()
  })

  it('links the manifest and every icon', () => {
    const rels = rootHead({ environment: 'production' }).links.map((link) => link.rel)
    expect(rels).toEqual(expect.arrayContaining(['manifest', 'icon', 'apple-touch-icon']))
  })

  it('describes the site and its publisher as structured data', () => {
    const { meta } = rootHead({ environment: 'production' })
    const data = meta.find((tag) => 'script:ld+json' in tag)?.['script:ld+json'] as {
      '@graph': { '@type': string }[]
    }
    expect(data['@graph'].map((node) => node['@type'])).toEqual(['WebSite', 'Organization'])
  })
})
