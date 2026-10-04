// Springs, solved in closed form.
//
// Every value here is the position of a damped harmonic oscillator that sits
// at rest on 0 and is released toward 1. Because the motion is written as an
// exact function of elapsed time (no stepping, no stored velocity), any frame
// of a video can be computed on its own and always comes out the same.
//
// Presets use the designer-facing pair:
//   duration  seconds per cycle of the undamped spring, so w0 = 2π / duration
//   bounce    1 − damping ratio. 0 lands without overshoot, toward 1 it rings
//             more, and below 0 it creeps in (overdamped).
//
// This file imports nothing so Node scripts can load it directly.

export type SpringShape = {
  /** Seconds per cycle of the undamped spring. */
  duration: number
  /** 0 = no overshoot, up to <1 = springier, negative = sluggish. */
  bounce: number
}

/** The house presets. Changing these numbers changes every film. */
export const PRESETS = {
  /** Buttons, cursor, leading edges. */
  snappy: { duration: 0.22, bounce: 0.2 },
  /** Cards, containers, camera. Used when no preset is named. */
  default: { duration: 0.4, bounce: 0.14 },
  /** Display type, logo. */
  heavy: { duration: 0.5, bounce: 0 },
  /** Mascots only. */
  playful: { duration: 0.5, bounce: 0.55 },
} satisfies Record<string, SpringShape>

export type PresetName = keyof typeof PRESETS
export type Preset = PresetName | SpringShape

/** One retarget for `track()`: at `frame`, head for `value`. */
export type TrackKey = readonly [frame: number, value: number, preset?: Preset]

function shapeOf(preset: Preset | undefined): SpringShape {
  if (preset === undefined) return PRESETS.default
  return typeof preset === 'string' ? PRESETS[preset] : preset
}

/**
 * Position (0 → 1, may pass 1 briefly) of a spring `seconds` after release.
 * 0 at or before release.
 */
export function springAt(seconds: number, preset?: Preset): number {
  if (!(seconds > 0)) return 0
  const { duration, bounce } = shapeOf(preset)
  const w0 = (2 * Math.PI) / duration
  const zeta = 1 - bounce
  const t = seconds

  if (zeta < 1) {
    // Rings: a decaying cosine/sine pair at the damped frequency.
    const decay = zeta * w0
    const wd = w0 * Math.sqrt(1 - zeta * zeta)
    const envelope = Math.exp(-decay * t)
    return 1 - envelope * (Math.cos(wd * t) + (decay / wd) * Math.sin(wd * t))
  }

  if (zeta === 1) {
    // Fastest approach that never crosses the target.
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t)
  }

  // Overdamped: two real decay rates, the slow one dominating the tail.
  const spread = w0 * Math.sqrt(zeta * zeta - 1)
  const fast = -zeta * w0 - spread
  const slow = -zeta * w0 + spread
  return 1 + (slow * Math.exp(fast * t) - fast * Math.exp(slow * t)) / (fast - slow)
}

/**
 * Speed of `springAt` (travel per second) `seconds` after release: 0 at
 * release, highest early on, 0 again once it settles.
 */
export function springVelocity(seconds: number, preset?: Preset): number {
  if (!(seconds > 0)) return 0
  const { duration, bounce } = shapeOf(preset)
  const w0 = (2 * Math.PI) / duration
  const zeta = 1 - bounce
  const t = seconds

  if (zeta < 1) {
    const decay = zeta * w0
    const wd = w0 * Math.sqrt(1 - zeta * zeta)
    return ((w0 * w0) / wd) * Math.exp(-decay * t) * Math.sin(wd * t)
  }

  if (zeta === 1) return w0 * w0 * t * Math.exp(-w0 * t)

  const spread = w0 * Math.sqrt(zeta * zeta - 1)
  const fast = -zeta * w0 - spread
  const slow = -zeta * w0 + spread
  return (slow * fast * (Math.exp(fast * t) - Math.exp(slow * t))) / (fast - slow)
}

/**
 * How far past the target a preset swings at its first peak, as a fraction of
 * the travel (0.05 = 5 %). Zero for presets that do not overshoot.
 */
export function peakOvershoot(preset?: Preset): number {
  const zeta = 1 - shapeOf(preset).bounce
  if (zeta >= 1) return 0
  // The first peak sits half a damped period after release, where the
  // oscillating term is −1 and only the envelope remains.
  return Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta))
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

/** Frame-based helpers bound to a frame rate. */
export function motion(fps: number) {
  const progress = (frame: number, at: number, preset?: Preset) => springAt((frame - at) / fps, preset)
  const track =(frame: number, keys: readonly TrackKey[], preset?: Preset) => {
    if (keys.length === 0) return 0
    let value = keys[0][1]
    for (let i = 1; i < keys.length; i++) {
      const [at, target, own] = keys[i]
      if (at >= frame) continue
      value += (target - keys[i - 1][1]) * progress(frame, at, own ?? preset)
    }
    return value
  }

  return {
    fps,

    /** 0 → 1 for a spring released on frame `at`. */
    progress,

    /** Spring from `from` to `to`, released on frame `at`. */
    spring: (frame: number, at: number, from: number, to: number, preset?: Preset) =>
      from + (to - from) * progress(frame, at, preset),

    /**
     * A value retargeted several times. The first key is the starting value;
     * each later key launches its own spring for the change it asks for, and
     * those springs add up, so a new target never cuts off one in flight.
     */
    track,

    /** Speed of a `track()` at `frame`, in units per second. */
    trackVelocity: (frame: number, keys: readonly TrackKey[], preset?: Preset) => {
      let speed = 0
      for (let i = 1; i < keys.length; i++) {
        const [at, target, own] = keys[i]
        if (at >= frame) continue
        speed += (target - keys[i - 1][1]) * springVelocity((frame - at) / fps, own ?? preset)
      }
      return speed
    },

    /**
     * A spring let go on frame `at` at `from` while already moving at
     * `velocity` (units per second), heading for `to`. For a drag that is
     * released, or a shot that takes over a value at the speed it had in the
     * one before (`trackVelocity()` on the cut frame). `from` until `at`.
     */
    release: (frame: number, at: number, from: number, velocity: number, to: number, preset?: Preset) => {
      const t = (frame - at) / fps
      if (!(t > 0)) return from
      const w0 = (2 * Math.PI) / shapeOf(preset).duration
      // A spring's speed after a unit step, over w0², is its motion after a unit kick.
      return to + (from - to) * (1 - springAt(t, preset)) + (velocity * springVelocity(t, preset)) / (w0 * w0)
    },

    /**
     * A scale (or any value > 0) moved in log space: each doubling takes the
     * same time, so a deep zoom keeps one apparent speed instead of rushing at
     * the start and crawling at the end. Keys as in `track()`. Also the camera
     * push for an impact: [[0, 1], [hit, 1.06, 'snappy'], [hit + 8, 1]].
     */
    zoom: (frame: number, keys: readonly TrackKey[], preset?: Preset) =>
      Math.exp(track(frame, keys.map(([at, value, own]) => [at, Math.log(value), own] as const), preset)),

    /**
     * Opacity for text inside a container that changes shape on frames `inAt`
     * and `outAt`: it arrives once the first morph is under way and leaves
     * before the next one begins.
     */
    swapAlpha: (frame: number, inAt: number, outAt = Infinity) => {
      const t = frame / fps
      const showFrom = inAt / fps + 0.08
      const hideBy = outAt / fps - 0.1
      return Math.min(clamp01((t - showFrom) / 0.12), clamp01((hideBy - t) / 0.1))
    },
  }
}

export type Motion = ReturnType<typeof motion>
