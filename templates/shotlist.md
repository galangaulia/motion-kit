# Shotlist — __SLUG__

Written after the brief, **approved before building**. Times are in beats (see
src/timeline.ts); 4 beats = 1 bar.

Archetype (keep one; delete the others and their checks below):
- **arc**: hook → product → proof → CTA, a shot each.
- **one-shape UI tour**: 8–12 states of the real product in one container that
  never cuts; a pointer drives every change, and the last frame matches the
  first so it loops.
- **high-energy hype** (12–20 s): 6–8 scenes of 1.5–3 s on a 120–140 BPM grid,
  each handed to the next through a shape, with the value line as a kinetic
  triplet.
- **calm product demo** (45–90 s): one short line at a time; the camera pushes
  into it, cuts to the real UI up close while it's used, then pulls back and
  glides to the next feature chapter.
- **one-take journey** (10–30 s, loops): one hero (a knob, a cursor, a file, a
  message) travels through the product's workflow laid out as stations on one
  big canvas; each station reacts as it passes, the camera follows without a
  cut, then pulls out to show the whole course and dives back to the start.

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

Checks the archetype adds:

*arc*
- [ ] One shot per job in the brief's arc; no proof shot when brand.json allows none

*one-shape UI tour*
- [ ] One container from first frame to last: it changes shape with `track()`, it never cuts
- [ ] Every change starts from the pointer (`snappy`)
- [ ] The last frame matches the first, so the loop has no seam

*high-energy hype*
- [ ] 6–8 scenes, one idea each; the product's name is up by 2 s (the opening mark floods into it by beat 4)
- [ ] Every scene hands over through a shape: a line or bar that floods into the next background, or a dot from a letter (a full stop, the dot on an i) that grows into the next scene (`Flood` from that point). A hard cut on a downbeat at most twice
- [ ] The value line is a kinetic triplet: three words, two beats each (three for a two-word phrase, so it can be read), swapped hard on the beat by masks, landing on `heavy` with no overshoot. Backgrounds alternate between the brand's roles, never a new colour
- [ ] One signature visual for the product's idea, built from the brand's own shapes (no particle bursts, confetti or glow)
- [ ] One product micro-moment from the captured product (a toggle, the main button, a bar filling), with its real labels
- [ ] No HUD: no corner brackets, scene counter or timecode (a border around the frame and corner captions are banned)
- [ ] Every flood has an impact cue and every carried hand-over a whoosh in build-audio.mjs

*calm product demo*
- [ ] Features budgeted by length: 45 s → 2–3, 60 s → 3–4, 90 s → 4–5 (about 9–12 s each). Proof or integrations only when there's room (one at 45–60 s, both at 90 s) and brand.json allows them
- [ ] Opens on the problem line or the product's empty input, on screen by 2 s; no slow brand intro
- [ ] One short line or one UI element on screen at a time, never both
- [ ] Each chapter: title line typed or unmasked (not faded up word by word) → camera push into it with `zoom()` on `heavy`, so the type never overshoots → highlight sweep behind the key word (front edge on `snappy`) → hard cut on the beat to the real UI up close → camera rides with the action (it follows the caret while typing) → pull back to the whole screen → glide to the next title. No dissolves or blur-dissolves
- [ ] The UI is captured from the real product; anything rebuilt (e.g. text too small at 360 px) is named in the brief
- [ ] Inside a UI moment something new lands every 2–4 s (a typed line, a step ticking off, a result row), and each result holds long enough to read
- [ ] The bed is slow and even (100 BPM is 18 frames a beat at 30 fps) and sits under small cues: key ticks, clicks, a tick per finished step

*one-take journey*
- [ ] One hero from first frame to last; it may change shape for a moment but is never replaced, and it is the brightest thing on screen
- [ ] 3–6 stations, one per workflow step, each a real element of the product (captured, or named in the brief if rebuilt) that visibly changes because the hero touched it
- [ ] The first station's label states the point by 2 s; station labels are the only words on screen, and each stays up long enough to read
- [ ] Every contact lands on the beat (`g.hit`): hops and falls are parabolas solved to land on it, with one gravity for the whole film
- [ ] The hero squashes on contact and stretches in flight; `playful` only when the hero is a character (a ball, a mascot), `snappy` when it is a piece of interface (a knob, a cursor). Stations react on `snappy` or `default`, never `playful`
- [ ] No cut anywhere: the camera follows with `track()` and frames each station with `zoom()`, keeping the hero in the middle half of the frame; a grid that moves with the canvas makes the moves read
- [ ] The payoff (the final result) holds in frame before the launch; the pull-out shows the whole course for about a second, stations reset during that hold, and the dive lands the hero on the first station as the camera arrives
- [ ] The last frame matches the first; anything that straddles the seam (a landing squash, a sound's tail) is drawn and mixed at both ends
- [ ] The hero's contacts are the main instrument in build-audio.mjs: a pitched note per contact, rising as the story moves on, a whoosh up on the launch and down on the dive
