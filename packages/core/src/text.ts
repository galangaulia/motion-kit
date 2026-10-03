// Showreel text and number effects: pure functions of the frame, importable
// from Node (no JSX), so they're unit-tested in test.mjs.

/** Integer hash → [0, 1). Same inputs, same output, every render. */
export function hash(...n: number[]): number {
  let h = 2166136261
  for (const v of n) {
    h ^= Math.floor(v) + 0x9e3779b9
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
  }
  return (h >>> 0) / 4294967296
}

const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+/<>=?'

/**
 * Text decode: characters scramble, then lock left to right. `progress` 0 → 1
 * is how much of the string has locked; unlocked characters re-roll every
 * `rate` frames. Spaces and punctuation stay put so the word shapes read early.
 */
export function scramble(text: string, frame: number, progress: number, { seed = 1, rate = 2 } = {}): string {
  const locked = Math.floor(Math.max(0, Math.min(1, progress)) * text.length)
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (i < locked || !/[A-Za-z0-9]/.test(ch)) out += ch
    else out += GLYPHS[Math.floor(hash(seed, i, Math.floor(frame / rate)) * GLYPHS.length)]
  }
  return out
}

/** Integer count-up for a 0 → 1 progress. */
export const countUp = (progress: number, to: number, from = 0) =>
  Math.round(from + (to - from) * Math.max(0, Math.min(1, progress)))
