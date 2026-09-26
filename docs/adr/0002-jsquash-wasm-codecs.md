# jSquash WebAssembly codecs instead of browser encoders

We encode and decode with the jSquash packages (MozJPEG, libwebp, libavif, libjxl, oxipng, QOI)
compiled to WebAssembly, not with `OffscreenCanvas.convertToBlob`. The browser encoders give one
quality setting, cannot write AVIF or JPEG XL, and produce different bytes in each browser, and
Safari cannot write WebP. jSquash is Apache-2.0 and its codecs use permissive licences.

## Consequences

- Each codec downloads on first use, so pages load only the codecs they need.
- Our distribution keeps the jSquash licence and notice files.
- We do not use libimagequant, which is GPL. Colour reduction, if needed, uses our own code or a
  permissively licensed library.
