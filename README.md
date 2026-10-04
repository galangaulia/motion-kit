# motion-kit

[![ci](https://github.com/galangaulia/motion-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/galangaulia/motion-kit/actions/workflows/ci.yml)

<p align="center">
  <img src="films/tally-demo/preview.gif" width="432" alt="Demo film: the words 'Streaks, not spreadsheets.' rise one per beat, a card of three habits lands and each is tapped to a check, then the card morphs into a green 'Try Tally' pill with the logo and example.com.">
</p>

<p align="center">
  <a href="films/tally-demo/preview.mp4">Watch with sound</a> ·
  <a href="films/tally-demo/src/Film.tsx">its code</a> ·
  <a href="films/tally-demo/review_log.md">its critic rounds</a>
</p>

A small motion studio: films made in code with [Remotion](https://remotion.dev),
on shared springs, a beat grid, synthesized sound and a scored critique loop.
Open [Claude Code](https://claude.com/claude-code) in this folder and
`CLAUDE.md` + the `/reel` skill load automatically. For motion-graphic B-roll
on a talking-head video you already have, see [broll-kit](https://github.com/galangaulia/broll-kit).

```text
/reel 15-second teaser for Tally, 1:1 and 9:16, synthesized music
```

## Structure

```text
CLAUDE.md               house rules (motion, rhythm, look, sound, gates)
.claude/skills/reel/    the /reel workflow (films, Remotion)
packages/
  core/                 springs (motion, track, swapAlpha), beat grid, enter/exit, loadFonts
  audio/                synth voices, WAV I/O, BS.1770 loudness, mixdown (duck, limit, -14 LUFS)
  review/               motion-review: contact sheet, 360 px phone sheet, sound report, scorecard
brands/
  example/              Tally, a fictional brand to try the kit with (Geist, OFL)
  _blank/               copy this for a new brand
films/
  tally-demo/           8 s demo on the example brand: 1:1, 9:16, 16:9 (preview.gif / .mp4)
templates/
  film/                 starter film: 3 formats, springs, beats, soundtrack
  brief.md · shotlist.md · review_log.md · style_guide.md
references/             links and notes on films worth learning from
prompts/                prompts that worked
vendor/                 third-party kits (git-ignored, see vendor/README.md)
scripts/                new-film, brand-sync, deliver
docs/                   guides: your own brand, your own sound
```

## Setup

Node 22.18+ (it runs the `.ts` timeline files directly, no build step). No ffmpeg or Python
needed: Remotion ships its own ffmpeg, and the audio and review tools are pure
Node (`sharp` for contact sheets).

```bash
npm install
npm test
cd films/tally-demo && npm run studio   # the demo, live
```

## Make a film

```bash
npm run new -- my-film --brand example
cd films/my-film
npm run studio                 # live preview
npm run render && npm run review
npm run render:all             # 1:1, 9:16, 16:9
npm run render:final           # the same with motion blur → out/final/
```

Every timing lives in the film's `src/timeline.ts` (in beats); the picture
and `scripts/build-audio.mjs` both read it, so a retimed shot keeps its sound.

## Guides

- [Bring your own brand](docs/brand.md): the `--film-*` roles, fonts, tokens, logo, syncing from your product repo.
- [Make the sound yours](docs/sound.md): how a film's soundtrack is built, the synth voices, your own samples or a licensed track.

## Brands

Copy `brands/_blank` to `brands/<name>` ([guide](docs/brand.md)). `brand.json` holds the voice, proof
rules and CTA, plus an optional `sync` map of files to copy from the product
repo (tokens, fonts, logo) and a `deliver.to` folder for finished films:

```bash
npm run brand:sync -- <name>   # then: git diff brands/<name>
npm run deliver -- <film>      # out/final/*.mp4 → deliver.to/<film>
```

## Private work: `studio/`

Client or product films you don't want in a public fork can live in
`studio/`, a separate git repo nested here and ignored by this one. It uses
the same layout (`studio/brands/<name>`, `studio/films/<slug>`), so imports
work unchanged; `npm run new` puts a film next to its brand, and the root
workspace links `studio/films/*` to the shared packages.

```bash
mkdir -p studio/brands studio/films && git -C studio init
echo '{ "extends": "../tsconfig.base.json" }' > studio/tsconfig.base.json
```

## Licences

- This repo: [MIT](LICENSE).
- **Remotion is not MIT.** It is free for individuals and companies of up to
  3 people; larger teams need a [company licence](https://www.remotion.dev/license).
  Using this kit means using Remotion under its terms.
- Geist and Geist Mono (in `brands/example/fonts`): SIL Open Font License 1.1, © Vercel.
- `vendor/` kits keep their own licences; see `vendor/README.md`.
