import { describe, expect, it } from 'vitest'
import { productRegistry } from '#/features/nodes/registry'
import { PipelineFileError } from '#/features/pipelines/pipeline-file'
import {
  PipelineLinkTooLong,
  pipelineLinkPayload,
  pipelineLinkUrl,
  readPipelineLink,
} from '#/features/pipelines/pipeline-link'
import { availableTemplates } from '#/features/pipelines/templates'

const ORIGIN = 'https://hexlode.damnlabs.com'

describe('pipeline links', () => {
  it.each(
    availableTemplates(productRegistry).map((template) => [template.name, template]),
  )('carries the %s template unchanged', async (_name, template) => {
    const url = await pipelineLinkUrl(ORIGIN, template)
    const opened = await readPipelineLink(new URL(url).hash, productRegistry)
    expect(opened).toEqual({ name: template.name, pipeline: template.pipeline })
  })

  it('opens the shared pipeline tool page and keeps the pipeline after the #', async () => {
    const template = availableTemplates(productRegistry)[0]
    const url = new URL(await pipelineLinkUrl(ORIGIN, template))
    expect(url.origin).toBe(ORIGIN)
    expect(url.pathname).toBe('/tools/shared')
    expect(url.search).toBe('')
    // Only characters that survive chat apps, email and address bars unescaped.
    expect(url.hash).toMatch(/^#[A-Za-z0-9._-]+$/)
  })

  it('stays short enough to paste into a chat', async () => {
    for (const template of availableTemplates(productRegistry)) {
      const url = await pipelineLinkUrl(ORIGIN, template)
      expect(url.length).toBeLessThan(1500)
    }
  })

  it('refuses a pipeline too large for a link, such as one with a big logo', async () => {
    // A logo is already compressed, so it stays large: pseudo-random base64 behaves the same.
    let seed = 1
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    const logo = Array.from({ length: 60_000 }, () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648
      return alphabet[Math.floor(seed / 65_536) % 64]
    }).join('')
    const pipeline = {
      nodes: [
        { id: 'files', type: 'files', settings: {}, position: { x: 0, y: 0 } },
        {
          id: 'logo',
          type: 'image-watermark',
          settings: { logo: { name: 'logo.png', type: 'image/png', data: logo } },
          position: { x: 300, y: 0 },
        },
      ],
      connections: [{ id: 'files-out-logo', source: 'files', sourcePort: 'out', target: 'logo' }],
    }
    await expect(pipelineLinkPayload({ name: 'Big logo', pipeline })).rejects.toBeInstanceOf(
      PipelineLinkTooLong,
    )
  })

  it('says a cut-off link is damaged', async () => {
    const template = availableTemplates(productRegistry)[0]
    const url = await pipelineLinkUrl(ORIGIN, template)
    const hash = new URL(url).hash
    const cut = hash.slice(0, Math.floor(hash.length / 2))
    await expect(readPipelineLink(cut, productRegistry)).rejects.toThrow(
      new PipelineFileError('This link is damaged or incomplete. Ask for it again.'),
    )
  })

  it('says a link without a pipeline has nothing to open', async () => {
    await expect(readPipelineLink('', productRegistry)).rejects.toThrow(
      new PipelineFileError('This link has no pipeline in it.'),
    )
    await expect(readPipelineLink('#', productRegistry)).rejects.toThrow(
      new PipelineFileError('This link has no pipeline in it.'),
    )
  })

  it('says a link from a newer Hexlode needs a newer version', async () => {
    await expect(readPipelineLink('#9.abc', productRegistry)).rejects.toThrow(
      new PipelineFileError('This link was made by a newer version of Hexlode.'),
    )
  })

  it('checks the pipeline it carries like a pipeline file', async () => {
    const pipeline = {
      nodes: [{ id: 'mystery', type: 'teleport', settings: {}, position: { x: 0, y: 0 } }],
      connections: [],
    }
    const payload = await pipelineLinkPayload({ name: 'Odd', pipeline })
    await expect(readPipelineLink(`#${payload}`, productRegistry)).rejects.toThrow(
      'This pipeline uses nodes this version of Hexlode does not have: teleport.',
    )
  })
})
