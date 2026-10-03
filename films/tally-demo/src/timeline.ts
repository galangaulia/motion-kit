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
/** The hook lifts away a quarter beat early: still rising off the top as the card opens. */
export const HOOK_OUT = 3.75
export const PRODUCT = { from: 4, to: 12 }
export const CTA = { from: 12, to: 16 }

/** Hook words, one per beat. Five words or fewer. */
export const HOOK_WORDS = ['Streaks,', 'not', 'spreadsheets.']

/** Beats on which a row lands inside the product card, ring still empty.
 *  Off-beats, so row 1 arrives as the card settles and the card is never shown empty. */
export const ROWS_AT = [4.5, 5.5, 6.5]

/** One habit per row, in the order they land. No numbers: the brief rules them out. */
export const ROWS = ['Read before bed', 'Walk after lunch', 'Lights out early']

/** Beats on which each habit is tapped: its ring fills to a check. */
export const CHECKS_AT = [8, 9, 10]

export const CTA_TEXT = 'Try Tally'

/** End card: the destination lands under the logo, then the pill takes one press. */
export const URL_TEXT = 'example.com'
export const URL_AT = 14
export const PRESS_AT = 15
