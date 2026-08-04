# Hexlode Agent Guide

## Project

- TanStack Start application using React 19, TypeScript, Vite, Tailwind CSS, and Astryx.
- PostgreSQL access uses Drizzle ORM. The local development database is `hexlode`.
- Authentication uses Better Auth; monitoring uses Sentry and PostHog.
- Use pnpm only. Node and pnpm versions are pinned in `.nvmrc` and `package.json`.

## Working Agreement

- Read `idea.md` for product scope and `implementation.md` for delivery order before product or
  architecture work. Keep both documents aligned when an accepted decision changes.
- Inspect the affected flow before editing and keep changes narrowly scoped.
- Reuse existing code and dependencies before adding abstractions or packages.
- Never expose or commit `.env*` secrets. Keep `.env.example` placeholder-only.
- Do not edit generated files such as `src/routeTree.gen.ts`.
- Do not hand-edit generated Drizzle migrations. Change `src/db/schema.ts`, then run
  `pnpm db:generate` and review the generated SQL.
- Load the matching TanStack Intent guidance below before editing related framework code.

## Commands

- Install: `nvm use && pnpm install`
- Develop: `pnpm dev`
- Validate: `pnpm validate`
- Format: `pnpm format`
- Lint: `pnpm lint`
- Type-check: `pnpm typecheck`
- Database: `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:push`, `pnpm db:studio`

## Code Conventions

- Follow `biome.json`; use two spaces, single quotes, and no unnecessary semicolons.
- Prefer `#/` for imports rooted at `src/`.
- Keep server-only secrets and database access out of browser bundles.
- Colocate tests in a `__tests__/` directory beside the feature or submodule they verify.
- Add the smallest focused test for non-trivial new behavior.
- Keep feature-owned limits and defaults in `constants.ts`, domain contracts in `types.ts`, and
  validation schemas or parsing logic in `validators.ts` when separating them makes the module
  easier to navigate. Keep schema-derived types beside their schema.
- Keep JSX declarative: compute formatted display values before the return and extract repeated or
  branch-heavy sections into named components in the same feature.
- Split files by responsibility when UI, domain policy, and side effects become mixed. Do not split
  cohesive code only to satisfy a line-count target or create generic junk-drawer folders.
- Move a helper to `src/lib` only after at least two features use it.
- Use dedicated browser Web Workers for CPU-heavy local processing. Do not add server queues,
  Redis, uploads, or cloud workers to a local-only workflow.
- Use Conventional Commits; Husky enforces staged checks and commit-message linting.

<!-- ASTRYX:START -->
Astryx v0.2.0 · 154 components
CLI: run every command as `pnpm exec astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in your app entry e.g. main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";

WORKFLOW — discover, don't guess. Before writing UI:
1. `astryx build "<idea>"` — START HERE: returns a kit (closest [page] + [block]s + [component]s). No args = full playbook.
2. `astryx template <name> [--skeleton]` — scaffold the [page]/[block]s it named, or study their layout. Templates are reference code.
3. `astryx component <Name>` — props + examples for every component you use.

RULES:
- No <div> — components do all layout/spacing. Full page → AppShell; sidebar nav → SideNav.
- Frame first: pick the shell (AppShell / Layout+LayoutPanel) and budget regions in px BEFORE writing content (`astryx docs layout`).
- Dense data = rows (Table, List/Item) edge-to-edge — never Card-wrapped list items. Card = dashboard widgets, galleries, settings groups only.
- Status → StatusDot/Token; Badge only for counts and enumerated states, never decoration.
- Custom styling: component props first; else Tailwind utilities backed by tokens (bg-surface, text-primary, rounded-lg) via tailwind-theme.css. No raw hex/px.
- Tokens for every value (`astryx docs tokens`). Brand/accent via `astryx theme` — never override --color-* in :root.
- SELF-CHECK before you finish: re-read the file and replace any style={{…}}, raw <div>/<span> layout, imported .css/@apply, or hardcoded/arbitrary value (e.g. bg-[#fff], p-[13px]) with the component or a token-backed utility. If unsure a component/prop exists, run `astryx component <Name>` / `astryx search "<thing>"`; don't hand-roll CSS.

MORE CLI:
  search "<query>"   find any component / hook / doc / template / block
  component --list   154 components by category
  template --list    page + block recipes
  docs <topic>       color, elevation, icons, illustrations, internationalization, layout, migration, motion, principles, shape, spacing, styling, theme, tokens, typography
  swizzle <Name>     eject component source for deep customization
  upgrade --apply    run after any @astryxdesign/core bump
<!-- ASTRYX:END -->
