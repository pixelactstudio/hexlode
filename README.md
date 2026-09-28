<div align="center">
  <img src="./public/hexlode-mark.svg" alt="Hexlode" width="64" height="64" />
  <h1>Hexlode</h1>
  <p>Open-source image processing that runs in your browser.</p>
</div>

<p align="center">
  <a href="https://github.com/pixelactstudio/hexlode/actions/workflows/ci.yml">
    <img src="https://github.com/pixelactstudio/hexlode/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
  <a href="https://github.com/pixelactstudio/hexlode/actions/workflows/codeql.yml">
    <img src="https://github.com/pixelactstudio/hexlode/actions/workflows/codeql.yml/badge.svg" alt="CodeQL" />
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="Apache-2.0 license" />
  </a>
</p>

Hexlode has quick tools for converting, compressing, resizing, cropping, rotating and stripping
metadata, and a node-based Studio for running many images through the same pipeline. Images are
processed on your device, without uploading them.

Use it at [hexlode.damnlabs.com](https://hexlode.damnlabs.com). Hexlode is made by [Damn Labs](https://damnlabs.com),
a [Pixelact Studio](https://pixelactstudio.com) product.

## Principles

- Process images on the user's device.
- Make the Studio canvas show real work: progress, results and errors.
- Never send image bytes, filenames, thumbnails or metadata to analytics.

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

Hexlode processes images in the browser's Origin Private File System, which browsers turn on only
over HTTPS or at `localhost`. To open the dev server from another device, serve it over HTTPS,
for example with `tailscale serve --bg --https=8443 http://127.0.0.1:3000`. Over plain HTTP the
tools explain this instead of running.

## Checks

| Command | What it does |
|---|---|
| `pnpm test` | Unit tests in Node and browser tests in Chromium. |
| `pnpm test:scale` | 500 images of 12 megapixels through a template, checking memory. Takes minutes. |
| `pnpm validate` | Biome, TypeScript, `pnpm test` and a production build. |

Browser tests use the Chromium at `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, or the one
`pnpm exec playwright install chromium` downloads.

## Docker

CI publishes `ghcr.io/pixelactstudio/hexlode` for x86 and ARM on every push to `main`.

```bash
docker run -p 3000:3000 ghcr.io/pixelactstudio/hexlode:latest
```

Settings come from the container's environment, for example `-e VITE_POSTHOG_KEY=…` and
`-e VITE_SENTRY_DSN=…` to enable analytics and error reports. [DEPLOY.md](./DEPLOY.md) covers
Dokploy, every variable, zero-downtime updates and deploying on each push.

## Documents

[idea.md](./idea.md) describes the product, [implementation.md](./implementation.md) the plan and
engine, [CONTEXT.md](./CONTEXT.md) the vocabulary and [docs/adr/](./docs/adr/) the decisions.

## License

[Apache License 2.0](./LICENSE). Copyright 2026 Dev Talan. The jSquash codecs keep their own
licences, listed in `node_modules/@jsquash/*/LICENSE` and bundled with the app.

An open-source project by [Pixelact Studio](https://pixelactstudio.com).
