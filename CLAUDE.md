# Motion studio — house rules

Two kinds of work, two skills:

- **Films** made from nothing in code with Remotion, on shared packages: the `/reel` skill (`.claude/skills/reel`) walks the whole workflow, and these are the rules it enforces.
- **Edits**: motion-graphic B-roll for a talking-head video that already exists (reels, YouTube), timed to the transcript: the `/motion-broll` skill (`.claude/skills/motion-broll`, copied from Barty-Bart/motion-graphics, MIT). It has its own HTML engine and render pipeline; see *Edits* below.

Read this before touching either.

## Layout

- `packages/core` springs, beat grid, `enter`/`exit`, `loadFonts`
- `packages/audio` synth voices, WAV I/O, loudness, `mixdown` (ducking, limiter, −14 LUFS)
- `packages/review` `motion-review`: contact sheet, 360 px phone sheet, sound report, scorecard
- `brands/<name>` brand.json (voice, proof rules, CTA), synced tokens + fonts, `index.tsx` (fonts, logo, CSS with `--film-*` roles)
- `films/<slug>` one Remotion project per film: brief, shotlist, review log, `src/timeline.ts`, `scripts/build-audio.mjs`
- `edits/<slug>` one talking-head video per folder, used as `/motion-broll`'s `motion/` folder: `clips/*.html`, `plan.json`, `TIMING.md` are committed; `inputs/` (footage, transcript), `work/`, `dist/`, `out/` and its Playwright install are not
- `templates/` the film starter + brief / shotlist / review log / style guide
- `vendor/` third-party kits, read-only, git-ignored. Check each one's licence before reusing anything (see `vendor/README.md`); a kit without a licence is reference only.
- `studio/` optional private work (brands, films, edits) with the same layout, in its own git repo and ignored here. Never `git add -f` anything under it. Edits of a real person's footage belong here, not in the kit.

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
4. Review loop: `npm run render && npm run review`, then look at `contact.png` and `phone.png`. A critic subagent that has never seen the build scores the round, read-only, from the sheets, `report.md` and this file (a builder grading their own work came out about 2 points generous). Fix the handful of issues that cost the most points (no more than three per round), log the round in `review_log.md`, and go again. **A film ships when every criterion scores 8 or more**, unless its owner calls it once the scores stop moving.
5. Finals: every format and look the brief asks for, with motion blur (`npm run render:final` in the film → `out/final/`), then `npm run deliver -- <film>` from the repo root copies them to the brand's delivery folder (`brand.json` → `deliver.to`).

## Edits

- Follow `.claude/skills/motion-broll/SKILL.md`, with `edits/<slug>` (usually `studio/edits/<slug>`) as its `motion/` folder: `bash .claude/skills/motion-broll/scripts/setup.sh studio/edits/<slug>`. Put the source video and the SRT in `inputs/`.
- Needs Python 3 + numpy and a full ffmpeg with `prores_ks` (Remotion's bundled ffmpeg lacks `overlay`, `fps` and `tmix`, so it won't do).
- Look: the brand's tokens and faces (pass them in at the skill's interview), never the skill's default palette when a brand is given. *Picture* and *Brand truth* above apply: no invented numbers, results or quotes on screen.
- Don't edit the skill's files in place: they are a plain copy of upstream (`UPSTREAM.md` says how to update). House-specific choices go in this file.

## Commands

```bash
npm test                              # core + audio sanity checks
npm run new -- <slug> --brand <name>  # scaffold a film
npm run brand:sync -- <name>          # refresh tokens/fonts from the product repo
# inside films/<slug>:
npm run studio | render | render:all | review | typecheck
```
