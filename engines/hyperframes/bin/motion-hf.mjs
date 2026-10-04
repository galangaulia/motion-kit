#!/usr/bin/env node
// motion-hf — build, preview and render a HyperFrames film. Run from the film
// folder (its package.json scripts do this):
//
//   motion-hf build [Format …]                build/<Format>/ only (page, film.js, brand)
//   motion-hf preview [Format]                HyperFrames' preview, with the soundtrack
//   motion-hf render [Format …] [--final]     out/<format>.mp4, or out/final/ with motion blur
//   motion-hf browser                         fetch the pinned headless Chrome (render does it too)
//
// Formats are the keys of src/formats.ts; render takes all of them when none is named.

import { parseArgs } from 'node:util'
import { build, ensureBrowser, preview, render } from '../src/project.mjs'

const { values, positionals } = parseArgs({ allowPositionals: true, options: { final: { type: 'boolean' } } })
const [command, ...formats] = positionals

try {
  if (command === 'build') {
    const f = await build({ formats })
    console.log(`build/ ← ${Object.keys(f.projects).join(', ')}`)
  } else if (command === 'preview') {
    await preview({ format: formats[0] })
  } else if (command === 'render') {
    await render({ formats, final: values.final })
  } else if (command === 'browser') {
    console.log(await ensureBrowser())
  } else {
    console.error('usage: motion-hf build [Format …] | preview [Format] | render [Format …] [--final] | browser')
    process.exit(1)
  }
} catch (e) {
  console.error(`motion-hf: ${e.message}`)
  process.exit(1)
}
