import { existsSync, readFileSync } from 'node:fs'
import babel from '@rolldown/plugin-babel'
import { sentryTanstackStart } from '@sentry/tanstackstart-react/vite'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig, type Plugin } from 'vite'

import { serviceWorker } from '#/features/offline/build-plugin'
import { OFFLINE_PAGES } from '#/features/offline/pages'

/** jSquash loads its WebAssembly with `new URL(..., import.meta.url)`, which pre-bundling breaks. */
const JSQUASH_PACKAGES = [
  '@jsquash/avif',
  '@jsquash/jpeg',
  '@jsquash/jxl',
  '@jsquash/oxipng',
  '@jsquash/png',
  '@jsquash/qoi',
  '@jsquash/resize',
  '@jsquash/webp',
]

/**
 * Where the HEIC decoder's source is, as the LGPL asks (ADR 0016). libheif-js packs the build of
 * libheif-emscripten with the same version, which runs libheif's own build-emscripten.sh; that
 * script names the libde265 version it compiles in.
 */
function libheifNotice() {
  const { version } = JSON.parse(readFileSync('node_modules/libheif-js/package.json', 'utf8'))
  return [
    `Hexlode decodes HEIC and HEIF photos with libheif and its libde265 HEVC decoder, both under`,
    `the GNU Lesser General Public License 3.0, compiled to WebAssembly by libheif-js ${version}.`,
    'They are served as separate files (libheif.js and libheif.wasm) and loaded only when a HEIC',
    'image is opened, so they can be replaced with another build of the same library.',
    '',
    'Source code:',
    `  libheif-js         https://github.com/catdad-experiments/libheif-js/tree/${version}`,
    `  libheif build      https://github.com/catdad-experiments/libheif-emscripten/tree/v${version}`,
    `  libheif            https://github.com/strukturag/libheif/tree/v${version}`,
    `  libde265 version   https://github.com/strukturag/libheif/blob/v${version}/build-emscripten.sh`,
    '  libde265           https://github.com/strukturag/libde265',
  ].join('\n')
}

/**
 * Ships every codec's licence with the app, as ADRs 0002 and 0016 require, at
 * /licenses/jsquash.txt: the jSquash codecs, then libheif.
 */
function codecLicences(): Plugin {
  return {
    name: 'hexlode:codec-licences',
    apply: 'build',
    generateBundle() {
      if (this.environment?.name !== 'client') return
      const section = (path: string) =>
        `==> ${path.replace('node_modules/', '')} <==\n\n${readFileSync(path, 'utf8')}`
      const jsquash = JSQUASH_PACKAGES.flatMap((name) =>
        [`node_modules/${name}/LICENSE`, `node_modules/${name}/codec/LICENSE.codec.md`]
          .filter((path) => existsSync(path))
          .map(section),
      )
      const libheif = section('node_modules/libheif-js/libheif-wasm/LICENSE')
      this.emitFile({
        type: 'asset',
        fileName: 'licenses/jsquash.txt',
        source: [
          'Hexlode encodes and decodes images with jSquash codecs, and decodes HEIC with libheif.',
          ...jsquash,
          libheifNotice(),
          libheif,
        ].join('\n\n'),
      })
    },
  }
}

/**
 * Ships the licences of the background removal model and of ONNX Runtime, which runs it, at
 * /licenses/background-removal.txt (ADR 0017).
 */
function modelLicences(): Plugin {
  const folder = 'src/features/background-removal/licences'
  const files = [
    ['The BiRefNet_lite model, 512 × 512 ONNX export', 'birefnet-lite-512-LICENSE.txt'],
    ['ONNX Runtime Web', 'onnxruntime-LICENSE.txt'],
    ['ONNX Runtime third-party notices', 'onnxruntime-ThirdPartyNotices.txt'],
  ]
  return {
    name: 'hexlode:model-licences',
    apply: 'build',
    generateBundle() {
      if (this.environment?.name !== 'client') return
      const sections = files.map(
        ([title, file]) => `==> ${title} <==\n\n${readFileSync(`${folder}/${file}`, 'utf8')}`,
      )
      this.emitFile({
        type: 'asset',
        fileName: 'licenses/background-removal.txt',
        source: `Hexlode removes backgrounds with BiRefNet_lite, run by ONNX Runtime Web.\n\n${sections.join('\n\n')}`,
      })
    },
  }
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  // libheif-js ships a CommonJS loader, which must be pre-bundled; ONNX Runtime is told where its
  // WebAssembly is, so pre-bundling it is safe too. Listing them keeps a first run from finding them
  // late and reloading the page while tests or the app are running.
  optimizeDeps: {
    exclude: JSQUASH_PACKAGES,
    include: [
      'libheif-js/libheif-wasm/libheif.js',
      'onnxruntime-web/webgpu',
      'onnxruntime-web/wasm',
    ],
  },
  worker: { format: 'es' },
  // The dev server is also opened from other devices on the tailnet, such as the T3 Code preview.
  server: { allowedHosts: ['.ts.net'] },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
    codecLicences(),
    modelLicences(),
    // Writes /sw.js with every build file listed, so the app works offline after one visit.
    serviceWorker({ entry: 'src/features/offline/service-worker.ts', pages: OFFLINE_PAGES }),
    // Last, as Sentry's guide asks. Uploads source maps when SENTRY_AUTH_TOKEN, SENTRY_ORG and
    // SENTRY_PROJECT are set at build time, then deletes them from the output. The tunnel sends
    // browser reports through this server, at a path generated per build, past content blockers.
    sentryTanstackStart({ tunnelRoute: true, telemetry: false }),
  ],
})

export default config
