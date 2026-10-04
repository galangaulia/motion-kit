// Motion checks: what a contact sheet sampling one frame in ~25 can't show.
// One- or two-frame glitches, things that appear without moving, cuts off the
// beat, freezes, stretches with no new picture, and flashes (WCAG 2.3.1).
//
// Pure: give it decoded frames, get findings. Frames are small rgb24 images
// (64 px on the short side is plenty; sides a multiple of 16), one Uint8Array
// of w·h·3 per frame. Thresholds are in 8-bit luma steps or seconds, so 30 and
// 60 fps films read the same.

export const LIMITS = {
  /** Change detection works on tiles this many px square. */
  tile: 8,
  /** Glitch: tiles change at least this much into the odd frame and out of it… */
  glitch: 8,
  /** …and everything that changed comes back to within this share of the change. */
  glitchReturn: 0.3,
  /** Step: a tile jumps at least this much in one frame… */
  step: 12,
  /** …with less than this share of it in the frames either side. */
  stepCalm: 0.2,
  /** Glitches and snaps smaller than this (summed tile change, about one word at 64 px) are ignored. */
  mass: 40,
  /** A step across this share of the tiles is a cut. */
  cutShare: 0.4,
  /** Frozen: fewer than `frozenShare` of the pixels move more than `frozenPixel`. */
  frozenPixel: 3,
  frozenShare: 0.002,
  frozenReport: 0.5,
  frozenWarn: 1,
  /** New picture: some coarse tile's mean luma moves this far from the last new picture. */
  anchorTile: 16,
  newPicture: 6,
  staleWarn: 2,
  staleFail: 4,
  /** WCAG 2.3.1: opposing changes of ≥ 10 % of full luminance, the darker state under 0.8. */
  flashStep: 0.1,
  flashDarker: 0.8,
  /** Red flash: (R − G − B) · 320 changes by more than 20 and the redder state is saturated. */
  redStep: 20,
  redSaturated: 0.8,
  /** More than three flashes in a second = seven or more transitions. */
  flashTransitions: 7,
  /** …across this share of a ⅓ × ⅓ window (WCAG's estimate of a 10° field). */
  flashArea: 0.25,
}

// sRGB → linear, per 8-bit value.
const LINEAR = Float64Array.from({ length: 256 }, (_, v) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
})

/** Per-pixel luma (gamma, 0–255) of one rgb24 frame. */
function lumaOf(rgb, n) {
  const y = new Float32Array(n)
  for (let i = 0, p = 0; i < n; i++, p += 3) y[i] = 0.2126 * rgb[p] + 0.7152 * rgb[p + 1] + 0.0722 * rgb[p + 2]
  return y
}

/** Mean |a − b| per tile. */
function tileDiff(a, b, w, h, t) {
  const cols = w / t
  const out = new Float32Array(cols * (h / t))
  for (let y = 0; y < h; y++) {
    const row = ((y / t) | 0) * cols
    for (let x = 0; x < w; x++) out[row + ((x / t) | 0)] += Math.abs(a[y * w + x] - b[y * w + x])
  }
  for (let k = 0; k < out.length; k++) out[k] /= t * t
  return out
}

/** Mean of each of `planes` per block of `t` px. */
function blockMeans(planes, w, h, t) {
  const cols = w / t
  const outs = planes.map(() => new Float32Array(cols * (h / t)))
  for (let y = 0; y < h; y++) {
    const row = ((y / t) | 0) * cols
    for (let x = 0; x < w; x++) {
      const k = row + ((x / t) | 0)
      for (let p = 0; p < planes.length; p++) outs[p][k] += planes[p][y * w + x]
    }
  }
  for (const o of outs) for (let k = 0; k < o.length; k++) o[k] /= t * t
  return outs
}

/**
 * Frames at which `series` reverses by at least `step` from its last peak or
 * trough, where `gate(lowValue, highIndex)` accepts the pair.
 */
function transitions(series, step, gate) {
  const at = []
  let state = 0
  let peak = series[0]
  let peakAt = 0
  let trough = series[0]
  for (let i = 1; i < series.length; i++) {
    const x = series[i]
    if (x > peak) [peak, peakAt] = [x, i]
    if (x < trough) trough = x
    if (state !== -1 && peak - x >= step && gate(x, peakAt)) {
      at.push(i)
      state = -1
      trough = x
      ;[peak, peakAt] = [x, i]
    } else if (state !== 1 && x - trough >= step && gate(trough, i)) {
      at.push(i)
      state = 1
      trough = x
      ;[peak, peakAt] = [x, i]
    }
  }
  return at
}

/**
 * For every frame, the largest share of a ⅓ × ⅓ window whose blocks have made
 * `limit` or more transitions in the second up to that frame.
 */
function flashingArea(blockSeries, cols, rows, fps, step, gate, limit) {
  const n = blockSeries[0].length
  const second = Math.max(1, Math.round(fps))
  // flashing[i][k]: block k made `limit` or more transitions in the second ending at frame i.
  const flashing = Array.from({ length: n }, () => new Uint8Array(cols * rows))
  let busiest = 0
  blockSeries.forEach((series, k) => {
    const sum = new Uint16Array(n + 1)
    for (const i of transitions(series, step, (low, hi) => gate(low, hi, k))) sum[i + 1] = 1
    for (let i = 0; i < n; i++) sum[i + 1] += sum[i]
    for (let i = 0; i < n; i++) {
      const count = sum[i + 1] - sum[Math.max(0, i + 1 - second)]
      busiest = Math.max(busiest, count)
      if (count >= limit) flashing[i][k] = 1
    }
  })
  const ww = Math.max(1, Math.round(cols / 3))
  const wh = Math.max(1, Math.round(rows / 3))
  const share = new Float32Array(n)
  for (let f = 0; f < n; f++) {
    const on = flashing[f]
    if (!on.some(Boolean)) continue
    for (let y0 = 0; y0 + wh <= rows; y0++) {
      for (let x0 = 0; x0 + ww <= cols; x0++) {
        let c = 0
        for (let y = y0; y < y0 + wh; y++) for (let x = x0; x < x0 + ww; x++) c += on[y * cols + x]
        share[f] = Math.max(share[f], c / (ww * wh))
      }
    }
  }
  return { share, busiest }
}

/** Frame ranges where `pred(i)` holds, as [from, to] inclusive. */
function runs(n, pred) {
  const out = []
  for (let i = 0; i < n; i++) {
    if (!pred(i)) continue
    let j = i
    while (j + 1 < n && pred(j + 1)) j++
    out.push([i, j])
    i = j
  }
  return out
}

/**
 * Beat position of `frame` on a film's grid (from timeline.ts), and whether it
 * sits on a beat: up to 2 frames early (a hit's lead) or 1 late.
 */
export function onBeat(frame, grid) {
  if (!grid) return { beat: null, on: null }
  const n = Math.round(grid.at(frame))
  const off = frame - grid.beat(n)
  return off >= -2 && off <= 1 ? { beat: n, on: true } : { beat: Math.round(grid.at(frame) * 10) / 10, on: false }
}

/**
 * Run every check. `grid` (optional) is the film's beat grid, used to say
 * whether a cut lands on a beat.
 */
export function motionChecks({ frames, width: w, height: h, fps, grid = null, limits = {} }) {
  const L = { ...LIMITS, ...limits }
  const n = frames.length
  const px = w * h
  const luma = frames.map((rgb) => lumaOf(rgb, px))
  const tiles = (w / L.tile) * (h / L.tile)
  const sec = (frames) => frames / fps

  // Frame-to-frame change per tile: step[i] is frame i−1 → i.
  const step = luma.map((y, i) => (i ? tileDiff(luma[i - 1], y, w, h, L.tile) : new Float32Array(tiles)))

  // ── Glitches: a frame (or two) that differs from both neighbours, which match.
  // Judged over everything that changed, not tile by tile: a fast object or
  // moving text also leaves single tiles that "come back", but the frames
  // either side of it don't match as a whole.
  const glitches = []
  for (let len = 1; len <= 2; len++) {
    for (let i = 1; i + len < n; i++) {
      const into = step[i]
      const out = step[i + len]
      let count = 0
      for (let k = 0; k < tiles; k++) if (Math.min(into[k], out[k]) >= L.glitch) count++
      if (!count) continue
      const across = tileDiff(luma[i - 1], luma[i + len], w, h, L.tile)
      let mass = 0
      let back = 0
      for (let k = 0; k < tiles; k++) {
        if (Math.max(into[k], out[k]) < L.glitch / 2) continue
        mass += Math.min(into[k], out[k])
        back += across[k]
      }
      const covered = glitches.some((g) => i <= g.frame + g.length - 1 && g.frame <= i + len - 1)
      if (mass >= L.mass && back <= L.glitchReturn * mass && !covered) glitches.push({ frame: i, length: len, tiles: count, mass: Math.round(mass) })
    }
  }

  // ── Steps: a one-frame jump with stillness either side. Wide = a cut.
  const cuts = []
  const snaps = []
  for (let i = 1; i < n; i++) {
    const a = step[i]
    const before = i > 1 ? step[i - 1] : null
    const after = i + 1 < n ? step[i + 1] : null
    let count = 0
    let mass = 0
    for (let k = 0; k < tiles; k++) {
      if (a[k] < L.step) continue
      if (before && before[k] > L.stepCalm * a[k]) continue
      if (after && after[k] > L.stepCalm * a[k]) continue
      count++
      mass += a[k]
    }
    if (!count || glitches.some((g) => i >= g.frame && i <= g.frame + g.length)) continue
    const share = count / tiles
    if (share >= L.cutShare) cuts.push({ frame: i, share, ...onBeat(i, grid) })
    else if (mass >= L.mass) snaps.push({ frame: i, tiles: count, mass: Math.round(mass) })
  }

  // ── Frozen: nothing moves from one frame to the next.
  const still = new Uint8Array(n)
  for (let i = 1; i < n; i++) {
    let moved = 0
    const a = luma[i - 1]
    const b = luma[i]
    for (let p = 0; p < px; p++) if (Math.abs(a[p] - b[p]) > L.frozenPixel) moved++
    still[i] = moved < L.frozenShare * px ? 1 : 0
  }
  // k still steps in a row = k + 1 identical frames on screen.
  const frozen = runs(n, (i) => still[i] === 1)
    .map(([a, b]) => ({ from: a - 1, to: b, seconds: sec(b - a + 2) }))
    .filter((r) => r.seconds >= L.frozenReport)
    .sort((x, y) => y.seconds - x.seconds)

  // ── New picture: the coarse layout moves away from the last new picture.
  const coarse = luma.map((y) => blockMeans([y], w, h, L.anchorTile)[0])
  const stretches = []
  let anchor = 0
  for (let i = 1; i <= n; i++) {
    let moved = i === n
    for (let k = 0; !moved && k < coarse[i].length; k++) moved = Math.abs(coarse[i][k] - coarse[anchor][k]) >= L.newPicture
    if (!moved) continue
    stretches.push({ from: anchor, to: i - 1, seconds: sec(i - anchor) })
    anchor = i
  }
  stretches.sort((x, y) => y.seconds - x.seconds)

  // ── Flashes: luminance and saturated red per block of 1/16 of the short side.
  const block = Math.max(1, Math.min(w, h) / 16)
  const cols = w / block
  const rows = h / block
  const lum = []
  const red = []
  const sat = []
  for (const rgb of frames) {
    const R = new Float32Array(px)
    const G = new Float32Array(px)
    const B = new Float32Array(px)
    for (let i = 0, p = 0; i < px; i++, p += 3) {
      R[i] = LINEAR[rgb[p]]
      G[i] = LINEAR[rgb[p + 1]]
      B[i] = LINEAR[rgb[p + 2]]
    }
    const [r, g, b] = blockMeans([R, G, B], w, h, block)
    lum.push(r.map((v, k) => 0.2126 * v + 0.7152 * g[k] + 0.0722 * b[k]))
    red.push(r.map((v, k) => Math.max(0, v - g[k] - b[k]) * 320))
    sat.push(r.map((v, k) => (v + g[k] + b[k] > 0 ? v / (v + g[k] + b[k]) : 0)))
  }
  const series = (per) => Array.from({ length: cols * rows }, (_, k) => Float32Array.from(per, (f) => f[k]))
  const general = flashingArea(series(lum), cols, rows, fps, L.flashStep, (low) => low < L.flashDarker, L.flashTransitions)
  const redFlash = flashingArea(series(red), cols, rows, fps, L.redStep, (_, hi, k) => sat[hi][k] >= L.redSaturated, L.flashTransitions)
  const flashRuns = (area) =>
    runs(n, (i) => area.share[i] >= L.flashArea).map(([a, b]) => ({ from: a, to: b, share: Math.max(...area.share.slice(a, b + 1)) }))
  const flashes = {
    general: { fails: flashRuns(general), peakShare: Math.max(0, ...general.share), busiest: general.busiest },
    red: { fails: flashRuns(redFlash), peakShare: Math.max(0, ...redFlash.share), busiest: redFlash.busiest },
  }

  return { fps, frames: n, glitches, cuts, snaps, frozen, stretches, flashes, limits: L }
}

/** Whether the result breaks a hard limit (flashes); the rest is for the critic to judge. */
export const flashFailed = (r) => r.flashes.general.fails.length > 0 || r.flashes.red.fails.length > 0

/**
 * The frames worth looking at up close, most serious first: flashes, glitches,
 * cuts off the beat, snaps. At most `max`.
 */
export function flaggedFrames(r, max = 8) {
  const out = [
    ...[...r.flashes.general.fails, ...r.flashes.red.fails].map((f) => ({ frame: f.from, why: 'flash' })),
    ...r.glitches.map((g) => ({ frame: g.frame, why: `glitch (${g.length} frame${g.length > 1 ? 's' : ''})` })),
    ...r.cuts.filter((c) => c.on === false).map((c) => ({ frame: c.frame, why: 'cut off the beat' })),
    ...r.snaps.map((s) => ({ frame: s.frame, why: 'snap' })),
  ]
  return out.slice(0, max)
}

const frameAt = (frame, fps) => `f${frame} (${(frame / fps).toFixed(1)} s)`
const list = (items, max = 6) => (items.length > max ? `${items.slice(0, max).join(', ')}, +${items.length - max} more` : items.join(', '))

/** The "Motion checks" section of report.md. */
export function motionReport(r) {
  const { fps, limits: L } = r
  const s = (x) => `${x.toFixed(1)} s`
  const rows = []

  rows.push([
    'Glitches (a frame or two that differs from both neighbours)',
    r.glitches.length ? `⚠ ${r.glitches.length}` : '0',
    'none',
    list(r.glitches.map((g) => `${frameAt(g.frame, fps)}: ${g.length} frame${g.length > 1 ? 's' : ''}, ${g.tiles} tile${g.tiles > 1 ? 's' : ''}`)),
  ])
  const offBeat = r.cuts.filter((c) => c.on === false)
  rows.push([
    'Hard cuts',
    `${r.cuts.length}${offBeat.length ? ` (⚠ ${offBeat.length} off the beat)` : ''}`,
    'on a beat',
    list(r.cuts.map((c) => `${frameAt(c.frame, fps)}${c.beat === null ? '' : `, beat ${c.beat}${c.on ? '' : ' ⚠'}`}`)),
  ])
  rows.push([
    'Snaps (something appears or jumps without moving)',
    r.snaps.length ? `⚠ ${r.snaps.length}` : '0',
    'none: arrivals move',
    list(r.snaps.map((x) => `${frameAt(x.frame, fps)}: ${x.tiles} tile${x.tiles > 1 ? 's' : ''}`)),
  ])
  const longestFreeze = r.frozen[0]
  rows.push([
    'Longest freeze (nothing moves)',
    longestFreeze ? `${longestFreeze.seconds >= L.frozenWarn ? '⚠ ' : ''}${s(longestFreeze.seconds)}` : `under ${s(L.frozenReport)}`,
    `under ${s(L.frozenWarn)}`,
    list(r.frozen.map((x) => `${frameAt(x.from, fps)}–f${x.to}`)),
  ])
  const top = r.stretches.slice(0, 3)
  const longest = top[0]?.seconds ?? 0
  rows.push([
    'Longest stretch without a new picture',
    `${longest > L.staleFail ? '✗ ' : longest > L.staleWarn ? '⚠ ' : ''}${s(longest)}`,
    `${L.staleWarn}–${L.staleFail} s`,
    list(top.map((x) => `${frameAt(x.from, fps)}–f${x.to}: ${s(x.seconds)}`)),
  ])
  for (const [name, flash] of [
    ['Flashes', r.flashes.general],
    ['Red flashes', r.flashes.red],
  ]) {
    rows.push([
      `${name} (more than 3 a second over ≥ ${Math.round(L.flashArea * 100)} % of a ⅓ × ⅓ area)`,
      flash.fails.length ? `✗ ${flash.fails.length}` : 'none',
      'none (WCAG 2.3.1)',
      list(flash.fails.map((x) => `${frameAt(x.from, fps)}–f${x.to}: ${Math.round(x.share * 100)} % of the area`)),
    ])
  }

  return [
    '| Check | Result | House limit | Where |',
    '|---|---|---|---|',
    ...rows.map((cells) => `| ${cells.join(' | ')} |`),
  ].join('\n')
}
