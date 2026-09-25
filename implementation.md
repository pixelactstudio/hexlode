# Hexlode implementation plan

> Updated: 2026-09-26
> Product: [idea.md](./idea.md). Vocabulary: [CONTEXT.md](./CONTEXT.md). Decisions: [docs/adr/](./docs/adr/).

## Goal

Version 1 is the complete local product: the home page, four quick tools, pipeline tools, and the
Studio with all 33 nodes from the catalogue in [idea.md](./idea.md). It ships in three phases. Phase 1
builds the whole application and node batch 1. Phases 2 and 3 only add node batches 2 and 3. Each
phase is deployable and passes its exit gate before the next phase starts.

Active phase: **Phase 1**.

## Phase 1: the application and node batch 1

### Cleanup

1. Remove the old canvas UI, recipe dialog, privacy modes (Private Session and Airgap), Codec
   Tournament, macro presets and debugger.
2. Keep code that fits the new engine: input validation, the worker message protocol, the serial
   batch queue and streaming ZIP output. Move each piece into the new layout when the engine
   needs it.
3. Remove the MCP demo (`src/routes/mcp.ts`, `src/mcp-todos.ts`, `src/utils/mcp-handler.ts`).
4. Keep Drizzle and Better Auth compiling and unused
   ([ADR 0006](./docs/adr/0006-dormant-database-and-accounts.md)).

### Foundation

5. Replace `node:test` with Vitest, with browser mode on Playwright Chromium for worker, OPFS and
   codec tests.
6. Set up PostHog and Sentry as described in Analytics below, and add the privacy page.
7. Add a Dockerfile and deploy on Dokploy.

### Engine

8. Pipeline model, node definitions with accepts and produces, compatibility checks, worker pool,
   cancellation and estimates.
9. jSquash codecs, loaded per format on first use.
10. Step cache in OPFS with the 5 GB budget, and incremental runs.
11. Output storage in OPFS and ZIP or folder delivery.
12. Live previews on a sample image.

### Application

13. Home page and the four quick tools.
14. Studio: sidebar with every node category, drag and search, inspector, template picker, live
    previews, run statistics on nodes and connections, undo and redo, narrow-screen message.
15. Save in browser storage, `.hexlode` export and import, pipeline tools.

### Node batch 1

16. Files, Filter, Inspect, Resize, Crop, Rotate / Flip, Strip metadata, Convert, Compress to size,
    Optimize PNG, Rename, Output, Compare.

A template appears in the template picker once all its nodes exist. Phase 1 ships Web-ready photos
and Blank.

### Exit gate

- The app starts from a fresh clone with no `.env.local`.
- Every quick tool and template runs on real JPEG, PNG, WebP, AVIF, JPEG XL and QOI fixtures.
- A batch of 500 generated 12-megapixel images completes without memory growing with batch size.
- Changing a node's setting and running again executes only that node and the nodes after it.
- A `.hexlode` file round-trips without changes.
- The node pair matrix passes (see Testing).
- `pnpm validate` passes and the app runs in the Docker image.

## Phase 2: node batch 2

Auto-trim, Pad / Extend, Pixel-art upscale, Split / Tile, Adjust, Filters, Sharpen / Blur,
Background, Text watermark, Image watermark, Border / Rounded corners, Deduplicate. Adds the
Watermark and compress and Instagram carousel templates.

Exit gate: each node has output tests on real fixtures, the node pair matrix passes with the new
nodes, and the new templates run end to end.

## Phase 3: node batch 3

Best format, Responsive set, Favicon / App icons, Placeholder, Palette, Contact sheet, Images to
PDF, Set copyright / author. Adds the Responsive image set template.

Exit gate: same as phase 2, plus tests for nodes that change the item count (one image to many,
many images to one) and nodes that produce data or documents.

## Engine design

- A pipeline is a directed graph without cycles. Items flow through it one by one, so an item can
  reach the last node while later items are still at the first node.
- Nodes that combine items (Contact sheet, Images to PDF, near-duplicate Deduplicate) wait until
  every upstream item has arrived.
- Decoding happens once, when an item enters. Nodes pass pixels between them. Encoding happens at
  Convert, Compress to size and Optimize PNG. An image that reaches Output without an encoding node
  keeps its source format.
- Items carry their metadata. Encoders write it back where the format supports it. Strip metadata is
  the only node that removes metadata; when an encoder cannot keep metadata, the run reports a
  warning.
- A worker pool runs the tasks. The pool size depends on CPU cores and the memory estimate of the
  largest item in flight.
- An item a node cannot accept skips that branch
  ([ADR 0003](./docs/adr/0003-items-skip-branches-they-cannot-enter.md)).
- The step cache stores each node's last results in OPFS. The cache key combines the node's settings
  and the cache keys of its inputs, so a settings change invalidates that node and every node after
  it ([ADR 0004](./docs/adr/0004-opfs-for-outputs-and-step-cache.md)).
- The step cache has a 5 GB budget by default, which the user can change in settings. When it is
  full, the least recently used results are deleted. A node whose results were deleted runs again
  from the nearest earlier node that still has a step cache, and the estimate includes that work.
- The engine is plain TypeScript with no React. The UI subscribes to engine events.

## Testing

We write tests first, using the `tdd` skill. A test must fail when the behaviour it covers is
removed.

- Node tests decode the file the node produces and check format, dimensions, sample pixel values
  and metadata.
- Fixtures are small files in the repository, generated or with a licence that allows it, covering
  every input format, transparency, EXIF orientation, location metadata and a malformed file.
- The node pair matrix connects every pair of node types and checks that the Studio's accept or
  refuse decision matches what the engine does when it runs that pair.
- Worker, OPFS, codec and ZIP tests run in real Chromium through Vitest browser mode.
- `pnpm validate` passes before every commit.

## Analytics

- PostHog uses `cookieless_mode: 'always'` and `person_profiles: 'never'`, with IP capture, session
  replay and autocapture turned off. The app sends its own events from one analytics module
  ([ADR 0005](./docs/adr/0005-cookieless-explicit-analytics.md)).
- Sentry sends errors with `sendDefaultPii: false` and no replay. File names are removed from error
  messages before sending.

## Deployment

The app runs as one Docker container that serves the Nitro build. Dokploy on the maintainer's VPS
builds the Dockerfile and handles the domain and HTTPS. A future cloud mode adds a Postgres
container next to it.
