# Building with Manim

CLAUDE.md's house rules hold for every engine. This page is how they map onto
[Manim Community](https://www.manim.community) (MIT), used two ways:

- **a whole film**: `npm run new -- <slug> --brand <name> --engine manim`, for
  explainers built from diagrams, graphs and geometry;
- **a clip** inside a Remotion or HyperFrames film: a transparent segment drawn
  by Manim, placed by the host film on its own beats.

## Setup, once

```bash
curl -fsSL https://pixi.sh/install.sh | PIXI_NO_PATH_UPDATE=1 sh   # → ~/.pixi, no sudo, no Homebrew
```

The first `motion-manim` run installs the engine's environment from
`engines/manim/pixi.lock`: Python 3.12, cairo, pango, PyAV (with its own ffmpeg)
and Manim 0.21.0, from conda-forge for macOS and Linux alike. No system Python,
no Homebrew, no LaTeX. Set `PIXI` if pixi lives somewhere else.

## Scenes draw from the frame number

Every scene is a `FrameScene` (`motionkit`, in this folder):

```python
from manim import Circle
from motionkit import FrameScene, enter

class Clip(FrameScene):
    def build(self):                     # every mobject, once
        self.dot = Circle(radius=self.px(40), fill_opacity=1, stroke_width=0, color=self.color("accent"))
        self.add(self.dot)

    def frame(self, f):                  # f is the film's frame number
        self.place(self.dot, 100, 100, enter(self.m, f, self.g.hit(4), scale=0.6, preset="heavy"))
```

- **`build()` creates and adds every mobject; nothing is added later.** Manim
  freezes anything outside the running animation into the background after its
  first frame. Hide a mobject with opacity or scale until its moment.
- **`frame(f)` starts from what `build()` left, every time:** each mobject is
  restored before the call. Never carry state between frames: no updaters that
  add `dt`, no `always_redraw` around `Text` (it rebuilds the text every frame),
  no `self.play` / `self.wait` of your own.
- A shape whose geometry changes is rebuilt in place:
  `self.box.become(RoundedRectangle(...))`.
- **Layout is in the half-size px every engine uses:** `self.at(x, y)` (origin top
  left, y down), `self.px(n)`; the frame is `self.film.width × self.film.height`.
- **Brand only:** `self.text(words, size_px, weight, role="display"|"ui"|"mono",
  color="ink", tracking=0)` sets type in the brand's faces at CSS sizes, with
  `tracking` in em like CSS `letter-spacing` (it matches Chrome to about 1 %);
  `self.color(role)` is a `--film-*` colour (`bg`, `card`, `ink`, `ink2`,
  `accent`, `onAccent`, `line`); `self.svg(path, scale)` places an SVG whose px
  are half-size px.
- **Motion:** `self.m` is `motion(FPS)` (springs, `track`, `swap_alpha`), `self.g`
  the beat grid, `enter` / `exit` give a `Move` for `self.place(mob, x, y, move)`.
  The Python port matches the TypeScript (`pixi run test` checks it).
- **Randomness:** `hash()` from `motionkit`, bit for bit the TypeScript one.
  Manim's own seed is fixed at 0.
- **Numbers:** `DecimalNumber` and `Integer` need LaTeX, which isn't installed; use
  `self.text(str(count_up(p, 120)))`, or pass `mob_class=Text`. `Tex` / `MathTex`
  need LaTeX too.
- The logo is `brand.json` → `logo` (an SVG with its text converted to outlines,
  like `brands/example/logo.svg`), placed with `self.svg(self.film.logo)`, or the
  brand's name as a wordmark when there is none.

## A whole film

| File | What it holds |
|---|---|
| `src/film.py` | `class FilmScene(FrameScene)`: the film. |
| `src/timeline.ts` | Every timing, in beats; Python reads it as `self.tl` (exported to JSON). |
| `src/formats.ts` | The formats, at half size. |
| `scripts/build-audio.mjs` | The soundtrack, from the same timeline. |
| `build/manim/` | Written by `motion-manim`: timeline, brand, fonts, frames. Never commit it. |

```bash
npm run studio        # a half-size render with sound, opened
npm run render        # out/square.mp4 (render:all for every format)
npm run render:final  # out/final/<slug>-<ratio>.mp4
npm run review        # motion-review from out/square.mp4
npm run stills        # key stills at 1080, drawn for just those frames
```

## A clip in a Remotion or HyperFrames film

1. Write `manim/<name>.py` in the film with `class Clip(FrameScene)`.
2. Time and size it in `src/timeline.ts`:
   `export const CLIPS = { formula: { from: 8, to: 12, width: 460, height: 300 } }`
   (beats, then half-size px). The scene's `f` is the film's frame number, so
   `self.g.hit(9)` lands on beat 9 of the film.
3. Place it:
   - Remotion: `<ManimClip name="formula" clip={CLIPS.formula} g={g} style={{ left: 40, top: 120 }} />`
     from `@motion-kit/remotion/clip`;
   - HyperFrames: `{{clip:formula}}` in `src/film.html`, positioned with
     `#clip-formula { left: 40px; top: 120px; }` in `src/film.css`.
4. `npm run clips` (every render runs it) writes `public/clips/<name>.webm`, VP9
   with alpha at 2×, and redoes it only when the scene, the timeline or motionkit
   changed. Films without `manim/` need neither pixi nor Python.

## Where Manim differs from the other engines

- **No motion blur on finals.** Sixteen samples a frame on a renderer that draws
  frames one after another would take 32× as long, so Manim finals are sharp
  (an exception to CLAUDE.md's finals rule). Keep fast moves short, or make them
  a clip in a Remotion or HyperFrames film, which blurs it with the rest.
- Frames render in order in one process, so long films are slower.
- Pango lays text out with CoreText on macOS and fontconfig on Linux; the two can
  differ by a pixel, so render a film's finals on one machine.
- Faces are converted from the brand's WOFF2 to static TTFs (one per 100 of
  weight); the text cache is cleared on every render, since Manim keys it by family
  name rather than by font file.
