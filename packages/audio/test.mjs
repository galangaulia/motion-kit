// Sanity checks for @motion-kit/audio. Run: npm test
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SR, TAU, buffer, integratedLufs, limit, mixdown, noise, peakDb, pluck, readWav, truePeakDb, writeWav } from './src/index.mjs'

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

// True peak. A sine at a quarter of the sample rate, sampled 45° off its crests,
// never has a sample on a crest: samples read −9.03 dBFS, the wave itself −6.02.
{
  const x = new Float32Array(4800).map((_, i) => 0.5 * Math.sin((Math.PI / 2) * i + Math.PI / 4))
  close(peakDb([x, x]), -9.03, 0.01, 'fs/4 sample peak')
  close(truePeakDb([x, x]), -6.02, 0.15, 'fs/4 true peak')
}
// A slow wave has its crests on samples: true peak ≈ sample peak, at both rates.
for (const sr of [44100, 48000]) {
  const n = sr
  const x = new Float32Array(n).map((_, i) => 0.5 * Math.sin((TAU * 997 * i) / sr) * Math.sin((Math.PI * i) / n))
  close(truePeakDb([x, x]), peakDb([x, x]), 0.1, `997 Hz true peak @${sr}`)
}
{
  const rnd = noise(5)
  const x = new Float32Array(SR / 4).map(() => 0.4 * rnd())
  assert.ok(truePeakDb([x, x]) >= peakDb([x, x]), 'true peak is never under the sample peak')
  assert.equal(truePeakDb(buffer(0.1)), -Infinity, 'silence has no peak')
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
