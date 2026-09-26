# Hexlode

Hexlode is a browser-local image-processing app with quick tools and a node-based Studio. Version 1
is local only.

## Before product or architecture work

- `idea.md` owns product scope and the node catalogue.
- `implementation.md` owns the phases, the active phase, the engine design and the testing rules.
  Work only on the active phase unless the user asks otherwise.
- `CONTEXT.md` is the glossary. Use its terms in code, UI text and docs.
- `docs/adr/` records decisions with their reasons. Read the matching ADR before changing the
  engine, codecs, storage, analytics, the pipeline file format or the dormant database code.

When the user changes a decision, update the document that owns it in the same change.

## Stack

TanStack Start (React 19, Vite, Nitro), TypeScript, React Flow, Astryx with Tailwind, jSquash
codecs in Web Workers, OPFS, PostHog and Sentry. Drizzle, PostgreSQL and Better Auth are dormant
until cloud work: keep them compiling and build version 1 features without them.

Use pnpm. The scripts are in `package.json`; `pnpm validate` runs every check.

## Code

- Import from `src/` with the `#/` prefix.
- Put domain code in `src/features/<feature>/`. Routes compose features.
- Keep the engine and node logic in plain TypeScript with no React. Components subscribe to engine
  events.
- Run pixel work, decoding and encoding in Web Workers.
- Put a feature's limits and defaults in `constants.ts`, its contracts in `types.ts`, and its
  parsing in `validators.ts`.
- Move a helper to `src/lib` once two features use it.
- Send analytics only through the analytics module, with event properties limited to counts,
  timings, node types, settings and error codes.
- `src/routeTree.gen.ts` and the files in `drizzle/` are generated. For schema changes, edit
  `src/db/schema.ts` and run `pnpm db:generate`.
- Keep secrets in `.env.local`. `.env.example` holds placeholders only.

## Tests

- Work test first with the `tdd` skill. Every test must fail when the behaviour it covers is
  removed.
- Assert on real output: decode the produced file and check format, dimensions, pixels and
  metadata.
- Put tests in a `__tests__/` folder beside the code they cover.
- Add every new node to the node pair matrix.

## UI

Build every screen from Astryx components, and style only with component props and token-backed
Tailwind utilities such as `bg-surface`, `text-primary` and `rounded-lg`.

- Start a new screen with `pnpm exec astryx build "<idea>"`, then check props with
  `pnpm exec astryx component <Name>`. Use `pnpm exec astryx search "<thing>"` when unsure a
  component exists.
- Use AppShell or Layout for page frames, Table or List for dense data, Card for widgets and
  settings groups, and StatusDot or Token for status.
- Set brand colours through `pnpm exec astryx theme`.
- Style the Studio canvas with the same tokens and hide the React Flow attribution.

## Commits

Use Conventional Commits. Husky runs Biome on staged files and commitlint on the message.
