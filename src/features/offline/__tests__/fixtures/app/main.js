// A tiny client build: a codec loaded by URL and a page loaded on demand, like Hexlode's own.
globalThis.codecUrl = new URL('./codec.wasm', import.meta.url)
globalThis.openPage = () => import('./lazy.js')
