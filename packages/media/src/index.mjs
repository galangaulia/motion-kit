// The ffmpeg every engine shares: read a render back (probe, frames, stills,
// audio), lay the soundtrack in, and encode a PNG sequence into a delivery MP4.
// Everything here runs on Remotion's small ffmpeg build too (see ffmpeg.mjs).

import { spawnSync } from 'node:child_process'
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
