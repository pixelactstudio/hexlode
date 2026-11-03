/** Colours in node settings: `#rrggbb`, or `#rrggbbaa` with an alpha byte. */

export type Rgba = [red: number, green: number, blue: number, alpha: number]

export const HEX_COLOUR = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i

export function rgbaOf(hex: string): Rgba {
  if (!HEX_COLOUR.test(hex)) throw new Error(`${hex} is not a colour.`)
  const byte = (at: number) => Number.parseInt(hex.slice(at, at + 2), 16)
  return [byte(1), byte(3), byte(5), hex.length === 9 ? byte(7) : 255]
}

export function hexOf(red: number, green: number, blue: number) {
  return `#${[red, green, blue].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`
}

/** Relative luminance weights of sRGB (Rec. 709), applied to the stored values. */
export function lumaOf(red: number, green: number, blue: number) {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}
