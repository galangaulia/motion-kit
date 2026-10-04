// Starter film: the house grammar in 16 beats, the same film as the Remotion
// starter. Replace the content, keep the grammar — springs, hits on the beat,
// one shape that morphs from shot to shot.
//
//   bar 0    hook words land one per beat (heavy), leave on the bar line
//   bar 1–2  the container springs in as a card; rows land on beats; the card
//            breathes with the kick
//   bar 3    the same container morphs (size and colour together) into the CTA
//            pill; the logo lands; the pill takes one press so the end card
//            never waits for the clock
//
// render(frame) sets every moving style from the frame number alone, so any
// frame can be drawn on its own, in any order (engines/hyperframes/BUILD.md).

import { enter, exit } from '@motion-kit/core/enter'
import { motion } from '@motion-kit/core/springs'
import { apply, mount, reset } from '@motion-kit/hyperframes/runtime'
import { CTA, FPS, HOOK, HOOK_WORDS, PRODUCT, ROWS_AT, g } from './timeline'

const m = motion(FPS)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const $ = (id: string) => document.getElementById(id) as HTMLElement

const root = $('root')
const width = Number(root.dataset.width)
const height = Number(root.dataset.height)
const u = Math.min(width, height) / 540 // 1 at the 540 square
apply(root, { '--u': u })

// Words and rows come from the timeline, so the copy lives in one place.
const hook = $('hook')
const words = HOOK_WORDS.map((word) => {
  const span = document.createElement('span')
  span.className = 'film-hook-word'
  span.textContent = word
  hook.append(span)
  return span
})
const rowsLayer = $('rows')
const rows = ROWS_AT.map((beat, i) => {
  const row = document.createElement('div')
  row.className = 'film-row'
  const dot = document.createElement('span')
  dot.className = 'film-row-dot'
  row.append(dot, `Row ${i + 1} lands on beat ${beat}`)
  rowsLayer.append(row)
  return row
})
const box = $('box')
const cta = $('cta')
const logo = $('logo')
$('logo-slot').style.transform = `translateY(${80 * u}px)`

function render(frame: number) {
  // Hook
  if (frame >= g.hit(HOOK.to)) apply(hook, exit(m, frame, g.hit(HOOK.to), { y: -40 * u, preset: 'heavy' }))
  else reset(hook, 'opacity', 'transform')
  words.forEach((word, i) => apply(word, enter(m, frame, g.hit(HOOK.from + i), { y: 28 * u, preset: 'heavy' })))

  // The one container: size, radius and colour track through each shot, never cut.
  // Shown from its first hit: a zero-size box would still paint its border as a dot.
  const cardW = Math.min(width - 80 * u, 440 * u)
  const w = m.track(frame, [[0, 0], [g.hit(PRODUCT.from), cardW], [g.hit(CTA.from), 280 * u, 'snappy']])
  const h = m.track(frame, [[0, 0], [g.hit(PRODUCT.from), 220 * u], [g.hit(CTA.from), 72 * u, 'snappy']])
  const r = m.track(frame, [[0, 0], [g.hit(PRODUCT.from), 22 * u], [g.hit(CTA.from), 36 * u]])
  // Colour rides the same spring as the shape, so card → pill is one morph.
  const accent = Math.round(clamp01(m.progress(frame, g.hit(CTA.from), 'snappy')) * 100)
  const breathe = 1 + 0.012 * g.pulse(frame - g.beat(PRODUCT.from)) * (frame < g.beat(CTA.from) ? 1 : 0)
  // One press on the last bar's third beat: the end card keeps moving.
  const pressAt = g.hit(CTA.from + 3)
  const press = m.track(frame, [[0, 1], [pressAt, 0.95, 'snappy'], [pressAt + 5, 1, 'snappy']])
  apply(box, {
    display: frame >= g.hit(PRODUCT.from) ? '' : 'none',
    width: `${w}px`,
    height: `${h}px`,
    borderRadius: `${r}px`,
    background: `color-mix(in srgb, var(--film-accent) ${accent}%, var(--film-card))`,
    borderColor: `color-mix(in srgb, var(--film-accent) ${accent}%, var(--film-line))`,
    transform: `scale(${breathe * press})`,
  })
  apply(rowsLayer, { opacity: m.swapAlpha(frame, g.hit(PRODUCT.from), g.hit(CTA.from)) })
  rows.forEach((row, i) => apply(row, enter(m, frame, g.hit(ROWS_AT[i]), { x: 24 * u, preset: 'snappy' })))
  apply(cta, { opacity: m.swapAlpha(frame, g.hit(CTA.from)) })

  // Logo under the CTA
  apply(logo, enter(m, frame, g.hit(CTA.from + 1), { y: 12 * u, preset: 'heavy' }))
}

mount({ fps: FPS, render })
