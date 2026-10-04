import type { SeoPage, SeoPageDefinition } from '#/features/seo/types'

export const SITE_NAME = 'Hexlode'

/**
 * The production address. Canonical links, share cards and the sitemap always point here, so
 * staging and local copies never compete with it in search results.
 */
export const SITE_URL = 'https://hexlode.damnlabs.com'

/** Between a page's title and the site name, as in `Convert images | Hexlode`. */
export const TITLE_SEPARATOR = ' | '

/** The browser and link preview colour: the dark page tone. */
export const THEME_COLOUR = '#0a0a0a'

/** The brand red from the logomark, for share cards and icons. */
export const BRAND_RED = '#ff1616'

/** Open Graph's recommended share card size, which X, Discord, Slack and LinkedIn all crop well. */
export const SHARE_CARD = { width: 1200, height: 630 } as const

/** Where the generated share cards are served from: `/og/<page>.png`. */
export const SHARE_CARD_DIRECTORY = '/og'

/** The icon sizes `pnpm seo:build` renders from the logomark, served from `/icons/`. */
export const ICON_SIZES = { apple: 180, small: 192, large: 512 } as const

/** The organisation that publishes Hexlode, for structured data. */
export const PUBLISHER = { name: 'Damn Labs', url: 'https://damnlabs.com' } as const

/**
 * The searches Hexlode aims to rank for. Page titles, descriptions and headings use these words;
 * search engines ignore a keywords meta tag, so this list only feeds structured data.
 */
export const KEYWORDS = [
  'batch image converter',
  'bulk image compressor',
  'batch resize images',
  'convert images to WebP',
  'AVIF converter',
  'JPEG XL converter',
  'compress images to 200 KB',
  'remove EXIF data',
  'remove GPS location from photos',
  'crop images to 1:1',
  'image pipeline',
  'node-based image editor',
  'image converter without upload',
  'browser image processing',
] as const

const TOOL_FREQUENCY = { changeFrequency: 'monthly', priority: 0.9 } as const

/** Every page search engines may list, in sitemap order. */
export const SEO_PAGES: Record<SeoPage, SeoPageDefinition> = {
  home: {
    path: '/',
    title: 'Hexlode | Batch image converter, compressor and resizer',
    description:
      'Batch convert, compress, resize and crop images, and strip EXIF data, right in your browser. Free and open source, and it can run on your device without uploading.',
    card: {
      eyebrow: 'Free and open source',
      title: 'Batch image editing,',
      accent: 'right in your browser.',
      body: 'Convert, compress, resize, crop and clean up hundreds of images at once.',
      chips: ['WebP', 'AVIF', 'JPEG XL', 'PNG', 'JPEG', 'QOI'],
      art: 'studio',
    },
    changeFrequency: 'weekly',
    priority: 1,
  },
  studio: {
    path: '/studio',
    title: 'Studio: node-based batch image pipelines',
    description:
      'Build reusable image pipelines from nodes: resize, crop, convert, compress and rename hundreds of images in one run. Free, open source and in your browser.',
    card: {
      eyebrow: 'Studio',
      title: 'Image pipelines',
      accent: 'you can run again.',
      body: 'Connect nodes, preview every step on a sample, then run the whole batch.',
      chips: ['Templates', 'Live previews', 'Batch runs', 'Reusable'],
      art: 'studio',
    },
    changeFrequency: 'weekly',
    priority: 0.9,
  },
  convert: {
    path: '/convert',
    title: 'Convert images to WebP, AVIF, JPEG XL or PNG',
    description:
      "Convert JPEG, PNG, WebP, AVIF, JPEG XL and QOI images in bulk, with each encoder's real quality settings. Free, in your browser, with no upload needed.",
    card: {
      eyebrow: 'Quick tool',
      title: 'Convert images',
      accent: 'to any modern format.',
      body: "Batch convert with each encoder's real quality and lossless settings.",
      chips: ['JPEG', 'PNG', 'WebP', 'AVIF', 'JPEG XL', 'QOI'],
      art: 'icon',
    },
    ...TOOL_FREQUENCY,
  },
  compress: {
    path: '/compress',
    title: 'Compress images in bulk, to a target size',
    description:
      'Make JPEG, PNG, WebP and AVIF images smaller in bulk, by quality or to a target size such as 200 KB. Free, in your browser, with no upload needed.',
    card: {
      eyebrow: 'Quick tool',
      title: 'Compress images',
      accent: 'to the size you need.',
      body: 'Set a quality, or a target such as 200 KB, and compress a whole batch.',
      chips: ['Target size', 'Quality', 'JPEG', 'WebP', 'AVIF', 'PNG'],
      art: 'icon',
    },
    ...TOOL_FREQUENCY,
  },
  resize: {
    path: '/resize',
    title: 'Resize images in bulk by width, height or percent',
    description:
      'Resize many images at once by width, height, percent or longest edge, with fit, fill or exact modes and Lanczos resampling. Free, with no upload needed.',
    card: {
      eyebrow: 'Quick tool',
      title: 'Resize images',
      accent: 'hundreds at a time.',
      body: 'By width, height, percent or longest edge, with sharp Lanczos resampling.',
      chips: ['Longest edge', 'Width', 'Height', 'Percent', 'Fit', 'Fill'],
      art: 'icon',
    },
    ...TOOL_FREQUENCY,
  },
  crop: {
    path: '/crop',
    title: 'Crop images to 1:1, 4:5 or 16:9 in bulk',
    description:
      'Crop many images at once to 1:1, 4:5, 16:9 or a custom aspect ratio, from the centre or an edge. Free, in your browser, with no upload needed.',
    card: {
      eyebrow: 'Quick tool',
      title: 'Crop images',
      accent: 'to any aspect ratio.',
      body: 'Square thumbnails, portrait posts or widescreen banners, in one run.',
      chips: ['1:1', '4:5', '3:2', '16:9', '9:16', 'Custom'],
      art: 'icon',
    },
    ...TOOL_FREQUENCY,
  },
  rotate: {
    path: '/rotate',
    title: 'Rotate, flip and auto-orient photos in bulk',
    description:
      'Turn photos upright from their EXIF orientation, rotate them by quarter turns or flip them, many at once. Free, in your browser, with no upload needed.',
    card: {
      eyebrow: 'Quick tool',
      title: 'Rotate and flip',
      accent: 'a whole batch of photos.',
      body: 'Turn photos upright from their camera orientation, or rotate and flip them.',
      chips: ['Auto-orient', '90°', '180°', '270°', 'Flip'],
      art: 'icon',
    },
    ...TOOL_FREQUENCY,
  },
  'strip-metadata': {
    path: '/strip-metadata',
    title: 'Remove EXIF and GPS data from photos',
    description:
      'Remove EXIF, GPS location and camera data from photos in bulk, without re-encoding them. Keep copyright if you want. Free, with no upload needed.',
    card: {
      eyebrow: 'Quick tool',
      title: 'Remove EXIF data',
      accent: 'and GPS location.',
      body: 'Strip hidden metadata from many photos at once, without re-encoding.',
      chips: ['All metadata', 'Location only', 'Keep copyright', 'No re-encoding'],
      art: 'icon',
    },
    ...TOOL_FREQUENCY,
  },
  privacy: {
    path: '/privacy',
    title: 'Privacy',
    description:
      'How Hexlode handles your images and data: what it keeps in your browser, what it measures without cookies, and what error reports contain.',
    card: {
      eyebrow: 'Privacy',
      title: 'Your images,',
      accent: 'on your device.',
      body: 'What Hexlode keeps in your browser and what it measures, in plain words.',
      chips: ['No cookies', 'Anonymous analytics', 'Open source'],
      art: 'icon',
    },
    changeFrequency: 'yearly',
    priority: 0.3,
  },
}
