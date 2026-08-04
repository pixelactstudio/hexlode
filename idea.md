# Hexlode — Product Brief

> Status: Working product direction
> Updated: 2026-08-05
> Companion plan: [implementation.md](./implementation.md)

## 1. Product Summary

Hexlode is a visual image-processing application with local and optional server execution. Users
connect nodes to build a reusable workflow, run images through it, compare the results, and save the
workflow for later.

The central promise is:

> Build an image-processing recipe once. Drop new images into it whenever you need it.

Hexlode begins as a focused side project and open-source community tool. It should remain useful
without an account and work locally by default, while the full product may offer signed-in server
processing for larger or longer jobs.

## 2. Why It Should Exist

Existing image tools usually trade away one of the things users care about:

- Simple web converters often upload files to a server.
- Private browser tools tend to support one file and one operation at a time.
- Powerful desktop tools require installation and are cumbersome for repeatable jobs.
- Node-based tools often use the graph as decoration rather than representing real computation.

Hexlode combines local processing with reusable visual workflows. Its retention loop is:

1. Open a working starter pipeline.
2. Drop in an image and receive a result immediately.
3. Branch or adjust the pipeline and compare outputs.
4. Save the result as a reusable recipe.
5. Return with a new image or batch.

## 3. Positioning

Primary positioning:

> A local-first visual workspace for converting, inspecting, optimizing, and comparing images.

Supporting promise:

> No account required. Process on your device by default. Use cloud processing only when you
> explicitly choose it.

The application should feel like a creative technical instrument, not a collection of unrelated
converter pages.

## 4. Product Principles

### 4.1 The canvas is the product

The node canvas is the main interface. Documentation, settings, saved recipes, and account pages
support it; they do not replace it.

### 4.2 Never start empty

The first visit opens a working pipeline:

```text
Files -> Inspect -> Resize -> WebP -> Compare -> Download
```

A new user should get an output without first learning the graph editor.

### 4.3 Local-first is the default

Anonymous users can run the full local workflow. Image bytes, filenames, thumbnails, metadata, and
file-linked hashes must not enter analytics or backend services during local processing.

### 4.4 Cloud processing is explicit

Cloud processing may provide the full product with more power for very large batches, long-running
jobs, or expensive operations, but it is never a silent fallback. Before a remote job begins, the
user must see what will be uploaded, why, expected cost or quota use, retention, and deletion
behavior. A server job may continue after the browser closes.

### 4.5 Simple by default, deep by choice

Nodes expose safe defaults first. Advanced codec, metadata, and quality controls belong in an
inspector rather than crowding every node.

### 4.6 Feature-rich does not mean over-engineered

Hexlode stays one application. Product logic is organized by feature inside `src/`; it is not split
into packages merely because it may be reusable someday.

### 4.7 Own the product logic, not industry standards

Hexlode should own its graph validation, execution planning, batch policy, comparison experience,
constraint search, recipe model, and privacy controls. It should use mature libraries for image
codecs, archives, cryptography, authentication, databases, and other difficult standards.

We will not rewrite JPEG, PNG, WebP, AVIF, HEIC, or similar codecs from scratch. A focused custom
transform is reasonable only when it provides a measured advantage and remains maintainable.

## 5. Privacy and Execution Modes

### 5.1 Private Session

- No account.
- No analytics.
- No cloud processing or remote integrations.
- No persistent recipes, history, or temporary outputs.
- Processing remains on the device.

This is the best mode for sensitive or one-off images.

### 5.2 Local Workspace

- Default mode; no account required.
- Processing remains on the device.
- Recipes, preferences, and lightweight run history are saved locally.
- Recipes can be imported and exported.
- The core workflow should remain usable offline after required assets are cached.

### 5.3 Airgap Mode

Private Session and Local Workspace can enable a visible Airgap Mode. It disables analytics, remote
inputs, cloud features, and optional integrations. The UI should make this enforcement clear rather
than relying on marketing copy.

### 5.4 Synced Workspace — later

An optional account may eventually synchronize recipes, macros, settings, and versions. Images and
their metadata stay local by default. Signing in must never become permission to use the core app.

### 5.5 Cloud Assist — opt-in full-product capability

Cloud processing is intended for workloads such as hundreds of images, slow experimental codecs,
or operations that would exhaust a device. It requires a signed-in workspace and supports durable
background jobs that continue after the browser closes.

- Each job requires an explicit remote-processing choice.
- A generous free allowance should cover ordinary community use.
- Any usage-based charges should remain inexpensive and recover real compute cost rather than create
  artificial product limits.
- Local processing must not be weakened to promote cloud usage.
- Failed retries must not silently extend retention or duplicate charges.

## 6. Core Experience

### 6.1 Canvas behavior

The editor should eventually support:

- Pan, zoom, selection, connection, deletion, and duplication.
- Undo and redo.
- Typed ports and visibly rejected invalid connections.
- Search or command-palette node insertion.
- Node configuration through an inspector panel.
- Real execution state on nodes and edges.
- Keyboard access for essential workflows.
- A simpler non-canvas representation when accessibility or narrow screens require it.

Advanced grouping, minimaps, auto-layout, macros, and rich edge animation should follow the working
pipeline rather than block it.

### 6.2 Runtime states

Nodes should share a small, consistent state model:

- Idle or waiting.
- Invalid.
- Ready or queued.
- Processing.
- Complete, warning, or failed.
- Cancelled.
- Cached or dirty after upstream changes.

Edges may show file count, bytes, savings, and active status when those values come from the real
execution engine.

### 6.3 Typed workflow data

Start with only the types required by implemented nodes:

- `Image`
- `ImageBatch`
- `Metadata`
- `Boolean`
- `Number`
- `String`
- `FileBundle`
- `ErrorBatch`

Add another type only when a real feature needs it.

## 7. Product Scope

### 7.1 First useful release

The first release should make one excellent local workflow reliable:

```text
Files -> Inspect -> Resize -> WebP -> Compare -> Download
```

Required capabilities:

- File selection and drag-and-drop.
- Input inspection and basic safety checks.
- Resize and orientation correction.
- WebP output with useful defaults.
- Before-and-after preview and file-size comparison.
- Progress, cancellation, controlled errors, and download.
- A starter graph that can be edited and saved locally.

### 7.2 Core expansion

Once the first pipeline is dependable, add features in response to actual workflows:

- JPEG and PNG output, then AVIF if the adapter proves reliable.
- Metadata inspection and selective removal, including GPS.
- Crop, rotate, transparency handling, and background behavior.
- Branching and filtering.
- Folder input, bounded batch processing, naming templates, and ZIP output.
- Recipe import, export, duplication, and run history.

HEIC input, animation, colour-profile conversion, and uncommon formats require separate correctness
and licensing decisions.

### 7.3 Signature features

These distinguish Hexlode, but they should build on proven processing primitives.

#### Codec Tournament

Run selected encoders and settings against the same input, then compare size, processing time,
quality, transparency, and compatibility. Users can pick a result or pass it to Select Best.

#### Constraint Solver

Let users specify an outcome such as “under 200 KB, at least 1600 px wide, preserve transparency.”
Search must be bounded, cancellable, deterministic for fixed inputs, and able to explain failure.

#### Visual Difference Lab

Provide side-by-side, slider, synchronized zoom, pixel difference, heatmap, and perceptual comparison
only as those primitives become trustworthy.

#### Macro Nodes

Allow a selected subgraph to become a named reusable node. Versioning and nested macros can wait
until simple local macros work reliably.

#### Pipeline Debugger

Show real inputs, outputs, durations, warnings, failed files, cache state, and invalidation reasons.
Do not display estimates as if they were observed runtime facts.

### 7.4 Experimental Labs

Potential Labs features include background removal, upscaling, OCR, redaction, smart crop, local ML,
GPU transforms, palette extraction, duplicate detection, dithering, and experimental codecs.

Labs features must be clearly labelled, disclose whether they are local or remote, and have a safe
fallback or a clear unsupported state.

## 8. Recipes and Local History

A recipe is versioned JSON describing nodes, connections, and settings. Visual positions should be
separable from execution meaning so layout changes do not alter results.

Recipes should support:

- Local save, duplicate, rename, import, and export.
- A schema version and migrations when the format changes.
- Small-file sharing without an account where practical.
- Run metadata such as settings, durations, output sizes, warnings, and engine versions.

Source image bytes should not be retained unless the user explicitly enables local caching.

## 9. Technical Direction

### 9.1 One repository, one application

Hexlode remains a standard TanStack Start application. Use a Bulletproof React-style feature layout
inside the existing repository:

```text
src/
  routes/                 Route definitions and composition
  features/
    canvas/               Graph editing and node presentation
    processing/           Planning, workers, codecs, progress, cancellation
    image-input/          File and folder acquisition and inspection
    recipes/              Recipe schema, persistence, import, and export
    comparison/           Preview and difference tools
    privacy/              Session mode, Airgap Mode, and remote-boundary UI
    cloud-processing/      Optional remote jobs, only when implemented
  components/             Truly shared application components
  integrations/           Framework and third-party providers
  lib/                    Small cross-feature utilities
  db/                     Drizzle schema and database access
```

Each feature should contain only the folders it needs, such as `components`, `hooks`, `schemas`,
`services`, `types`, or `utils`. Do not scaffold every folder in advance.

### 9.2 Separation without packages

React components edit and display the workflow. Processing, graph validation, recipe parsing, and
worker messages should remain plain TypeScript within their feature modules. That separation makes
the code testable without creating a monorepo or public SDK.

Extract a package only when an independently shipped second consumer actually exists and sharing
source directly is no longer workable.

### 9.3 Current stack

- TanStack Start, React 19, TypeScript, and Vite.
- React Flow for the canvas.
- Astryx and Tailwind for the interface.
- Web Workers for heavy browser work.
- Proven browser or WebAssembly codec libraries selected per format.
- IndexedDB for local structured persistence; OPFS only if large intermediates justify it.
- Drizzle and PostgreSQL for future account and cloud data.
- Better Auth for optional accounts when synchronization exists.
- PostHog and Sentry with privacy-safe configuration.

### 9.4 Processing rules

- Never process large images on the React render path.
- Validate file signatures, dimensions, and estimated allocations before decoding.
- Bound concurrency by memory pressure as well as CPU availability.
- Support progress and cancellation from the first real pipeline.
- Lazy-load expensive codecs.
- Prefer transferable buffers and release intermediates promptly.
- Add SIMD, multithreaded WebAssembly, OPFS, or WebGPU only after measurement.

## 10. Analytics, Security, and Accessibility

Analytics may record coarse product events such as a node being added or a pipeline completing. It
must not record file content, names, paths, metadata, thumbnails, or file-linked identifiers.
Analytics is disabled in Private Session and Airgap Mode.

Image inputs are untrusted. Dimension limits, allocation limits, malformed-file handling, codec
updates, and a restrictive processing boundary are core product requirements.

Essential controls need labels, visible focus, keyboard operation, sufficient contrast, and reduced
motion. Advanced canvas accessibility should grow alongside real editor functionality.

## 11. Explicit Non-Goals

Not planned for the initial product:

- A monorepo or internal package ecosystem.
- Public SDK, CLI, plugin SDK, or GitHub Action product.
- Reimplementing mature image codecs in JavaScript, Rust, C, or C++.
- Mandatory accounts, subscriptions, billing, or cloud processing.
- A desktop application or editor extension.
- A plugin marketplace or public recipe registry.
- Collaboration or organization management.
- A Photoshop replacement.
- Every image format and every browser capability at once.
- Browser automation suites before they solve a demonstrated regression risk.
- GPU or AI features without a measured product benefit.

These are not permanent prohibitions. They require proven demand and a clear maintenance case.

## 12. Success Criteria

Hexlode is succeeding when:

- A new visitor gets a useful output from the starter graph in minutes.
- Ordinary use works anonymously and locally.
- Users save and reuse recipes rather than rebuilding the same workflow.
- Batch jobs remain responsive and do not cause uncontrolled memory growth.
- Privacy and remote-processing boundaries are visible and technically enforced.
- New features fit the existing application without multiplying repositories or packages.

## 13. Open Decisions

- Final visual identity and public licence.
- First supported browser and mobile baseline.
- Exact initial JPEG, PNG, WebP, and AVIF implementations.
- Quality metric used by Codec Tournament and Constraint Solver.
- HEIC licensing and decoder choice.
- Local cache limits and retention defaults.
- When anonymous usage demonstrates a need for recipe sync or cloud batches.

## 14. North Star

> Drop -> experiment visually -> compare -> save the recipe -> reuse.

Build the smallest dependable version of that loop first. Add depth when it makes the loop better,
not because a future platform can be imagined.
