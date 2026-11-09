import { describe, expect, it } from 'vitest'

import { SEO_PAGES, SITE_URL } from '#/features/seo/constants'
import { robotsTxt, sitemapXml, webManifest } from '#/features/seo/files'

describe('robotsTxt', () => {
  it('lets crawlers in on production and points them at the sitemap', () => {
    const text = robotsTxt({ indexable: true })
    expect(text).toContain('User-agent: *')
    expect(text).toContain('Allow: /')
    expect(text).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`)
  })

  it('keeps crawlers away from server routes and saved pipeline tools', () => {
    const text = robotsTxt({ indexable: true })
    expect(text).toContain('Disallow: /api/')
    expect(text).toContain('Disallow: /tools/')
  })

  it('shuts crawlers out everywhere else', () => {
    const text = robotsTxt({ indexable: false })
    expect(text).toContain('Disallow: /')
    expect(text).not.toContain('Allow: /\n')
    expect(text).not.toContain('Sitemap:')
  })
})

describe('sitemapXml', () => {
  const xml = sitemapXml()

  it('lists every page at its production address', () => {
    const locations = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1])
    expect(locations).toEqual(
      Object.values(SEO_PAGES).map((page) => (page.path === '/' ? SITE_URL : SITE_URL + page.path)),
    )
  })

  it('is a sitemap document', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
    expect(xml).toContain('<changefreq>weekly</changefreq>')
    expect(xml).toContain('<priority>1.0</priority>')
  })
})

describe('webManifest', () => {
  it('names the app and offers installable icons', () => {
    const manifest = webManifest()
    expect(manifest.name).toBe('Hexlode')
    expect(manifest.start_url).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(
      expect.arrayContaining(['192x192', '512x512']),
    )
  })
})

describe('webManifest for the installed app', () => {
  const manifest = webManifest()
  const images = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
    'image/avif': ['.avif'],
    'image/jxl': ['.jxl'],
    'image/qoi': ['.qoi'],
  }

  it('meets the install criteria', () => {
    expect(manifest).toMatchObject({ id: '/', scope: '/', start_url: '/', display: 'standalone' })
    expect(manifest.short_name.length).toBeLessThanOrEqual(12)
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: '192x192', type: 'image/png' }),
        expect.objectContaining({ sizes: '512x512', type: 'image/png' }),
      ]),
    )
    expect(manifest).not.toHaveProperty('prefer_related_applications', true)
  })

  it('opens the images Hexlode reads and .hexlode files from the file manager', () => {
    expect(manifest.file_handlers).toEqual([
      {
        action: '/open',
        accept: { ...images, 'application/vnd.hexlode.pipeline+json': ['.hexlode'] },
        launch_type: 'single-client',
      },
    ])
  })

  it('opens files in a new window, so no open work is replaced', () => {
    expect(manifest.launch_handler).toEqual({ client_mode: 'navigate-new' })
  })

  it('receives photos shared on Android', () => {
    expect(manifest.share_target).toEqual({
      action: '/share-target',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        files: [
          { name: 'photos', accept: [...Object.keys(images), ...Object.values(images).flat()] },
        ],
      },
    })
  })
})
