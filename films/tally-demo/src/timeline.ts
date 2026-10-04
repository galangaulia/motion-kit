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
export const HOOK = { from: 0, to: 3 }
/** The product shows before 2 s: on beat 3 the hook moves up and the card opens under it. */
export const PRODUCT = { from: 3, to: 12 }
/** The hook lifts off the top and the card moves to the centre. */
export const HOOK_OUT = 4.5
export const CTA = { from: 12, to: 16 }

/** Hook words, one per beat. Five words or fewer. */
export const HOOK_WORDS = ['Streaks,', 'not', 'spreadsheets.']

/** Beats on which a row lands inside the product card, ring still empty. Row 1
 *  arrives as the card settles (≈1.75 s), the rest once the card has the frame. */
export const ROWS_AT = [3.5, 5, 6]

/** One habit per row, in the order they land. No numbers: the brief rules them out. */
export const ROWS = ['Read before bed', 'Walk after lunch', 'Lights out early']

/** Beats on which each habit is tapped: its ring fills to a check. */
export const CHECKS_AT = [8, 9, 10]

/** A thumb comes in for the taps and leaves after the last one. */
export const POINTER_IN = 7
export const POINTER_OUT = 10.5

export const CTA_TEXT = 'Try Tally'

/** End card: the destination lands under the logo, then the pill takes one press. */
export const URL_TEXT = 'example.com'
export const URL_AT = 14
export const PRESS_AT = 15

/**
 * Key stills (gate 2b): one frame per shot, at the moment it makes its point.
 * Their look is approved before the rest of the film is animated; render them
 * with `npm run stills`.
 */
export const STILLS = [
  { frame: g.hit(HOOK.to) - 1, label: 'hook' },
  { frame: g.hit(POINTER_IN) - 1, label: 'product' },
  // All three checked and the thumb gone, just before the rows lift out.
  { frame: g.beat(POINTER_OUT) + 3, label: 'proof' },
  { frame: TOTAL_FRAMES - 1, label: 'end card' },
]
