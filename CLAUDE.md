# Motion studio — house rules

Films are made from nothing in code, with Remotion, HyperFrames or Manim, on
shared packages. Read this before touching a film. The `/reel` skill (`.claude/skills/reel`) walks
the whole workflow; these are the rules it enforces.

Motion-graphic B-roll for a talking-head video that already exists is a
different job with its own engine: it lives in [broll-kit](https://github.com/galangaulia/broll-kit).

## Layout

- `packages/core` springs (`track`, `release`, `zoom`), beat grid, `enter`/`exit`, `Flood`, `loadFonts`
- `packages/audio` synth voices, WAV I/O, loudness, `mixdown` (ducking, limiter, −14 LUFS)
- `packages/media` the ffmpeg every engine shares: probe, frames, stills, audio, mux, encode
- `packages/review` `motion-review`, for any engine: contact sheet, 360 px phone sheet (with the 9:16 safe zone), key stills, motion checks on every frame, sound report (true peak), scorecard
- `engines/<engine>` one folder per engine (`remotion`, `hyperframes`, `manim`): its film starter (`template/`), the review's view of it, and `BUILD.md`, how these rules map onto it
- `brands/<name>` brand.json (voice, proof rules, CTA, CSS and font files), synced tokens + fonts, `index.tsx` (fonts, logo, CSS with `--film-*` roles); `scripts/brand-export.mjs` hands the same brand to engines that can't import `index.tsx`
- `films/<slug>` one project per film, on one engine (`package.json` → `motionKit`): brief, shotlist, review log, `src/timeline.ts`, `scripts/build-audio.mjs`
- `templates/` brief / shotlist / review log / style guide, and `shared/` (the timeline and soundtrack script every engine's starter begins from)
- `AGENTS.md`, `GEMINI.md`, `.agents/skills/` the way in for other agents (Codex, Gemini CLI, Cursor, Copilot). When a rule or the skill starts leaning on a Claude Code feature, say in `AGENTS.md` how to do it without one.
- `docs/` guides for users of the kit: `setup.md` (from a clone or a ZIP, per platform), `engines.md` (which engine), `brand.md` (bring your own design system), `sound.md` (customize the soundtrack)
- `vendor/` third-party kits, read-only, git-ignored. Check each one's licence before reusing anything (see `vendor/README.md`); a kit without a licence is reference only.
- `studio/` optional private work (brands + films) with the same layout, in its own git repo and ignored here. Never `git add -f` anything under it.

## Engines

Pick one at brief time; the timeline, soundtrack, brand and review carry over,
the picture doesn't.

- **Remotion** (default): React. The richest helpers (`Flood`, backdrops, `loadFonts`) and a live Studio.
- **HyperFrames**: plain HTML and CSS plus one `render(frame)`, no React. Rendered by headless Chrome.
- **Manim**: diagrams, graphs, geometry and maths, as a whole explainer film or as a transparent clip inside a Remotion or HyperFrames film (`CLIPS` in `timeline.ts`).

How each one meets the rules below: `engines/<engine>/BUILD.md`.

## Determinism

Every engine draws frames out of order: in parallel (Remotion, HyperFrames),
between frames for motion blur, or for key stills only. So each frame has to be
computable on its own from its frame number (`useCurrentFrame()` in Remotion,
`render(frame)` in HyperFrames, `frame(f)` in Manim).

- Derive every value from the frame number. Randomness comes from the seeded `hash()` in `@motion-kit/core`; `Math.random`, `Date`, timers, React state and effects that remember earlier frames are out.
- Keep CSS static: no `transition`, no `@keyframes`, no `animation`.
- Leave GPU-layer hints out (`will-change`, `translate3d`, `translateZ(0)`). Layer promotion can make two renders of one frame differ.
- Never put `opacity` or `filter` on a `preserve-3d` element: it flattens and both faces show. Fade its wrapper. Inside a hidden parent, children use `visibility: inherit`; `visible` shows through.
- Manim: nothing carries between frames. `FrameScene` restores every mobject before `frame(f)`; updaters that add `dt` are out.
- Films are laid out at half size (540 on the short side) and rendered at 2×, so a brand's token sizes can be used as written.

## Movement

- Anything that arrives, leaves or changes target moves on a spring from `motion(FPS)` (`@motion-kit/core`; in Manim, `motionkit`, which matches it number for number). Pick the preset by what is moving:
  - `snappy`: small controls, pointers, the front edge of something that stretches
  - `default`: panels, cards, the camera
  - `heavy`: headlines and logos (critically damped)
  - `playful`: characters and stickers only; never interface or type
- UI may overshoot a hair; type never does.
- When a value is sent somewhere new while still moving, give it a `track()` with one key per destination rather than starting a fresh spring.
- Motion that crosses a cut or a released drag keeps its speed: read it with `trackVelocity()` on that frame and carry on with `release()`.
- The camera zooms with `zoom()`, in log scale, so a deep push keeps one speed instead of rushing and then crawling. An impact is a punch-in with `zoom()` on `snappy`, never a shake.
- Copy inside a shape that is morphing stays hidden while the shape changes: `swapAlpha()` brings it in just after the morph begins and takes it out just before the next one.
- Opacity is a passenger, never the vehicle: an element can't appear or disappear by fading alone (`enter`/`exit` fade while they move).
- Shots never dissolve into each other. Move between them with a morph, a hard cut on a beat, a camera move, or a `Flood` of a brand colour from a point that matters.

## Timing

- `src/timeline.ts` owns every timing, counted in beats on `grid(BPM, FPS)`. The picture and the soundtrack both import it.
- Release visual hits with `g.hit(n)`: two frames ahead of the beat, so the movement lands on it.
- The point has to be on screen within 2 s, the picture has to change at least every 2–4 s, and nothing (end card included) sits still waiting for the clock.
- No line leaves before it can be read: about three words a second, plus half a second.

## Picture

- Colour and type come from the brand alone: the `--film-*` roles or the brand's tokens. One accent colour and one display face plus one UI face, unless the brief asks for more.
- Show the real product. Capture it instead of rebuilding it from memory; if a screen has to be rebuilt, say so in the brief.
- Test every frame at 360 px wide, the size of a phone feed. When it doesn't read, cut words before shrinking type. In 9:16, words, the product and the CTA stay inside the outline on `phone.png`; the apps' buttons and captions cover the rest.
- Words hand over by masking or a matched edge, never by morphing one glyph's outline into another.
- Steer clear of the stock-template look. Some usual suspects: confetti or particle bursts; glitch, spin and light-leak transitions; UI that wobbles; glowing buttons and panels; a lone headline centred on a gradient; captions parked in the corners or a border around the frame; a film where every element simply fades up. Glass and refraction only when the product's own UI has them, and then capture it.
- Nothing flashes more than three times a second (WCAG 2.3.1).

## Sound

- Music and effects are made with `@motion-kit/audio`. A bought or licensed track is fine too; write its source and licence into the brief.
- `scripts/build-audio.mjs` places each cue from `timeline.ts` and calls `mixdown()`, which lowers the bed under cues, keeps peaks under −1 dBFS and sets the master to −14 LUFS. A film plays a single `soundtrack.wav`. The encode can lift peaks between samples, so `report.md` measures the MP4: its true peak stays at −1 dBTP or under.
- Assume most viewers have the sound off: everything the film says must also be on screen.

## Brand truth

- Follow `brands/<name>/brand.json`: voice, CTA, and especially **proof**. Never invent customers, logos, quotes or numbers.

## Workflow gates (don't skip)

1. Brief (`brief.md`), answered in one round of questions.
2. Shotlist (`shotlist.md`) — **stop and get it approved before building.**
   - **2b.** Key stills: build just the frames listed in `timeline.ts` → `STILLS` (one per shot: layout, type, colour, the real product) and render them with `npm run stills` — **stop and get the look approved before animating the rest.**
3. Build against `timeline.ts`.
4. Review loop: `npm run render && npm run review`, then look at `contact.png` and `phone.png`. `report.md` opens with motion checks on every frame of the render (glitches, snaps, cuts against the beat, freezes, stretches with no new picture, flashes) and `flags.png` shows each flagged moment up close; a flash ✗ blocks shipping. Two critic subagents that have never seen the build (nor each other, nor earlier rounds) score the round in parallel, read-only, from the sheets, `report.md` and this file; the round's score per criterion is the lower of the two. A builder grading their own work came out about 2 points generous, and a single critic's 7-or-8 swings with who is judging. Critics mark each issue P0 (breaks a rule here, or can't be read), P1 or P2; P0s are fixed first. Fix the handful of issues that cost the most points (no more than three per round), log the round in `review_log.md`, and go again. Snapshot the film before each round (a commit in its repo, or a copy of `src/`) so a round that makes things worse can be rolled back. **A film ships when every criterion scores 8 or more**, unless its owner calls it once the scores stop moving.
5. Finals: every format and look the brief asks for, with motion blur (`npm run render:final` in the film → `out/final/`; Manim finals carry none, see `engines/manim/BUILD.md`), then `npm run deliver -- <film>` from the repo root copies them to the brand's delivery folder (`brand.json` → `deliver.to`).

## Commands

```bash
npm test                              # core, audio, media, review, brand and Manim-parity checks
npm run new -- <slug> --brand <name> [--engine remotion|hyperframes|manim]   # scaffold a film
npm run brand:sync -- <name>          # refresh tokens/fonts from the product repo
# inside films/<slug>:
npm run studio | render | render:all | render:final | review | stills | clips | typecheck
npm run review -- --strict            # fails on flashes or a true peak over −1 dBTP
```
