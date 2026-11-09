# HEIC is decoded with libheif in WebAssembly and never written

HEIC and HEIF photos, the iPhone default, open wherever other images do. We decode them with
libheif and its libde265 HEVC decoder, compiled to WebAssembly by `libheif-js`, loaded in the
workers the first time a HEIC image needs pixels, like the jSquash codecs
([ADR 0002](./0002-jsquash-wasm-codecs.md)). Hexlode serves the loader (88 KB) and the `.wasm`
(1.46 MB, 490 KB compressed) itself, as files of their own. It never encodes HEIC: a HEIC image
whose pixels changed and that reaches Output, or Convert or Responsive set kept at their own
format, is saved as JPEG, or as PNG when it has transparency, and the run warns. Compress to size
makes it JPEG, since a target size needs a lossy format. A HEIC image whose pixels did not change
keeps its original bytes, and Strip metadata and Set copyright edit its metadata in place.

## Considered options

- **`libheif-js` (chosen).** It follows libheif releases (1.23.5, October 2026), gives raw RGBA
  pixels of the primary image, and ships the `.wasm` beside its loader, so the browser compiles it
  while it downloads. Its build compiles synchronously unless handed a module, so we compile it
  first and instantiate it inside the loader's call.
- **`heic-to`.** The same libheif, also maintained, but it returns canvas blobs or bitmaps and
  inlines the WebAssembly as base64 in multi-megabyte bundles.
- **`heic2any`, `elheif`, `@saschazar/wasm-heif`.** Older libheif builds, unmaintained since 2021
  to 2024; `heic2any` also decodes on the main thread.
- **`heic-decode`.** A thin wrapper over the inlined `libheif-js` bundle; it adds nothing we need.
- **Safari's own decoder through `createImageBitmap`.** Only Safari has one, and it would make
  pixels differ by browser. Left out; it could later skip the download there.
- **Writing HEIC.** It needs an HEVC encoder such as x265 (GPL) and carries the patent question
  below for encoding as well. Out of scope.

## Orientation

HEIF stores rotation, mirroring and cropping as `irot`, `imir` and `clap` properties of the image,
and libheif applies them, so decoded pixels are upright and the header reader reports the size
after them. Phones also write the EXIF orientation tag, which HEIF readers ignore. Reading HEIC
metadata sets that tag to 1, changing only its value, so a HEIC item has orientation 1, Rotate's
auto mode and Crop leave the rotation alone, and other formats get an upright tag.

## Metadata

EXIF and XMP live in items of the `meta` box, as in AVIF, and the colour profile in the primary
image's `colr` property. One HEIF module reads both formats; AVIF now carries its colour profile
too. Edits happen in place: removing and shrinking work, adding does not, and the run reports what
could not be kept. The colour profile describes the coded image, so it stays in the file even when
Strip metadata is told to remove it; other formats get it, so colours do not shift.

## Consequences

- **Licence.** libheif and libde265 are LGPL-3.0. They stay separately loaded files, and
  `/licenses/jsquash.txt` holds their licence and links to the source of the exact versions. That
  source lives upstream on GitHub; if it ever disappears, Hexlode must host it.
- **Patents.** HEVC is covered by patents licensed through pools such as Access Advance and Via LA,
  and their terms can cover software decoders a product distributes. Browsers avoid shipping their
  own HEVC decoder for this reason. Hexlode sends libde265 to every visitor who opens a HEIC
  photo, free and without encoding. This is a risk the maintainer accepts or rejects; removing
  HEIC means dropping the decoder and the `heic` format, nothing else depends on them.
- Only the primary image is decoded. Thumbnails, bursts, depth maps and HDR gain maps are not,
  and images with more than 8 bits per channel come out at 8.
- Decoding is slow next to other formats, about 70 ms per megapixel, which the estimate counts.
