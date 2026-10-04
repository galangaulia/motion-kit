# Building a HyperFrames film

CLAUDE.md's house rules hold for every engine. This page is how they map onto
[HyperFrames](https://github.com/heygen-com/hyperframes) (HTML + CSS rendered by
headless Chrome). Scaffold one with `npm run new -- <slug> --brand <name> --engine hyperframes`.

## The film's files

| File | What it holds |
|---|---|
| `src/film.html` | The markup inside the page root. `{{logo}}` becomes the brand's `<Logotype />`, rendered once to static HTML. |
| `src/film.css` | Styles. Colours and faces only from the `--film-*` roles; sizes as `calc(Npx * var(--u))` for the 540 layout. |
| `src/film.ts` | One `render(frame)` and `mount({ fps, render })`. Bundled by esbuild. |
| `src/timeline.ts` | Every timing, in beats. The picture and `scripts/build-audio.mjs` both read it. |
| `src/formats.ts` | The formats, at half size (540 on the short side). |
| `public/` | The film's own files (captures, images, Manim clips), referenced as `public/…`. |
| `build/` | Written by `motion-hf`: one HyperFrames project per format. Never edit it or commit it. |

## Rules

- **Every moving value is set in `render(frame)`, from the frame number alone.**
  HyperFrames seeks the page to each capture time, in any order, across several
  workers, and between frames when it blurs. So: no GSAP, WAAPI, Lottie, CSS
  `transition` / `animation` / `@keyframes`, `requestAnimationFrame`, timers,
  `Date` or `Math.random` (use `hash()` from `@motion-kit/core/text`). HyperFrames
  can drive all of those, but none of them follow the springs or the beat grid.
- **`render()` sets or resets everything it touches on every call.** A style
  applied only after a beat has to be `reset()` before it, or an earlier frame
  rendered later keeps it.
- **Frame numbers can be fractional** (motion blur samples between frames).
  Comparisons like `frame >= g.hit(4)` are safe; `frameAt()` already snaps float
  noise to whole frames.
- Move things with `enter` / `exit` (`@motion-kit/core/enter`) and `motion()`
  (`@motion-kit/core/springs`), written to the page with `apply(el, style)`.
- **Don't write pages by hand.** `motion-hf` builds one per format from
  `formats.ts` and `timeline.ts`, so a page's length can't drift from the soundtrack.
- **Fonts come from `brand.json` → `fontFiles`.** HyperFrames quietly swaps in a
  stand-in face when a font URL is wrong, so the build checks every face exists,
  and a face that still fails to load paints a red bar across every frame.
- Don't install HyperFrames' own agent skills: their animation advice (GSAP eases
  standing in for springs) breaks the house rules. Its docs are fine for the
  composition contract.

## Commands (in the film)

```bash
npm run studio        # HyperFrames' preview of build/, with the soundtrack
npm run render        # out/square.mp4 (render:all for every format)
npm run render:final  # out/final/<slug>-<ratio>.mp4 with motion blur
npm run review        # motion-review from out/square.mp4
npm run stills        # key stills at 1080, snapshotted from the page
```

## What motion-hf pins, and why

- **Versions:** `hyperframes` and every `@hyperframes/*` package exactly (the root
  `package.json` → `overrides`), since its own dependencies float and it ships
  several releases a day.
- **Chrome:** software rendering (SwiftShader), so a laptop and CI make the same
  pixels, and the managed `chrome-headless-shell` (`npx hyperframes browser ensure`
  downloads it; CI does this before rendering).
- **Quiet:** telemetry, update checks and auto-install off; `GEMINI_API_KEY` is
  removed, because `hyperframes snapshot` would send every still to Gemini.
- **ffmpeg:** a full build (HyperFrames uses filters Remotion's lacks), found by
  `@motion-kit/media` and handed over as `HYPERFRAMES_FFMPEG_PATH`.
- **Render:** 2× to 1080p, H.264 CRF 16; the page renders silent and the
  soundtrack is laid in by `@motion-kit/media`. Finals blur 16 samples over a
  180° shutter centred on the frame.
