# Hexlode product

> Updated: 2026-09-26 (Phase 1 build)
> Delivery plan: [implementation.md](./implementation.md). Vocabulary: [CONTEXT.md](./CONTEXT.md).
> Decisions and their reasons: [docs/adr/](./docs/adr/).

## Summary

Hexlode is an open-source image-processing app that runs in the browser. It has two levels:

- Quick tools do one common job on a simple page: drop images, pick settings, download.
- The Studio is a node editor for batch work. Users drag nodes onto a canvas, connect them into
  branching pipelines, run hundreds of images through them, and save the pipeline for reuse.

Version 1 processes everything on the user's device. A signed-in cloud mode with credits may come
later. The project is open source first: someone who finds the repository should be able to clone
it, run `pnpm install` and `pnpm dev`, and use it.

## Users

Anyone who converts, compresses or resizes images, and people who repeat the same image work on
large batches: photographers, web developers, designers, shop owners and content creators.

## Home page

The home page shows the name and five text links: Convert, Compress, Resize, Strip metadata and
Studio. It has no hero section, marketing copy or feature grid. Saved pipeline tools appear under
the five links once the user has some.

## Quick tools

| Tool | Job |
|---|---|
| Convert | Change format: JPEG, PNG, WebP, AVIF, JPEG XL or QOI. |
| Compress | Reduce file size by quality setting or by target size. |
| Resize | Change dimensions by width, height, percent or longest edge. |
| Strip metadata | Remove all metadata, only location data, or everything except copyright. |

Each quick tool is a fixed pipeline that runs on the same engine as the Studio. A quick tool page
has a drop area, the settings for that job, a results list with before and after sizes, and a
download button. A single result downloads as the file itself; several download as a ZIP.
Compress by quality never returns a file larger than the original.

A pipeline tool is a saved Studio pipeline opened as a quick tool page. The user builds the
pipeline once, then drops new images into the simple page whenever they need it.

## Studio

The Studio is for desktop screens. Phones and narrow windows get a message that points them to the
quick tools.

### Layout

- A sidebar lists every node type by category. The user drags a node onto the canvas or searches
  for it by name.
- The canvas holds the pipeline. Any output can connect to several nodes, so a pipeline branches
  like a tree.
- An inspector panel shows the full settings of the selected node.
- A new Studio opens a template picker: Web-ready photos, Responsive image set, Watermark and
  compress, Instagram carousel, and Blank.

### What the canvas shows

The canvas shows real engine data so the user can see the work happening:

- Each node shows a live preview thumbnail of its output for a sample image the user picks; the
  first image added is the sample until the user picks another. Previews run on a copy scaled to
  1024 pixels. The preview updates when a setting changes. The full batch runs only when the user
  presses Run.
- During a run, each node shows counts (processed, skipped, failed), bytes in and out, and time.
- Connections animate while items flow and carry small labels: item count, formats such as
  "PNG only", and size saved.
- The React Flow attribution is hidden.

### Compatibility rules

Each node declares which items it accepts and which it produces. The Studio uses these
declarations to keep pipelines valid:

- A connection is refused when the upstream node can never produce anything the downstream node
  accepts. The message says why and suggests a fix, for example "Optimize PNG needs PNG images.
  Add Convert to PNG before it."
- A connection that narrows the stream is allowed. The connection gets a label such as "PNG only"
  and a toast explains that other formats skip this branch.
- The Files node accepts every format that at least one branch can handle. It refuses files that
  no branch can use and says which formats the pipeline accepts.
- During a run, an item that a node cannot accept skips that branch and continues through the
  other branches. Skips are counted and shown separately from failures.

### Runs

- A run processes items on the device in Web Workers. The interface stays responsive.
- Before a run the Studio shows an estimate, for example "about 2,000 encodes, roughly 12 minutes
  on this device".
- There is no limit on the number of files. Single images that are too large to decode safely are
  refused with a clear reason.
- Each node keeps a step cache of its last results. When the user changes a setting and runs
  again, only that node and the nodes after it run.
- The user can cancel a run. Items already finished stay available.

### Output nodes

An Output node saves every item that reaches it into browser file storage and passes the same item
on to the next nodes at the same moment. Output never slows the pipeline. When the last item
arrives, Output builds a ZIP from storage and shows a Download button. An Auto-download switch on
the node downloads the ZIP as soon as it is ready; it is off by default. A pipeline can have
several Output nodes, and each delivers on its own. Output can also save straight into a folder in
browsers that allow it.

## Node catalogue

Items are images, data (JSON or text) or documents (PDF). Batch numbers match the phases in
[implementation.md](./implementation.md).

### Input and routing

| Node | What it does | Batch |
|---|---|---|
| Files | Takes dropped files or a folder. Starts every pipeline. | 1 |
| Filter | Routes items by rules on format, file size, dimensions, orientation or transparency. Each rule has its own output, plus an output for everything else. An item leaves by the first rule it matches. | 1 |
| Inspect | Shows format, dimensions, size and metadata per item. Passes items through unchanged. | 1 |
| Deduplicate | Drops exact duplicates, or near duplicates by image fingerprint. | 2 |

### Size and shape

| Node | What it does | Batch |
|---|---|---|
| Resize | Resizes by width, height, percent or longest edge, with fit, fill or exact modes and a choice of resampling method. | 1 |
| Crop | Crops to an aspect preset (1:1, 4:5, 16:9 and others), from the centre or a chosen position. Turns the image upright first. | 1 |
| Rotate / Flip | Rotates and flips, including automatic rotation from the camera orientation tag. | 1 |
| Auto-trim | Removes plain-colour or transparent borders. | 2 |
| Pad / Extend | Adds space to reach an aspect ratio, filled with a colour or a blurred copy of the image. | 2 |
| Pixel-art upscale | Enlarges pixel art 2x to 4x with sharp edges. | 2 |
| Split / Tile | Cuts one image into a grid of images. | 2 |

### Colour and look

| Node | What it does | Batch |
|---|---|---|
| Adjust | Changes brightness, contrast, saturation and exposure. | 2 |
| Filters | Applies grayscale, sepia, duotone or invert. | 2 |
| Sharpen / Blur | Sharpens, or blurs the whole image or a region. | 2 |
| Background | Replaces transparency with a colour. | 2 |

### Overlays

| Node | What it does | Batch |
|---|---|---|
| Text watermark | Places text with position, size, opacity and an optional repeated tile. | 2 |
| Image watermark | Places a logo (PNG, WebP or SVG) with position, scale and opacity. | 2 |
| Border / Rounded corners | Adds a frame or rounds the corners. | 2 |

### Metadata

| Node | What it does | Batch |
|---|---|---|
| Strip metadata | Removes all metadata, only location data, or everything except copyright, without re-encoding. Keeps the colour profile unless told otherwise, and keeps a camera orientation tag so photos stay upright. | 1 |
| Set copyright / author | Writes author and copyright fields. | 3 |

### Output and encoding

| Node | What it does | Batch |
|---|---|---|
| Convert | Encodes to WebP, AVIF, JPEG, JPEG XL, PNG or QOI with the encoder's real settings, or keeps each item's format. | 1 |
| Compress to size | Finds the highest quality that fits a target size such as 200 KB. | 1 |
| Optimize PNG | Makes PNG files smaller without changing pixels. | 1 |
| Rename | Names files from a template such as `{name}-{width}w`. The extension follows the format. Output numbers duplicate names. | 1 |
| Output | Saves items, passes them on, and delivers a ZIP or folder. | 1 |
| Compare | Shows a before and after slider and the size difference. Passes items through. | 1 |
| Best format | Encodes several formats and keeps the smallest. | 3 |
| Responsive set | Makes several widths and a ready `srcset` HTML snippet. | 3 |
| Favicon / App icons | Makes every favicon and app icon size from one image. | 3 |
| Placeholder | Generates a tiny blurred preview code for websites. | 3 |
| Palette | Extracts the main colours as JSON or CSS variables. | 3 |
| Contact sheet | Combines many images into one grid image. | 3 |
| Images to PDF | Combines images into one PDF. | 3 |

## Saving and sharing pipelines

- Clicking Save stores the pipeline in the browser. The save dialog always shows one line: "Saved in
  this browser only. Clearing site data deletes it; export a .hexlode file to keep a backup."
- Nothing is stored in the browser until the user clicks Save or starts a run.
- A pipeline exports to and imports from a `.hexlode` file. The file is versioned JSON, and older
  versions are migrated on import.

## Analytics

Analytics are always on and store nothing in the browser, so the app needs no cookie banner.
Hexlode records detailed product events: runs, image counts, successes, skips, failures with reasons,
timings, the quick tools used, and the shape and settings of pipelines. Analytics never include
file names, paths, pixels, image metadata or text the user types. The app has a short privacy page
that lists what it collects.

## Cloud (after version 1)

A signed-in cloud mode may later run large jobs on a server, keep running after the browser closes,
and use a credit system. Local processing stays free and unlimited. The database and account code
in the repository waits for this work.

## Out of scope for version 1

- Accounts, sign-in, cloud processing and billing.
- HEIC input, animated images and colour-profile conversion.
- Dither and retro effects.
- The Studio on phones.
