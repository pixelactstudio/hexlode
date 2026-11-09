/**
 * Exit gate: every built-in tool runs end to end on real files, and what it delivers decodes to the
 * job its page promises.
 */
import { describe, expect, it } from 'vitest'

import {
  availableBuiltInTools,
  BUILT_IN_TOOLS,
  builtInToolProblem,
} from '#/features/built-in-tools/tools'
import type { BuiltInTool } from '#/features/built-in-tools/types'
import type { Pipeline } from '#/features/engine/types'
import {
  decodeFile,
  fixtureBytes,
  near,
  pixelAt,
  pngInput,
  run,
  solidPixels,
} from '#/features/nodes/__tests__/harness'
import { productRegistry } from '#/features/nodes/registry'
import { validatePipeline } from '#/features/pipelines/pipeline-file'

const WHITE = [255, 255, 255, 255]

function tool(slug: string) {
  const found = BUILT_IN_TOOLS.find((candidate) => candidate.slug === slug)
  if (!found) throw new Error(`No built-in tool ${slug}`)
  return found
}

function withSettings(pipeline: Pipeline, nodeId: string, settings: Record<string, unknown>) {
  return {
    ...pipeline,
    nodes: pipeline.nodes.map((node) =>
      node.id === nodeId ? { ...node, settings: { ...node.settings, ...settings } } : node,
    ),
  }
}

/** Every file the tool's Output node delivers. */
async function delivered(
  builtIn: BuiltInTool,
  inputs: Parameters<typeof run>[1],
  pipeline?: Pipeline,
) {
  const output = builtIn.pipeline.nodes.find((node) => node.type === 'output')
  if (!output) throw new Error('No Output node')
  const result = await run(pipeline ?? builtIn.pipeline, inputs)
  expect(result.result.status).toBe('complete')
  const failures = result.events.filter(
    (event) => event.type === 'node-item' && event.status === 'failed',
  )
  expect(failures).toEqual([])
  return result.files(output.id)
}

describe('built-in tools', () => {
  it('each tool has a valid pipeline with one Output node and a stated reason', () => {
    for (const builtIn of availableBuiltInTools(productRegistry)) {
      expect(() => validatePipeline(builtIn.pipeline, productRegistry)).not.toThrow()
      expect(builtIn.pipeline.nodes.filter((node) => node.type === 'output')).toHaveLength(1)
      expect(builtIn.reason.length).toBeGreaterThan(40)
      for (const nodeId of builtIn.adjustable ?? []) {
        expect(builtIn.pipeline.nodes.map((node) => node.id)).toContain(nodeId)
      }
    }
  })

  it('each tool has its own slug, outside the paths other tool pages use', () => {
    const slugs = BUILT_IN_TOOLS.map((builtIn) => builtIn.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(slugs).not.toContain('shared')
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('WebP to JPG saves JPEG files and turns transparency white, not black', async () => {
    const source = await decodeFile(await fixtureBytes('alpha.webp'))
    let clear: [number, number] | undefined
    for (let y = 0; y < source.height && !clear; y += 1) {
      for (let x = 0; x < source.width && !clear; x += 1) {
        if (pixelAt(source, x, y)[3] === 0) clear = [x, y]
      }
    }
    if (!clear) throw new Error('alpha.webp has no transparent pixel')
    const files = await delivered(tool('webp-to-jpg'), ['alpha.webp', 'photo.webp'])
    expect(files.map(({ name }) => name)).toEqual(['alpha.jpg', 'photo.jpg'])
    const image = await decodeFile(files[0].bytes)
    expect(image).toMatchObject({ format: 'jpeg', width: source.width, height: source.height })
    expect(near(pixelAt(image, ...clear), WHITE, 12)).toBe(true)
  })

  it('JPG to PDF puts every image on its own page of one PDF, upright', async () => {
    const files = await delivered(tool('jpg-to-pdf'), ['photo.jpg', 'oriented.jpg', 'photo.png'])
    expect(files).toHaveLength(1)
    expect(files[0].name).toMatch(/\.pdf$/)
    const source = new TextDecoder('latin1').decode(files[0].bytes)
    expect(source.startsWith('%PDF-1.')).toBe(true)
    expect(source.match(/\/Type \/Page(?!s)/g)).toHaveLength(3)
    // oriented.jpg is stored 48 × 32 with an orientation tag that stands it upright as 32 × 48.
    const sizes = [...source.matchAll(/\/Width (\d+)\s*\/Height (\d+)/g)].map(
      ([, width, height]) => `${width}x${height}`,
    )
    expect(sizes).toContain('32x48')
  })

  it('Instagram without cropping fits the whole photo into 4:5 at 1080 × 1350', async () => {
    const wide = await pngInput(
      'wide.png',
      solidPixels(1500, 1000, (x) => (x < 750 ? [255, 0, 0, 255] : [0, 0, 255, 255])),
    )
    const files = await delivered(tool('instagram-no-crop'), [wide, 'photo.jpg'])
    const post = await decodeFile(files[0].bytes)
    expect(post).toMatchObject({ format: 'jpeg', width: 1080, height: 1350 })
    // Nothing is cropped: both halves of the photo reach the left and right edges.
    expect(near(pixelAt(post, 2, 675), [255, 0, 0, 255])).toBe(true)
    expect(near(pixelAt(post, 1077, 675), [0, 0, 255, 255])).toBe(true)
    const small = await decodeFile(files[1].bytes)
    expect(small.width / small.height).toBeCloseTo(4 / 5, 1)
  })

  it('Instagram without cropping can make square posts instead', async () => {
    const builtIn = tool('instagram-no-crop')
    const padId = builtIn.adjustable?.[0] as string
    const square = withSettings(builtIn.pipeline, padId, { aspect: '1:1' })
    const wide = await pngInput('wide.png', solidPixels(1500, 1000, [0, 128, 0, 255]))
    const files = await delivered(builtIn, [wide], square)
    expect(await decodeFile(files[0].bytes)).toMatchObject({ width: 1080, height: 1080 })
  })

  it('Favicon generator makes an ICO file, PNG icons, a manifest and the HTML tags', async () => {
    const logo = await pngInput('logo.png', solidPixels(512, 512, [255, 22, 22, 255]))
    const files = await delivered(tool('favicon-generator'), [logo])
    const names = files.map(({ name }) => name)
    expect(names.some((name) => name.endsWith('.ico'))).toBe(true)
    expect(names.some((name) => name.endsWith('.webmanifest'))).toBe(true)
    expect(names.some((name) => name.endsWith('.html'))).toBe(true)
    const pngs = files.filter(({ name }) => name.endsWith('.png'))
    expect(pngs.length).toBeGreaterThanOrEqual(3)
    for (const png of pngs) expect((await decodeFile(png.bytes)).format).toBe('png')
  })

  it('Watermark photos writes the text on every photo and keeps each format', async () => {
    const plain = await pngInput('plain.png', solidPixels(400, 300, [20, 20, 20, 255]))
    const builtIn = tool('watermark-photos')
    const textId = builtIn.adjustable?.[0] as string
    const marked = withSettings(builtIn.pipeline, textId, {
      text: 'HEXLODE',
      position: 'center',
      size: 20,
      opacity: 100,
    })
    const files = await delivered(builtIn, [plain, 'photo.jpg'], marked)
    const image = await decodeFile(files[0].bytes)
    expect(image).toMatchObject({ format: 'png', width: 400, height: 300 })
    const changed = Array.from({ length: 300 }, (_, x) => pixelAt(image, x + 50, 150)).filter(
      (pixel) => !near(pixel, [20, 20, 20, 255], 8),
    )
    expect(changed.length).toBeGreaterThan(10)
    expect((await decodeFile(files[1].bytes)).format).toBe('jpeg')
  })

  it('Add logo to photos asks for a logo before it runs, then places it', async () => {
    const builtIn = tool('add-logo-to-photos')
    expect(builtInToolProblem(builtIn, builtIn.pipeline)).toBe('Choose your logo first.')
    const logoBytes = (await pngInput('logo.png', solidPixels(40, 40, [255, 0, 0, 255]))).bytes
    const logoId = builtIn.adjustable?.[0] as string
    let binary = ''
    for (const byte of logoBytes) binary += String.fromCharCode(byte)
    const withLogo = withSettings(builtIn.pipeline, logoId, {
      logo: { name: 'logo.png', data: btoa(binary), width: 40, height: 40 },
      position: 'top-left',
      margin: 0,
      opacity: 100,
      scale: 25,
    })
    expect(builtInToolProblem(builtIn, withLogo)).toBeNull()
    const plain = await pngInput('plain.png', solidPixels(400, 300, [0, 0, 255, 255]))
    const files = await delivered(builtIn, [plain], withLogo)
    const image = await decodeFile(files[0].bytes)
    expect(near(pixelAt(image, 10, 10), [255, 0, 0, 255])).toBe(true)
    expect(near(pixelAt(image, 390, 290), [0, 0, 255, 255])).toBe(true)
  })

  it('delivers favicon files that unzip as the HTML tags list them', async () => {
    const logo = await pngInput('logo.png', solidPixels(256, 256, [0, 0, 0, 255]))
    const files = await delivered(tool('favicon-generator'), [logo])
    const html = files.find(({ name }) => name.endsWith('.html'))
    const tags = new TextDecoder().decode(html?.bytes)
    for (const href of tags.match(/href="([^"]+)"/g) ?? []) {
      const file = href.slice(6, -1).split('/').pop() as string
      expect(files.map(({ name }) => name.split('/').pop())).toContain(file)
    }
  })
})
