# Shotlist — __SLUG__

Written after the brief, **approved before building**. Times are in beats (see
src/timeline.ts); 4 beats = 1 bar.

Archetype: **arc** (hook → product → proof → CTA, a shot each) | **one-shape UI
tour** (8–12 states of the real product, one container that never cuts, a
pointer drives every change, the last frame matches the first so it loops)

| # | Beats | On screen | Motion (preset) | Sound cue | Into next shot | Key still (beat) |
|---|---|---|---|---|---|---|
| 1 | 0–4 | | | | | |
| 2 | 4–12 | | | | | |
| 3 | 12–16 | | | | | |

Key stills: one per shot, at the moment it makes its point. They go into
`STILLS` in src/timeline.ts, and `npm run stills` renders them for the second
stop (CLAUDE.md, gate 2b).

Checks before asking for approval:
- [ ] Hook lands inside 2 s
- [ ] Something new on screen at least every 2–4 s (8 beats at 120 BPM is 4 s)
- [ ] No crossfades: every shot change is a morph, a cut on the beat, a camera move or a flood
- [ ] Moves that cross a cut keep their speed
- [ ] Every line stays up long enough to read: about three words a second, plus half a second
- [ ] In 9:16, words, the product and the CTA sit inside the safe zone (the outline on phone.png)
- [ ] The end card is built from what came before (the container, a word, the logo's own shape), not a fresh slide
- [ ] Every on-screen claim is allowed by the brand's proof rules
