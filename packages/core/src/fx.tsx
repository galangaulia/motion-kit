// Showreel effects: deterministic, frame-driven, safe to render in any order.

import { hash } from './text'

/**
 * Film grain: SVG turbulence whose seed changes every frame, overlaid at
 * `amount`. Deterministic (the seed is the frame), so renders are repeatable.
 */
export function Grain({ frame, amount, fps = 30 }: { frame: number; amount: number; fps?: number }) {
  if (amount <= 0) return null
  // Re-seed ~24 times a second regardless of frame rate, like film.
  const seed = Math.floor((frame / fps) * 24) % 997
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: amount, mixBlendMode: 'overlay', pointerEvents: 'none' }}
      aria-hidden
    >
      <filter id={`grain-${seed}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
    </svg>
  )
}

// ── Backdrops ──────────────────────────────────────────────────────────
// Stage layers a film switches between per act, so not every shot sits on the
// same vignette. All are pure functions of the frame, drawn in a 0 0 W H box.

type Field = { frame: number; width: number; height: number; color: string; opacity: number }

/**
 * Blueprint grid. `drift` (px/frame) scrolls it; `x`/`y` offset it so it can
 * move with a camera at a parallax fraction; `zoom` scales it about the centre.
 */
export function GridField({ frame, width, height, color, opacity, cell = 36, drift = 0.25, x = 0, y = 0, zoom = 1, id: name = 'grid' }: Field & { cell?: number; drift?: number; x?: number; y?: number; zoom?: number; id?: string }) {
  if (opacity <= 0) return null
  const c = cell * zoom
  const ox = (((x % c) + c) % c) - c
  const oy = ((((y - frame * drift) % c) + c) % c) - c
  // SVG ids are page-global: give each field on screen its own `id`.
  const id = `${name}-${Math.round(c * 10)}`
  return (
    <svg width={width} height={height} style={{ position: 'absolute', inset: 0, opacity, pointerEvents: 'none' }} aria-hidden>
      <defs>
        <pattern id={id} width={c} height={c} patternUnits="userSpaceOnUse" x={ox} y={oy}>
          <path d={`M ${c} 0 L 0 0 0 ${c}`} fill="none" stroke={color} strokeWidth={1} />
        </pattern>
        <radialGradient id={`${id}-fade`}>
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id={`${id}-mask`}>
          <rect width={width} height={height} fill={`url(#${id}-fade)`} />
        </mask>
      </defs>
      <rect width={width} height={height} fill={`url(#${id})`} mask={`url(#${id}-mask)`} />
    </svg>
  )
}

/**
 * A field of dots flying toward the viewer from a vanishing point: each dot's
 * depth cycles with time, so the field reads as forward motion (hyperspace,
 * but quiet). `speed` is depth units per frame.
 */
export function DotField({ frame, width, height, color, opacity, count = 90, speed = 0.006, cx = width / 2, cy = height / 2, seed = 7 }: Field & { count?: number; speed?: number; cx?: number; cy?: number; seed?: number }) {
  if (opacity <= 0) return null
  const dots = []
  const reach = Math.hypot(width, height) * 0.6
  for (let i = 0; i < count; i++) {
    const a = hash(seed, i, 1) * Math.PI * 2
    const z = (hash(seed, i, 2) + frame * speed) % 1 // 0 far → 1 near
    const r = z * z * reach
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    dots.push(<circle key={i} cx={x} cy={y} r={0.6 + z * 2.4} fill={color} opacity={Math.min(1, z * 1.6) * (1 - Math.max(0, z - 0.85) / 0.15)} />)
  }
  return (
    <svg width={width} height={height} style={{ position: 'absolute', inset: 0, opacity, pointerEvents: 'none' }} aria-hidden>
      {dots}
    </svg>
  )
}

/** Concentric rings pulsing out from a point, one every `period` frames. */
export function RingPulse({ frame, width, height, color, opacity, cx, cy, period = 30, rings = 4, max = 420 }: Field & { cx: number; cy: number; period?: number; rings?: number; max?: number }) {
  if (opacity <= 0) return null
  const out = []
  for (let k = 0; k < rings; k++) {
    const t = ((frame + k * (period / rings) * rings) % (period * rings)) / (period * rings)
    out.push(<circle key={k} cx={cx} cy={cy} r={40 + t * max} fill="none" stroke={color} strokeWidth={1.2} opacity={(1 - t) * 0.9} />)
  }
  return (
    <svg width={width} height={height} style={{ position: 'absolute', inset: 0, opacity, pointerEvents: 'none' }} aria-hidden>
      {out}
    </svg>
  )
}

/** Radial speed streaks from a point — for the fastest moments. */
export function Streaks({ frame, width, height, color, opacity, cx, cy, count = 40, seed = 11 }: Field & { cx: number; cy: number; count?: number; seed?: number }) {
  if (opacity <= 0) return null
  const lines = []
  const reach = Math.hypot(width, height) * 0.7
  for (let i = 0; i < count; i++) {
    const a = hash(seed, i, 3) * Math.PI * 2
    const t = (hash(seed, i, 4) + frame * 0.02) % 1
    const r0 = 60 + t * reach
    const len = 30 + 120 * t
    lines.push(
      <line
        key={i}
        x1={cx + Math.cos(a) * r0}
        y1={cy + Math.sin(a) * r0}
        x2={cx + Math.cos(a) * (r0 + len)}
        y2={cy + Math.sin(a) * (r0 + len)}
        stroke={color}
        strokeWidth={1.5 + t * 3}
        opacity={t * 0.8}
      />,
    )
  }
  return (
    <svg width={width} height={height} style={{ position: 'absolute', inset: 0, opacity, pointerEvents: 'none' }} aria-hidden>
      {lines}
    </svg>
  )
}
