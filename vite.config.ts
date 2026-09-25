import { existsSync, readFileSync } from 'node:fs'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig, type Plugin } from 'vite'

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

/** Ships every codec's licence with the app, as ADR 0002 requires, at /licenses/jsquash.txt. */
function codecLicences(): Plugin {
  return {
    name: 'hexlode:codec-licences',
    apply: 'build',
    generateBundle() {
      if (this.environment?.name !== 'client') return
      const sections = JSQUASH_PACKAGES.flatMap((name) =>
        [`node_modules/${name}/LICENSE`, `node_modules/${name}/codec/LICENSE.codec.md`]
          .filter((path) => existsSync(path))
          .map(
            (path) =>
              `==> ${path.replace('node_modules/', '')} <==\n\n${readFileSync(path, 'utf8')}`,
          ),
      )
      this.emitFile({
        type: 'asset',
        fileName: 'licenses/jsquash.txt',
        source: `Hexlode encodes and decodes images with jSquash codecs.\n\n${sections.join('\n\n')}`,
      })
    },
  }
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  ssr: { noExternal: ['@astryxdesign/theme-neutral'] },
  optimizeDeps: { exclude: JSQUASH_PACKAGES },
  worker: { format: 'es' },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
    codecLicences(),
  ],
})

export default config
