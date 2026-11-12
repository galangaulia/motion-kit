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
//                sample and true peak, clipping, per-cue lift over the bed, how well
//                the music's own kicks line up with the declared beat grid, the
//                licence of any sound from outside the kit (public/audio/sources.json),
//                and the scorecard to fill in (CLAUDE.md "Review loop")
//   sound.html   every cue, clickable: hear it in the mix, and alone when
//                build-audio.mjs wrote its dry clip to public/audio/cues/
//                (only when there's a video and cues.json)
//   flags.png    the frames before, at and after each moment the motion checks flag
//   CREDITS.txt  the outside sound, for the post's description (only when there is some)
//
// --strict exits 1 (after writing everything) when the film flashes past WCAG
// 2.3.1, its true peak is over −1 dBTP, the music is audibly off the beat grid
// (median kick offset over a quarter of a beat, with most beats found), or a sound
// source has a licence problem (missing, non-commercial, no-derivatives, or checked
// more than 30 days ago). Synthesized music passes the last two by construction.
// The other checks only inform the critic.
//
// --stills is the key-stills gate (CLAUDE.md, gate 2b): it renders only the frames
// in src/timeline.ts's STILLS (or --frames) into out/review/<stamp>-<comp>-stills/:
// stills/fNNNN.png at full size, stills.png side by side, phone.png at 360 px, and
// a short report to approve the look before the rest of the film is animated.
//
// Any engine: the film's package.json names it ("motionKit": { "engine" }, Remotion
// when absent) and @motion-kit/<engine>/review supplies the frames. Remotion renders
// them from source (--comp is a composition id); HyperFrames and Manim films are
// read from their render (--comp is a format in src/formats.ts, --video is needed
// for the sheets) and render key stills themselves.
//
// The sheets are cut from --video, one ffmpeg pass per sheet, when it matches the
// composition (length, rate, shape) and nothing in src/, scripts/, public/ or manim/
// changed after it was rendered. Remotion renders from source only the tiles wider
// than the video, so nothing is upscaled: a --scale=0.5 preview of a 540×960 film is
// 270 px wide, enough for contact.png, not for phone.png's 360. It bundles the film
// and opens Chrome only when some tile needs it. report.md says where each sheet's
// tiles came from. --stills always renders from source.

import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { basename, dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { beatAlignment, integratedLufs, peakDb, readWav, truePeakDb, writeWav } from '@motion-kit/audio'
import { checkSize, decodeFrames, extractAudio, pickFrames, probe } from '@motion-kit/media'
import sharp from 'sharp'
import { flaggedFrames, flashFailed, motionChecks, motionReport } from './motion-checks.mjs'
import { isStoryFormat, safeOutlineSvg } from './safe-zones.mjs'
import { soundReportHtml } from './sound-report.mjs'
import { checkSources, creditsText } from './sound-sources.mjs'
import { guessMeta, tileLine, whyNotVideo } from './tiles.mjs'

const { values: args } = parseArgs({
  options: {
    comp: { type: 'string' },
    entry: { type: 'string', default: 'src/index.ts' },
    video: { type: 'string' },
    every: { type: 'string' },
    phoneEvery: { type: 'string' },
    cues: { type: 'string', default: 'public/audio/cues.json' },
    sources: { type: 'string', default: 'public/audio/sources.json' },
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

const hasVideo = Boolean(args.video && existsSync(args.video))

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

// The render, and whether anything it was made from changed after it.
// public/audio is rebuilt by every `npm run audio`; its sources are in scripts/.
// manim/ holds the scenes of a film's Manim clips (public/clips is built from them).
const videoInfo = hasVideo ? probe(args.video) : null
const stale = hasVideo && newest(['src', 'scripts', 'public', 'manim'], join('public', 'audio')) > statSync(args.video).mtimeMs

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

// The engine that made the film (package.json → "motionKit": { "engine" }; films
// from before engines say nothing and are Remotion) supplies its size, rate and
// length, and renders or cuts out any frame: @motion-kit/<engine>/review.
const pkg = existsSync('package.json') ? JSON.parse(readFileSync('package.json', 'utf8')) : {}
const engine = pkg.motionKit?.engine ?? 'remotion'
let enginePath
try {
  enginePath = createRequire(resolve('package.json')).resolve(`@motion-kit/${engine}/review`)
} catch {
  console.error(`No review support for engine "${engine}": @motion-kit/${engine}/review didn't resolve (run npm install at the repo root).`)
  process.exit(1)
}
const adapter = await (await import(pathToFileURL(enginePath).href)).open({
  comp: args.comp,
  entry: args.entry,
  video: hasVideo ? args.video : undefined,
  stills: args.stills,
  timeline,
  tmp,
  // Remotion bundles the film just to learn the composition's size, rate and
  // length. With a render to cut the sheets from, this guess lets it wait.
  guess: args.stills ? null : guessMeta(timeline, videoInfo),
})

// Each sheet's tiles are cut from the render, or else drawn by the engine; the
// reason they aren't cut, per sheet (null: they are).
const TILE_WIDTHS = { contact: 270, phone: 360 }
const fromSource = Boolean(adapter.fromSource)
const whyNot = (meta) =>
  Object.fromEntries(
    Object.entries(TILE_WIDTHS).map(([sheet, tileWidth]) => [
      sheet,
      whyNotVideo({ video: hasVideo ? args.video : null, info: videoInfo, meta, stale, tileWidth, fromSource }),
    ]),
  )
let meta = adapter.meta
let guessed = Boolean(adapter.guessed)
let notCut = args.stills ? null : whyNot(meta)
// A guess holds only while nothing is rendered from source. Once something is,
// the film is bundled anyway, and the composition's own numbers decide.
if (guessed && Object.values(notCut).some(Boolean)) {
  meta = await adapter.resolveMeta()
  guessed = false
  notCut = whyNot(meta)
}
const { fps, width, height, durationInFrames: total } = meta
const safe = args.safe ?? isStoryFormat(width, height)

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

/** Frame `frame` at `scale` × the composition size; engines that hand back another size are resized. */
async function still(frame, scale) {
  const png = await adapter.still(frame, scale)
  const w = Math.round(width * scale)
  const { width: got } = await sharp(png).metadata()
  return got === w ? png : sharp(png).resize(w, Math.round(height * scale), { kernel: 'lanczos3' }).png().toBuffer()
}

const escapeXml = (text) => String(text).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c])
const label = (text, w, h) =>
  Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#16181d"/>` +
      `<text x="8" y="${h - 8}" font-family="Menlo, monospace" font-size="13" fill="#c8cdd9">${escapeXml(text)}</text></svg>`,
  )

async function sheet(frames, scale, cols, file, { overlay, names, cut } = {}) {
  let tiles = []
  if (cut) {
    // The whole sheet in one pass over the render, scaled down like still() does.
    const raw = { width: Math.round(width * scale), height: Math.round(height * scale), channels: 3 }
    process.stdout.write(`${file}: cutting…`)
    const picked = await pickFrames(args.video, frames, raw.width, raw.height)
    tiles = picked.map((rgb, i) => ({ frame: frames[i], input: Buffer.from(rgb.buffer, rgb.byteOffset, rgb.length), raw }))
  } else {
    for (const f of frames) {
      process.stdout.write(`\r${file}: frame ${f}   `)
      tiles.push({ frame: f, input: await still(f, scale) })
    }
  }
  const { width: w, height: h } = tiles[0].raw ?? (await sharp(tiles[0].input).metadata())
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
          { input: t.input, ...(t.raw && { raw: t.raw }), left, top: top + bar },
          ...(over ? [{ input: over, left, top: top + bar }] : []),
        ]
      }),
    )
    .png()
    .toFile(join(OUT, file))
  process.stdout.write(`\r${file}: ${tiles.length} frames${cut ? ` cut from ${args.video}` : ''}\n`)
}

if (args.stills) {
  // Full size is what the finals render at: 1080 on the short side.
  mkdirSync(join(OUT, 'stills'), { recursive: true })
  const full = 1080 / Math.min(width, height)
  await adapter.prepare?.(stills.map((s) => s.frame))
  for (const { frame } of stills) {
    process.stdout.write(`\rstills: frame ${frame}   `)
    writeFileSync(join(OUT, 'stills', `f${String(frame).padStart(4, '0')}.png`), await still(frame, full))
  }
  process.stdout.write(`\rstills: ${stills.length} frames\n`)
  const frames = stills.map((s) => s.frame)
  const names = new Map(stills.map((s) => [s.frame, s.label]))
  await sheet(frames, 540 / Math.min(width, height), 2, 'stills.png', { names })
  await sheet(frames, 360 / width, 4, 'phone.png', { names, overlay: safe ? safeOutlineSvg : undefined })
  await adapter.close()

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

await sheet(sample(every), TILE_WIDTHS.contact / width, 6, 'contact.png', { cut: !notCut.contact })
await sheet(sample(phoneEvery), TILE_WIDTHS.phone / width, 4, 'phone.png', { cut: !notCut.phone, overlay: safe ? safeOutlineSvg : undefined })
await adapter.close()
const tileLines = Object.keys(TILE_WIDTHS)
  .map((sheet) => tileLine(`${sheet}.png`, notCut[sheet], { video: args.video, info: videoInfo, fromSource }))
  .join('\n')

// ── Sound ─────────────────────────────────────────────────────────────

let audio = '_No video given (`--video`), so no sound check._'
let truePeak = null
let beatAlign = null
if (hasVideo) {
  const wav = join(tmp, 'mix.wav')
  if (!extractAudio(args.video, wav, 48000)) {
    audio = `_\`${args.video}\` has no sound track, so no sound check._`
  } else {
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
      // Dry clips build-audio.mjs wrote next to cues.json, one per cue in the
      // same order, numbered so duplicate names (two "whoosh") don't collide.
      const cuesDir = join(dirname(args.cues), 'cues')
      const rows = cues.map(({ name, frame }, i) => {
        // The bed's floor just before the cue (quietest of the 8 frames before), so a
        // cue in a fast run is measured against the music, not the previous cue.
        // Clamped to the video's own frames: a cue near the very start or end
        // read past them (frame -1, or past `total`) as silence either way.
        const before = Math.min(...Array.from({ length: 8 }, (_, j) => framePeak(Math.max(0, frame - 1 - j))))
        const after = Math.max(...Array.from({ length: 8 }, (_, j) => framePeak(Math.min(total - 1, frame + j))))
        const clip = join(cuesDir, `${String(i).padStart(2, '0')}-${name.replace(/[^a-z0-9-]/gi, '-')}.wav`)
        return { name, frame, time: frame / fps, before, after, lift: after - before, clip: existsSync(clip) ? clip : null }
      })
      audio +=
        '\n\nEach cue should rise clearly above the bed\'s floor just before it (≈ +4 dB or more), exactly at its frame.\n\n' +
        '| Cue | Frame | Bed floor before (dBFS) | Peak after (dBFS) | Lift (dB) |\n|---|---|---|---|---|\n' +
        rows.map((r) => `| ${r.name} | ${r.frame} | ${r.before.toFixed(1)} | ${r.after.toFixed(1)} | ${r.lift.toFixed(1)} |`).join('\n')

      // A page to actually hear each cue: in context (seeking the mix) and alone,
      // when build-audio.mjs wrote its dry clip.
      mkdirSync(join(OUT, 'sound'), { recursive: true })
      writeWav(join(OUT, 'sound', 'mix.wav'), mix, sr)
      const soundRows = rows.map((r) => {
        const clip = r.clip ? `sound/${basename(r.clip)}` : null
        if (r.clip) copyFileSync(r.clip, join(OUT, 'sound', basename(r.clip)))
        return { name: r.name, time: r.time, lift: r.lift, clip }
      })
      writeFileSync(join(OUT, 'sound.html'), soundReportHtml({ cues: soundRows, mix: 'sound/mix.wav' }))
      audio += '\n\nListen to every cue, in context and alone: `sound.html`.'
    }

    // Does the music's own beat line up with the grid the picture was cut
    // to? Synthesized music is correct by construction; this earns its keep
    // on a bought or licensed track, whose tempo might not exactly match.
    if (beatGrid) {
      const totalBeats = Math.floor(beatGrid.at(total))
      beatAlign = beatAlignment(mix, sr, beatGrid, { to: totalBeats })
      const perBeatMs = (beatGrid.perBeat / beatGrid.fps) * 1000
      const found = beatAlign.beats.length - beatAlign.missing.length
      audio += `\n\n**Beat alignment** — ${found}/${beatAlign.beats.length} beats of the grid found in the mix`
      if (beatAlign.medianErrorMs === null) {
        audio += '. No kicks found near any beat: is this the right track, or does it have an audible beat at all?'
      } else {
        const sign = beatAlign.medianErrorMs >= 0 ? '+' : ''
        audio += `, median ${sign}${beatAlign.medianErrorMs.toFixed(0)} ms off, worst ${beatAlign.maxErrorMs.toFixed(0)} ms.`
        if (Math.abs(beatAlign.medianErrorMs) > perBeatMs * 0.15) {
          const dir = beatAlign.medianErrorMs > 0 ? 'late' : 'early'
          audio += ` Consistently ${dir} — shift the grid's \`offset\` by ${beatAlign.suggestedOffsetFrames} frame${Math.abs(beatAlign.suggestedOffsetFrames) === 1 ? '' : 's'}, or check the track's real tempo against the declared BPM.`
        }
      }
    } else {
      audio += `\n\n_${beatNote || 'No beat grid to check the music against.'}_`
    }
  }
}

// ── Sound sources ─────────────────────────────────────────────────────

let sources = `_No \`${args.sources}\`, so sound from outside the kit isn't checked: add \`SOURCES\` to scripts/build-audio.mjs (docs/sound.md)._`
let sourceProblems = null
if (existsSync(args.sources)) {
  const list = JSON.parse(readFileSync(args.sources, 'utf8'))
  if (!list.length) {
    sources = 'Everything was synthesized by `@motion-kit/audio`: nothing to license.'
    sourceProblems = []
  } else {
    const checked = checkSources(list, { today: new Date().toISOString().slice(0, 10) })
    sourceProblems = checked.filter((c) => c.problems.length)
    writeFileSync(join(OUT, 'CREDITS.txt'), creditsText(list, basename(process.cwd())))
    const cell = (v) => String(v ?? '').replaceAll('|', '\\|')
    const verdict = ({ problems, note }) => (problems.length ? `✗ ${cell(problems.join('; '))}` : note ? `⚠ ${note}` : '✓')
    sources = [
      "Sound from outside the kit. Before the finals, open each page, confirm its licence still allows this film's channel, and update `checked`. `CREDITS.txt` lists them for the post's description.",
      '',
      '| Sound | By | Licence | Checked | |',
      '|---|---|---|---|---|',
      ...checked.map((c) => {
        const s = c.source
        return `| ${cell(s.kind ?? 'sound')}: [${cell(s.title)}](${s.url ?? ''}) | ${cell(s.author)} | ${cell(s.licence)} | ${cell(s.checked)} | ${verdict(c)} |`
      }),
    ].join('\n')
  }
}

// ── Motion ────────────────────────────────────────────────────────────

let motion = '_No video given (`--video`), so no motion checks._'
let motionResult = null
if (hasVideo) {
  console.log('motion checks…')
  const video = videoInfo
  const warnings = []
  if (Math.abs(video.width / video.height - width / height) > 0.01) {
    warnings.push(`⚠ \`${args.video}\` is ${video.width}×${video.height} but ${args.comp} is ${width}×${height}: is it the right video?`)
  }
  if (Number.isFinite(video.frames) && video.frames !== total) {
    warnings.push(`⚠ \`${args.video}\` has ${video.frames} frames, ${args.comp} has ${total}: render again.`)
  }
  if (stale) {
    warnings.push(`⚠ Files in src/, scripts/, public/ or manim/ changed after \`${args.video}\` was rendered: these checks and the sound describe an older cut.`)
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

${width}×${height} @ ${fps} fps · ${(total / fps).toFixed(1)} s${
  guessed ? ' (`FPS` and `TOTAL_FRAMES` from src/timeline.ts, the video at half size: the film wasn\'t bundled)' : ''
}

${tileLines}

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

### Sources

${sources}

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
  if (beatAlign && beatAlign.medianErrorMs !== null && beatAlign.confidence >= 0.5) {
    const perBeatMs = (beatGrid.perBeat / beatGrid.fps) * 1000
    if (Math.abs(beatAlign.medianErrorMs) > perBeatMs * 0.25) {
      fails.push(`soundtrack ${beatAlign.medianErrorMs.toFixed(0)} ms off the beat grid (see report.md)`)
    }
  }
  if (sourceProblems?.length) fails.push(`${sourceProblems.length} sound source(s) with licence problems (see report.md)`)
  if (fails.length) {
    console.error(`strict: ${fails.join('; ')}`)
    process.exitCode = 1
  }
}
