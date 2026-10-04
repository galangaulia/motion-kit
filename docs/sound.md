# Make the sound yours

Every film builds its own soundtrack in code. There are no stock samples in the
kit: the music bed and every effect are synthesized by `@motion-kit/audio`, so
a film can sound like anything — and nothing in it belongs to someone else.

## How it works

`films/<slug>/scripts/build-audio.mjs` (run by `npm run audio`, and before every
render) does three things:

1. **Bed:** a short piece of music built from the film's tempo and bars:
   `pad` chords, a `thump` kick on every beat, `hiss` hats on the off-beats,
   through `reverb` and `lowpass`.
2. **Cues:** one sound per visual hit, each placed at a frame taken from
   `src/timeline.ts` (`g.beat(n)`), so moving a beat there moves its picture and
   its sound together.
3. **Mix:** `mixdown()` ducks the bed under the cues, normalizes to −14 LUFS and
   limits at −1 dBFS, then writes `public/audio/soundtrack.wav` (plus
   `cues.json`). The film plays that one file.

It is deterministic: the same script always writes the same file.

What a new film starts with (from `templates/shared/scripts/build-audio.mjs`,
the same for every engine): a I–V–vi–IV progression in C at 120 BPM, a rising
`pluck` note per hook word and per row, a `sweep` whoosh into each shot, and a
brighter note on the CTA. That's a starting point, not a house sound: change
all of it.

## The voices

| Function | Sound | Useful options |
|---|---|---|
| `pluck(buf, t, freq, opts)` | FM pluck: keys, marimba, bell | `ratio` (1 round · 2 keys · 3.5 glassy), `decay`, `index` (brightness), `glide` |
| `pad(buf, t0, t1, notes, opts)` | sustained chord, wide | `attack`, `release`, `amp` |
| `sweep(buf, t, dur, opts)` | band-passed noise glide: whoosh, riser, swish | `f0 → f1 → f2` (Hz), `peakAt`, `q`, `panFrom`/`panTo` |
| `thump(buf, t, amp)` | soft sub kick | — |
| `hiss(buf, t, opts)` | short noise burst: hats, clicks | `dur`, `amp`, `pan` |
| `reverb(buf, opts)`, `lowpass(buf, hz)`, `finish(buf, opts)` | room, tone, fades + normalize | `wet`, `room`, `damp` |

`midi(n)` turns a MIDI note into Hz (60 = middle C). `buffer(sec)` makes an
empty stereo buffer to draw into.

## Ways to customize, from small to big

1. **Tempo:** change `BPM` in `src/timeline.ts`. Everything, picture and sound,
   follows the grid. Pick one that divides your frame rate cleanly (at 30 fps,
   120 BPM = 15 frames a beat, 100 BPM = 18).
2. **Key and mood:** edit `CHORDS` (MIDI notes per bar) and the cue notes.
   Minor key, slower attack, more reverb: calmer. Higher `ratio` and `index`:
   brighter, more "tech".
3. **New cues:** add an entry to `cues` with a `frame` from the timeline, a
   `buf` built from the voices, and a `gain`.
4. **Your own samples:** put WAV files in `films/<slug>/sound/` (committed with
   the film) and load them with `readWav()`, then use them as a cue's `buf`.
   Convert other formats first: `ffmpeg -i click.mp3 click.wav` (or, without an
   ffmpeg of your own, Remotion's: `npx remotion ffmpeg -i click.mp3 click.wav`).
5. **A licensed music track as the bed:** same folder, `readWav()` it and pass it
   as `bed`. Write its source and licence in the film's `brief.md`.
6. **Mix:** `mixdown()` takes `bedGain`, `duck: { depth, attack, release }`,
   `lufs` and `ceiling`.

Don't put inputs in `public/audio/`: the script empties that folder every run.

## A house sound for a brand

If several films should share a palette of sounds, write the cue builders once
in `brands/<name>/sound.mjs` (for example `export const whoosh = …`,
`export const tick = (n) => …`) and import them in each film's
`build-audio.mjs`. Keep the picture's timing in each film's `timeline.ts`.

## Check it

`npm run audio` prints loudness and peak. `npm run review` adds a sound table
to `report.md`, measured on the rendered MP4 after its AAC encode: loudness,
sample peak and **true peak** (the wave between samples, which the encode can
push up; keep it at −1 dBTP or below). Every cue should rise about **+4 dB or
more** above the bed just before it. A cue under that won't be heard; raise its
gain, shorten the sound before it, or drop it. The film must also work muted:
every message on screen.
