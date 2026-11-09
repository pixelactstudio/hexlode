/**
 * Pipeline links: a pipeline file, compressed, after the `#` of a link to the shared pipeline tool
 * page. Browsers never send the part after `#` to a server, so the link is the only copy of the
 * pipeline. The part after `#` is `<link version>.<base64url of the deflated pipeline file>`.
 */
import type { NodeRegistry } from '#/features/engine/types'
import {
  MAX_PIPELINE_LINK_BYTES,
  MAX_PIPELINE_LINK_PAYLOAD,
  PIPELINE_LINK_PATH,
  PIPELINE_LINK_VERSION,
} from '#/features/pipelines/constants'
import {
  importPipelineFile,
  PipelineFileError,
  pipelineFileData,
} from '#/features/pipelines/pipeline-file'
import type { NamedPipeline } from '#/features/pipelines/types'
import { base64UrlToBytes, bytesToBase64Url } from '#/lib/base64'

/** The pipeline is too large for a link, usually because of a watermark logo. */
export class PipelineLinkTooLong extends Error {
  constructor() {
    super('This pipeline is too large for a link. Export the .hexlode file and send that instead.')
    this.name = 'PipelineLinkTooLong'
  }
}

const DAMAGED = 'This link is damaged or incomplete. Ask for it again.'

/** Runs bytes through a compression stream, stopping once the output passes `limit`. */
async function transform(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
  limit = Number.POSITIVE_INFINITY,
) {
  const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > limit) {
      await reader.cancel()
      throw new PipelineFileError(DAMAGED)
    }
    chunks.push(value)
  }
  const joined = new Uint8Array(total)
  let at = 0
  for (const chunk of chunks) {
    joined.set(chunk, at)
    at += chunk.length
  }
  return joined
}

/** The part after `#` that carries a pipeline. Throws PipelineLinkTooLong when it would not fit. */
export async function pipelineLinkPayload({ name, pipeline }: NamedPipeline) {
  const text = JSON.stringify(pipelineFileData({ name, pipeline }))
  const packed = await transform(
    new TextEncoder().encode(text),
    new CompressionStream('deflate-raw'),
  )
  const payload = `${PIPELINE_LINK_VERSION}.${bytesToBase64Url(packed)}`
  if (payload.length > MAX_PIPELINE_LINK_PAYLOAD) throw new PipelineLinkTooLong()
  return payload
}

/** A link to this Hexlode (`origin`) that opens the pipeline as a pipeline tool page. */
export async function pipelineLinkUrl(origin: string, named: NamedPipeline) {
  return `${origin}${PIPELINE_LINK_PATH}#${await pipelineLinkPayload(named)}`
}

/**
 * Reads the pipeline from the part of a link after `#`, with or without the `#`. Throws a
 * PipelineFileError that says what is wrong, in words for the person who opened the link.
 */
export async function readPipelineLink(hash: string, registry: NodeRegistry) {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  if (!fragment) throw new PipelineFileError('This link has no pipeline in it.')
  const dot = fragment.indexOf('.')
  const version = Number(fragment.slice(0, dot))
  if (dot < 1 || !Number.isInteger(version) || version < 1) throw new PipelineFileError(DAMAGED)
  if (version > PIPELINE_LINK_VERSION) {
    throw new PipelineFileError('This link was made by a newer version of Hexlode.')
  }
  let text: string
  try {
    const packed = base64UrlToBytes(fragment.slice(dot + 1))
    const bytes = await transform(
      packed,
      new DecompressionStream('deflate-raw'),
      MAX_PIPELINE_LINK_BYTES,
    )
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new PipelineFileError(DAMAGED)
  }
  try {
    return importPipelineFile(text, registry) satisfies NamedPipeline
  } catch (reason) {
    // A link that unpacks to something other than a pipeline file was cut or changed.
    if (
      reason instanceof PipelineFileError &&
      (reason.message === 'This is not a .hexlode file.' ||
        reason.message === 'This .hexlode file is damaged.')
    ) {
      throw new PipelineFileError(DAMAGED)
    }
    throw reason
  }
}
