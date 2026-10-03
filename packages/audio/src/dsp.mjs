// Synth voices and processing. Plain Float32Array stereo buffers ([L, R]) at SR,
// no dependencies, seeded noise only — the same code always writes the same bytes.
//
// Voices *add* into a buffer at a time in seconds, so a film builds its music or
// an SFX by layering calls, then hands the result to finish() or mixdown().

export const SR = 44100
export const TAU = Math.PI * 2

/** MIDI note → Hz (69 = A4 = 440). */
export const midi = (n) => 440 * 2 ** ((n - 69) / 12)
export const samples = (sec) => Math.round(sec * SR)
/** Silent stereo buffer of `sec` seconds. */
export const buffer = (sec) => [new Float32Array(samples(sec)), new Float32Array(samples(sec))]

/** Equal-power pan, -1 (left) … 1 (right). */
export const panGains = (pan) => [Math.cos(((pan + 1) * Math.PI) / 4), Math.sin(((pan + 1) * Math.PI) / 4)]

/** Seeded PRNG (mulberry32) → uniform noise in [-1, 1). */
export function noise(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1
  }
}

// ── Voices ────────────────────────────────────────────────────────────

/**
 * Soft two-operator FM pluck: electric piano / marimba / bell family.
 * ratio 1 = round, 2 = keys, 3.5 = glassy. glide = start N semitones sharp.
 */
export function pluck([L, R], t, freq, { amp = 1, decay = 0.4, index = 1, ratio = 2, pan = 0, glide = 0 } = {}) {
  const start = samples(t)
  const n = Math.min(samples(decay * 7), L.length - start)
  const [gl, gr] = panGains(pan)
  let phase = 0
  for (let i = 0; i < n; i++) {
    const s = i / SR
    const f = freq * 2 ** ((glide * Math.exp(-s / 0.04)) / 12)
    phase += (TAU * f) / SR
    const env = Math.min(1, s / 0.004) * Math.exp(-s / decay)
    const mod = index * Math.exp(-s / (decay * 0.3)) * Math.sin(phase * ratio)
    const v = Math.sin(phase + mod) * env * amp
    L[start + i] += v * gl
    R[start + i] += v * gr
  }
}

/** Band-passed noise whose centre glides f0 → f1 (reached at `peakAt`) → f2. Whooshes, swishes, risers. */
export function sweep([L, R], t, dur, { f0, f1, f2 = f1, q = 0.8, amp = 1, peakAt = 0.5, seed = 1, panFrom = 0, panTo = panFrom }) {
  const rand = noise(seed)
  const start = samples(t)
  const n = Math.min(samples(dur), L.length - start)
  // Band-pass noise through a trapezoidal (zero-delay feedback) state-variable
  // filter, after Zavalishin, "The Art of VA Filter Design", and Simper's SVF
  // notes: stable at any cutoff, so the sweep needs no frequency cap. q is the
  // damping (1 / Q). s1, s2 are the two integrator states.
  let s1 = 0
  let s2 = 0
  for (let i = 0; i < n; i++) {
    const p = i / n
    const fc = p < peakAt ? f0 * (f1 / f0) ** (p / peakAt) : f1 * (f2 / f1) ** ((p - peakAt) / (1 - peakAt))
    const g = Math.tan((Math.PI * Math.min(fc, 0.45 * SR)) / SR)
    const d = 1 / (1 + g * (g + q))
    const band = d * (g * (rand() - s2) + s1)
    const low = s2 + g * band
    s1 = 2 * band - s1
    s2 = 2 * low - s2
    const env = p < peakAt ? (p / peakAt) ** 2 : (1 - (p - peakAt) / (1 - peakAt)) ** 1.6
    const [gl, gr] = panGains(panFrom + (panTo - panFrom) * p)
    L[start + i] += band * env * amp * gl
    R[start + i] += band * env * amp * gr
  }
}

/** Sustained chord from t0 to t1: two detuned partial stacks per note, one per side, for width. */
export function pad([L, R], t0, t1, notes, { amp = 1, attack = 0.8, release = 1.2, seed = 7 } = {}) {
  const rand = noise(seed)
  const start = samples(Math.max(0, t0))
  const end = Math.min(samples(t1 + release), L.length)
  for (const note of notes) {
    const f = midi(note)
    const detune = [2 ** (-6 / 1200), 2 ** (6 / 1200)]
    const phase0 = [rand() * Math.PI, rand() * Math.PI]
    for (let i = start; i < end; i++) {
      const s = i / SR
      const rise = Math.min(1, (s - t0) / attack)
      const fall = s > t1 ? Math.max(0, 1 - (s - t1) / release) : 1
      const env = Math.sin((Math.PI / 2) * Math.max(0, rise)) ** 2 * fall * fall
      for (let side = 0; side < 2; side++) {
        const ph = TAU * f * detune[side] * s + phase0[side]
        const v = (Math.sin(ph) + 0.22 * Math.sin(2 * ph) + 0.07 * Math.sin(3 * ph)) * env * amp
        ;(side === 0 ? L : R)[i] += v
      }
    }
  }
}

/** Soft sub kick: a sine dropping 90 → 48 Hz. Felt more than heard. */
export function thump([L, R], t, amp = 1) {
  const start = samples(t)
  const n = Math.min(samples(0.5), L.length - start)
  let phase = 0
  for (let i = 0; i < n; i++) {
    const s = i / SR
    phase += (TAU * (48 + 42 * Math.exp(-s / 0.03))) / SR
    const v = Math.sin(phase) * Math.min(1, s / 0.002) * Math.exp(-s / 0.14) * amp
    L[start + i] += v
    R[start + i] += v
  }
}

/** Short high-passed noise burst: hats, clicks, transients. */
export function hiss([L, R], t, { dur = 0.03, amp = 1, seed = 3, pan = 0 } = {}) {
  const rand = noise(seed)
  const start = samples(t)
  const n = Math.min(samples(dur * 4), L.length - start)
  const [gl, gr] = panGains(pan)
  let prev = 0
  for (let i = 0; i < n; i++) {
    const x = rand()
    const v = (x - prev) * Math.exp(-i / SR / dur) * amp // first difference ≈ high-pass
    prev = x
    L[start + i] += v * gl
    R[start + i] += v * gr
  }
}

// ── Processing ────────────────────────────────────────────────────────

/** Freeverb-style room, in place: 8 damped combs into 4 allpasses per side. */
export function reverb([L, R], { wet = 0.25, room = 0.84, damp = 0.3 } = {}) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]
  const allpasses = [556, 441, 341, 225]
  const process = (input, spread) => {
    const out = new Float32Array(input.length)
    const cbuf = combs.map((d) => ({ b: new Float32Array(d + spread), i: 0, lp: 0 }))
    const abuf = allpasses.map((d) => ({ b: new Float32Array(d + spread), i: 0 }))
    for (let n = 0; n < input.length; n++) {
      const x = input[n] * 0.015
      let y = 0
      for (const c of cbuf) {
        const o = c.b[c.i]
        c.lp = o * (1 - damp) + c.lp * damp
        c.b[c.i] = x + c.lp * room
        c.i = (c.i + 1) % c.b.length
        y += o
      }
      for (const a of abuf) {
        const o = a.b[a.i]
        a.b[a.i] = y + o * 0.5
        a.i = (a.i + 1) % a.b.length
        y = o - y
      }
      out[n] = y
    }
    return out
  }
  const mono = L.map((v, i) => v + R[i])
  const wl = process(mono, 0)
  const wr = process(mono, 23)
  for (let i = 0; i < L.length; i++) {
    L[i] += wl[i] * wet * 3
    R[i] += wr[i] * wet * 3
  }
}

/** One-pole low-pass, in place. */
export function lowpass([L, R], hz) {
  const a = Math.exp((-TAU * hz) / SR)
  for (const ch of [L, R]) {
    let y = 0
    for (let i = 0; i < ch.length; i++) ch[i] = y = ch[i] * (1 - a) + y * a
  }
}

/** Fade the edges (no clicks) and peak-normalize to `peak`, in place. Returns the buffer. */
export function finish(buf, { fadeIn = 0.002, fadeOut = 0.02, peak = 0.89 } = {}) {
  const [L, R] = buf
  const n = L.length
  let max = 0
  for (let i = 0; i < n; i++) {
    const g = Math.min(1, i / (fadeIn * SR), (n - 1 - i) / (fadeOut * SR))
    L[i] *= g
    R[i] *= g
    max = Math.max(max, Math.abs(L[i]), Math.abs(R[i]))
  }
  const gain = max > 0 ? peak / max : 0
  for (let i = 0; i < n; i++) {
    L[i] *= gain
    R[i] *= gain
  }
  return buf
}
