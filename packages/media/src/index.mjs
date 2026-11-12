// The ffmpeg every engine shares: read a render back (probe, frames, stills,
// audio), lay the soundtrack in, and encode a PNG sequence into a delivery MP4.
// Everything here runs on Remotion's small ffmpeg build too (see ffmpeg.mjs).

import { spawn, spawnSync } from 'node:child_process'
import { has, need, run, tool } from './ffmpeg.mjs'

export { has, need, run, tool }

/** Width, height, frame rate and frame count of the first video stream. */
export function probe(video) {
  const out = run('ffprobe', ['-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_frames', '-of', 'csv=p=0', video])
  const [width, height, rate, frames] = out.toString().trim().split(',')
  const [num, den] = rate.split('/').map(Number)
  return { width: Number(width), height: Number(height), fps: num / (den || 1), frames: Number(frames) }
}

/**
 * Every frame (or frames `from`…`to` inclusive) as rgb24 at `width` × `height`,
 * one Uint8Array per frame. Frames come through image2pipe and a range is cut
 * with `trim`, because the smallest build has no rawvideo muxer and no `select`.
 */
export function decodeFrames(video, width, height, { from, to } = {}) {
  const filters = []
  if (from !== undefined) filters.push(`trim=start_frame=${from}:end_frame=${to + 1}`)
  filters.push(`scale=${width}:${height}:flags=area`)
  const size = width * height * 3
  const expected = from !== undefined ? to - from + 1 : probe(video).frames
  const raw = run(
    'ffmpeg',
    ['-i', video, '-an', '-vf', filters.join(','), '-fps_mode', 'passthrough', '-pix_fmt', 'rgb24', '-c:v', 'rawvideo', '-f', 'image2pipe', '-'],
    { maxBuffer: Math.ceil(expected * 1.1 + 4) * size },
  )
  const frames = []
  for (let p = 0; p + size <= raw.length; p += size) frames.push(new Uint8Array(raw.buffer, raw.byteOffset + p, size))
  return frames
}

/** Decode size for the motion checks: `short` px on the short side, both sides a multiple of 16. */
export function checkSize(width, height, short = 64) {
  const long = Math.max(16, Math.round((short * Math.max(width, height)) / Math.min(width, height) / 16) * 16)
  return width >= height ? { width: long, height: short } : { width: short, height: long }
}

/**
 * The `select` expression for frame numbers `wanted` (sorted, no repeats).
 * ffmpeg refuses a flat sum of more than 100 terms ("Error while parsing
 * expression"), and a long film's contact sheet asks for more than that. So consecutive frames become one
 * `between()` and the terms are summed as a balanced tree: the nesting grows
 * with log2 of the count (18,000 single frames parse in one pass).
 */
export function selectExpr(wanted) {
  const terms = []
  for (let i = 0; i < wanted.length; ) {
    let j = i
    while (j + 1 < wanted.length && wanted[j + 1] === wanted[j] + 1) j++
    terms.push(j === i ? `eq(n\\,${wanted[i]})` : `between(n\\,${wanted[i]}\\,${wanted[j]})`)
    i = j + 1
  }
  const sum = (from, to) => {
    if (to - from <= 8) return terms.slice(from, to).join('+')
    const mid = (from + to) >> 1
    return `(${sum(from, mid)})+(${sum(mid, to)})`
  }
  return sum(0, terms.length)
}

/**
 * Frames `frames` of a video as rgb24 at `width` × `height`, one Uint8Array each
 * in the order asked, from a single pass over the video (a `still()` per frame
 * decodes from the start every time). With `select` in the build only those frames
 * are scaled; without it (Remotion's build, or `select: false`) every frame up to
 * the last one asked for is, and the rest are dropped here as they stream past.
 */
export function pickFrames(video, frames, width, height, { select = has('filters', 'select') } = {}) {
  const wanted = [...new Set(frames)].sort((a, b) => a - b)
  if (!wanted.length) return Promise.resolve([])
  const filters = [`trim=end_frame=${wanted.at(-1) + 1}`]
  if (select) filters.push(`select=${selectExpr(wanted)}`)
  filters.push(`scale=${width}:${height}:flags=area`)
  const { cmd, pre } = tool('ffmpeg')
  const child = spawn(cmd, [
    ...pre, '-v', 'error', '-i', video, '-an', '-vf', filters.join(','),
    '-fps_mode', 'passthrough', '-pix_fmt', 'rgb24', '-c:v', 'rawvideo', '-f', 'image2pipe', '-',
  ])
  const size = width * height * 3
  const keep = new Set(wanted)
  const got = new Map()
  let n = 0 // frames out so far: the frame number without select, the place in `wanted` with it
  let chunks = []
  let have = 0
  let errors = ''
  child.stdout.on('data', (chunk) => {
    chunks.push(chunk)
    have += chunk.length
    if (have < size) return
    const all = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks, have)
    let p = 0
    for (; have - p >= size; p += size, n++) {
      const frame = select ? wanted[n] : n
      if (keep.has(frame)) got.set(frame, new Uint8Array(all.subarray(p, p + size)))
    }
    chunks = p < have ? [all.subarray(p)] : []
    have -= p
  })
  child.stderr.on('data', (chunk) => (errors += chunk))
  return new Promise((done, fail) => {
    child.on('error', fail)
    child.on('close', (code) => {
      if (code !== 0) return fail(new Error(`ffmpeg failed: ${errors.trim() || code}`))
      const missing = wanted.filter((f) => !got.has(f))
      if (missing.length) return fail(new Error(`${video} has no frame ${missing.join(', ')}`))
      done(frames.map((f) => got.get(f)))
    })
  })
}

/** One frame of a video as a PNG at `width` × `height` (frame-exact, via `trim`). */
export function still(video, frame, width, height) {
  return run('ffmpeg', [
    '-i', video, '-an',
    '-vf', `trim=start_frame=${frame}:end_frame=${frame + 1},scale=${width}:${height}:flags=area`,
    '-frames:v', '1', '-c:v', 'png', '-f', 'image2pipe', '-',
  ], { maxBuffer: width * height * 4 + (1 << 20) })
}

/** The video's sound as a stereo WAV at `sampleRate`; false when it has none. */
export function extractAudio(video, wav, sampleRate = 48000) {
  const { cmd, pre } = tool('ffmpeg')
  const r = spawnSync(cmd, [...pre, '-y', '-loglevel', 'error', '-i', video, '-vn', '-ac', '2', '-ar', String(sampleRate), wav], { stdio: 'ignore' })
  return r.status === 0
}

// Tagged twice over: newer ffmpeg builds drop the container options when the
// frames carry no colour properties of their own, but x264's VUI always lands.
const BT709 = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709']

/**
 * Encode frames into a delivery MP4: H.264, yuv420p with BT.709 conversion and
 * tags (RGB → YUV defaults to BT.601 otherwise, which shifts brand colours), and
 * the soundtrack as AAC when `audio` is given. `input` is a video, or an image
 * sequence pattern such as `frames/%05d.png` read at `fps`.
 */
export function encode({ input, output, fps, audio, crf = 16, preset = 'medium' }) {
  const sequence = input.includes('%')
  if (sequence && !fps) throw new Error('encode: an image sequence needs fps')
  run('ffmpeg', [
    '-y',
    ...(sequence ? ['-framerate', String(fps)] : []), '-i', input,
    ...(audio ? ['-i', audio, '-map', '0:v:0', '-map', '1:a:0'] : ['-an']),
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-crf', String(crf), '-preset', preset, ...BT709,
    ...(audio ? ['-c:a', 'aac', '-b:a', '320k', '-shortest'] : []),
    '-movflags', '+faststart', output,
  ])
}

/** Lay `wav` under a video without re-encoding the picture (AAC 320k). */
export function mux({ video, audio, output }) {
  run('ffmpeg', [
    '-y', '-i', video, '-i', audio, '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', output,
  ])
}
