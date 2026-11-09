/**
 * Writes src/features/background-removal/__tests__/fixtures/threshold.onnx, a tiny stand-in for
 * the background removal model with the same input and output: `input_image`, 1 × 3 × 512 × 512,
 * in; logits, 1 × 1 × 512 × 512, out. It averages the three normalised channels, so bright pixels
 * come out as the subject and dark ones as background. Tests run the real inference worker and
 * ONNX Runtime on it in milliseconds, offline.
 *
 * Run with `node scripts/generate-model-fixture.mjs`. The ONNX protobuf is written by hand here,
 * so the script needs no packages.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'src/features/background-removal/__tests__/fixtures/threshold.onnx')
const SIZE = 512
/** Logits are 10 × (mean of the normalised channels − 0.2): white is +22, black −22. */
const THRESHOLD = 0.2
const SCALE = 10

function varint(value) {
  const bytes = []
  let rest = BigInt(value)
  do {
    let byte = Number(rest & 0x7fn)
    rest >>= 7n
    if (rest > 0n) byte |= 0x80
    bytes.push(byte)
  } while (rest > 0n)
  return bytes
}

const key = (field, wireType) => varint((field << 3) | wireType)
const int = (field, value) => [...key(field, 0), ...varint(value)]
const bytes = (field, data) => [...key(field, 2), ...varint(data.length), ...data]
const text = (field, value) => bytes(field, [...new TextEncoder().encode(value)])

function floats(field, values) {
  const data = new Uint8Array(values.length * 4)
  const view = new DataView(data.buffer)
  for (const [index, value] of values.entries()) view.setFloat32(index * 4, value, true)
  return bytes(field, [...data])
}

/** TensorProto: a float scalar. */
const scalar = (name, value) => [...int(2, 1), ...floats(4, [value]), ...text(8, name)]

/** ValueInfoProto: a float tensor of a fixed shape. */
function valueInfo(name, shape) {
  const dims = shape.flatMap((size) => bytes(1, int(1, size)))
  const tensorType = [...int(1, 1), ...bytes(2, dims)]
  return [...text(1, name), ...bytes(2, bytes(1, tensorType))]
}

function node(opType, inputs, outputs, attributes = []) {
  return [
    ...inputs.flatMap((input) => text(1, input)),
    ...outputs.flatMap((output) => text(2, output)),
    ...text(3, `${opType}_0`),
    ...text(4, opType),
    ...attributes.flatMap((attribute) => bytes(5, attribute)),
  ]
}

/** AttributeProto: a list of integers (type INTS). */
const ints = (name, values) => [
  ...text(1, name),
  ...values.flatMap((v) => int(8, v)),
  ...int(20, 7),
]
/** AttributeProto: an integer (type INT). */
const integer = (name, value) => [...text(1, name), ...int(3, value), ...int(20, 2)]

const graph = [
  ...bytes(
    1,
    node('ReduceMean', ['input_image'], ['mean'], [ints('axes', [1]), integer('keepdims', 1)]),
  ),
  ...bytes(1, node('Sub', ['mean', 'threshold'], ['centred'])),
  ...bytes(1, node('Mul', ['centred', 'scale'], ['logits'])),
  ...text(2, 'threshold'),
  ...bytes(5, scalar('threshold', THRESHOLD)),
  ...bytes(5, scalar('scale', SCALE)),
  ...bytes(11, valueInfo('input_image', [1, 3, SIZE, SIZE])),
  ...bytes(12, valueInfo('logits', [1, 1, SIZE, SIZE])),
]

const model = [
  ...int(1, 7),
  ...text(2, 'hexlode-tests'),
  ...bytes(7, graph),
  ...bytes(8, int(2, 13)),
]

await mkdir(dirname(out), { recursive: true })
await writeFile(out, Uint8Array.from(model))
console.log(`Wrote ${out} (${model.length} bytes)`)
