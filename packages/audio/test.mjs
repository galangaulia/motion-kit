// Sanity checks for @motion-kit/audio. Run: npm test
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SR, TAU, buffer, integratedLufs, limit, mixdown, peakDb, pluck, readWav, writeWav } from './src/index.mjs'

const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`)

// BS.1770 reference: a 997 Hz full-scale-sine-like tone at -20 dBFS per channel
// reads about -20 + 3.01 (two channels) - 0.691 + K-weight gain at 1 kHz (~0.69)
// ≈ -17 LUFS. Check we're in that neighbourhood at both sample rates.
for (const sr of [44100, 48000]) {
  const n = sr * 5
  const amp = 10 ** (-20 / 20) * Math.SQRT2
  const L = new Float32Array(n).map((_, i) => amp * Math.sin((TAU * 997 * i) / sr))
  close(integratedLufs([L, L.slice()], sr), -17, 0.3, `tone loudness @${sr}`)
}

// Limiter: nothing above the ceiling, quiet material untouched.
const hot = buffer(1)
for (let i = 0; i < hot[0].length; i++) hot[0][i] = hot[1][i] = 1.5 * Math.sin((TAU * 220 * i) / SR)
limit(hot, -1)
assert.ok(peakDb(hot) <= -0.99, `limited peak ${peakDb(hot)}`)
assert.ok(peakDb(hot) >= -1.5, `limiter shouldn't over-squash: ${peakDb(hot)}`)
const quiet = buffer(1)
for (let i = 0; i < quiet[0].length; i++) quiet[0][i] = quiet[1][i] = 0.5 * Math.sin((TAU * 220 * i) / SR)
const ref = quiet[0].slice()
limit(quiet, -1)
assert.ok(quiet[0].every((v, i) => v === ref[i]), 'limiter leaves quiet material untouched')

// Mixdown hits the loudness target and the ceiling.
const bed = buffer(4)
for (let t = 0; t < 4; t += 0.25) pluck(bed, t, 330, { amp: 0.3 })
const blip = buffer(0.3)
pluck(blip, 0, 880, { decay: 0.1 })
const { master, report } = mixdown({
  duration: 4,
  fps: 30,
  bed,
  cues: [10, 40, 70, 100].map((frame) => ({ frame, buf: blip, gain: 0.8, name: 'blip' })),
  lufs: -14,
})
close(report.lufs, -14, 0.5, 'mixdown loudness')
assert.ok(report.peak <= -0.99, `mixdown peak ${report.peak}`)

// WAV round trip.
const path = join(mkdtempSync(join(tmpdir(), 'mk-')), 't.wav')
writeWav(path, master)
const back = readWav(path)
assert.equal(back[0].length, master[0].length)
close(back[0][1000], master[0][1000], 1 / 16000, 'wav round trip')

console.log('audio: ok')
