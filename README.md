# Hexlode

Open-source image processing in the browser: quick tools for converting, compressing, resizing and
stripping metadata, and a node-based Studio for batch pipelines. Images never leave your device.

## Run locally

Requires Node.js 24 and pnpm 11.

```bash
git clone git@github.com:pixelactstudio/hexlode.git
cd hexlode
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). No `.env.local` is needed; copy
`.env.example` to `.env.local` only to enable analytics or error reports.

## Checks

| Command | What it does |
|---|---|
| `pnpm test` | Unit tests in Node and browser tests in Chromium. |
| `pnpm test:scale` | 500 images of 12 megapixels through a template, checking memory. Takes minutes. |
| `pnpm validate` | Biome, TypeScript, `pnpm test` and a production build. |

Browser tests use the Chromium at `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, or the one
`pnpm exec playwright install chromium` downloads.

## Docker

```bash
docker build -t hexlode .
docker run -p 3000:3000 hexlode
```

Pass `--build-arg VITE_POSTHOG_KEY=…` and `--build-arg VITE_SENTRY_DSN=…` to enable analytics and
error reports.

## Documents

[idea.md](./idea.md) describes the product, [implementation.md](./implementation.md) the plan and
engine, [CONTEXT.md](./CONTEXT.md) the vocabulary and [docs/adr/](./docs/adr/) the decisions.

## License

[Apache License 2.0](./LICENSE). Copyright 2026 Dev Talan. The jSquash codecs keep their own
licences, listed in `node_modules/@jsquash/*/LICENSE` and bundled with the app.
