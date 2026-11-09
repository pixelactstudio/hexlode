import { stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

import { RUNTIME_BYTES } from '#/features/background-removal/constants'

const resolve = createRequire(import.meta.url).resolve

describe('what the consent prompt says it downloads', () => {
  it('matches the ONNX Runtime files the app serves', async () => {
    const size = async (file: string) => (await stat(resolve(`onnxruntime-web/${file}`))).size
    expect(RUNTIME_BYTES).toEqual({
      webgpu: await size('ort-wasm-simd-threaded.asyncify.wasm'),
      wasm: await size('ort-wasm-simd-threaded.wasm'),
    })
  })
})
