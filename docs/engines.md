# Engines

A film is drawn by one of three engines. Whichever you pick, the rest of the
kit is the same: the beat timeline, the synthesized soundtrack, the brand, the
key-stills and review loop, the finals and `npm run deliver`.

```bash
npm run new -- my-film --brand example                      # Remotion (default)
npm run new -- my-film --brand example --engine hyperframes
npm run new -- my-film --brand example --engine manim
```

Every film then has the same commands: `npm run studio`, `render`,
`render:all`, `render:final`, `review`, `stills`.

## Which one

| | Remotion | HyperFrames | Manim |
|---|---|---|---|
| You write | React components | HTML, CSS, one `render(frame)` | Python scenes |
| Best for | product films, UI, the kit's richest helpers | the same films, without React | diagrams, graphs, geometry, maths |
| Preview | Remotion Studio, live | HyperFrames' preview | a quick half-size render |
| Finals | motion blur | motion blur | sharp (no blur) |
| Needs | Node | Node + a full ffmpeg | Node + pixi |
| Licence | free for individuals and teams of up to 3, then a [company licence](https://www.remotion.dev/license) | Apache 2.0 | MIT |

Not sure? Use Remotion. Reach for Manim when the film explains something with a
diagram or an equation, or use it for just that part: a **Manim clip** is a
transparent segment drawn by Manim and placed in a Remotion or HyperFrames film
on its beats ([engines/manim/BUILD.md](../engines/manim/BUILD.md)).

How each engine meets the house rules: `engines/<engine>/BUILD.md`.

## Installing what each one needs

**Remotion**: nothing beyond `npm install`. It downloads its own Chrome and
ships its own ffmpeg.

**HyperFrames**: a full ffmpeg (Remotion's build lacks filters HyperFrames uses).
The kit looks in `$MOTION_KIT_FFMPEG`, then `PATH`, then `~/.local/bin`:

```bash
brew install ffmpeg            # macOS with Homebrew
sudo apt install ffmpeg        # Debian / Ubuntu
# or a static build in ~/.local/bin (ffmpeg and ffprobe)
```

The first render downloads the headless Chrome HyperFrames pins (about 95 MB,
into `~/.cache/hyperframes`). Versions are pinned exactly in the root
`package.json` (`overrides`); upgrade them together, then run
`node engines/hyperframes/test/seek.mjs`.

**Manim**: [pixi](https://pixi.sh), which installs Python, cairo, pango and PyAV
from conda-forge into the engine's own environment. No Homebrew, no system
Python, no LaTeX:

```bash
curl -fsSL https://pixi.sh/install.sh | PIXI_NO_PATH_UPDATE=1 sh   # → ~/.pixi
```

The first Manim render installs the environment from `engines/manim/pixi.lock`
(a few hundred MB, once). Films that don't use Manim never need pixi.

## Changing engines

The brief, shotlist, timeline, soundtrack and brand carry over; the picture
doesn't. Scaffold a new film on the other engine, copy `src/timeline.ts`,
`scripts/build-audio.mjs` and the docs across, and rebuild the shots.
