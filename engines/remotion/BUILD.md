# Building a Remotion film

The default engine, and the one the house rules in CLAUDE.md were first written
for. Scaffold with `npm run new -- <slug> --brand <name>`.

## The film's files

| File | What it holds |
|---|---|
| `src/Root.tsx` | One `<Composition>` per format (Square, Vertical, Wide), each twice: plain and `-Final` (motion blur). Loads the brand's fonts. |
| `src/Film.tsx` | The picture: React, every value from `useCurrentFrame()`. |
| `src/film.css` | Styles from the brand's `--film-*` roles; sizes as `calc(Npx * var(--u))`. |
| `src/timeline.ts` | Every timing, in beats; `scripts/build-audio.mjs` reads it too. |
| `remotion.config.ts` | Renders the half-size compositions at 2×, H.264 CRF 16. |
| `public/` | Captures, images, the soundtrack (`audio/`, rebuilt by `npm run audio`) and Manim clips (`clips/`). |

## Rules

- Every value comes from `useCurrentFrame()`: no React state, effects that
  remember frames, timers, `Date` or `Math.random` (`hash()` from `@motion-kit/core`).
- Fonts load through the brand's `fonts` and `loadFonts()`, which holds the render
  until they are ready.
- Finals wrap the moving content in `<CameraMotionBlur samples={16} shutterAngle={180}>`
  and paint the background once underneath it (stacked copies of a flat
  background drift its colour).
- A clip is `<Clip name clip={CLIPS.<name>} g={g} style={{ left, top }} />` from
  `@motion-kit/remotion/clip`: a Manim scene (engines/manim/BUILD.md), or any
  transparent webm in `public/clips/` with a `CLIPS` entry (CLAUDE.md, Picture).
  `ManimClip` is still exported as the old name for it.
- A film that renders a product's own components can customise webpack in
  `webpack-override.mjs`; the review loads it too.

## Commands (in the film)

```bash
npm run studio        # Remotion Studio, live
npm run render        # out/square.mp4 (render:all for every format)
npm run render:final  # out/final/<slug>-<ratio>.mp4 with motion blur
npm run review        # sheets and motion checks from out/square.mp4 (below)
npm run stills        # key stills at 1080, rendered from source
```

The review cuts `contact.png` (270 px tiles) and `phone.png` (360 px) out of
the render, one ffmpeg pass per sheet, when the render matches the composition
(frame count, rate, shape) and nothing in `src/`, `scripts/`, `public/` or
`manim/` changed after it. A sheet whose tiles are wider than the render is
rendered from source instead, so nothing is upscaled: a 1080p render serves
both sheets, a half-scale preview (`remotion render <Comp> out/preview.mp4
--scale=0.5`, 270×480 for a 540×960 film) serves `contact.png` only. The film
is bundled and Chrome opened only when some tile needs them; until then the
composition's rate and length are `FPS` and `TOTAL_FRAMES` from
`src/timeline.ts`. `report.md` says where each sheet's tiles came from.
