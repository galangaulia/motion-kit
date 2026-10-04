// Which ffmpeg / ffprobe to run, and what that build can do.
//
// Looked up in this order: MOTION_KIT_FFMPEG / MOTION_KIT_FFPROBE, the one on
// PATH, ~/.local/bin, then the build Remotion ships (run through its CLI). Remotion's
// build is small — scale, trim, format, png, libx264, libvpx-vp9, aac, image2 — with
// no select, fps or tmix filter and no rawvideo demuxer, so the helpers in this
// package stay inside that set. Anything that needs more calls need() first, which
// says what is missing instead of failing halfway through an encode.

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const found = new Map()

const answers = (cmd, pre) => spawnSync(cmd, [...pre, '-version'], { stdio: 'ignore' }).status === 0

/** Remotion's CLI, when some film in the repo installed it. */
function remotionCli() {
  try {
    return join(dirname(require.resolve('@remotion/cli/package.json')), 'remotion-cli.js')
  } catch {
    return null
  }
}

/** `{ cmd, pre, source }` for 'ffmpeg' or 'ffprobe', or throws with how to get one. */
export function tool(name) {
  if (found.has(name)) return found.get(name)
  const env = process.env[`MOTION_KIT_${name.toUpperCase()}`]
  const local = join(homedir(), '.local', 'bin', name)
  const candidates = [
    ...(env ? [{ cmd: env, pre: [], source: `$MOTION_KIT_${name.toUpperCase()}` }] : []),
    { cmd: name, pre: [], source: 'PATH' },
    ...(existsSync(local) ? [{ cmd: local, pre: [], source: '~/.local/bin' }] : []),
  ]
  const cli = remotionCli()
  if (cli) candidates.push({ cmd: process.execPath, pre: [cli, name], source: "Remotion's build" })
  const hit = candidates.find((c) => answers(c.cmd, c.pre))
  if (!hit) throw new Error(`No ${name} found: install ffmpeg, put it on PATH or set MOTION_KIT_${name.toUpperCase()}.`)
  found.set(name, hit)
  return hit
}

/** Run ffmpeg or ffprobe quietly; stdout as a Buffer, or throws with its stderr. */
export function run(name, args, { maxBuffer = 16 << 20 } = {}) {
  const { cmd, pre } = tool(name)
  const r = spawnSync(cmd, [...pre, '-v', 'error', ...args], { maxBuffer })
  if (r.status !== 0) throw new Error(`${name} failed: ${r.stderr?.toString().trim() || r.error?.message || r.status}`)
  return r.stdout
}

const lists = new Map()

/**
 * Names the ffmpeg build lists for `kind`: 'filters', 'encoders', 'decoders',
 * 'muxers' or 'demuxers'.
 */
function list(kind) {
  if (lists.has(kind)) return lists.get(kind)
  const { cmd, pre } = tool('ffmpeg')
  const out = spawnSync(cmd, [...pre, '-hide_banner', `-${kind}`], { encoding: 'utf8' }).stdout ?? ''
  // Rows are "<flags> <name[,name]> …"; the legend above them reads "<flags> = …"
  // (older builds print no dashed separator, so the legend is skipped by its "=").
  const names = new Set()
  for (const line of out.split('\n')) {
    const [flags, field] = line.trim().split(/\s+/)
    if (field && field !== '=' && /^[.A-Z|]+$/.test(flags)) for (const n of field.split(',')) names.add(n)
  }
  lists.set(kind, names)
  return names
}

/** Whether the ffmpeg in use has a filter / encoder / decoder / muxer / demuxer. */
export const has = (kind, name) => list(kind).has(name)

/** Throws, naming the build and the fix, unless ffmpeg has everything in `wants`. */
export function need(why, wants) {
  const missing = Object.entries(wants).flatMap(([kind, names]) => names.filter((n) => !has(kind, n)).map((n) => `${n} (${kind.replace(/s$/, '')})`))
  if (missing.length) {
    throw new Error(`${why} needs ${missing.join(', ')}, which ${tool('ffmpeg').source} ffmpeg lacks. Install a full ffmpeg or set MOTION_KIT_FFMPEG.`)
  }
}
