#!/usr/bin/env node
// motion-review — what the critic looks at before scoring a round.
//
// Run from a film folder (its `npm run review` does this):
//   motion-review --comp PrdCritique --video out/film.mp4 [--every 30] [--entry src/index.ts]
//
// Writes out/review/<stamp>-<comp>/:
//   contact.png  one frame every --every frames (default 1 s), labelled
//   phone.png    frames at 360 px wide — the real phone-feed size, unscaled
//   report.md    loudness, peak, clipping, per-cue lift over the bed, and the
//                scorecard to fill in (CLAUDE.md "Review loop")

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { integratedLufs, peakDb, readWav } from '@motion-kit/audio'
import { bundle } from '@remotion/bundler'
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer'
import sharp from 'sharp'

const { values: args } = parseArgs({
  options: {
    comp: { type: 'string' },
    entry: { type: 'string', default: 'src/index.ts' },
    video: { type: 'string' },
    every: { type: 'string' },
    phoneEvery: { type: 'string' },
    cues: { type: 'string', default: 'public/audio/cues.json' },
  },
})
if (!args.comp) {
  console.error('usage: motion-review --comp <id> [--video out/film.mp4] [--every <frames>]')
  process.exit(1)
}

const stamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-')
// One folder per run and composition, so back-to-back reviews never overwrite each other.
const OUT = resolve('out', 'review', `${stamp}-${args.comp}`)
mkdirSync(OUT, { recursive: true })

// ── Frames ────────────────────────────────────────────────────────────

// Everything temporary lives under one folder that is removed on exit — renders
// at 1080p and up fill a disk fast if stills and bundles are left behind.
const tmp = mkdtempSync(join(tmpdir(), 'motion-review-'))
process.on('exit', () => rmSync(tmp, { recursive: true, force: true }))

console.log('bundling…')
const serveUrl = await bundle({ entryPoint: resolve(args.entry), outDir: join(tmp, 'bundle') })
const composition = await selectComposition({ serveUrl, id: args.comp })
const { fps, width, durationInFrames: total } = composition
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

const label = (text, w, h) =>
  Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#16181d"/>` +
      `<text x="8" y="${h - 8}" font-family="Menlo, monospace" font-size="13" fill="#c8cdd9">${text}</text></svg>`,
  )

async function sheet(frames, scale, cols, file) {
  const tiles = []
  for (const f of frames) {
    process.stdout.write(`\r${file}: frame ${f}   `)
    tiles.push({ frame: f, png: await still(f, scale) })
  }
  const { width: w, height: h } = await sharp(tiles[0].png).metadata()
  const bar = 22
  const rows = Math.ceil(tiles.length / cols)
  await sharp({ create: { width: cols * w, height: rows * (h + bar), channels: 3, background: '#16181d' } })
    .composite(
      tiles.flatMap((t, i) => {
        const left = (i % cols) * w
        const top = Math.floor(i / cols) * (h + bar)
        return [
          { input: label(`f${t.frame} · ${(t.frame / fps).toFixed(1)}s`, w, bar), left, top },
          { input: t.png, left, top: top + bar },
        ]
      }),
    )
    .png()
    .toFile(join(OUT, file))
  process.stdout.write(`\r${file}: ${tiles.length} frames\n`)
}

await sheet(sample(every), 270 / width, 6, 'contact.png')
await sheet(sample(phoneEvery), 360 / width, 4, 'phone.png')
await browser.close({ silent: true })

// ── Sound ─────────────────────────────────────────────────────────────

let audio = '_No video given (`--video`), so no sound check._'
if (args.video && existsSync(args.video)) {
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

// ── Report + scorecard ───────────────────────────────────────────────

writeFileSync(
  join(OUT, 'report.md'),
  `# Review ${stamp} · ${args.comp}

${composition.width}×${composition.height} @ ${fps} fps · ${(total / fps).toFixed(1)} s

Look at \`contact.png\` (rhythm, variety, composition) and \`phone.png\` (360 px:
can every word be read?) before scoring.

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
