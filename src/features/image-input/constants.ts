/** Files larger than this are refused before they are read. */
export const MAX_INPUT_MEGABYTES = 256
export const MAX_INPUT_BYTES = MAX_INPUT_MEGABYTES * 1024 * 1024
/** Decoded RGBA must fit comfortably in one WebAssembly memory next to an encoder. */
export const MAX_DECODE_BYTES = 400 * 1024 * 1024
export const MAX_IMAGE_DIMENSION = 16_383
/** Bytes read from each file to find its format and dimensions. */
export const HEADER_READ_BYTES = 512 * 1024
