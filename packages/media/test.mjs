// Sanity checks for @motion-kit/media on whichever ffmpeg it finds. Run: node packages/media/test.mjs

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { crc32, deflateSync } from 'node:zlib'
import { buffer, writeWav } from '../audio/src/index.mjs'
import { checkSize, decodeFrames, encode, extractAudio, has, mux, pickFrames, probe, run, selectExpr, still, tool } from './src/index.mjs'

const tmp = mkdtempSync(join(tmpdir(), 'media-test-'))
process.on('exit', () => rmSync(tmp, { recursive: true, force: true }))

/** A minimal 8-bit RGB PNG. */
function png(width, height, pixel) {
  const stride = width * 3 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) raw.set(pixel(x, y), y * stride + 1 + x * 3)
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data])
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

const W = 64, H = 36, N = 12
const GREEN = [23, 130, 87] // Tally's accent: catches a BT.601/709 mix-up
const near = (got, want, tol, what) => assert.ok(Math.abs(got - want) <= tol, `${what}: ${got} vs ${want} (±${tol})`)

console.log(`ffmpeg: ${tool('ffmpeg').source}`)
assert.ok(has('filters', 'scale') && has('filters', 'trim'), 'ffmpeg lists scale and trim')
assert.equal(has('filters', 'no-such-filter'), false)

// A 12-frame clip: the left half steps grey by 20 a frame, the right half is green.
mkdirSync(join(tmp, 'frames'))
for (let i = 0; i < N; i++) writeFileSync(join(tmp, 'frames', `${String(i).padStart(3, '0')}.png`), png(W, H, (x) => (x < W / 2 ? [i * 20, i * 20, i * 20] : GREEN)))
const clip = join(tmp, 'clip.mp4')
encode({ input: join(tmp, 'frames', '%03d.png'), output: clip, fps: 30, crf: 0 })

const tags = run('ffprobe', ['-select_streams', 'v:0', '-show_entries', 'stream=color_space,color_primaries,color_transfer', '-of', 'csv=p=0', clip]).toString().trim()
assert.equal(tags, 'bt709,bt709,bt709', 'encode tags matrix, primaries and transfer as BT.709')
const info = probe(clip)
assert.deepEqual([info.width, info.height, info.fps, info.frames], [W, H, 30, N], 'probe reads size, rate and frame count')

const frames = decodeFrames(clip, W, H)
assert.equal(frames.length, N, 'every frame decodes')
const px = (f, x, y) => Array.from(f.subarray((y * W + x) * 3, (y * W + x) * 3 + 3))
for (const i of [0, 5, 11]) near(px(frames[i], 4, 18)[0], i * 20, 3, `grey on frame ${i}`)
const g = px(frames[6], W - 6, 18)
GREEN.forEach((v, c) => near(g[c], v, 4, `green channel ${c} (BT.709 both ways)`))

const range = decodeFrames(clip, W, H, { from: 3, to: 5 })
assert.equal(range.length, 3, 'a trimmed range decodes exactly those frames')
near(px(range[0], 4, 18)[0], 60, 3, 'range starts on frame 3')

// Picked frames, in one pass: in the order asked, repeats allowed, the same
// with `select` and without it (Remotion's build has none).
for (const select of [...(has('filters', 'select') ? [true] : []), false]) {
  const picked = await pickFrames(clip, [7, 2, 11, 2], 32, 18, { select })
  assert.equal(picked.length, 4, `pickFrames (select: ${select}) returns one frame per ask`)
  const px32 = (f) => f[(9 * 32 + 2) * 3]
  ;[7, 2, 11, 2].forEach((i, k) => near(px32(picked[k]), i * 20, 3, `picked frame ${i} (select: ${select})`))
  assert.equal(picked[0].length, 32 * 18 * 3, 'picked frames are rgb24 at the asked size')
  await assert.rejects(pickFrames(clip, [3, N + 2], 32, 18, { select }), /has no frame 14/, `a frame past the end is an error (select: ${select})`)
}
assert.deepEqual(await pickFrames(clip, [], 32, 18), [], 'nothing asked, nothing decoded')

// A long film: ffmpeg refuses a `select` sum of more than 100 terms, so 300
// scattered frames (and a run of 300 in a row) must still come back in one pass.
// Frame i is told apart by two greys: i % 40 on the left, ⌊i / 40⌋ on the right.
const LONG = 600
mkdirSync(join(tmp, 'long'))
for (let i = 0; i < LONG; i++) writeFileSync(join(tmp, 'long', `${String(i).padStart(3, '0')}.png`), png(W, H, (x) => { const v = x < W / 2 ? (i % 40) * 6 : Math.floor(i / 40) * 15; return [v, v, v] }))
const long = join(tmp, 'long.mp4')
encode({ input: join(tmp, 'long', '%03d.png'), output: long, fps: 30, crf: 0 })
const scattered = Array.from({ length: 300 }, (_, k) => (k * 7) % LONG) // 300 distinct frames, out of order
const run300 = Array.from({ length: 300 }, (_, k) => 150 + k)
assert.ok(selectExpr(scattered.toSorted((a, b) => a - b)).split('+').length > 100, 'the scattered ask is past the flat-sum limit')
assert.equal(selectExpr(run300), 'between(n\\,150\\,449)', 'a run of frames is one term')
for (const select of [...(has('filters', 'select') ? [true] : []), false]) {
  for (const [what, ask] of [['300 scattered', scattered], ['300 in a row', run300]]) {
    const picked = await pickFrames(long, ask, 32, 18, { select })
    assert.equal(picked.length, ask.length, `${what} (select: ${select}): one frame per ask`)
    ask.forEach((i, k) => {
      near(picked[k][(9 * 32 + 2) * 3], (i % 40) * 6, 3, `${what}: frame ${i} left (select: ${select})`)
      near(picked[k][(9 * 32 + 29) * 3], Math.floor(i / 40) * 15, 3, `${what}: frame ${i} right (select: ${select})`)
    })
  }
}

const one = still(clip, 7, 32, 18)
assert.deepEqual([...one.subarray(1, 4)].map((c) => String.fromCharCode(c)).join(''), 'PNG')
assert.deepEqual([one.readUInt32BE(16), one.readUInt32BE(20)], [32, 18], 'still is scaled to the asked size')

// Soundtrack in, then back out.
assert.equal(extractAudio(clip, join(tmp, 'none.wav')), false, 'a silent clip has no audio to extract')
const tone = buffer(N / 30)
for (let i = 0; i < tone[0].length; i++) tone[0][i] = tone[1][i] = 0.25 * Math.sin((2 * Math.PI * 440 * i) / 44100)
writeWav(join(tmp, 'tone.wav'), tone)
const withSound = join(tmp, 'sound.mp4')
mux({ video: clip, audio: join(tmp, 'tone.wav'), output: withSound })
assert.equal(probe(withSound).frames, N, 'muxing keeps every frame')
assert.ok(extractAudio(withSound, join(tmp, 'back.wav')), 'muxed audio extracts')

assert.deepEqual(checkSize(540, 960), { width: 64, height: 112 })
assert.deepEqual(checkSize(960, 540), { width: 112, height: 64 })

console.log('media: all checks passed')
