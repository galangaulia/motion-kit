// Sanity checks for the pure-math parts of @motion-kit/core. Run: npm test
import assert from 'node:assert/strict'
import { PRESETS, motion, peakOvershoot, springAt, springVelocity } from './src/springs.ts'
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

// springVelocity(): the slope of springAt, for every kind of damping.
for (const preset of [...Object.keys(PRESETS), slow]) {
  assert.equal(springVelocity(0, preset), 0, 'still at release')
  assert.equal(springVelocity(-1, preset), 0, 'still before release')
  for (const t of [0.02, 0.1, 0.25, 0.6]) {
    const dt = 1e-5
    const slope = (springAt(t + dt, preset) - springAt(t - dt, preset)) / (2 * dt)
    near(springVelocity(t, preset), slope, 1e-4 * Math.max(1, Math.abs(slope)), `velocity is the slope at ${t}s`)
  }
}

// trackVelocity(): the slope of track(), in units per second.
for (const f of [12, 16.5, 20, 40]) {
  const slope = (m.track(f + 1e-4, path) - m.track(f - 1e-4, path)) / (2e-4 / 30)
  near(m.trackVelocity(f, path), slope, 1e-3 * Math.max(1, Math.abs(slope)), `track speed at f${f}`)
}
assert.equal(m.trackVelocity(5, path), 0, 'no speed before the first retarget')

// release(): starts where and as fast as it was let go, lands on its target.
{
  const fine = motion(1000)
  for (const preset of [...Object.keys(PRESETS), slow]) {
    assert.equal(fine.release(100, 100, 30, 500, 80, preset), 30, 'starts at from')
    const speed = (fine.release(100.01, 100, 30, 500, 80, preset) - 30) / (0.01 / 1000)
    near(speed, 500, 5, `starts at the speed it was let go (${preset})`)
    near(fine.release(5000, 100, 30, 500, 80, preset), 80, 1e-6, 'lands on to')
  }
  for (const f of [10, 14, 20, 40]) near(m.release(f, 10, 0, 0, 100), m.spring(f, 10, 0, 100), 1e-9, 'from rest it is spring()')
  // Thrown the wrong way it travels backwards first; thrown along, it gets there sooner.
  assert.ok(m.release(11, 10, 0, -600, 100) < 0, 'a backward throw dips first')
  assert.ok(m.release(13, 10, 0, 600, 100) > m.spring(13, 10, 0, 100), 'a forward throw is ahead of a spring from rest')
}

// zoom(): log space, so halfway through the spring a 1 → 4 zoom reads 2.
{
  const keys = [[0, 1], [10, 4]]
  for (const f of [11, 14, 18, 30]) near(m.zoom(f, keys), 4 ** m.progress(f, 10), 1e-9, `zoom at f${f}`)
  let f = 10
  while (m.progress(f, 10) < 0.5) f += 0.01
  near(m.zoom(f, keys), 2, 0.01, 'halfway is the geometric middle')
  near(m.zoom(300, [[0, 1], [10, 1.06, 'snappy'], [18, 1]]), 1, 1e-6, 'a punch-in comes back to 1')
}

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
