import { describe, expect, it } from 'vitest'

import { cachedOnFirstUse, precacheUrls } from '#/features/offline/precache'

describe('precacheUrls', () => {
  it('keeps every script, style, font, codec and public file of the client build', () => {
    expect(
      precacheUrls([
        'assets/index-Ab12.js',
        'assets/styles-Cd34.css',
        'assets/figtree-latin-wght-normal-Ef56.woff2',
        'assets/avif_enc-Gh78.wasm',
        'assets/engine.worker-Ij90.js',
        'app-shell.html',
        'favicon.ico',
        'icons/icon-192.png',
        'home/studio-dark-1920.webp',
        'licenses/jsquash.txt',
      ]),
    ).toEqual([
      '/app-shell.html',
      '/assets/avif_enc-Gh78.wasm',
      '/assets/engine.worker-Ij90.js',
      '/assets/figtree-latin-wght-normal-Ef56.woff2',
      '/assets/index-Ab12.js',
      '/assets/styles-Cd34.css',
      '/favicon.ico',
      '/home/studio-dark-1920.webp',
      '/icons/icon-192.png',
      '/licenses/jsquash.txt',
    ])
  })

  it('leaves out source maps, share cards, hidden files and the worker itself', () => {
    expect(
      precacheUrls([
        'assets/index-Ab12.js.map',
        'og/home.png',
        '.vite/manifest.json',
        'sw.js',
        'assets/index-Ab12.js',
      ]),
    ).toEqual(['/assets/index-Ab12.js'])
  })

  it('lists each file once, whichever way its path is written', () => {
    expect(precacheUrls(['assets/a.js', '/assets/a.js', 'assets\\b.js'])).toEqual([
      '/assets/a.js',
      '/assets/b.js',
    ])
  })
})

describe('cachedOnFirstUse', () => {
  it("picks ONNX Runtime's WebAssembly, fetched only after the user agrees to Remove background", () => {
    expect(cachedOnFirstUse('/assets/ort-wasm-simd-threaded.asyncify-Ab12.wasm')).toBe(true)
    expect(cachedOnFirstUse('/assets/ort-wasm-simd-threaded-Cd34.wasm')).toBe(true)
    expect(cachedOnFirstUse('/assets/avif_enc-Gh78.wasm')).toBe(false)
    expect(cachedOnFirstUse('/assets/index-Ab12.js')).toBe(false)
  })
})
