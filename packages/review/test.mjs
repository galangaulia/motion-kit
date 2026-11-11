// Sanity checks for the pure parts of motion-review. Run: npm test
// (review.mjs itself runs on import, so only its pure modules are loaded here.)
import assert from 'node:assert/strict'
import { grid } from '../core/src/beats.ts'
import { checkSize } from '@motion-kit/media'
import { flaggedFrames, flashFailed, motionChecks, motionReport, onBeat } from './src/motion-checks.mjs'
import { isStoryFormat, safeOutline, safeOutlineSvg } from './src/safe-zones.mjs'
import { soundReportHtml } from './src/sound-report.mjs'
import { checkSources, creditsText } from './src/sound-sources.mjs'

const near = (got, want, tol, label) => assert.ok(Math.abs(got - want) <= tol, `${label}: got ${got}, want ${want}`)

// Safe zone: only 9:16 frames get the outline.
assert.ok(isStoryFormat(1080, 1920), '9:16 is a story frame')
assert.ok(!isStoryFormat(1080, 1350), '4:5 is a feed post')
assert.ok(!isStoryFormat(1080, 1080), '1:1 is not')
assert.ok(!isStoryFormat(1920, 1080), '16:9 is not')

// Meta's margins on a 1080 × 1920 frame: 14 % top, 35 % bottom, 6 % sides.
const outline = safeOutline(1080, 1920)
const xs = outline.map(([x]) => x)
const ys = outline.map(([, y]) => y)
near(Math.min(...ys), 268.8, 0.01, 'top margin')
near(1920 - Math.max(...ys), 672, 0.01, 'bottom margin')
near(Math.min(...xs), 64.8, 0.01, 'left margin')
near(1080 - Math.max(...xs), 64.8, 0.01, 'right margin above the buttons')
// Below 45 % of the height the right edge steps in 18 % for the action buttons.
const railPoints = outline.filter(([x]) => Math.abs(1080 - x - 194.4) < 0.01)
assert.equal(railPoints.length, 2, 'two corners on the button rail')
assert.ok(railPoints.every(([, y]) => y >= 864), 'the rail starts 45 % down')
assert.match(safeOutlineSvg(270, 480), /^<svg width="270" height="480"/)

// ── Motion checks, on synthetic films ────────────────────────────────

// Decode sizes: 64 px on the short side, sides a multiple of 16.
assert.deepEqual(checkSize(1080, 1080), { width: 64, height: 64 })
assert.deepEqual(checkSize(1080, 1920), { width: 64, height: 112 })
assert.deepEqual(checkSize(1920, 1080), { width: 112, height: 64 })

const W = 64
const H = 64
const PAPER = [240, 238, 232]
const INK = [24, 24, 28]

/** One rgb24 frame: rectangles with sub-pixel edges on a flat ground, plus ±1 of seeded noise. */
function paint(rects, { bg = PAPER, seed = 0 } = {}) {
  const f = new Uint8Array(W * H * 3)
  let s = seed * 7919 + 1
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = [...bg]
      for (const { x0, y0, x1, y1, color = INK } of rects) {
        const cover = Math.max(0, Math.min(x + 1, x1) - Math.max(x, x0)) * Math.max(0, Math.min(y + 1, y1) - Math.max(y, y0))
        for (let k = 0; k < 3; k++) c[k] += (color[k] - c[k]) * cover
      }
      s = (s * 1103515245 + 12345) >>> 0
      const noise = (s >>> 16) % 3 - 1
      for (let k = 0; k < 3; k++) f[(y * W + x) * 3 + k] = Math.max(0, Math.min(255, Math.round(c[k] + noise)))
    }
  }
  return f
}
const film = (n, rectsAt, opts = {}) => Array.from({ length: n }, (_, i) => paint(rectsAt(i), { seed: i, ...opts }))
const check = (frames, fps = 30, extra = {}) => motionChecks({ frames, width: W, height: H, fps, grid: grid(120, fps), ...extra })
const word = (x = 20, y = 28) => ({ x0: x, y0: y, x1: x + 16, y1: y + 8 })
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))

for (const fps of [30, 60]) {
  const s = (sec) => Math.round(sec * fps)

  // A word that glides in and settles: nothing to flag.
  {
    const r = check(film(s(2), (i) => [word(4 + 36 * ease(i / s(0.6)), 28)]), fps)
    assert.equal(r.glitches.length, 0, `${fps}: smooth move has no glitch`)
    assert.equal(r.snaps.length, 0, `${fps}: smooth move has no snap`)
    assert.equal(r.cuts.length, 0, `${fps}: smooth move has no cut`)
    assert.ok(!flashFailed(r), `${fps}: smooth move doesn't flash`)
  }

  // The word drops out for one frame, then for two.
  for (const len of [1, 2]) {
    const at = s(1)
    const r = check(film(s(2), (i) => (i >= at && i < at + len ? [] : [word()])), fps)
    assert.equal(r.glitches.length, 1, `${fps}: one ${len}-frame glitch`)
    assert.equal(r.glitches[0].frame, at, `${fps}: glitch frame`)
    assert.equal(r.glitches[0].length, len, `${fps}: glitch length`)
    assert.equal(r.snaps.length, 0, `${fps}: a glitch isn't also a snap`)
  }

  // A word that appears without moving.
  {
    const r = check(film(s(2), (i) => (i >= s(1) ? [word()] : [])), fps)
    assert.deepEqual(
      r.snaps.map((x) => x.frame),
      [s(1)],
      `${fps}: a word popping in is a snap`,
    )
  }

  // Hard cuts: on beat 4, and half a beat later.
  for (const [beat, on] of [
    [4, true],
    [4.5, false],
  ]) {
    const at = Math.round((beat * 60 * fps) / 120)
    const r = check(film(s(4), (i) => (i < at ? [word(4, 8)] : [{ x0: 0, y0: 0, x1: W, y1: H, color: [30, 90, 70] }, word(40, 44)])), fps)
    assert.equal(r.cuts.length, 1, `${fps}: one cut at beat ${beat}`)
    assert.equal(r.cuts[0].frame, at, `${fps}: cut frame`)
    assert.equal(r.cuts[0].on, on, `${fps}: cut at beat ${beat} on the beat: ${on}`)
  }

  // Moves for half a second, holds 1.5 s, moves again.
  {
    const x = (i) => (i < s(0.5) ? 4 + 20 * (i / s(0.5)) : i < s(2) ? 24 : 24 + 20 * ((i - s(2)) / s(0.5)))
    const r = check(film(s(2.5), (i) => [word(x(i), 28)]), fps)
    near(r.frozen[0]?.seconds ?? 0, 1.5, 2 / fps, `${fps}: the hold is found`)
  }

  // A big card breathing with the kick for 3 s: never frozen, but no new picture either.
  {
    const g = grid(120, fps)
    const r = check(
      film(s(3), (i) => {
        const k = 1 + 0.012 * g.pulse(i)
        const half = 20 * k
        return [{ x0: 32 - half, y0: 32 - half, x1: 32 + half, y1: 32 + half }]
      }),
      fps,
    )
    assert.equal(r.frozen.length, 0, `${fps}: breathing isn't a freeze`)
    assert.ok(r.stretches[0].seconds > 2, `${fps}: breathing isn't a new picture (${r.stretches[0].seconds} s)`)
    assert.match(motionReport(r), /⚠ 3\.0 s/, `${fps}: the report warns about the stretch`)
  }

  // Flashes. A flat field switching between two levels `hz` times a second.
  const square = (hz, lo, hi, rect = { x0: 0, y0: 0, x1: W, y1: H }) =>
    film(s(2), (i) => (Math.floor((2 * hz * i) / fps) % 2 ? [{ ...rect, color: hi }] : [{ ...rect, color: lo }]))
  const grey = (v) => [v, v, v]
  assert.ok(!flashFailed(check(square(3, grey(60), grey(200)), fps)), `${fps}: 3 flashes a second pass`)
  assert.ok(flashFailed(check(square(3.75, grey(60), grey(200)), fps)), `${fps}: 3.75 a second fail`)
  assert.ok(!flashFailed(check(square(5, grey(237), grey(250)), fps)), `${fps}: bright to brighter is no flash`)
  assert.ok(!flashFailed(check(square(5, grey(60), grey(200), { x0: 28, y0: 28, x1: 32, y1: 32 }), fps)), `${fps}: one small spot is under the area limit`)
  {
    const r = check(film(s(2), (i) => [{ x0: 0, y0: 0, x1: W, y1: H, color: grey(Math.round(255 * Math.min(1, i / fps))) }]), fps)
    assert.ok(!flashFailed(r), `${fps}: a one-second fade is no flash`)
  }
  // A beat pulse on half the frame: 3 a second (180 BPM) passes, 4 (240 BPM) fails.
  for (const [bpm, fails] of [
    [180, false],
    [240, true],
  ]) {
    const g = grid(bpm, fps)
    const frames = film(s(2), (i) => [{ x0: 0, y0: 0, x1: W / 2, y1: H, color: grey(g.pulse(i, 1, 3) > 0.5 ? 200 : 120) }])
    assert.equal(flashFailed(check(frames, fps)), fails, `${fps}: half-frame pulse at ${bpm} BPM fails: ${fails}`)
  }
  // Saturated red against a grey of the same luminance: only the red rule catches it.
  {
    const r = check(square(5, [127, 127, 127], [255, 0, 0]), fps)
    assert.equal(r.flashes.general.fails.length, 0, `${fps}: equal-luminance red isn't a general flash`)
    assert.ok(r.flashes.red.fails.length > 0, `${fps}: but it is a red flash`)
    assert.match(motionReport(r), /Red flashes[^\n]*✗/, `${fps}: the report marks it`)
    assert.equal(flaggedFrames(r)[0].why, 'flash', `${fps}: flashes are flagged first`)
  }
}

// On the beat means up to two frames early (a hit's lead) or one late.
{
  const g = grid(120, 30)
  assert.deepEqual(onBeat(58, g), { beat: 4, on: true })
  assert.deepEqual(onBeat(61, g), { beat: 4, on: true })
  assert.equal(onBeat(63, g).on, false)
  assert.deepEqual(onBeat(63, null), { beat: null, on: null })
}

// ── Sound sources ─────────────────────────────────────────────────────

{
  const track = {
    file: 'sound/bed.wav',
    kind: 'music',
    title: 'Morning Light',
    author: 'A. Composer',
    url: 'https://example.com/track/1',
    licence: 'CC0 1.0',
    checked: '2026-10-10',
  }
  const today = '2026-10-16'
  const [ok] = checkSources([track], { today })
  assert.deepEqual(ok.problems, [], 'a complete, recently checked CC0 track passes')
  assert.equal(ok.note, null, 'CC0 needs no credit')

  const [missing] = checkSources([{ ...track, url: '', checked: undefined }], { today })
  assert.deepEqual(missing.problems, ['no url', 'no checked'], 'missing fields are named')

  const [stale] = checkSources([{ ...track, checked: '2026-08-01' }], { today })
  assert.match(stale.problems[0], /76 days ago/, 'an old licence check must be redone')
  assert.match(checkSources([{ ...track, checked: '16/10/2026' }], { today })[0].problems[0], /isn't a YYYY-MM-DD/)
  assert.match(checkSources([{ ...track, checked: '2026-10-20' }], { today })[0].problems[0], /in the future/)

  assert.match(checkSources([{ ...track, licence: 'CC BY-NC 4.0' }], { today })[0].problems[0], /non-commercial/)
  assert.match(checkSources([{ ...track, licence: 'CC BY-ND 4.0' }], { today })[0].problems[0], /no-derivatives/)
  const [by] = checkSources([{ ...track, licence: 'CC BY 4.0' }], { today })
  assert.deepEqual(by.problems, [], 'CC BY is allowed')
  assert.equal(by.note, 'credit required in the post', 'but it needs a credit')

  const credits = creditsText([track, { ...track, kind: 'whoosh', title: 'Swish' }], 'launch')
  assert.match(credits, /^Sound in launch\n/)
  assert.match(credits, /- music: "Morning Light" by A\. Composer, CC0 1\.0\. https:\/\/example\.com\/track\/1/)
  assert.match(credits, /- sound: "Swish"/, 'an unknown kind reads as sound')
}

// ── Sound — cue audition page ──────────────────────────────────────────

{
  const html = soundReportHtml({
    cues: [
      { name: 'whoosh', time: 1.3, lift: 4.8, clip: 'sound/03-whoosh.wav' },
      { name: '<raw>', time: 0, lift: null, clip: null },
    ],
    mix: 'sound/mix.wav',
  })
  assert.match(html, /<audio id=mix[^>]*src="sound\/mix\.wav">/, 'the full mix is embedded')
  assert.match(html, /seek\(1\.3\)/, 'a cue seeks the mix to its own time')
  assert.match(html, /\+4\.8 dB/, 'a positive lift keeps its sign')
  assert.match(html, /<audio controls preload=none src="sound\/03-whoosh\.wav">/, "a cue's dry clip is embedded")
  assert.match(html, /no dry clip/, 'a cue with no clip says so instead of a broken <audio>')
  assert.doesNotMatch(html, /<raw>/, 'a cue name is escaped')
}

console.log('review: ok')
