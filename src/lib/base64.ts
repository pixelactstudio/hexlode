/** Base64 for bytes kept in settings and text, such as a watermark logo. */

const CHUNK = 0x8000

export function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (let at = 0; at < bytes.length; at += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(at, at + CHUNK))
  }
  return btoa(binary)
}

export function base64ToBytes(text: string) {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

/** Base64 with `-` and `_` and no padding, safe in links without escaping. */
export function bytesToBase64Url(bytes: Uint8Array) {
  return bytesToBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export function base64UrlToBytes(text: string) {
  const base64 = text.replaceAll('-', '+').replaceAll('_', '/')
  return base64ToBytes(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
}
