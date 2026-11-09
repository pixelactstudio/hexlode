/// <reference lib="webworker" />
/**
 * Draws previews of files the browser cannot show in an image element, such as HEIC, JPEG XL and
 * QOI, one at a time so a long list never holds more than one decoded image.
 */

import { jsquashCodecs } from '#/features/images/codecs'
import { loadImageItem, uprightPixelsOf } from '#/features/images/image-item'
import { displayBlob, scaleDown } from '#/features/images/thumbnail'
import {
  type ThumbnailRequest,
  type ThumbnailResponse,
  thumbnailRequestSchema,
} from '#/features/previews/protocol'
import { fromOwnerPage } from '#/lib/worker-message'

const scope = self as unknown as DedicatedWorkerGlobalScope
const post = (message: ThumbnailResponse) => scope.postMessage(message)
let queue = Promise.resolve()

async function draw({ id, file, name, edge }: ThumbnailRequest) {
  try {
    const item = await loadImageItem(new Uint8Array(await file.arrayBuffer()), name)
    const pixels = await scaleDown(await uprightPixelsOf(item, jsquashCodecs), edge, jsquashCodecs)
    post({ id, image: await displayBlob(pixels) })
  } catch (reason) {
    post({ id, error: reason instanceof Error ? reason.message : 'The preview failed.' })
  }
}

scope.onmessage = (event: MessageEvent<unknown>) => {
  if (!fromOwnerPage(event, scope)) return
  const parsed = thumbnailRequestSchema.safeParse(event.data)
  if (!parsed.success) return
  queue = queue.then(() => draw(parsed.data))
}
