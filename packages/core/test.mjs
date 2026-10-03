// Sanity checks for the pure-math parts of @motion-kit/core. Run: npm test
import assert from 'node:assert/strict'
import { PRESETS, motion, peakOvershoot, springAt } from './src/springs.ts'
import { grid } from './src/beats.ts'
import { countUp, hash, scramble } from './src/text.ts'

const near = (got, want, tol, label) => assert.ok(Math.abs(got - want) <= tol, `${label}: got ${got}, want ${want}`)

// Every preset is still at release, and has arrived a few seconds later.
for (const name of Object.keys(PRESETS)) {
  assert.equal(springAt(0, name), 0, `${name}: 0 at release`)
  assert.equal(springAt(-0.5, name), 0, `${name}: 0 before release`)
  assert.equal(springAt(NaN, name), 0, `${name}: 0 for NaN`)
  near(springAt(4, name), 1, 1e-6, `${name}: arrives`)
}

// Sample the curve to find its highest point past the target.
const measuredPeak = (preset) => {
  let top = 0
  for (let s = 0; s < 3; s += 0.0005) top = Math.max(top, springAt(s, preset))
  return top - 1
}
for (const name of Object.keys(PRESETS)) {
  near(peakOvershoot(name), measuredPeak(name), 0.002, `${name}: overshoot formula matches the curve`)
}
assert.equal(peakOvershoot('heavy'), 0, 'heavy never overshoots')
near(measuredPeak('heavy'), 0, 1e-9, 'heavy curve stays under 1')
assert.ok(peakOvershoot('playful') > peakOvershoot('snappy'), 'playful rings more than snappy')
assert.ok(peakOvershoot('snappy') > peakOvershoot('default'), 'snappy rings more than default')

// Overdamped springs (negative bounce) creep in without crossing 1.
const slow = { duration: 0.4, bounce: -0.5 }
assert.equal(peakOvershoot(slow), 0)
assert.ok(measuredPeak(slow) <= 1e-12, 'overdamped never passes 1')
assert.ok(springAt(0.2, slow) < springAt(0.2, { duration: 0.4, bounce: 0 }), 'overdamped lags critical')

// motion(): frames to seconds, and no preset means the default one.
const m = motion(30)
assert.equal(m.fps, 30)
assert.equal(m.progress(25, 10), springAt(0.5, 'default'))
assert.equal(m.spring(25, 10, 10, 20, 'heavy'), 10 + 10 * springAt(0.5, 'heavy'))

// track(): retargeting mid-flight continues smoothly and lands on the last value.
const path = [[0, 0], [10, 100], [16, 40]]
assert.equal(m.track(10, path), 0, 'nothing moves until the first retarget has passed')
const a = m.track(16, path)
const b = m.track(17, path)
assert.ok(Math.abs(b - a) < 20, `no jump on retarget (${a} -> ${b})`)
near(m.track(300, path), 40, 1e-6, 'track ends on the last target')

// swapAlpha(): hidden, then shown, then hidden again before the next morph.
assert.equal(m.swapAlpha(0, 10, 60), 0)
assert.equal(m.swapAlpha(30, 10, 60), 1)
assert.equal(m.swapAlpha(59, 10, 60), 0)
assert.equal(m.swapAlpha(1000, 10), 1, 'no exit when outAt is omitted')

// Beat grid: 120 BPM at 30 fps is 15 frames a beat.
const g = grid(120, 30)
assert.equal(g.perBeat, 15)
assert.equal(g.beat(4), 60)
assert.equal(g.bar(1), 60)
assert.equal(g.hit(4), 58)
assert.equal(g.seconds(2), 1)
assert.equal(g.pulse(60), 1)
assert.ok(g.pulse(66) < 0.5)

// fx: scramble is deterministic and locks left to right.
assert.equal(scramble('Motion', 10, 1), 'Motion')
assert.equal(scramble('Motion', 10, 0.5).slice(0, 3), 'Mot')
assert.notEqual(scramble('Motion', 10, 0), 'Motion')
assert.equal(scramble('ab cd', 7, 0), scramble('ab cd', 7, 0))
assert.equal(scramble('ab cd', 7, 0)[2], ' ')
assert.ok(hash(1, 2) >= 0 && hash(1, 2) < 1)
assert.equal(countUp(0.5, 92), 46)

console.log('core: ok')
