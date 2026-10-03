// Beat grid. Films write their timeline in beats; picture and sound both read
// this grid, so a hit on beat 12 lands on beat 12 in the image and the audio.
//
// Pick a BPM that divides the frame rate cleanly: at 30 fps, 120 BPM = 15 frames
// per beat and 100 BPM = 18. Fractional beats are fine (0.5 = the off-beat).
//
// This file imports nothing so Node audio scripts can load it directly.

export function grid(bpm: number, fps: number, { offset = 0, beatsPerBar = 4 } = {}) {
  const perBeat = (60 / bpm) * fps

  /** Frame of beat `n` (0-based). */
  const beat = (n: number) => Math.round(offset + n * perBeat)

  return {
    bpm,
    fps,
    offset,
    beatsPerBar,
    /** Frames per beat (may be fractional at odd tempos). */
    perBeat,
    beat,
    /** Frame of the downbeat of bar `n` (0-based). */
    bar: (n: number) => beat(n * beatsPerBar),
    /**
     * Release frame for a visual hit on beat `n`. A spring released exactly on
     * the beat only becomes visible a couple of frames later, so lead it in.
     */
    hit: (n: number, lead = 2) => beat(n) - lead,
    /** Seconds at beat `n` — for audio scripts placing sound on the same grid. */
    seconds: (n: number) => (offset + n * perBeat) / fps,
    /** Beats elapsed at `frame` (fractional, negative before the offset). */
    at: (frame: number) => (frame - offset) / perBeat,
    /**
     * 1 on every `every`-th beat, decaying over `decay` frames: drive a small
     * scale or brightness pulse with it so the picture breathes with the kick.
     */
    pulse: (frame: number, every = 1, decay = 6) => {
      const b = (frame - offset) / perBeat
      if (b < 0) return 0
      return Math.exp(-((b % every) * perBeat) / decay)
    },
  }
}

export type BeatGrid = ReturnType<typeof grid>
