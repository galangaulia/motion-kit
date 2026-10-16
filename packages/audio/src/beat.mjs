/**
 * How well a mix's low end lines up with a declared beat grid. The grid's
 * BPM and offset are already known (from timeline.ts), so this isn't generic
 * tempo detection: for each beat it looks for the nearest kick or onset in a
 * window around the expected time and reports the gap. Synthesized music
 * lines up by construction; this is for a bought or licensed track, whose
 * real tempo might not exactly match the grid it was placed on.
 *
 * `grid` only needs to look like the BeatGrid @motion-kit/core/beats makes
 * (`fps`, `perBeat`, `seconds(n)`, `at(frame)`) — this module stays
 * dependency-free, like the rest of @motion-kit/audio.
 *
 * from/to: which beats to check (0-based, half-open). Default: every whole
 * beat that fits the buffer.
 *
 * Returns:
 *   beats             [{ n, expectedMs, foundMs, errorMs }], one per beat
 *                      checked; foundMs/errorMs are null when nothing was
 *                      found nearby (a quiet passage, or the grid is wrong).
 *   missing           the `n` of every beat with no onset found
 *   medianErrorMs     median offset of found beats (0 = exactly on the grid)
 *   maxErrorMs        largest absolute offset of found beats
 *   confidence        found beats / checked beats, 0–1
 *   suggestedOffsetFrames   medianErrorMs turned into frames, for shifting
 *                      the grid's `offset` to re-align it to this track
 */
export function beatAlignment([L, R], sr, grid, { from = 0, to, lowpassHz = 150 } = {}) {
  const durationFrames = (L.length / sr) * grid.fps
  const end = to ?? Math.floor(grid.at(durationFrames))

  // Kick emphasis: fold to mono, then two one-pole low-pass passes (steeper
  // than one) to leave mostly the sub/kick band that carries the beat.
  const mono = new Float32Array(L.length)
  for (let i = 0; i < L.length; i++) mono[i] = (L[i] + R[i]) * 0.5
  const a = Math.exp((-2 * Math.PI * lowpassHz) / sr)
  for (let pass = 0; pass < 2; pass++) {
    let y = 0
    for (let i = 0; i < mono.length; i++) mono[i] = y = mono[i] * (1 - a) + y * a
  }

  // Onset strength: a smoothed envelope's rise, at a coarse hop so the search
  // below is cheap. The smoothing doubles as a low-pass on the kick's own
  // amplitude bumps, so one clean rise represents one hit, not its ringing.
  const hop = Math.max(1, Math.round(sr * 0.005)) // 5 ms
  const envN = Math.floor(mono.length / hop)
  const env = new Float32Array(envN)
  const rel = Math.exp(-hop / (sr * 0.01)) // ~10 ms smoothing between hops
  {
    let y = 0
    for (let o = 0, i = 0; o < envN; o++, i += hop) {
      let peak = 0
      for (let j = i; j < Math.min(i + hop, mono.length); j++) peak = Math.max(peak, Math.abs(mono[j]))
      y = peak * (1 - rel) + y * rel
      env[o] = y
    }
  }
  const flux = new Float32Array(envN)
  let fluxMax = 0
  for (let i = 1; i < envN; i++) fluxMax = Math.max(fluxMax, (flux[i] = Math.max(0, env[i] - env[i - 1])))

  const perBeatMs = (grid.perBeat / grid.fps) * 1000
  const windowHops = Math.max(1, Math.round((Math.min(perBeatMs * 0.5, 180) / 1000 / hop) * sr))
  const threshold = fluxMax * 0.12 // smaller than this is texture, not a hit

  const beats = []
  const foundErrors = []
  const missing = []
  for (let n = from; n < end; n++) {
    const expectedMs = grid.seconds(n) * 1000
    const centre = Math.round((expectedMs / 1000) * sr) / hop
    let bestI = -1
    let bestV = 0
    for (let i = Math.max(0, Math.round(centre - windowHops)); i <= Math.min(envN - 1, Math.round(centre + windowHops)); i++) {
      if (flux[i] > bestV) {
        bestV = flux[i]
        bestI = i
      }
    }
    if (bestI < 0 || bestV < threshold) {
      beats.push({ n, expectedMs, foundMs: null, errorMs: null })
      missing.push(n)
      continue
    }
    const foundMs = ((bestI * hop) / sr) * 1000
    const errorMs = foundMs - expectedMs
    beats.push({ n, expectedMs, foundMs, errorMs })
    foundErrors.push(errorMs)
  }

  foundErrors.sort((x, y) => x - y)
  const medianErrorMs = foundErrors.length ? foundErrors[Math.floor(foundErrors.length / 2)] : null
  const maxErrorMs = foundErrors.length ? Math.max(...foundErrors.map(Math.abs)) : null
  const confidence = beats.length ? 1 - missing.length / beats.length : 0
  const suggestedOffsetFrames = medianErrorMs !== null ? Math.round((medianErrorMs / 1000) * grid.fps) : 0

  return { beats, missing, medianErrorMs, maxErrorMs, confidence, suggestedOffsetFrames }
}
