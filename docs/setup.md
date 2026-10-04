# Setup

From nothing to a rendered film, whether you cloned the repo or downloaded it
as a ZIP. Remotion films need only Node; HyperFrames adds ffmpeg, Manim adds
pixi. Install only what the engines you use need ([engines.md](engines.md)).

## 1. Get the code

Either:

```bash
git clone https://github.com/galangaulia/motion-kit.git
cd motion-kit
```

or, on GitHub, **Code → Download ZIP**, unzip it and open the folder
(`motion-kit-main`; rename it if you like). Nothing in the kit needs git. You
only use it if you want history: for `studio/` (private work, see the README)
or for snapshotting a film between review rounds.

## 2. Node 22.18 or newer

```bash
node --version    # v22.18.0 or later
```

Get it from [nodejs.org](https://nodejs.org), or through a version manager
(nvm, fnm, Volta). The kit runs its `.ts` timeline files directly, which older
Node can't do.

## 3. Install the kit

```bash
npm install
npm test
```

`npm test` ends with `manim parity fixture: current`. Every line before it ends
in `ok` or `passed`. This step is all a Remotion film needs; the demo proves it:

```bash
cd films/tally-demo
npm run render       # out/square.mp4 (Remotion downloads its own Chrome the first time)
```

## 4. Extra tools, per engine

### HyperFrames: a full ffmpeg

| System | Command |
|---|---|
| macOS with Homebrew | `brew install ffmpeg` |
| macOS without Homebrew | put a static `ffmpeg` and `ffprobe` in `~/.local/bin` |
| Windows | `winget install Gyan.FFmpeg` (or `choco install ffmpeg`), then open a new terminal |
| Debian / Ubuntu | `sudo apt install ffmpeg` |

The kit looks in `$MOTION_KIT_FFMPEG` / `$MOTION_KIT_FFPROBE`, then `PATH`, then
`~/.local/bin`. Check it:

```bash
npx motion-hf browser                    # fetches the headless Chrome HyperFrames pins (~200 MB, once)
node engines/hyperframes/test/seek.mjs   # ends with: hyperframes seek: ok
```

### Manim: pixi

pixi installs Python, cairo, pango and PyAV into the engine's own environment.
You don't need Homebrew, a system Python or LaTeX.

| System | Command |
|---|---|
| macOS / Linux | `curl -fsSL https://pixi.sh/install.sh \| PIXI_NO_PATH_UPDATE=1 sh` |
| Windows (PowerShell) | `powershell -ExecutionPolicy ByPass -c "irm -useb https://pixi.sh/install.ps1 \| iex"` |

On macOS and Linux it lands in `~/.pixi/bin`, where the kit finds it without
`PATH` changes; elsewhere, put it on `PATH` or set `$PIXI`. Check it (the first
run installs the environment from `engines/manim/pixi.lock`, a few minutes once):

```bash
~/.pixi/bin/pixi run --manifest-path engines/manim/pixi.toml test   # or: pixi run …
node engines/manim/test/clip.mjs                                    # ends with: manim clip: ok
```

## 5. Your first film

```bash
npm run new -- my-film --brand example                 # add --engine hyperframes or --engine manim
cd films/my-film
npm run studio                                         # preview
npm run render && npm run review                       # out/square.mp4, then out/review/<stamp>-Square/
```

From there the [README](../README.md) and `CLAUDE.md` take over. With
[Claude Code](https://claude.com/claude-code), open the folder: `CLAUDE.md` and
the `/reel` skill load on their own. Other agents start from `AGENTS.md`.

## Platforms

CI renders and reviews a film on every engine on each of these:

| | Remotion | HyperFrames | Manim |
|---|---|---|---|
| macOS, Apple Silicon | yes | yes | yes |
| macOS, Intel | yes | yes | yes |
| Linux x64 | yes | yes | yes |
| Windows x64 | yes | yes | yes |

Linux on ARM isn't covered: Manim's environment isn't locked for it.

## Disk space

| What | Size | Where |
|---|---|---|
| `npm install` | ~750 MB | `node_modules/` |
| Remotion's Chrome | ~200 MB | `node_modules/.remotion/` |
| HyperFrames' Chrome | ~200 MB | `~/.cache/hyperframes/` |
| Manim's environment | ~800 MB | `engines/manim/.pixi/` |
| pixi's download cache | ~1 GB | your user cache; `pixi clean cache` frees it once the environment is installed |

## When something fails

| Message | Fix |
|---|---|
| `Unknown file extension ".ts"` | Node is older than 22.18. |
| `No ffmpeg found` | Install ffmpeg (above), or set `MOTION_KIT_FFMPEG`. |
| `HyperFrames needs a full ffmpeg` | Only Remotion's small build was found: install a full one. |
| `pixi is missing` | Install pixi (above), or set `PIXI` to its path. |
| A red bar reading `FONT FAILED TO LOAD` across a HyperFrames frame | A face in the brand's `brand.json` → `fontFiles` points at a file that isn't there. |
| `npm install` downloads a large Chrome | A copy from before `.puppeteerrc.cjs` existed: set `PUPPETEER_SKIP_DOWNLOAD=1`. |
| `.agents/skills/reel` is a small text file (Windows) | Git or the unzip tool didn't make the symlink. Claude Code reads `.claude/skills/` and doesn't need it; for other agents, point them at `.claude/skills/reel/SKILL.md`. |
