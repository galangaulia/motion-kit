// Seek conformance: HyperFrames has to draw every frame from our render(frame),
// with the right frame number, whatever the worker count, the same pixels each
// time, and a length that matches the timeline to the frame. This engine leans on
// HyperFrames' `hf-seek` event, which is documented for canvas only, so this runs
// on CI for every HyperFrames upgrade.
//
// Run: node engines/hyperframes/test/seek.mjs   (fetches the pinned Chrome; needs ffmpeg)

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeFrames } from '@motion-kit/media'
import { frameAt } from '../src/runtime.ts'
import { hfEnv } from '../src/project.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

// frameAt snaps float noise to whole frames and keeps real sub-frame times.
assert.equal(frameAt(58 / 30, 30), 58)
assert.equal(frameAt(1.9333333333333331, 30), 58)
assert.equal(frameAt((58 + 0.25) / 30, 30), 58.25)

const BITS = 12
const W = BITS * 32
const H = 64
const FRAMES = 241 // 8.0333… s: a length that isn't a whole number of seconds
const FPS = 30

const tmp = mkdtempSync(join(tmpdir(), 'hf-seek-'))
process.on('exit', () => rmSync(tmp, { recursive: true, force: true }))

// The frame number as 12 black/white blocks, drawn by our runtime.
const esbuild = await import('esbuild')
await esbuild.build({
  stdin: {
    resolveDir: HERE,
    contents: `
      import { mount } from '../src/runtime.ts'
      const root = document.getElementById('root')
      const bits = Array.from({ length: ${BITS} }, (_, i) => {
        const b = document.createElement('div')
        b.style.cssText = 'position:absolute;top:0;width:32px;height:${H}px;left:' + i * 32 + 'px'
        root.append(b)
        return b
      })
      mount({ fps: ${FPS}, render: (f) => bits.forEach((b, i) => (b.style.background = (Math.floor(f) >> (${BITS - 1} - i)) & 1 ? '#fff' : '#000')) })`,
  },
  outfile: join(tmp, 'film.js'), bundle: true, format: 'iife', platform: 'browser', logLevel: 'warning',
})
writeFileSync(join(tmp, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0}#root{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#808080}</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${FRAMES / FPS}" data-width="${W}" data-height="${H}" data-fps="${FPS}" data-no-timeline></div>
<script src="film.js"></script></body></html>`)

Object.assign(process.env, await hfEnv())
const { createRenderJob, executeRenderJob } = await import('@hyperframes/producer')
const quiet = { error: (m) => console.error(m), warn: () => {}, info: () => {}, debug: () => {} }

const hashes = []
for (const workers of [1, 4]) {
  const video = join(tmp, `w${workers}.mp4`)
  const job = createRenderJob({ fps: { num: FPS, den: 1 }, quality: 'high', crf: 0, format: 'mp4', workers, producerConfig: { browserGpuMode: 'software' }, logger: quiet })
  await executeRenderJob(job, tmp, video)
  const frames = decodeFrames(video, W, H)
  assert.equal(frames.length, FRAMES, `${workers} worker(s): ${frames.length} frames, timeline says ${FRAMES}`)
  const wrong = []
  const hash = createHash('sha1')
  frames.forEach((rgb, f) => {
    let n = 0
    for (let i = 0; i < BITS; i++) n = (n << 1) | (rgb[((H / 2) * W + i * 32 + 16) * 3] > 128 ? 1 : 0)
    if (n !== f) wrong.push(`f${f} drew ${n}`)
    hash.update(rgb)
  })
  assert.deepEqual(wrong, [], `${workers} worker(s) drew the wrong frame: ${wrong.slice(0, 6).join(', ')}`)
  hashes.push(hash.digest('hex'))
  console.log(`${workers} worker(s): ${FRAMES} frames, every one drawn from its own frame number`)
}
assert.equal(hashes[0], hashes[1], '1 and 4 workers render different pixels')
console.log('hyperframes seek: ok')
