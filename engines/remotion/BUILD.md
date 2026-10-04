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
- A Manim clip is `<ManimClip name clip={CLIPS.<name>} g={g} style={{ left, top }} />`
  from `@motion-kit/remotion/clip` (engines/manim/BUILD.md).
- A film that renders a product's own components can customise webpack in
  `webpack-override.mjs`; the review loads it too.

## Commands (in the film)

```bash
npm run studio        # Remotion Studio, live
npm run render        # out/square.mp4 (render:all for every format)
npm run render:final  # out/final/<slug>-<ratio>.mp4 with motion blur
npm run review        # stills rendered from source, motion checks from out/square.mp4
npm run stills        # key stills at 1080
```
