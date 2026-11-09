# On-device background removal with BiRefNet_lite, served by Hexlode

Remove background runs BiRefNet_lite (MIT) on the device, through ONNX Runtime Web (MIT), on
WebGPU where the browser has a usable adapter and on WebAssembly otherwise. The model is the
512 × 512 ONNX export `studioludens/birefnet-lite-512`, revision
`962e67969ec6acec9c19fab76acee4f5e22e990c`, file `onnx/model_fp16.onnx`: 98,484,532 bytes,
SHA-256 `eff9216bb2f9d3f023d9c2b7196845a7485739ab1f231593633e4d2344ffc516`. It is a conversion of
`ZhengPeng7/BiRefNet_lite`, and both carry the MIT licence, which allows commercial use and serving
the weights to browsers as long as the notice travels with them; the app ships it at
`/licenses/background-removal.txt` with ONNX Runtime's licence and third-party notices.

We chose it by running the candidates on composited photos with exact reference masks, one thread
of WebAssembly in Node:

| Model | Input | Size | Mean IoU | Worst IoU | Time per photo |
|---|---|---|---|---|---|
| BiRefNet_lite, fp16 | 512 | 94 MB | 0.955 | 0.854 | 12 to 17 s |
| ISNet general use, fp32 | 1024 | 170 MB | 0.859 | 0.456 | 10 to 13 s |
| U2-NetP | 320 | 4.4 MB | 0.841 | 0.425 | 1.4 s |

BiRefNet_lite also had the sharpest edges (the lowest mean error of the soft mask). ISNet and
U2-NetP took the church spire behind the cat as part of the subject; BiRefNet did not. The machine
was shared with other builds while measuring, so the times are high, and it had no GPU, so WebGPU
was not measured. Until a device has run the model, the estimate assumes 9 seconds a photo on
WebAssembly and 0.9 seconds on WebGPU.

## Delivery

Browsers download the model only from Hexlode's own server, at
`/models/birefnet-lite-512-fp16-eff9216b.onnx`, and only after the person agreed in a prompt that
states the size. The server route fetches the pinned file from its upstream revision on the first
request, checks its size and SHA-256 while writing it to `HEXLODE_MODEL_DIR` (the system's
temporary folder by default), and serves it from disk from then on with a year of caching, since
the name changes with the file. Because the server sends that file to every visitor, the folder must
belong to the server's user and not be writable by others, the download is created for that user
only, and a file already in the folder is served only after its SHA-256 matches, checked once after
each start; a file planted in a shared temporary folder is never sent. The browser checks the hash again before keeping the model in Cache
Storage, where the page and every worker can read it. ONNX Runtime's WebAssembly is served with the
app: the build with WebGPU (27 MB) where WebGPU works, the smaller build (14 MB) elsewhere.

## Engine fit

Each item travels through the whole pipeline in one engine worker, and the pool has one worker per
core. A model copy per worker would multiply about 2.5 GB of WebAssembly memory by the pool size,
so the page runs one shared inference worker, started when a run or a preview first needs a model.
Every engine worker and the preview worker get their own MessagePort to it. A node resizes the
upright image to 512 × 512 in its own worker and sends only that; the inference worker runs one
image at a time and returns the 512 × 512 mask; the node scales the mask to the full image, cuts
the subject out, and estimates the colour of soft edges (approximate fast foreground estimation,
the method BiRefNet's own code uses), so no fringe of the old background shows on white. Full-size
pixels never leave the worker that owns the item.

The estimate times model runs one after another rather than sharing them across workers, adds the
start of the model once per page, and adds the download while the model is not in the browser,
unscaled by this device's speed. Before a run on this page it uses typical times for the backend
the browser offers (WebAssembly runs use one thread, because more need cross-origin isolation,
which Hexlode does not turn on); afterwards it uses what it measured.

## Considered options

- **Downloading the model while building the Docker image.** Robust at runtime, but every image,
  published for two architectures on each merge, grows by 94 MB, and `pnpm dev` would still need
  its own download. The route gives development and production one path; its cost is that the
  server needs outbound HTTPS to Hugging Face once per model directory. A volume at
  `HEXLODE_MODEL_DIR` keeps the file across deploys.
- **A model per engine worker, with a node memory cost that shrinks the pool.** Simpler messages,
  but either memory grows with cores or every other node in the pipeline runs on one worker.
- **BiRefNet_lite at 1024.** ONNX Runtime's WebAssembly backend runs out of its 4 GB memory with it.
- **BRIA RMBG** models are licensed for non-commercial use only, and `@imgly/background-removal` is
  AGPL, so neither fits Hexlode's Apache 2.0 code.

## Consequences

- The node pair matrix and node tests use a stand-in segmenter; the inference worker, the pool
  and previews are tested with `threshold.onnx`, a 305-byte model with the real model's input and
  output. The real model runs only in the opt-in `pnpm test:model` suite.
- Changing the model means a new file name, size, hash and upstream in
  `src/features/background-removal/constants.ts`, a new version of the Remove background node so
  step caches are invalidated, a new row of measurements here, and new minimums in the quality
  suite. Bumping ONNX Runtime means updating `RUNTIME_BYTES` (a test
  checks it) and the notices in `src/features/background-removal/licences/`.
