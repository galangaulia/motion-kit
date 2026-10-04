# Motion studio — house rules

Films are made from nothing in code with Remotion, on shared packages. Read
this before touching a film. The `/reel` skill (`.claude/skills/reel`) walks
the whole workflow; these are the rules it enforces.

Motion-graphic B-roll for a talking-head video that already exists is a
different job with its own engine: it lives in [broll-kit](https://github.com/galangaulia/broll-kit).

## Layout

- `packages/core` springs, beat grid, `enter`/`exit`, `loadFonts`
- `packages/audio` synth voices, WAV I/O, loudness, `mixdown` (ducking, limiter, −14 LUFS)
- `packages/review` `motion-review`: contact sheet, 360 px phone sheet, sound report, scorecard
- `brands/<name>` brand.json (voice, proof rules, CTA), synced tokens + fonts, `index.tsx` (fonts, logo, CSS with `--film-*` roles)
- `films/<slug>` one Remotion project per film: brief, shotlist, review log, `src/timeline.ts`, `scripts/build-audio.mjs`
- `templates/` the film starter + brief / shotlist / review log / style guide
- `docs/` guides for users of the kit: `brand.md` (bring your own design system), `sound.md` (customize the soundtrack)
- `vendor/` third-party kits, read-only, git-ignored. Check each one's licence before reusing anything (see `vendor/README.md`); a kit without a licence is reference only.
- `studio/` optional private work (brands + films) with the same layout, in its own git repo and ignored here. Never `git add -f` anything under it.

## Determinism

Remotion renders frames out of order and in parallel, so each frame has to be
computable on its own from `useCurrentFrame()`.

- Derive every value from the frame number. Randomness comes from the seeded `hash()` in `@motion-kit/core`; `Math.random`, `Date`, timers, React state and effects that remember earlier frames are out.
- Keep CSS static: no `transition`, no `@keyframes`, no `animation`.
- Leave GPU-layer hints out (`will-change`, `translate3d`, `translateZ(0)`). Layer promotion can make two renders of one frame differ.
- Compositions are laid out at half size (540 on the short side) and `remotion.config.ts` renders them at 2×, so a brand's token sizes can be used as written.

## Movement

- Anything that arrives, leaves or changes target moves on a spring from `motion(FPS)` (`@motion-kit/core`). Pick the preset by what is moving:
  - `snappy`: small controls, pointers, the front edge of something that stretches
  - `default`: panels, cards, the camera
  - `heavy`: headlines and logos (critically damped)
  - `playful`: characters and stickers only; never interface or type
- UI may overshoot a hair; type never does.
- When a value is sent somewhere new while still moving, give it a `track()` with one key per destination rather than starting a fresh spring.
- Copy inside a shape that is morphing stays hidden while the shape changes: `swapAlpha()` brings it in just after the morph begins and takes it out just before the next one.
- Opacity is a passenger, never the vehicle: an element can't appear or disappear by fading alone (`enter`/`exit` fade while they move).
- Shots never dissolve into each other. Move between them with a morph, a hard cut on a beat, or a camera move.

## Timing

- `src/timeline.ts` owns every timing, counted in beats on `grid(BPM, FPS)`. The picture and the soundtrack both import it.
- Release visual hits with `g.hit(n)`: two frames ahead of the beat, so the movement lands on it.
- The point has to be on screen within 2 s, the picture has to change at least every 2–4 s, and nothing (end card included) sits still waiting for the clock.

## Picture

- Colour and type come from the brand alone: the `--film-*` roles or the brand's tokens. One accent colour and one display face plus one UI face, unless the brief asks for more.
- Show the real product. Capture it instead of rebuilding it from memory; if a screen has to be rebuilt, say so in the brief.
- Test every frame at 360 px wide, the size of a phone feed. When it doesn't read, cut words before shrinking type.
- Steer clear of the stock-template look. Some usual suspects: confetti or particle bursts; glitch, spin and light-leak transitions; UI that wobbles; glowing buttons and panels; a lone headline centred on a gradient; captions parked in the corners or a border around the frame; a film where every element simply fades up.
- Nothing flashes more than three times a second (WCAG 2.3.1).

## Sound

- Music and effects are made with `@motion-kit/audio`. A bought or licensed track is fine too; write its source and licence into the brief.
- `scripts/build-audio.mjs` places each cue from `timeline.ts` and calls `mixdown()`, which lowers the bed under cues, keeps peaks under −1 dBFS and sets the master to −14 LUFS. A film plays a single `soundtrack.wav`.
- Assume most viewers have the sound off: everything the film says must also be on screen.

## Brand truth

- Follow `brands/<name>/brand.json`: voice, CTA, and especially **proof**. Never invent customers, logos, quotes or numbers.

## Workflow gates (don't skip)

1. Brief (`brief.md`), answered in one round of questions.
2. Shotlist (`shotlist.md`) — **stop and get it approved before building.**
3. Build against `timeline.ts`.
4. Review loop: `npm run render && npm run review`, then look at `contact.png` and `phone.png`. Two critic subagents that have never seen the build (nor each other, nor earlier rounds) score the round in parallel, read-only, from the sheets, `report.md` and this file; the round's score per criterion is the lower of the two. A builder grading their own work came out about 2 points generous, and a single critic's 7-or-8 swings with who is judging. Fix the handful of issues that cost the most points (no more than three per round), log the round in `review_log.md`, and go again. **A film ships when every criterion scores 8 or more**, unless its owner calls it once the scores stop moving.
5. Finals: every format and look the brief asks for, with motion blur (`npm run render:final` in the film → `out/final/`), then `npm run deliver -- <film>` from the repo root copies them to the brand's delivery folder (`brand.json` → `deliver.to`).

## Commands

```bash
npm test                              # core + audio sanity checks
npm run new -- <slug> --brand <name>  # scaffold a film
npm run brand:sync -- <name>          # refresh tokens/fonts from the product repo
# inside films/<slug>:
npm run studio | render | render:all | render:final | review | typecheck
```
