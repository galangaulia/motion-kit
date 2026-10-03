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
export const HOOK_WORDS = ['Streaks,', 'not', 'spreadsheets.']

/** Beats on which a row lands inside the product card. */
export const ROWS_AT = [5, 6, 7]

/** One habit per row, in the order they land. */
export const ROWS = ['Read 10 pages', 'Walk after lunch', 'Lights out by 11']

export const CTA_TEXT = 'Try Tally'
