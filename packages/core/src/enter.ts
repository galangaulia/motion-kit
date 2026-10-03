import type { CSSProperties } from 'react'
import type { Motion, Preset } from './springs'

export type EnterFrom = {
  /** Start offset in px (positive = from below / from the right). */
  x?: number
  y?: number
  /** Start scale, e.g. 0.92. */
  scale?: number
  preset?: Preset
}

/**
 * Spring an element into place from an offset and/or scale. Opacity rides
 * along (reaching 1 early in the move) — it is never the entrance by itself.
 */
export function enter(m: Motion, frame: number, at: number, from: EnterFrom = { y: 16 }): CSSProperties {
  const p = m.progress(frame, at, from.preset)
  const x = (from.x ?? 0) * (1 - p)
  const y = (from.y ?? 0) * (1 - p)
  const s = from.scale === undefined ? 1 : from.scale + (1 - from.scale) * p
  return {
    opacity: Math.min(1, Math.max(0, p * 2.5)),
    transform: `translate(${x}px, ${y}px) scale(${s})`,
  }
}

/** The mirror of `enter`: spring away to an offset, opacity riding along. */
export function exit(m: Motion, frame: number, at: number, to: EnterFrom = { y: -16 }): CSSProperties {
  const p = m.progress(frame, at, to.preset)
  const x = (to.x ?? 0) * p
  const y = (to.y ?? 0) * p
  const s = to.scale === undefined ? 1 : 1 + (to.scale - 1) * p
  return {
    opacity: Math.min(1, Math.max(0, 1 - p * 2.5)),
    transform: `translate(${x}px, ${y}px) scale(${s})`,
  }
}
