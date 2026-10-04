// The Node side of the Manim engine. Python (motionkit, Manim) runs through
// pixi with a job; this file writes the job and everything it points at:
//
//   build/manim/timeline.json   every JSON-able export of src/timeline.ts, grids as parameters
//   build/manim/brand.json      the --film-* roles as hex, faces, font files (scripts/brand-export.mjs)
//   build/manim/fonts/          the faces as static TTFs Pango can register
//
// Clips: manim/<name>.py (class Clip) in any film, timed by CLIPS.<name> in
// src/timeline.ts, rendered transparent to public/clips/<name>.webm for the
// host film to place. Films: src/film.py (class FilmScene) per format in
// src/formats.ts, encoded with @motion-kit/media and the soundtrack laid in.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { encode, run } from '@motion-kit/media'

const ENGINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const KIT = resolve(ENGINE, '..', '..')
const MANIFEST = join(ENGINE, 'pixi.toml')

/** The pixi binary: $PIXI, ~/.pixi/bin/pixi, or pixi on PATH. */
export function pixi() {
  for (const cmd of [process.env.PIXI, join(homedir(), '.pixi', 'bin', 'pixi'), 'pixi'].filter(Boolean)) {
    if (spawnSync(cmd, ['--version'], { stdio: 'ignore' }).status === 0) return cmd
  }
  throw new Error('pixi is missing: `curl -fsSL https://pixi.sh/install.sh | PIXI_NO_PATH_UPDATE=1 sh` installs it to ~/.pixi (no sudo, no Homebrew), or set PIXI')
}

/** Run motionkit's Python in the engine's pixi environment. */
function python(args, { job, capture = false } = {}) {
  const r = spawnSync(pixi(), ['run', '--manifest-path', MANIFEST, 'python', '-W', 'ignore', ...args], {
    env: { ...process.env, PYTHONPATH: ENGINE, ...(job ? { MOTIONKIT_JOB: JSON.stringify(job) } : {}) },
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
  })
  if (r.status !== 0) throw new Error(`python ${args.slice(0, 3).join(' ')} failed (exit ${r.status})`)
  return r.stdout ?? ''
}

const isGrid = (v) => v && typeof v.beat === 'function' && 'perBeat' in v && 'bpm' in v

/** The film in `dir`: slug, brand, timeline module, its beat grid, formats (if any). */
export async function film(dir = process.cwd()) {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const timelinePath = join(dir, 'src', 'timeline.ts')
  if (!existsSync(timelinePath)) throw new Error('src/timeline.ts is missing')
  const timeline = await import(pathToFileURL(timelinePath).href)
  const g = isGrid(timeline.g) ? timeline.g : Object.values(timeline).find(isGrid)
  const formatsPath = join(dir, 'src', 'formats.ts')
  const formats = existsSync(formatsPath) ? (await import(pathToFileURL(formatsPath).href)).FORMATS : null
  return { dir, slug: pkg.name.replace(/^@films\//, ''), brand: pkg.motionKit?.brand, timeline, g, formats }
}

/** src/timeline.ts as JSON: plain values as they are, beat grids as their parameters. */
export function timelineJson(timeline) {
  const values = {}
  const grids = {}
  for (const [name, v] of Object.entries(timeline)) {
    if (isGrid(v)) grids[name] = { bpm: v.bpm, fps: v.fps, offset: v.offset, beatsPerBar: v.beatsPerBar }
    else if (typeof v !== 'function') values[name] = JSON.parse(JSON.stringify(v) ?? 'null')
  }
  return { values, grids }
}

/** Write build/manim/{timeline.json, brand.json, fonts/}; fonts are converted only when they change. */
export async function prep(f) {
  const out = join(f.dir, 'build', 'manim')
  mkdirSync(out, { recursive: true })
  const timeline = join(out, 'timeline.json')
  writeFileSync(timeline, `${JSON.stringify(timelineJson(f.timeline), null, 2)}\n`)
  const { exportManim } = await import(pathToFileURL(join(KIT, 'scripts', 'brand-export.mjs')).href)
  const brand = exportManim(f.brand, out)

  const fonts = join(out, 'fonts')
  const stamp = createHash('sha1')
  for (const face of brand.fontFiles) stamp.update(face.family).update(readFileSync(face.src))
  const digest = stamp.digest('hex')
  if (!existsSync(join(fonts, '.hash')) || readFileSync(join(fonts, '.hash'), 'utf8') !== digest) {
    rmSync(fonts, { recursive: true, force: true })
    python(['-m', 'motionkit.fonts', join(out, 'brand.json'), fonts], { capture: true })
    writeFileSync(join(fonts, '.hash'), digest)
  }
  const fontFiles = readdirSync(fonts).filter((n) => n.endsWith('.ttf')).sort().map((n) => join(fonts, n))
  return { out, timeline, brand: join(out, 'brand.json'), colors: brand.colors, fontFiles, media: join(out, 'media') }
}

/** Render `scene`'s `cls` for `job` to PNGs in job.out; returns their paths in frame order. */
function renderFrames(scene, cls, job) {
  python(['-m', 'motionkit.render', scene, cls], { job })
  const pngs = readdirSync(job.out).filter((n) => n.endsWith('.png')).sort()
  const want = job.frame_list?.length ?? job.frames
  if (pngs.length !== want) throw new Error(`${scene} rendered ${pngs.length} frames, the job asked for ${want}`)
  return pngs.map((n) => join(job.out, n))
}

const newest = (paths) =>
  Math.max(0, ...paths.filter((p) => existsSync(p)).flatMap((p) => (statSync(p).isDirectory() ? readdirSync(p).map((n) => join(p, n)) : [p])).map((p) => statSync(p).mtimeMs))

/**
 * Render the film's Manim clips (manim/<name>.py, class Clip) to public/clips/<name>.webm:
 * VP9 with alpha, CLIPS.<name>.width × height at 2×, from beat `from` to beat `to`.
 * A clip newer than its scene, the timeline and motionkit is left alone unless `force`.
 */
export async function clips({ dir = process.cwd(), force = false } = {}) {
  const scenes = join(dir, 'manim')
  const names = existsSync(scenes) ? readdirSync(scenes).filter((n) => n.endsWith('.py') && !n.startsWith('_')).map((n) => n.slice(0, -3)) : []
  if (!names.length) return []
  const f = await film(dir)
  const specs = f.timeline.CLIPS ?? {}
  let p = null
  const done = []
  for (const name of names) {
    const spec = specs[name]
    if (!spec) throw new Error(`manim/${name}.py has no CLIPS.${name} in src/timeline.ts: { from, to } in beats, { width, height } in half-size px`)
    if (!f.g) throw new Error('src/timeline.ts exports no beat grid to time the clips by')
    const target = join(dir, 'public', 'clips', `${name}.webm`)
    const sources = [join(scenes, `${name}.py`), join(dir, 'src', 'timeline.ts'), join(ENGINE, 'motionkit')]
    if (!force && existsSync(target) && statSync(target).mtimeMs > newest(sources)) {
      console.log(`${name}.webm  up to date`)
      continue
    }
    p ??= await prep(f)
    const start = f.g.beat(spec.from)
    const frames = f.g.beat(spec.to) - start
    const out = join(p.out, 'clips', name)
    const job = { width: spec.width, height: spec.height, fps: f.timeline.FPS, start, frames, transparent: true, out, media: p.media, timeline: p.timeline, brand: p.brand, font_files: p.fontFiles }
    renderFrames(join(scenes, `${name}.py`), 'Clip', job)
    mkdirSync(dirname(target), { recursive: true })
    run('ffmpeg', ['-y', '-framerate', String(f.timeline.FPS), '-i', join(out, 'f%05d.png'), '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '18', '-auto-alt-ref', '0', target])
    console.log(`${name}.webm  ${spec.width * 2}×${spec.height * 2}  frames ${start}–${start + frames - 1}`)
    done.push(target)
  }
  return done
}

const ratio = ({ width, height }) => {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a)
  const d = gcd(width, height)
  return `${width / d}x${height / d}`
}

function formatOf(f, name) {
  if (!f.formats) throw new Error('src/formats.ts is missing: it exports FORMATS, each format with its half-size width and height')
  const size = f.formats[name]
  if (!size) throw new Error(`no format "${name}" in src/formats.ts (has ${Object.keys(f.formats).join(', ')})`)
  return size
}

/** A job for src/film.py (class FilmScene) in one format. */
function filmJob(f, p, name, extra) {
  const size = formatOf(f, name)
  return { ...size, fps: f.timeline.FPS, start: 0, frames: f.timeline.TOTAL_FRAMES, background: p.colors.bg, media: p.media, timeline: p.timeline, brand: p.brand, font_files: p.fontFiles, out: join(p.out, name), ...extra }
}

/**
 * Render a Manim film (src/film.py) to out/<format>.mp4, or with `final` to
 * out/final/<slug>-<ratio>.mp4. Manim finals carry no motion blur (BUILD.md).
 */
export async function render({ dir = process.cwd(), formats = [], final = false } = {}) {
  const f = await film(dir)
  const wav = join(dir, 'public', 'audio', 'soundtrack.wav')
  if (!existsSync(wav)) throw new Error('public/audio/soundtrack.wav is missing: run npm run audio')
  const p = await prep(f)
  for (const name of formats.length ? formats : Object.keys(f.formats ?? {})) {
    const started = Date.now()
    const job = filmJob(f, p, name)
    renderFrames(join(dir, 'src', 'film.py'), 'FilmScene', job)
    const size = formatOf(f, name)
    const target = final ? join(dir, 'out', 'final', `${f.slug}-${ratio(size)}.mp4`) : join(dir, 'out', `${name.toLowerCase()}.mp4`)
    mkdirSync(dirname(target), { recursive: true })
    encode({ input: join(job.out, 'f%05d.png'), fps: f.timeline.FPS, output: target, audio: wav, crf: 16, preset: final ? 'slow' : 'medium' })
    console.log(`${target.slice(dir.length + 1)}  ${size.width * 2}×${size.height * 2}  ${((Date.now() - started) / 1000).toFixed(1)} s`)
  }
}

/** Key stills at 2×: Map(frame → PNG). Only those frames are drawn. */
export async function stills({ dir = process.cwd(), format, frames }) {
  const f = await film(dir)
  const p = await prep(f)
  const job = filmJob(f, p, format, { frame_list: frames, out: join(p.out, `${format}-stills`) })
  const pngs = renderFrames(join(dir, 'src', 'film.py'), 'FilmScene', job)
  return new Map(frames.map((n, i) => [n, readFileSync(pngs[i])]))
}

/** A quick look: one format at half size, with the soundtrack, opened in the system player. */
export async function preview({ dir = process.cwd(), format } = {}) {
  const f = await film(dir)
  const p = await prep(f)
  const name = format ?? Object.keys(f.formats ?? {})[0]
  const job = filmJob(f, p, name, { scale: 1, out: join(p.out, `${name}-preview`) })
  renderFrames(join(dir, 'src', 'film.py'), 'FilmScene', job)
  const target = join(p.out, `${name}-preview.mp4`)
  const wav = join(dir, 'public', 'audio', 'soundtrack.wav')
  encode({ input: join(job.out, 'f%05d.png'), fps: f.timeline.FPS, output: target, audio: existsSync(wav) ? wav : undefined, crf: 23, preset: 'veryfast' })
  console.log(target)
  if (process.platform === 'darwin') spawnSync('open', [target])
}
