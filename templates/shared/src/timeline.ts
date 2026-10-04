// When everything happens, in beats. The picture (Film.tsx) and the
// soundtrack (scripts/build-audio.mjs) both read this file, so moving a beat
// here moves its image and its sound together.

import { grid } from '@motion-kit/core/beats'

export const FPS = 30
/** 120 BPM at 30 fps = 15 frames a beat. */
export const BPM = 120
export const g = grid(BPM, FPS)

export const BARS = 4
export const TOTAL_FRAMES = g.bar(BARS)

// Shots, as beat ranges. A new shot every bar, something new on every beat.
export const HOOK = { from: 0, to: 4 }
export const PRODUCT = { from: 4, to: 12 }
export const CTA = { from: 12, to: 16 }

/** Hook words, one per beat. Five words or fewer. */
export const HOOK_WORDS = ['Your', 'hook,', 'five', 'words.']

/** Beats on which a row lands inside the product card. */
export const ROWS_AT = [5, 6, 7]

/**
 * Key stills (gate 2b): one frame per shot, at the moment it makes its point.
 * Their look is approved before the rest of the film is animated; render them
 * with `npm run stills`.
 */
export const STILLS = [
  { frame: g.hit(HOOK.to) - 1, label: 'hook' },
  { frame: g.beat(PRODUCT.to - 4), label: 'product' },
  { frame: TOTAL_FRAMES - 1, label: 'end card' },
]
