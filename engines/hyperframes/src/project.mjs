// The Node side of a HyperFrames film: build its pages, render them, grab stills.
//
// A film is src/film.html (the markup), src/film.css, src/film.ts (one render(frame)),
// src/timeline.ts and src/formats.ts. `build` turns them into build/: one page per
// format whose root carries the size, rate and length from formats.ts and
// timeline.ts — never typed by hand, so a page can't drift from the soundtrack —
// plus film.js (esbuild), the brand (scripts/brand-export.mjs) and, for preview,
// the soundtrack. `render` hands a page to HyperFrames' producer at 2× and lays
// the soundtrack in with @motion-kit/media.

import { spawnSync } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mux, tool } from '@motion-kit/media'

const HERE = dirname(fileURLToPath(import.meta.url))
const KIT = resolve(HERE, '..', '..', '..')
const require = createRequire(import.meta.url)

// HyperFrames phones home and updates itself by default; a render must be the
// same on every run, so all of that is off. GEMINI_API_KEY is dropped because
// `hyperframes snapshot` would send every still to Gemini when it is set.
export function quietEnv(env = process.env) {
  const out = { ...env, HYPERFRAMES_NO_TELEMETRY: '1', HYPERFRAMES_NO_UPDATE_CHECK: '1', HYPERFRAMES_NO_AUTO_INSTALL: '1' }
  delete out.GEMINI_API_KEY
  const ff = tool('ffmpeg')
  if (ff.pre.length) throw new Error("HyperFrames needs a full ffmpeg (Remotion's build is too small): install one or set MOTION_KIT_FFMPEG.")
  if (ff.cmd.startsWith('/')) {
    out.HYPERFRAMES_FFMPEG_PATH = ff.cmd
    const probe = tool('ffprobe')
    if (probe.cmd.startsWith('/')) out.HYPERFRAMES_FFPROBE_PATH = probe.cmd
  }
  return out
}

// The chrome-headless-shell hyperframes 0.8.121 manages (its CHROME_VERSION) —
// bump with it. Installed into HyperFrames' own cache, and handed to every render
// and snapshot by path, so no machine falls back to its system Chrome.
const CHROME = '152.0.7977.30'
const CHROME_CACHE = join(homedir(), '.cache', 'hyperframes', 'chrome')

/** The pinned headless shell's path, downloading it first if it isn't cached. */
export async function ensureBrowser() {
  const { Browser, computeExecutablePath, detectBrowserPlatform, install } = await import('@puppeteer/browsers')
  const opts = { browser: Browser.CHROMEHEADLESSSHELL, buildId: CHROME, cacheDir: CHROME_CACHE, platform: detectBrowserPlatform() }
  const path = computeExecutablePath(opts)
  if (!existsSync(path)) {
    console.log(`downloading chrome-headless-shell ${CHROME}…`)
    await install(opts)
  }
  return path
}

/** quietEnv() plus the pinned browser, for the producer and the CLI alike. */
export async function hfEnv() {
  const browser = await ensureBrowser()
  return { ...quietEnv(), PRODUCER_HEADLESS_SHELL_PATH: browser, HYPERFRAMES_BROWSER_PATH: browser }
}

/** The film in `dir`: slug, brand, timeline and formats. */
export async function film(dir = process.cwd()) {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const load = async (name) => {
    const path = join(dir, 'src', name)
    if (!existsSync(path)) throw new Error(`src/${name} is missing`)
    return import(pathToFileURL(path).href)
  }
  const timeline = await load('timeline.ts')
  const { FORMATS } = await load('formats.ts')
  if (!Number.isFinite(timeline.FPS) || !Number.isInteger(timeline.TOTAL_FRAMES)) throw new Error('src/timeline.ts has to export FPS and TOTAL_FRAMES')
  return { dir, slug: pkg.name.replace(/^@films\//, ''), brand: pkg.motionKit?.brand, timeline, formats: FORMATS }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/** One format's page. The root's data-* are HyperFrames' composition contract. */
function page({ name, width, height, fps, frames, body, css, fontsCss, audio }) {
  const seconds = frames / fps
  return `<!doctype html>
<!-- Built by motion-hf from src/ — edit those, not this file. -->
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${width}, height=${height}">
<style>
${fontsCss}
html, body { margin: 0; }
#root { position: relative; width: ${width}px; height: ${height}px; overflow: hidden; }
</style>
${css.map((href) => `<link rel="stylesheet" href="${esc(href)}">`).join('\n')}
<link rel="stylesheet" href="film.css">
</head>
<body>
<div id="root" class="film-stage" data-composition-id="main" data-format="${esc(name)}" data-start="0" data-duration="${seconds}" data-width="${width}" data-height="${height}" data-fps="${fps}" data-no-timeline>
${body}
${audio ? `<audio id="soundtrack" src="audio/soundtrack.wav" data-start="0" data-duration="${seconds}" data-volume="1"></audio>` : ''}
</div>
<script src="film.js"></script>
</body>
</html>
`
}

/**
 * Build the film into build/<Format>/ for each of `formats` (all by default):
 * index.html, film.js, film.css and brand/ — one HyperFrames project per format,
 * since a project holds exactly one root composition. `preview` adds the soundtrack.
 */
export async function build({ dir = process.cwd(), formats, preview = false } = {}) {
  const f = await film(dir)
  const names = formats?.length ? formats : Object.keys(f.formats)
  for (const name of names) if (!f.formats[name]) throw new Error(`no format "${name}" in src/formats.ts (has ${Object.keys(f.formats).join(', ')})`)
  const out = join(dir, 'build')
  rmSync(out, { recursive: true, force: true })
  const assets = join(out, '.assets')
  mkdirSync(assets, { recursive: true })

  const esbuild = await import('esbuild')
  await esbuild.build({
    entryPoints: [join(dir, 'src', 'film.ts')], outfile: join(assets, 'film.js'),
    bundle: true, format: 'iife', platform: 'browser', target: 'chrome120', logLevel: 'warning',
  })
  copyFileSync(join(dir, 'src', 'film.css'), join(assets, 'film.css'))
  const { exportHtml } = await import(pathToFileURL(join(KIT, 'scripts', 'brand-export.mjs')).href)
  const brand = await exportHtml(f.brand, join(assets, 'brand'), dir, 'brand/')
  // The film's own files (captures, images, Manim clips) as public/…, as in Remotion;
  // public/audio is the soundtrack, which only the preview plays from the page.
  if (existsSync(join(dir, 'public'))) {
    cpSync(join(dir, 'public'), join(assets, 'public'), { recursive: true, filter: (src) => !src.startsWith(join(dir, 'public', 'audio')) })
  }
  const wav = join(dir, 'public', 'audio', 'soundtrack.wav')
  const audio = preview && existsSync(wav)
  if (audio) {
    mkdirSync(join(assets, 'audio'))
    copyFileSync(wav, join(assets, 'audio', 'soundtrack.wav'))
  }

  const body = readFileSync(join(dir, 'src', 'film.html'), 'utf8')
    .replaceAll('{{logo}}', brand.logo)
    .replace(/\{\{clip:([\w-]+)\}\}/g, (_, name) => clipTag(f, name))
  const shared = { fps: f.timeline.FPS, frames: f.timeline.TOTAL_FRAMES, body, css: brand.css.map((c) => `brand/${c}`), fontsCss: brand.fontsCss, audio }
  // HyperFrames swaps in a stand-in face when a font URL is wrong and renders on,
  // so check every face the page asks for is really there.
  for (const font of brand.fonts) if (!existsSync(join(assets, font))) throw new Error(`the page's @font-face points at ${font}, which the build doesn't contain`)
  const projects = {}
  for (const name of names) {
    projects[name] = join(out, name)
    cpSync(assets, projects[name], { recursive: true })
    writeFileSync(join(projects[name], 'index.html'), page({ name, ...f.formats[name], ...shared }))
  }
  rmSync(assets, { recursive: true, force: true })
  return { ...f, out, projects }
}

/**
 * A Manim clip (public/clips/<name>.webm, from `npm run clips`) as a timed
 * <video>, on the beats of CLIPS.<name> in src/timeline.ts. Its position is the
 * film's: style #clip-<name> in film.css.
 */
function clipTag(f, name) {
  const spec = f.timeline.CLIPS?.[name]
  if (!spec) throw new Error(`{{clip:${name}}} needs CLIPS.${name} in src/timeline.ts: { from, to } in beats, { width, height } in half-size px`)
  if (!existsSync(join(f.dir, 'public', 'clips', `${name}.webm`))) throw new Error(`public/clips/${name}.webm is missing: run npm run clips`)
  const g = f.timeline.g
  const start = g.beat(spec.from)
  const frames = g.beat(spec.to) - start
  const fps = f.timeline.FPS
  return `<video id="clip-${name}" class="clip" src="public/clips/${name}.webm" muted playsinline data-start="${start / fps}" data-duration="${frames / fps}" style="position:absolute;width:${spec.width}px;height:${spec.height}px"></video>`
}

/** The 1080p preset a half-size format renders to at 2×. */
function preset({ width, height }) {
  const key = `${width * 2}x${height * 2}`
  const known = { '1080x1080': 'square', '1080x1920': 'portrait', '1920x1080': 'landscape' }
  if (!known[key]) throw new Error(`${width}×${height} doesn't render to a 1080p preset at 2×: lay formats out at 540 on the short side`)
  return known[key]
}

const ratio = ({ width, height }) => {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a)
  const d = gcd(width, height)
  return `${width / d}x${height / d}`
}

const quietLogger = {
  error: (m) => console.error(m),
  warn: (m) => console.warn(m),
  info: () => {},
  debug: () => {},
  isLevelEnabled: (level) => level === 'error' || level === 'warn',
}

/**
 * Render `formats` (all of them when empty) to out/<format>.mp4, or with `final`
 * to out/final/<slug>-<ratio>.mp4 with a 16-sample, 180° motion blur.
 */
export async function render({ dir = process.cwd(), formats = [], final = false } = {}) {
  Object.assign(process.env, await hfEnv())
  delete process.env.GEMINI_API_KEY
  const f = await build({ dir, formats })
  const wav = join(dir, 'public', 'audio', 'soundtrack.wav')
  if (!existsSync(wav)) throw new Error('public/audio/soundtrack.wav is missing: run npm run audio')
  const { createRenderJob, executeRenderJob } = await import('@hyperframes/producer')
  for (const [name, project] of Object.entries(f.projects)) {
    const size = f.formats[name]
    const target = final ? join(dir, 'out', 'final', `${f.slug}-${ratio(size)}.mp4`) : join(dir, 'out', `${name.toLowerCase()}.mp4`)
    mkdirSync(dirname(target), { recursive: true })
    const silent = join(f.out, `${name}.silent.mp4`)
    const started = Date.now()
    const job = createRenderJob({
      fps: { num: f.timeline.FPS, den: 1 },
      quality: 'high',
      crf: 16,
      format: 'mp4',
      outputResolution: preset(size),
      // SwiftShader: the same pixels on a laptop and on CI, whatever the GPU.
      producerConfig: { browserGpuMode: 'software' },
      logger: quietLogger,
      ...(final ? { motionBlur: { samplesPerFrame: 16, shutterAngle: 180 } } : {}),
    })
    await executeRenderJob(job, project, silent)
    mux({ video: silent, audio: wav, output: target })
    rmSync(silent, { force: true })
    console.log(`${basename(target)}  ${size.width * 2}×${size.height * 2}  ${((Date.now() - started) / 1000).toFixed(1)} s`)
  }
}

/** The hyperframes CLI, run quietly from the film's build/. */
async function cli(args, opts = {}) {
  const pkgPath = require.resolve('hyperframes/package.json')
  const bin = JSON.parse(readFileSync(pkgPath, 'utf8')).bin
  const entry = join(dirname(pkgPath), typeof bin === 'string' ? bin : bin.hyperframes)
  return spawnSync(process.execPath, [entry, ...args], { env: await hfEnv(), encoding: 'utf8', ...opts })
}

/** Key stills at 2× (1080 on the short side), one PNG per frame: Map(frame → Buffer). */
export async function stills({ dir = process.cwd(), format, frames }) {
  const f = await build({ dir, formats: [format] })
  const { width, height } = f.formats[format]
  const shots = mkdtempSync(join(tmpdir(), 'motion-hf-stills-'))
  try {
    const at = frames.map((n) => n / f.timeline.FPS).join(',')
    const r = await cli(['snapshot', f.projects[format], '--at', at, '--no-end', '--zoom', `0,0,${width},${height}`, '--zoom-scale', '2', '--no-browser-gpu', '-o', shots])
    const files = readdirSync(shots).filter((n) => /^frame-\d+.*\.png$/.test(n)).sort()
    if (r.status !== 0 || files.length !== frames.length) throw new Error(`hyperframes snapshot failed:\n${r.stderr || r.stdout}`)
    return new Map(frames.map((n, i) => [n, readFileSync(join(shots, files[i]))]))
  } finally {
    rmSync(shots, { recursive: true, force: true })
  }
}

/** Open HyperFrames' preview (studio) on build/, with the soundtrack. */
export async function preview({ dir = process.cwd(), format } = {}) {
  const name = format ?? Object.keys((await film(dir)).formats)[0]
  const f = await build({ dir, formats: [name], preview: true })
  await cli(['preview', f.projects[name]], { stdio: 'inherit', encoding: undefined })
}
