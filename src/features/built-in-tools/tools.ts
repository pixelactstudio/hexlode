/**
 * The built-in tools. A job earns a page only when people search for it by name in large numbers,
 * repeat it, and Hexlode does all of it on the device better than a single quick tool; each entry
 * says why in `reason`. No page exists only to catch a search.
 */
import type { BuiltInTool, BuiltInToolSlug } from '#/features/built-in-tools/types'
import type { NodeRegistry, Pipeline } from '#/features/engine/types'
import { line } from '#/features/pipelines/templates'

export const BUILT_IN_TOOLS: BuiltInTool[] = [
  {
    slug: 'heic-to-jpg',
    name: 'HEIC to JPG',
    heading: 'Convert HEIC to JPG',
    description:
      'Turns iPhone HEIC photos into JPEG files that every computer, website and form accepts, upright and with their date, camera and location kept.',
    reason:
      'iPhones save photos as HEIC, which Windows, many websites and upload forms still refuse, so HEIC to JPG is one of the most searched image conversions there is. Most converters upload the photos; here a whole batch converts on the device.',
    pipeline: line([
      ['files', 'files'],
      ['convert', 'convert', { format: 'jpeg', jpeg: { quality: 90 } }],
      ['output', 'output', { archiveName: 'jpg' }],
    ]),
  },
  {
    slug: 'webp-to-jpg',
    name: 'WebP to JPG',
    heading: 'Convert WebP to JPG',
    description:
      'Turns WebP images saved from the web into JPEG files that every app opens, with transparent areas made white.',
    reason:
      'Images saved from websites arrive as WebP, which many editors, upload forms and older apps refuse, so people convert them to JPEG every day. A plain conversion turns transparent areas black; this tool fills them with white first.',
    pipeline: line([
      ['files', 'files'],
      ['background', 'background', { colour: '#ffffff' }],
      ['convert', 'convert', { format: 'jpeg', jpeg: { quality: 90 } }],
      ['output', 'output', { archiveName: 'jpg' }],
    ]),
  },
  {
    slug: 'jpg-to-pdf',
    name: 'JPG to PDF',
    heading: 'JPG to PDF: combine images into one PDF',
    description:
      'Puts every image on its own page of a single PDF, turned upright, in the order you add them.',
    reason:
      'Forms, landlords, schools and offices ask for one PDF made from photos of documents or receipts, which is among the most common file jobs there is. Most sites that do it upload the pages, often private documents; here they stay on the device.',
    pipeline: line([
      ['files', 'files'],
      ['rotate', 'rotate', { auto: true }],
      ['pdf', 'images-to-pdf', { pageSize: 'a4', margin: 10, name: 'images' }],
      ['output', 'output', { archiveName: 'pdf' }],
    ]),
    adjustable: ['pdf'],
  },
  {
    slug: 'instagram-no-crop',
    name: 'Instagram without cropping',
    heading: 'Post the whole photo on Instagram, without cropping',
    description:
      'Fits each photo into a 4:5 or square post at 1080 pixels wide, with a blurred or plain border instead of cutting it off.',
    reason:
      'Instagram crops photos outside 1.91:1 to 4:5, so people add borders with "no crop" apps that have hundreds of millions of installs. Doing a whole batch at once, at exactly the size Instagram keeps, beats one photo at a time.',
    guidance: {
      label: 'Instagram Help Center: photo resolution',
      url: 'https://help.instagram.com/1631821640426723',
      checked: '2026-11-10',
    },
    pipeline: line([
      ['files', 'files'],
      ['rotate', 'rotate', { auto: true }],
      ['pad', 'pad', { aspect: '4:5', fill: 'blur' }],
      ['resize', 'resize', { mode: 'box', width: 1080, height: 1350, fit: 'fit' }],
      ['convert', 'convert', { format: 'jpeg', jpeg: { quality: 90 } }],
      ['output', 'output', { archiveName: 'instagram' }],
    ]),
    adjustable: ['pad'],
  },
  {
    slug: 'product-photos-white-background',
    name: 'Product photos on white',
    heading: 'Product photos on a white background',
    description:
      'Cuts each product out, centres it on a pure white square so it fills about 85% of the frame, and saves a JPEG of up to 2000 pixels.',
    reason:
      'Amazon, eBay, Etsy and Shopify sellers need product shots on pure white, square and large enough to zoom, for every listing. Background removal sites charge per photo and upload each one; this does the cut-out, the white square and the size for a whole batch on the device.',
    guidance: {
      label: 'Amazon Seller Central: product image requirements',
      url: 'https://sellercentral.amazon.com/help/hub/reference/external/G1881',
      checked: '2026-11-10',
    },
    pipeline: line([
      ['files', 'files'],
      ['rotate', 'rotate', { auto: true }],
      ['cutout', 'remove-background'],
      ['trim', 'auto-trim'],
      ['white', 'background', { colour: '#ffffff' }],
      ['square', 'pad', { aspect: '1:1', colour: '#ffffff', margin: 8 }],
      ['resize', 'resize', { mode: 'box', width: 2000, height: 2000, fit: 'fit' }],
      ['convert', 'convert', { format: 'jpeg', jpeg: { quality: 92 } }],
      ['output', 'output', { archiveName: 'product-photos' }],
    ]),
    adjustable: ['square'],
  },
  {
    slug: 'favicon-generator',
    name: 'Favicon generator',
    heading: 'Favicon generator',
    description:
      'Makes every favicon and app icon from one image: an ICO file, PNG icons, a web app manifest and the HTML tags to paste.',
    reason:
      'Every website needs a favicon set, and the sizes, the ICO format and the manifest are fiddly enough that a favicon generator is one of the most used web developer tools. One image in, a ready folder out.',
    pipeline: line([
      ['files', 'files'],
      ['favicon', 'favicon'],
      ['output', 'output', { archiveName: 'favicon' }],
    ]),
    adjustable: ['favicon'],
  },
  {
    slug: 'watermark-photos',
    name: 'Watermark photos',
    heading: 'Add a text watermark to photos',
    description:
      'Writes your name or copyright on every photo in a batch, in a corner or tiled across, and keeps each format.',
    reason:
      'Photographers, sellers and creators mark every photo before posting it, usually a whole shoot at once, and most watermark sites upload the originals. A batch with the same mark in the same place is the whole job.',
    pipeline: line([
      ['files', 'files'],
      ['rotate', 'rotate', { auto: true }],
      ['watermark', 'text-watermark', { text: '© Your name' }],
      ['output', 'output', { archiveName: 'watermarked' }],
    ]),
    adjustable: ['watermark'],
  },
  {
    slug: 'add-logo-to-photos',
    name: 'Add logo to photos',
    heading: 'Add your logo to photos',
    description:
      'Places your logo on every photo in a batch, at the same corner, size and opacity, and keeps each format.',
    reason:
      'Shops, estate agents and brands put their logo on every listing and post photo, many at a time. Placing a PNG logo the same way on a whole batch is tedious in an editor and a common reason to reach for an online tool.',
    pipeline: line([
      ['files', 'files'],
      ['rotate', 'rotate', { auto: true }],
      ['logo', 'image-watermark'],
      ['output', 'output', { archiveName: 'with-logo' }],
    ]),
    adjustable: ['logo'],
    check: (pipeline) =>
      pipeline.nodes.find((node) => node.id === 'logo')?.settings.logo
        ? null
        : 'Choose your logo first.',
  },
]

/** The built-in tools whose nodes all exist in this version. */
export function availableBuiltInTools(registry: NodeRegistry) {
  return BUILT_IN_TOOLS.filter((tool) =>
    tool.pipeline.nodes.every((node) => registry.get(node.type)),
  )
}

export function builtInTool(slug: string) {
  return BUILT_IN_TOOLS.find((tool) => tool.slug === slug) as BuiltInTool | undefined
}

export function isBuiltInToolSlug(slug: string): slug is BuiltInToolSlug {
  return BUILT_IN_TOOLS.some((tool) => tool.slug === slug)
}

/** What still has to be set before the tool can run with these settings, or null. */
export function builtInToolProblem(tool: BuiltInTool, pipeline: Pipeline) {
  return tool.check?.(pipeline) ?? null
}
