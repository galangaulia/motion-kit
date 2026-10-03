import { SR, samples } from './dsp.mjs'
import { integratedLufs, peakDb } from './loudness.mjs'

const dbToGain = (db) => 10 ** (db / 20)

/** Add `src` into `dst` at `at` seconds, scaled by `gain`. */
export function place([DL, DR], [SL, SR_], at, gain = 1) {
  const start = samples(at)
  const n = Math.min(SL.length, DL.length - start)
  for (let i = Math.max(0, -start); i < n; i++) {
    DL[start + i] += SL[i] * gain
    DR[start + i] += SR_[i] * gain
  }
}

/**
 * Brickwall look-ahead limiter, in place. The gain needed for each sample is
 * min-filtered over the look-ahead window and then averaged over it, so the
 * gain is already down when a peak arrives and never steps (no clicks); it
 * recovers at `release` seconds.
 */
export function limit([L, R], ceilingDb = -1, { lookahead = 0.003, release = 0.06 } = {}) {
  const n = L.length
  const ceiling = dbToGain(ceilingDb)
  const win = Math.max(1, Math.round(lookahead * SR))
  const need = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(L[i]), Math.abs(R[i]))
    need[i] = p > ceiling ? ceiling / p : 1
  }
  // Forward-looking minimum over [i, i + win] (monotonic deque).
  const ahead = new Float32Array(n)
  const dq = new Int32Array(n)
  let head = 0
  let tail = 0
  for (let i = n - 1; i >= 0; i--) {
    while (tail > head && need[dq[tail - 1]] >= need[i]) tail--
    dq[tail++] = i
    while (dq[head] > i + win) head++
    ahead[i] = need[dq[head]]
  }
  // Average over the trailing window (unity before the start), then let it
  // recover at the release rate.
  const rel = 1 - Math.exp(-1 / (release * SR))
  let sum = win
  let gain = 1
  for (let i = 0; i < n; i++) {
    sum += ahead[i] - (i >= win ? ahead[i - win] : 1)
    const target = Math.min(sum / win, ahead[i])
    gain = target < gain ? target : gain + (target - gain) * rel
    L[i] *= gain
    R[i] *= gain
  }
}

/**
 * Mix a music bed and timed cues into one master.
 *
 *  - cues land at their frame (converted with `fps`), scaled by their gain
 *  - the bed ducks under the cue bus by up to `duck.depth` dB, so hits read
 *    without turning the whole mix up
 *  - the master is normalized to `lufs`, then limited at `ceiling` dBFS; the
 *    loop corrects for loudness the limiter takes away
 *
 * cues: [{ frame, buf: [L, R], gain = 1, name }]
 * Returns { master, report: { lufs, peak, gain, cues: [{ name, frame }] } }.
 */
export function mixdown({
  duration,
  fps,
  bed = null,
  bedGain = 1,
  cues = [],
  duck = { depth: 4, attack: 0.005, release: 0.2 },
  lufs = -14,
  ceiling = -1,
}) {
  const n = samples(duration)
  const sfx = [new Float32Array(n), new Float32Array(n)]
  for (const cue of cues) place(sfx, cue.buf, cue.frame / fps, cue.gain ?? 1)

  const master = [new Float32Array(n), new Float32Array(n)]
  if (bed) {
    // Sidechain: follow the cue bus envelope, map it to 0 … depth dB of cut.
    const atk = 1 - Math.exp(-1 / (duck.attack * SR))
    const rel = 1 - Math.exp(-1 / (duck.release * SR))
    let busPeak = 0
    for (let i = 0; i < n; i++) busPeak = Math.max(busPeak, Math.abs(sfx[0][i]), Math.abs(sfx[1][i]))
    let env = 0
    for (let i = 0; i < n; i++) {
      const x = busPeak > 0 ? Math.max(Math.abs(sfx[0][i]), Math.abs(sfx[1][i])) / busPeak : 0
      env += (x - env) * (x > env ? atk : rel)
      const g = bedGain * dbToGain(-duck.depth * Math.min(1, env * 2))
      master[0][i] = (bed[0][i] ?? 0) * g
      master[1][i] = (bed[1][i] ?? 0) * g
    }
  }
  for (let i = 0; i < n; i++) {
    master[0][i] += sfx[0][i]
    master[1][i] += sfx[1][i]
  }

  let total = 1
  for (let pass = 0; pass < 4; pass++) {
    const measured = integratedLufs(master)
    if (!Number.isFinite(measured) || Math.abs(measured - lufs) < 0.2) break
    const g = dbToGain(lufs - measured)
    total *= g
    for (const ch of master) for (let i = 0; i < n; i++) ch[i] *= g
    limit(master, ceiling)
  }
  limit(master, ceiling)

  return {
    master,
    report: {
      lufs: integratedLufs(master),
      peak: peakDb(master),
      gain: 20 * Math.log10(total),
      cues: cues.map(({ name, frame }) => ({ name, frame })),
    },
  }
}
