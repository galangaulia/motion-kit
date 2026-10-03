// Soundtrack: a 120 BPM bed plus a cue for every visual hit, all placed from
// src/timeline.ts and mixed by @motion-kit/audio (ducking, limiter, -14 LUFS).
// Deterministic. Run: npm run audio

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buffer, finish, hiss, lowpass, midi, mixdown, pad, pluck, reverb, sweep, thump, writeWav } from '@motion-kit/audio'
import { BARS, CHECKS_AT, CTA, FPS, HOOK, HOOK_WORDS, PRESS_AT, PRODUCT, ROWS_AT, TOTAL_FRAMES, URL_AT, g } from '../src/timeline.ts'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio')

// One chord per bar (I – V – vi – IV in C). Swap for the film's mood.
const CHORDS = [
  [48, 55, 60, 64, 67],
  [43, 55, 59, 62, 67],
  [45, 52, 57, 60, 64],
  [41, 53, 57, 60, 65],
]

function bed() {
  const T = TOTAL_FRAMES / FPS
  const tone = buffer(T)
  const drums = buffer(T)
  for (let bar = 0; bar < BARS; bar++) {
    const t0 = g.seconds(bar * 4)
    pad(tone, t0 - 0.05, g.seconds((bar + 1) * 4), CHORDS[bar], { amp: 0.1, attack: bar ? 0.3 : 0.8, release: 0.6, seed: bar + 1 })
  }
  for (let beat = 0; beat < BARS * 4; beat++) {
    thump(drums, g.seconds(beat), beat % 4 === 0 ? 0.7 : 0.5)
    hiss(drums, g.seconds(beat + 0.5), { dur: 0.02, amp: 0.06, seed: beat + 100 })
  }
  reverb(tone, { wet: 0.28 })
  for (let i = 0; i < tone[0].length; i++) {
    tone[0][i] += drums[0][i]
    tone[1][i] += drums[1][i]
  }
  lowpass(tone, 8000)
  return finish(tone, { fadeIn: 0.05, fadeOut: 0.6 })
}

const note = (n, opts = {}) => {
  const buf = buffer(1.4)
  pluck(buf, 0, midi(n), { decay: 0.35, index: 0.9, ...opts })
  reverb(buf, { wet: 0.2 })
  return finish(buf, { fadeOut: 0.3 })
}

const whoosh = (() => {
  const buf = buffer(0.9)
  sweep(buf, 0, 0.5, { f0: 300, f1: 2800, f2: 800, peakAt: 0.6, q: 0.9, panFrom: -0.5, panTo: 0.5, seed: 7 })
  return finish(buf, { fadeOut: 0.2 })
})()

// Cue frames come from the same beats the picture uses.
const cues = [
  ...HOOK_WORDS.map((_, i) => ({ name: `word-${i + 1}`, frame: g.beat(HOOK.from + i), buf: note([72, 74, 76, 79][i] ?? 79), gain: 0.5 })),
  { name: 'whoosh', frame: g.beat(PRODUCT.from) - 6, buf: whoosh, gain: 0.45 },
  ...ROWS_AT.map((b, i) => ({ name: `row-${i + 1}`, frame: g.beat(b), buf: note(76 + i * 3, { ratio: 3 }), gain: 0.45 })),
  ...CHECKS_AT.map((b, i) => ({ name: `check-${i + 1}`, frame: g.beat(b), buf: note(84 + i * 2, { decay: 0.22, index: 1.3 }), gain: 0.5 })),
  { name: 'whoosh', frame: g.beat(CTA.from) - 6, buf: whoosh, gain: 0.45 },
  { name: 'cta', frame: g.beat(CTA.from + 1), buf: note(84, { decay: 0.8, index: 1.4 }), gain: 0.6 },
  { name: 'url', frame: g.beat(URL_AT), buf: note(79, { decay: 0.5 }), gain: 0.55 },
  { name: 'press', frame: g.beat(PRESS_AT), buf: note(91, { decay: 0.12, index: 1.6 }), gain: 0.45 },
]

const { master, report } = mixdown({ duration: TOTAL_FRAMES / FPS, fps: FPS, bed: bed(), bedGain: 0.45, cues, lufs: -14 })

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
writeWav(join(OUT, 'soundtrack.wav'), master)
writeFileSync(join(OUT, 'cues.json'), JSON.stringify({ fps: FPS, ...report }, null, 2))
console.log(`soundtrack.wav  ${report.lufs.toFixed(1)} LUFS  peak ${report.peak.toFixed(1)} dBFS  ${report.cues.length} cues`)
