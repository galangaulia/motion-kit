import { SR } from './dsp.mjs'

// ITU-R BS.1770 loudness. K-weighting is a high shelf (+4 dB above ~1.7 kHz)
// followed by a ~38 Hz high-pass; coefficients are derived for any sample rate
// from the analog prototype, so 44.1 and 48 kHz both measure correctly.

function biquad(x, [b0, b1, b2, a1, a2]) {
  const y = new Float32Array(x.length)
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1
    x1 = x[i]
    y2 = y1
    y1 = v
    y[i] = v
  }
  return y
}

function kWeighting(sr) {
  // High shelf
  let G = 3.99984385397
  let Q = 0.7071752369554193
  let fc = 1681.9744509555319
  let A = 10 ** (G / 40)
  let w = (2 * Math.PI * fc) / sr
  let alpha = Math.sin(w) / (2 * Q)
  let cos = Math.cos(w)
  const sq = 2 * Math.sqrt(A) * alpha
  let a0 = A + 1 - (A - 1) * cos + sq
  const shelf = [
    (A * (A + 1 + (A - 1) * cos + sq)) / a0,
    (-2 * A * (A - 1 + (A + 1) * cos)) / a0,
    (A * (A + 1 + (A - 1) * cos - sq)) / a0,
    (2 * (A - 1 - (A + 1) * cos)) / a0,
    (A + 1 - (A - 1) * cos - sq) / a0,
  ]
  // High-pass
  Q = 0.5003270373253953
  fc = 38.13547087613982
  w = (2 * Math.PI * fc) / sr
  alpha = Math.sin(w) / (2 * Q)
  cos = Math.cos(w)
  a0 = 1 + alpha
  const highpass = [(1 + cos) / 2 / a0, -(1 + cos) / a0, (1 + cos) / 2 / a0, (-2 * cos) / a0, (1 - alpha) / a0]
  return [shelf, highpass]
}

const toLufs = (meanSquare) => (meanSquare > 0 ? -0.691 + 10 * Math.log10(meanSquare) : -Infinity)

/** Integrated loudness (LUFS) of a stereo buffer, gated per BS.1770-4. */
export function integratedLufs([L, R], sr = SR) {
  const [shelf, hp] = kWeighting(sr)
  const kl = biquad(biquad(L, shelf), hp)
  const kr = biquad(biquad(R, shelf), hp)
  const block = Math.round(0.4 * sr)
  const hop = Math.round(0.1 * sr)
  const blocks = []
  for (let s = 0; s + block <= kl.length; s += hop) {
    let sum = 0
    for (let i = s; i < s + block; i++) sum += kl[i] * kl[i] + kr[i] * kr[i]
    blocks.push(sum / block)
  }
  const absolute = blocks.filter((m) => toLufs(m) > -70)
  if (!absolute.length) return -Infinity
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
  const relative = toLufs(mean(absolute)) - 10
  const gated = absolute.filter((m) => toLufs(m) > relative)
  return toLufs(mean(gated))
}

/** Highest absolute sample in dBFS. */
export function peakDb([L, R], from = 0, to = L.length) {
  let max = 0
  for (let i = from; i < to; i++) max = Math.max(max, Math.abs(L[i]), Math.abs(R[i]))
  return max > 0 ? 20 * Math.log10(max) : -Infinity
}

/** RMS over a sample range, in dBFS. */
export function rmsDb([L, R], from = 0, to = L.length) {
  let sum = 0
  for (let i = from; i < to; i++) sum += L[i] * L[i] + R[i] * R[i]
  const n = 2 * Math.max(1, to - from)
  return sum > 0 ? 10 * Math.log10(sum / n) : -Infinity
}
