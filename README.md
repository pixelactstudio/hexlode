<div align="center">
  <img src="./public/hexlode-mark.svg" alt="Hexlode" width="64" height="64" />
  <h1>Hexlode</h1>
  <p>A private visual workspace for converting, inspecting, optimizing, and comparing images.</p>
</div>

<p align="center">
  <a href="https://github.com/pixelactstudio/hexlode/actions/workflows/ci.yml">
    <img src="https://github.com/pixelactstudio/hexlode/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="Apache-2.0 license" />
  </a>
</p>

Hexlode turns image processing into reusable visual recipes. Connect operations on a node canvas,
run images through the workflow, compare the results, and save the recipe for later.

The project is in early development. The application foundation is configured; the first real
browser-local processing pipeline is the next milestone.

## First workflow

```text
Files -> Inspect -> Resize -> WebP -> Compare -> Download
```

The first release will accept JPEG and PNG files, process them in a Web Worker, produce WebP output,
show before-and-after details, and download the result without requiring an account.

## Principles

- Process on the user's device by default.
- Keep the core workflow available without an account.
- Make the canvas represent real computation, progress, and errors.
- Never send image bytes, filenames, thumbnails, or metadata to analytics.
- Use cloud processing only after an explicit user choice.
- Keep one application and add infrastructure only when a real need appears.

## Getting started

Requirements: Node.js 24, pnpm 11, and PostgreSQL.

```bash
git clone git@github.com:pixelactstudio/hexlode.git
cd hexlode
nvm use
pnpm install
cp .env.example .env.local
createdb hexlode
pnpm db:push
pnpm dev
```

Before starting the application, update `DATABASE_URL` in `.env.local` for your local PostgreSQL
user and replace the Better Auth placeholder. Generate a secret with:

```bash
pnpm dlx @better-auth/cli secret
```

Google sign-in uses `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. For local development, configure
Google's authorized redirect URI as `http://localhost:3000/api/auth/callback/google`.

A standard PostgreSQL URL uses `postgresql://user:password@localhost:5432/hexlode`. Linux systems
using PostgreSQL peer authentication can instead use the local socket URL
`postgresql:///hexlode?host=/run/postgresql`, which needs no username or password in the URL.

The development server runs at [http://localhost:3000](http://localhost:3000). PostHog and Sentry
remain disabled when their keys are empty.

## Scripts

| Command            | Purpose                                             |
| ------------------ | --------------------------------------------------- |
| `pnpm dev`         | Start the local development server.                 |
| `pnpm build`       | Create a production build.                          |
| `pnpm preview`     | Preview the production build.                       |
| `pnpm start`       | Run the built Nitro Node server.                    |
| `pnpm validate`    | Run Biome checks, TypeScript, and a production build. |
| `pnpm format`      | Format the repository with Biome.                   |
| `pnpm lint`        | Run Biome lint rules.                               |
| `pnpm lint:fix`    | Fix safe Biome lint violations.                     |
| `pnpm typecheck`   | Check TypeScript without emitting files.            |
| `pnpm db:generate` | Generate Drizzle migrations from the schema.        |
| `pnpm db:migrate`  | Apply generated database migrations.                |
| `pnpm db:push`     | Push the current schema to a development database.  |
| `pnpm db:studio`   | Open Drizzle Studio.                                |

## Architecture

Hexlode is a single TanStack Start application organized as feature-first vertical slices. Routes
compose features; processing and workflow logic remain plain TypeScript outside React components.
Shared packages, an SDK, a CLI, and cloud infrastructure are intentionally deferred until a real
second consumer or measured workload requires them.

- [Product brief](./idea.md)
- [Implementation plan](./implementation.md)
- [Agent guide](./AGENTS.md)

## Stack

- TanStack Start, React 19, TypeScript, and Vite
- React Flow, Astryx, and Tailwind CSS
- PostgreSQL and Drizzle ORM
- Better Auth, PostHog, and Sentry
- Biome, Husky, lint-staged, and Commitlint

## Commit workflow

`pnpm install` configures Husky. Staged files are checked with Biome, and commit messages must use
[Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: add image input validation
fix: release worker buffers after cancellation
chore: update dependencies
```

## License

Hexlode is open-source software licensed under the [Apache License 2.0](./LICENSE).

An open-source project by [Pixelact Studio](https://pixelactstudio.com).
