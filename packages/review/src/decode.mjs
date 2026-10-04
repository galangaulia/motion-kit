// Read frames back out of a rendered MP4 with Remotion's own ffmpeg / ffprobe.
// That build has `scale` and `trim` but no rawvideo muxer and no `select`, so
// frames come through image2pipe, and a range is cut with `trim`.

import { spawnSync } from 'node:child_process'

const run = (tool, args, maxBuffer = 16 << 20) => {
  const r = spawnSync('npx', ['remotion', tool, '-v', 'error', ...args], { maxBuffer })
  if (r.status !== 0) throw new Error(`${tool} failed: ${r.stderr?.toString().trim() || r.error?.message || r.status}`)
  return r.stdout
}

/** Width, height, frame rate and frame count of the first video stream. */
export function probe(video) {
  const out = run('ffprobe', ['-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_frames', '-of', 'csv=p=0', video])
  const [width, height, rate, frames] = out.toString().trim().split(',')
  const [num, den] = rate.split('/').map(Number)
  return { width: Number(width), height: Number(height), fps: num / (den || 1), frames: Number(frames) }
}

/**
 * Every frame (or frames `from`…`to` inclusive) as rgb24 at `width` × `height`,
 * one Uint8Array per frame.
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
    Math.ceil(expected * 1.1 + 4) * size,
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
