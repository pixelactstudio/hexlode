---
name: build-hexlode-features
description: Apply Hexlode's project-specific feature architecture and delivery workflow. Use when Codex plans, implements, reviews, or refactors Hexlode product features; decides where code belongs; works on the image-processing pipeline, workers, codecs, canvas, recipes, comparisons, privacy modes, batches, account sync, or cloud processing; or evaluates shared code, dependencies, packages, SDKs, CLIs, monorepos, custom codecs, and other architecture boundaries.
---

# Build Hexlode Features

Build Hexlode as a feature-first modular monolith. Deliver complete vertical slices, keep domain
decisions pure where practical, and place adapters only at real external boundaries.

## Establish Context

Before planning or editing:

1. Read the repository `AGENTS.md` completely.
2. Read `idea.md` for product scope and non-goals.
3. Read `implementation.md` for the current milestone and delivery order.
4. Inspect the live code path and installed dependencies related to the request.
5. Respect discussion versus execution intent. Do not edit during a review, exploration, or planning
   request unless the user explicitly asks for implementation.

Treat `idea.md` as the authority for what Hexlode is and `implementation.md` as the authority for
what comes next. Keep them aligned only when the user accepts a durable decision change.

## Use This Architecture

Apply these patterns together:

- **Modular monolith:** keep one repository and one deployable application.
- **Feature-first ownership:** organize product code by user capability under `src/features`.
- **Vertical slices:** complete one real user workflow through UI, processing, errors, and output.
- **Functional core, imperative shell:** keep planning and policy pure; isolate browser effects.
- **Selective ports and adapters:** abstract codecs, storage, workers, analytics, and remote services
  only when the boundary is real.

Use this dependency direction:

```text
routes -> features -> shared components and lib
feature UI -> feature use cases -> pure domain logic
feature use cases -> external adapters -> browser APIs and dependencies
```

Do not let pure graph, recipe, planning, or policy logic import React, route modules, browser storage,
or concrete codec implementations.

## Place Code by Ownership

Use the existing source shape and create folders lazily:

```text
src/
  routes/          route definitions and feature composition
  features/        product capabilities
  components/      application components used by multiple features
  integrations/    framework and third-party providers
  lib/             small application-wide utilities
  db/              Drizzle schema and database access
```

Inside a feature, add only what the slice needs:

```text
src/features/<feature>/
  components/
  hooks/
  schemas/
  services/
  types/
  utils/
```

Do not scaffold all of these folders by default.

Follow these placement rules:

- Put route composition in `src/routes`; keep processing and business policy out of routes.
- Keep feature-specific UI, state, schemas, services, and types in that feature.
- Move code to `src/components` or `src/lib` only after two real features need it.
- Keep result buffers and worker-owned data outside React component state.
- Prefer direct, obvious imports. Do not add barrel files solely to imitate a package boundary.
- Keep cross-feature access narrow. Move genuinely shared policy to `lib` instead of reaching deeply
  into another feature.

## Build a Vertical Slice

For each feature:

1. Name the user-visible outcome.
2. Locate the current milestone in `implementation.md`.
3. Trace the full path from input to output before choosing files or abstractions.
4. Implement the smallest real path through UI, validation, processing, failure handling, and result.
5. Use actual engine events and outputs; do not build polished nodes around fake execution.
6. Add one focused runnable check for non-trivial planning, parsing, branching, worker, money, privacy,
   or security behavior.
7. Run the narrow checks first, then `pnpm validate` before handoff when the change affects code.
8. Report what was deliberately deferred.

Do not begin the next milestone merely because its infrastructure could be useful later.

## Keep the Processing Boundary Honest

Own Hexlode-specific logic:

- Typed graph validation.
- Recipe parsing and migrations.
- Execution planning and downstream invalidation.
- Memory-aware queue and batch policy.
- Progress, cancellation, and structured error semantics.
- Codec comparison and bounded constraint search.
- Privacy modes and remote-boundary consent.

Use proven implementations for:

- Image codecs and file-format standards.
- ZIP and archive formats.
- Cryptography and hashing primitives.
- Authentication, database access, graph interaction, schemas, and UI primitives.

Never implement JPEG, PNG, WebP, AVIF, HEIC, or another mature codec from scratch. Build a focused
custom transform only after a documented requirement and benchmark show that existing options fail.

For heavy processing:

- Validate signatures, dimensions, and predicted allocation before decode.
- Execute away from React rendering and the main thread.
- Bound work by memory as well as CPU.
- Support cancellation and controlled cleanup.
- Lazy-load expensive codecs.
- Add SIMD, worker pools, OPFS, WebGPU, or native code only after measurement.

## Add Adapters Selectively

Create a local adapter when at least one condition holds:

- The external API is unstable or awkward.
- The feature needs a smaller, safer contract.
- Tests need a deterministic boundary around browser I/O.
- Two implementations exist or an approved second implementation is imminent.

Do not create interfaces for ordinary React components, single pure helpers, or hypothetical future
providers. One concrete implementation does not automatically require a factory or repository class.

## Enforce Decision Gates

### Package or monorepo

Stay in the single application unless a second independently shipped consumer exists, the shared
contract is stable, and source sharing is no longer practical. An imagined SDK, CLI, desktop app, or
cloud worker is not a second consumer.

### Dependency

Before adding one, check the platform and installed dependencies. Add it only when it has a compatible
licence, credible maintenance, acceptable client cost, and a clear advantage over a small local
implementation. Do not write a local replacement for a difficult standard merely to avoid a package.

### Browser automation

Use focused unit and fixture tests first. Add Playwright or another browser suite only when a critical
file API, offline path, interaction, or browser-specific regression cannot be verified reliably and
cheaply another way.

### Accounts and cloud

Keep local anonymous use complete. Do not connect Better Auth, build synchronization, or add cloud
job infrastructure until the approved milestone requires it. Never upload image data without visible,
job-specific consent covering scope, quota or cost, retention, and deletion.

## Protect Product Guarantees

Never simplify away:

- Input validation for untrusted images.
- Allocation and concurrency limits.
- Cancellation and cleanup.
- Metadata and transparency warnings.
- Accessibility basics and reduced motion.
- The exclusion of file content, names, paths, metadata, thumbnails, and linked identifiers from
  analytics.
- Airgap and Private Session enforcement.

Feature richness is welcome. Speculative architecture is not.

## Review Architecture Changes

When reviewing a plan or diff, look for:

- Processing embedded in React components or routes.
- Feature internals scattered across shared folders.
- Abstractions with one trivial implementation and no volatility.
- Packages or public contracts created for imagined reuse.
- Fake execution state disconnected from worker events.
- Unbounded image allocations, concurrency, retries, or search.
- Silent metadata loss, transparency loss, analytics leakage, or remote processing.
- A mature standard being reimplemented without a compelling requirement.
- Later-milestone infrastructure mixed into the current vertical slice.

Lead with concrete file and runtime evidence. Recommend the smallest root-boundary correction.

## Handoff

State:

- The completed user-visible slice.
- The owning feature and any intentional shared boundary.
- Validation performed.
- Deferred architecture or features and the trigger for adding them.

Keep the handoff short unless the user requests a detailed report.
