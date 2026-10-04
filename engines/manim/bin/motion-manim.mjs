#!/usr/bin/env node
// motion-manim — Manim films and clips. Run from the film folder (its
// package.json scripts do this):
//
//   motion-manim clips [--force]             manim/<name>.py → public/clips/<name>.webm (any engine's film)
//   motion-manim render [Format …] [--final] src/film.py → out/<format>.mp4, or out/final/
//   motion-manim preview [Format]            a half-size render with sound, opened
//   motion-manim prep                        build/manim/: timeline, brand and fonts for Python
//
// Python runs in engines/manim's pixi environment; `clips` needs neither pixi
// nor Python when the film has no manim/ folder.

import { parseArgs } from 'node:util'
import { clips, film, prep, preview, render } from '../src/project.mjs'

const { values, positionals } = parseArgs({ allowPositionals: true, options: { final: { type: 'boolean' }, force: { type: 'boolean' } } })
const [command, ...formats] = positionals

try {
  if (command === 'clips') await clips({ force: values.force })
  else if (command === 'render') await render({ formats, final: values.final })
  else if (command === 'preview') await preview({ format: formats[0] })
  else if (command === 'prep') console.log((await prep(await film())).out)
  else {
    console.error('usage: motion-manim clips [--force] | render [Format …] [--final] | preview [Format] | prep')
    process.exit(1)
  }
} catch (e) {
  console.error(`motion-manim: ${e.message}`)
  process.exit(1)
}
