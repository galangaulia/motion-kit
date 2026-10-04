// Parity fixture: what the TypeScript springs, beat grid, hash and enter/exit
// return for a spread of inputs. tests/test_parity.py holds the Python port to
// these numbers; this script fails (npm test) when the TypeScript has changed
// and the fixture wasn't rewritten.
//
//   node engines/manim/test/fixture.mjs           check the fixture is current
//   node engines/manim/test/fixture.mjs --write   rewrite it

import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { grid } from '../../../packages/core/src/beats.ts'
import { motion, peakOvershoot, springAt, springVelocity } from '../../../packages/core/src/springs.ts'
import { countUp, hash, scramble } from '../../../packages/core/src/text.ts'

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixture.json')

const presets = ['snappy', 'default', 'heavy', 'playful', { duration: 0.3, bounce: -0.4 }]
const seconds = [-0.1, 0, 0.01, 1 / 30, 0.1, 0.2, 0.37, 0.5, 1, 2.5]
const frames = [-3, 0, 1, 7, 29.5, 58, 58.25, 61, 90, 150, 239]
const m = motion(30)
const keys = [[0, 0], [10, 200], [40, 60, 'snappy'], [41, 120, 'heavy']]
const zoomKeys = [[0, 1], [12, 2.5], [30, 1.06, 'snappy'], [38, 1]]

// enter/exit return CSS; the Python returns the numbers inside it.
const move = (css) => {
  const [, x, y, s] = css.transform.match(/^translate\((\S+)px, (\S+)px\) scale\((\S+)\)$/).map(Number)
  return { x, y, scale: s, opacity: css.opacity }
}
const enterExit = await import('../../../packages/core/src/enter.ts').catch(() => null)

function build() {
  const out = {
    springAt: presets.map((p) => seconds.map((t) => springAt(t, p))),
    springVelocity: presets.map((p) => seconds.map((t) => springVelocity(t, p))),
    peakOvershoot: presets.map((p) => peakOvershoot(p)),
    presets, seconds, frames, keys, zoomKeys,
    motion: frames.map((f) => ({
      progress: m.progress(f, 10, 'heavy'),
      spring: m.spring(f, 20, 5, -40),
      track: m.track(f, keys),
      trackVelocity: m.trackVelocity(f, keys),
      release: m.release(f, 30, 100, -800, 20, 'snappy'),
      zoom: m.zoom(f, zoomKeys),
      swapAlpha: m.swapAlpha(f, 10, 120),
      swapAlphaOpen: m.swapAlpha(f, 10),
    })),
    grids: [
      [120, 30, {}],
      [100, 30, { offset: 3 }],
      [128, 60, { beatsPerBar: 3 }],
    ].map(([bpm, fps, opts]) => {
      const g = grid(bpm, fps, opts)
      const beats = [-1.5, -0.5, 0, 0.5, 1, 3.5, 7.25, 12, 15.5]
      return {
        bpm, fps, offset: opts.offset ?? 0, beatsPerBar: opts.beatsPerBar ?? 4,
        beat: beats.map((b) => g.beat(b)), hit: beats.map((b) => g.hit(b)), bar: [0, 1, 2.5].map((b) => g.bar(b)),
        seconds: beats.map((b) => g.seconds(b)), at: frames.map((f) => g.at(f)),
        pulse: frames.map((f) => g.pulse(f)), pulse2: frames.map((f) => g.pulse(f, 2, 9)), beats,
      }
    }),
    hash: [[1], [1, 2], [7, 3, 99], [-5], [123456789, -42, 3.7], [0, 0, 0, 0], [2 ** 40, -(2 ** 33)]].map((args) => ({ args, value: hash(...args) })),
    scramble: [['Hello, World 42', 0, 0, 1], ['Hello, World 42', 7, 0.4, 3], ['PRD · v2', 19, 0.9, 1]].map(([text, frame, progress, seed]) => ({ text, frame, progress, seed, value: scramble(text, frame, progress, { seed }) })),
    countUp: [[0, 100], [0.5, 3], [0.25, 10], [0.75, 10, 2], [1.2, 7]].map(([p, to, from]) => ({ p, to, from: from ?? 0, value: countUp(p, to, from) })),
  }
  if (enterExit) {
    out.enter = frames.map((f) => move(enterExit.enter(m, f, 10, { y: 28, preset: 'heavy' })))
    out.enterDefault = frames.map((f) => move(enterExit.enter(m, f, 10)))
    out.enterScale = frames.map((f) => move(enterExit.enter(m, f, 10, { x: -24, scale: 0.9, preset: 'snappy' })))
    out.exit = frames.map((f) => move(enterExit.exit(m, f, 30, { y: -40, preset: 'heavy' })))
  }
  return out
}

const fresh = JSON.parse(JSON.stringify(build()))
if (process.argv.includes('--write')) {
  writeFileSync(FILE, `${JSON.stringify(fresh, null, 1)}\n`)
  console.log(`wrote ${FILE}`)
} else {
  assert.deepEqual(JSON.parse(readFileSync(FILE, 'utf8')), fresh, 'engines/manim/tests/fixture.json is stale: run node engines/manim/test/fixture.mjs --write, then pixi run test')
  console.log('manim parity fixture: current')
}
