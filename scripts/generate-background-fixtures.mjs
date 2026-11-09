/**
 * Makes the fixtures of the background removal quality suite in
 * src/features/background-removal/__tests__/fixtures: cut-out photos with a real transparent
 * background, composited onto photos of rooms and streets. Because the cut-out's own transparency
 * says exactly where the subject is, each composite comes with a reference mask, and with the
 * subject on white for checking edges. Every source is public domain or CC0 on Wikimedia Commons;
 * SOURCES.md lists them. The script checks each download against the SHA-1 Commons publishes.
 *
 * Run with `node scripts/generate-background-fixtures.mjs`. It needs the network.
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'src/features/background-removal/__tests__/fixtures')
const wasm = async (path) => WebAssembly.compile(await readFile(join(root, 'node_modules', path)))
const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons/'
const USER_AGENT = 'hexlode-fixtures/1.0 (https://github.com/pixelactstudio/hexlode)'

globalThis.ImageData ??= class ImageData {
  constructor(data, width, height) {
    this.data = data
    this.width = width
    this.height = height
  }
}

/** Originals on Wikimedia Commons, with the SHA-1 Commons publishes for each. */
const SOURCES = {
  emac: ['c/c3/Apple-eMac-FL_%28transparent%29.png', '6ba6a6ba520df965c6a4194d4c1105cdebce8451'],
  daruma: [
    '6/69/Daruma0791_with_transparent_background.png',
    '234b59015aefb5772e207cd9a94151afc75331b9',
  ],
  luggage: ['8/8f/Luggage-2708806_960_720.png', 'abbddb5c534326a397fd1c03f6d635b6439a33a5'],
  cat: ['e/e6/Cat_Stretch.png', '794338aacf9ba2730ac1bd4ae7e0636b3629743d'],
  woman: [
    '0/0a/Woman_in_White_Sleeveless_Dress_Sitting_on_Gray_Concrete_Seat_during_Daytime_transparent.png',
    '5000377aa4f089ae3de267438467009307358844',
  ],
  apartment: ['9/98/Apartment-1851201_960_720.jpg', '9831ac7c3c95c4f2c7518f1421a59d1e6563e9f4'],
  street: ['2/2b/Oxford-182705_960_720.jpg', '6b93b96cf0c18aa607e0fe6d47e1fb15108d1360'],
}

const WIDTH = 512
const HEIGHT = 342
const MARGIN = 5

/** Subject, background, subject height in percent of the picture, and offset from the centre. */
const FIXTURES = [
  ['emac', 'apartment', 80, 40],
  ['daruma', 'street', 85, -53],
  ['luggage', 'apartment', 60, -67],
  ['cat', 'street', 80, -140],
  ['woman', 'apartment', 95, -40],
]

const pngDecode = await import('@jsquash/png/decode.js')
await pngDecode.init(await wasm('@jsquash/png/codec/pkg/squoosh_png_bg.wasm'))
const pngEncode = await import('@jsquash/png/encode.js')
await pngEncode.init(await wasm('@jsquash/png/codec/pkg/squoosh_png_bg.wasm'))
const jpegDecode = await import('@jsquash/jpeg/decode.js')
await jpegDecode.init(await wasm('@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm'))
const jpegEncode = await import('@jsquash/jpeg/encode.js')
await jpegEncode.init(await wasm('@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm'))
const resizer = await import('@jsquash/resize')
await resizer.initResize(await wasm('@jsquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm'))

async function download(name) {
  const [path, sha1] = SOURCES[name]
  const response = await fetch(COMMONS + path, { headers: { 'user-agent': USER_AGENT } })
  if (!response.ok) throw new Error(`${name}: ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const actual = createHash('sha1').update(bytes).digest('hex')
  if (actual !== sha1) throw new Error(`${name}: SHA-1 ${actual}, expected ${sha1}`)
  return path.endsWith('.png') ? pngDecode.default(bytes.buffer) : jpegDecode.default(bytes.buffer)
}

const resize = (image, width, height) =>
  resizer.default(image, { width, height, method: 'lanczos3', premultiply: true, linearRGB: false })

/** Scales the background to cover the picture and keeps its middle. */
async function cover(image) {
  const scale = Math.max(WIDTH / image.width, HEIGHT / image.height)
  const scaled = await resize(
    image,
    Math.ceil(image.width * scale),
    Math.ceil(image.height * scale),
  )
  const left = Math.floor((scaled.width - WIDTH) / 2)
  const top = Math.floor((scaled.height - HEIGHT) / 2)
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4)
  for (let y = 0; y < HEIGHT; y += 1) {
    const start = ((y + top) * scaled.width + left) * 4
    data.set(scaled.data.subarray(start, start + WIDTH * 4), y * WIDTH * 4)
  }
  return new ImageData(data, WIDTH, HEIGHT)
}

const jpeg = (image) =>
  jpegEncode.default(image, { quality: 88, progressive: false, chroma_subsample: 2 })

for (const [name, background, percent, offset] of FIXTURES) {
  const subject = await download(name)
  const scene = await cover(await download(background))
  const height = Math.round((HEIGHT * percent) / 100)
  const width = Math.round((subject.width * height) / subject.height)
  const cutOut = await resize(subject, width, height)
  const left = Math.round((WIDTH - width) / 2 + offset)
  const top = HEIGHT - height - MARGIN
  const photo = new Uint8ClampedArray(scene.data)
  const onWhite = new Uint8ClampedArray(WIDTH * HEIGHT * 4).fill(255)
  const mask = new Uint8ClampedArray(WIDTH * HEIGHT * 4)
  for (let index = 3; index < mask.length; index += 4) mask[index] = 255
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const px = x + left
      const py = y + top
      if (px < 0 || py < 0 || px >= WIDTH || py >= HEIGHT) continue
      const from = (y * width + x) * 4
      const to = (py * WIDTH + px) * 4
      const alpha = cutOut.data[from + 3] / 255
      for (let channel = 0; channel < 3; channel += 1) {
        const colour = cutOut.data[from + channel]
        photo[to + channel] = colour * alpha + photo[to + channel] * (1 - alpha)
        onWhite[to + channel] = colour * alpha + 255 * (1 - alpha)
        mask[to + channel] = cutOut.data[from + 3]
      }
    }
  }
  await writeFile(
    join(out, `${name}.jpg`),
    new Uint8Array(await jpeg(new ImageData(photo, WIDTH, HEIGHT))),
  )
  await writeFile(
    join(out, `${name}-white.jpg`),
    new Uint8Array(await jpeg(new ImageData(onWhite, WIDTH, HEIGHT))),
  )
  await writeFile(
    join(out, `${name}-mask.png`),
    new Uint8Array(await pngEncode.default(new ImageData(mask, WIDTH, HEIGHT))),
  )
  console.log(`Wrote ${name}`)
}
