#!/usr/bin/env node
// motion-review — what the critic looks at before scoring a round.
//
// Run from a film folder (its `npm run review` does this):
//   motion-review --comp PrdCritique --video out/film.mp4 [--every 30] [--entry src/index.ts]
//                 [--safe | --no-safe] [--strict]
//   motion-review --comp PrdCritique --stills [--frames 12,58]
//
// Writes out/review/<stamp>-<comp>/:
//   contact.png  one frame every --every frames (default 1 s), labelled
//   phone.png    frames at 360 px wide — the real phone-feed size, unscaled; 9:16
//                frames carry the outline of the area the apps' UI leaves clear
//   report.md    motion checks on the rendered video (glitches, snaps, cuts against
//                the beat, freezes, stretches with no new picture, flashes), loudness,
//                sample and true peak, clipping, per-cue lift over the bed, and the
//                scorecard to fill in (CLAUDE.md "Review loop")
//   flags.png    the frames before, at and after each moment the motion checks flag
//
// --strict exits 1 (after writing everything) when the film flashes past WCAG
// 2.3.1 or its true peak is over −1 dBTP. The other checks only inform the critic.
//
// --stills is the key-stills gate (CLAUDE.md, gate 2b): it renders only the frames
// in src/timeline.ts's STILLS (or --frames) into out/review/<stamp>-<comp>-stills/:
// stills/fNNNN.png at full size, stills.png side by side, phone.png at 360 px, and
// a short report to approve the look before the rest of the film is animated.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { integratedLufs, peakDb, readWav, truePeakDb } from '@motion-kit/audio'
import { bundle } from '@remotion/bundler'
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer'
import sharp from 'sharp'
import { checkSize, decodeFrames, probe } from './decode.mjs'
import { flaggedFrames, flashFailed, motionChecks, motionReport } from './motion-checks.mjs'
import { isStoryFormat, safeOutlineSvg } from './safe-zones.mjs'

const { values: args } = parseArgs({
  options: {
    comp: { type: 'string' },
    entry: { type: 'string', default: 'src/index.ts' },
    video: { type: 'string' },
    every: { type: 'string' },
    phoneEvery: { type: 'string' },
    cues: { type: 'string', default: 'public/audio/cues.json' },
    // Safe-zone outline on phone.png; on by default for 9:16.
    safe: { type: 'boolean' },
    strict: { type: 'boolean' },
    stills: { type: 'boolean' },
    frames: { type: 'string' },
  },
  allowNegative: true,
})
if (!args.comp) {
  console.error('usage: motion-review --comp <id> [--video out/film.mp4] [--every <frames>] [--safe | --no-safe] [--strict]')
  console.error('       motion-review --comp <id> --stills [--frames 12,58]')
  process.exit(1)
}

const stamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-')
// One folder per run and composition, so back-to-back reviews never overwrite each other.
const OUT = resolve('out', 'review', `${stamp}-${args.comp}${args.stills ? '-stills' : ''}`)
mkdirSync(OUT, { recursive: true })

// ── Frames ────────────────────────────────────────────────────────────

// Everything temporary lives under one folder that is removed on exit — renders
// at 1080p and up fill a disk fast if stills and bundles are left behind.
const tmp = mkdtempSync(join(tmpdir(), 'motion-review-'))
process.on('exit', () => rmSync(tmp, { recursive: true, force: true }))

console.log('bundling…')
// A film that customises webpack (e.g. to render a product's own components)
// keeps the override in webpack-override.mjs next to its package.json; the
// CLI picks it up from remotion.config.ts, the review has to load it itself.
const overridePath = resolve('webpack-override.mjs')
const webpackOverride = existsSync(overridePath) ? (await import(pathToFileURL(overridePath).href)).default : undefined
const serveUrl = await bundle({ entryPoint: resolve(args.entry), outDir: join(tmp, 'bundle'), ...(webpackOverride ? { webpackOverride } : {}) })
const composition = await selectComposition({ serveUrl, id: args.comp })
const { fps, width, height, durationInFrames: total } = composition
const safe = args.safe ?? isStoryFormat(width, height)
const hasVideo = Boolean(args.video && existsSync(args.video))

// The film's beat grid, from the src/timeline.ts the picture and the soundtrack
// read (Node strips its types), to say whether a cut lands on a beat.
let timeline = null
let timelineError = ''
let beatGrid = null
let beatNote = ''
const TIMELINE_RULES =
  'It needs `.ts` on relative imports, `import type` for types, no enums, and `@motion-kit/core/beats` rather than `@motion-kit/core`.'
if (existsSync(resolve('src', 'timeline.ts'))) {
  try {
    timeline = await import(pathToFileURL(resolve('src', 'timeline.ts')).href)
    const isGrid = (v) => v && typeof v.at === 'function' && typeof v.beat === 'function' && 'perBeat' in v
    beatGrid = isGrid(timeline.g) ? timeline.g : (Object.values(timeline).find(isGrid) ?? null)
    if (!beatGrid) beatNote = '_src/timeline.ts exports no beat grid, so cuts are not checked against beats._'
  } catch (e) {
    timelineError = `src/timeline.ts didn't load in Node (${e.message.split('\n')[0]}). ${TIMELINE_RULES}`
    beatNote = `_src/timeline.ts didn't load in Node (${e.message.split('\n')[0]}), so cuts are not checked against beats. ${TIMELINE_RULES}_`
  }
}

// Key stills: --frames, or STILLS in timeline.ts (frame numbers, or { frame, label }).
let stills = []
if (args.stills) {
  const listed = args.frames ? args.frames.split(',').map(Number) : timeline?.STILLS
  if (!listed) {
    console.error(timelineError || 'No key stills: add `export const STILLS = [{ frame, label }]` to src/timeline.ts, or pass --frames 12,58.')
    process.exit(1)
  }
  stills = listed.map((s, i) => (typeof s === 'number' ? { frame: s, label: `still ${i + 1}` } : { label: `still ${i + 1}`, ...s }))
  const bad = stills.filter(({ frame }) => !Number.isInteger(frame) || frame < 0 || frame >= total)
  if (bad.length || stills.length > 8 || !stills.length) {
    console.error(`Key stills must be 1–8 whole frames inside 0–${total - 1}; got ${stills.map((s) => s.frame).join(', ')}.`)
    process.exit(1)
  }
}
// Short pieces get denser sheets: at least ~10 contact frames and ~8 phone frames.
const every = Number(args.every ?? Math.min(fps, Math.max(Math.round(fps / 4), Math.floor(total / 10))))
const phoneEvery = Number(args.phoneEvery ?? Math.min(fps * 2, Math.max(Math.round(fps / 2), Math.floor(total / 8))))

const sample = (step) => {
  const frames = []
  for (let f = Math.min(10, total - 1); f < total; f += step) frames.push(f)
  if (frames.at(-1) !== total - 1) frames.push(total - 1)
  return frames
}

const browser = await openBrowser('chrome')

async function still(frame, scale) {
  const output = join(tmp, `${frame}-${scale.toFixed(3)}.png`)
  await renderStill({ composition, serveUrl, frame, scale, output, imageFormat: 'png', puppeteerInstance: browser })
  return readFileSync(output)
}

const escapeXml = (text) => String(text).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c])
const label = (text, w, h) =>
  Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#16181d"/>` +
      `<text x="8" y="${h - 8}" font-family="Menlo, monospace" font-size="13" fill="#c8cdd9">${escapeXml(text)}</text></svg>`,
  )

async function sheet(frames, scale, cols, file, { overlay, names } = {}) {
  const tiles = []
  for (const f of frames) {
    process.stdout.write(`\r${file}: frame ${f}   `)
    tiles.push({ frame: f, png: await still(f, scale) })
  }
  const { width: w, height: h } = await sharp(tiles[0].png).metadata()
  const over = overlay ? Buffer.from(overlay(w, h)) : null
  const bar = 22
  const rows = Math.ceil(tiles.length / cols)
  await sharp({ create: { width: cols * w, height: rows * (h + bar), channels: 3, background: '#16181d' } })
    .composite(
      tiles.flatMap((t, i) => {
        const left = (i % cols) * w
        const top = Math.floor(i / cols) * (h + bar)
        return [
          { input: label(`${names?.has(t.frame) ? `${names.get(t.frame)} · ` : ''}f${t.frame} · ${(t.frame / fps).toFixed(1)}s`, w, bar), left, top },
          { input: t.png, left, top: top + bar },
          ...(over ? [{ input: over, left, top: top + bar }] : []),
        ]
      }),
    )
    .png()
    .toFile(join(OUT, file))
  process.stdout.write(`\r${file}: ${tiles.length} frames\n`)
}

if (args.stills) {
  // Full size is what the finals render at: 1080 on the short side.
  mkdirSync(join(OUT, 'stills'), { recursive: true })
  const full = 1080 / Math.min(width, height)
  for (const { frame } of stills) {
    process.stdout.write(`\rstills: frame ${frame}   `)
    writeFileSync(join(OUT, 'stills', `f${String(frame).padStart(4, '0')}.png`), await still(frame, full))
  }
  process.stdout.write(`\rstills: ${stills.length} frames\n`)
  const frames = stills.map((s) => s.frame)
  const names = new Map(stills.map((s) => [s.frame, s.label]))
  await sheet(frames, 540 / Math.min(width, height), 2, 'stills.png', { names })
  await sheet(frames, 360 / width, 4, 'phone.png', { names, overlay: safe ? safeOutlineSvg : undefined })
  await browser.close({ silent: true })

  writeFileSync(
    join(OUT, 'report.md'),
    `# Key stills ${stamp} · ${args.comp}

${width}×${height} · ${stills.length} frames from ${args.frames ? '`--frames`' : '`STILLS` in src/timeline.ts'}

Gate 2b: approve the look on these frames before the rest of the film is
animated. Full size in \`stills/\`, side by side in \`stills.png\`, at phone
size in \`phone.png\`${safe ? ' (the dashed outline is the area Reels, TikTok and Shorts leave clear)' : ''}.

| Still | Frame | Time |
|---|---|---|
${stills.map((s) => `| ${s.label} | ${s.frame} | ${(s.frame / fps).toFixed(2)} s |`).join('\n')}

## Scorecard (1–10)

| Question | Score | Stills that show it |
|---|---|---|
| Does each still make its point on its own, as a poster frame? | | |
| Can every word be read on the phone sheet? | | |
| Is each frame laid out with one clear focus? | | |
| Brand: only its colours, faces, voice and allowed proof? | | |
| Is the product real (captured, or a rebuild the brief names)? | | |

## Notes
`,
  )
  console.log(`stills → ${OUT}`)
  process.exit(0)
}

await sheet(sample(every), 270 / width, 6, 'contact.png')
await sheet(sample(phoneEvery), 360 / width, 4, 'phone.png', { overlay: safe ? safeOutlineSvg : undefined })
await browser.close({ silent: true })

// ── Sound ─────────────────────────────────────────────────────────────

let audio = '_No video given (`--video`), so no sound check._'
let truePeak = null
if (hasVideo) {
  const wav = join(tmp, 'mix.wav')
  const ff = spawnSync('npx', ['remotion', 'ffmpeg', '-y', '-loglevel', 'error', '-i', args.video, '-vn', '-ac', '2', '-ar', '48000', wav], {
    stdio: 'inherit',
  })
  if (ff.status === 0) {
    const sr = 48000
    const mix = readWav(wav, sr)
    const spf = sr / fps
    const framePeak = (f) => peakDb(mix, Math.floor(f * spf), Math.floor((f + 1) * spf))
    let clipped = 0
    for (const ch of mix) for (const v of ch) if (Math.abs(v) >= 0.999) clipped++
    const rows = [
      `| Integrated loudness | ${integratedLufs(mix, sr).toFixed(1)} LUFS | target −14 to −16 |`,
      `| Sample peak | ${peakDb(mix).toFixed(1)} dBFS | ≤ −1 |`,
      // Measured on the encoded file: AAC and the resample to 48 kHz can lift peaks between samples.
      `| True peak | ${(truePeak = truePeakDb(mix)).toFixed(1)} dBTP | ≤ −1 |`,
      `| Clipped samples | ${clipped} | 0 |`,
    ]
    audio = `| Measure | Value | Target |\n|---|---|---|\n${rows.join('\n')}`

    if (existsSync(args.cues)) {
      const { cues } = JSON.parse(readFileSync(args.cues, 'utf8'))
      const lift = cues.map(({ name, frame }) => {
        // The bed's floor just before the cue (quietest of the 8 frames before), so a
        // cue in a fast run is measured against the music, not the previous cue.
        const before = Math.min(...Array.from({ length: 8 }, (_, i) => framePeak(frame - 1 - i)))
        const after = Math.max(...Array.from({ length: 8 }, (_, i) => framePeak(frame + i)))
        return `| ${name} | ${frame} | ${before.toFixed(1)} | ${after.toFixed(1)} | ${(after - before).toFixed(1)} |`
      })
      audio +=
        '\n\nEach cue should rise clearly above the bed\'s floor just before it (≈ +4 dB or more), exactly at its frame.\n\n' +
        '| Cue | Frame | Bed floor before (dBFS) | Peak after (dBFS) | Lift (dB) |\n|---|---|---|---|---|\n' +
        lift.join('\n')
    }
  }
}

// ── Motion ────────────────────────────────────────────────────────────

/** Latest change to anything under `dirs` (skipping `skip`), in ms. */
function newest(dirs, skip) {
  let latest = 0
  for (const dir of dirs.filter((d) => existsSync(d))) {
    for (const rel of readdirSync(dir, { recursive: true })) {
      const path = join(dir, rel)
      if (!path.startsWith(skip)) latest = Math.max(latest, statSync(path).mtimeMs)
    }
  }
  return latest
}

let motion = '_No video given (`--video`), so no motion checks._'
let motionResult = null
if (hasVideo) {
  console.log('motion checks…')
  const video = probe(args.video)
  const warnings = []
  if (Math.abs(video.width / video.height - width / height) > 0.01) {
    warnings.push(`⚠ \`${args.video}\` is ${video.width}×${video.height} but ${args.comp} is ${width}×${height}: is it the right video?`)
  }
  if (Number.isFinite(video.frames) && video.frames !== total) {
    warnings.push(`⚠ \`${args.video}\` has ${video.frames} frames, ${args.comp} has ${total}: render again.`)
  }
  // public/audio is rebuilt by every `npm run audio`; its sources are in scripts/.
  if (newest(['src', 'scripts', 'public'], join('public', 'audio')) > statSync(args.video).mtimeMs) {
    warnings.push(`⚠ Files in src/, scripts/ or public/ changed after \`${args.video}\` was rendered: these checks and the sound describe an older cut.`)
  }

  const size = checkSize(video.width, video.height)
  motionResult = motionChecks({ frames: decodeFrames(args.video, size.width, size.height), ...size, fps: video.fps, grid: beatGrid })

  // Up close: the frame before, the frame, the frame after, for each flagged moment.
  const flagged = flaggedFrames(motionResult)
  if (flagged.length) {
    const fw = 360
    const fh = Math.round((fw * video.height) / video.width / 2) * 2
    const bar = 22
    const layers = []
    for (const [row, { frame, why }] of flagged.entries()) {
      const from = Math.max(0, frame - 1)
      const strip = decodeFrames(args.video, fw, fh, { from, to: Math.min(motionResult.frames - 1, frame + 1) })
      for (const [j, rgb] of strip.entries()) {
        const top = row * (fh + bar)
        const input = await sharp(Buffer.from(rgb.buffer, rgb.byteOffset, rgb.length), { raw: { width: fw, height: fh, channels: 3 } }).png().toBuffer()
        layers.push({ input: label(`f${from + j}${from + j === frame ? ` · ${why}` : ''}`, fw, bar), left: j * fw, top })
        layers.push({ input, left: j * fw, top: top + bar })
      }
    }
    await sharp({ create: { width: 3 * fw, height: flagged.length * (fh + bar), channels: 3, background: '#16181d' } })
      .composite(layers)
      .png()
      .toFile(join(OUT, 'flags.png'))
  }

  motion = [
    ...warnings,
    ...(warnings.length ? [''] : []),
    'The rendered video, every frame. A heuristic: ⚠ is for the critic to judge, ✗ breaks a house rule.' +
      (flagged.length ? ' `flags.png` shows each flagged moment with the frames either side.' : ''),
    '',
    motionReport(motionResult),
    ...(beatNote ? ['', beatNote] : []),
  ].join('\n')
}

// ── Report + scorecard ───────────────────────────────────────────────

writeFileSync(
  join(OUT, 'report.md'),
  `# Review ${stamp} · ${args.comp}

${composition.width}×${composition.height} @ ${fps} fps · ${(total / fps).toFixed(1)} s

Look at \`contact.png\` (rhythm, variety, composition) and \`phone.png\` (360 px:
can every word be read?) before scoring.${
  safe
    ? `

The dashed outline on \`phone.png\` is the area Reels, TikTok and Shorts leave
clear (Meta's 14 % top / 35 % bottom / 6 % sides, stepping in on the right for
the action buttons). Words, the product or the CTA outside it may sit under the
apps' UI.`
    : ''
}

## Motion checks

${motion}

## Sound

${audio}

## Scorecard (1–10; ships at 8+ on every row)

| Question | Score | Frames that show it |
|---|---|---|
| Would a thumb stop? (point on screen by 2 s) | | |
| Can every word be read on the phone sheet? | | |
| Does the picture keep changing, with no idle stretch? | | |
| Do moves land on beats, on springs, without wobble? | | |
| Is each frame laid out with one clear focus? | | |
| Brand: only its colours, faces, voice and allowed proof? | | |
| Do cues meet their hits, and does it work muted? | | |

## Costliest issues (three at most)

1.
2.
3.

## Fixes this round
`,
)

console.log(`review → ${OUT}`)

if (args.strict) {
  const fails = []
  if (!hasVideo) fails.push('no --video to check')
  if (motionResult && flashFailed(motionResult)) fails.push('flashes past WCAG 2.3.1 (see report.md)')
  if (truePeak !== null && truePeak > -1) fails.push(`true peak ${truePeak.toFixed(1)} dBTP, over −1`)
  if (fails.length) {
    console.error(`strict: ${fails.join('; ')}`)
    process.exitCode = 1
  }
}
