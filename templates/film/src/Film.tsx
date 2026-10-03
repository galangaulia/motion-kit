import { enter, exit, motion } from '@motion-kit/core'
import type { CSSProperties } from 'react'
import { AbsoluteFill, Html5Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { Logotype } from '../../../brands/__BRAND__'
import { CTA, FPS, HOOK, HOOK_WORDS, PRODUCT, ROWS_AT, g } from './timeline'

// Starter film: the house grammar in 16 beats. Replace the content, keep the
// grammar — springs, hits on the beat, one shape that morphs from shot to shot.
//
//   bar 0  hook words land one per beat (heavy), leave on the bar line
//   bar 1–2  the container springs in as a card; rows land on beats; the
//            card breathes with the kick
//   bar 3  the same container morphs (size and colour together) into the
//          CTA pill; logo lands; the pill takes one press so the end card
//          never waits for the clock

const m = motion(FPS)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export function Film() {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const u = Math.min(width, height) / 540 // 1 at the 540 square

  // The one container: size, radius and colour track through each shot, never cut.
  const cardW = Math.min(width - 80 * u, 440 * u)
  const box = {
    w: m.track(frame, [[0, 0], [g.hit(PRODUCT.from), cardW], [g.hit(CTA.from), 280 * u, 'snappy']]),
    h: m.track(frame, [[0, 0], [g.hit(PRODUCT.from), 220 * u], [g.hit(CTA.from), 72 * u, 'snappy']]),
    r: m.track(frame, [[0, 0], [g.hit(PRODUCT.from), 22 * u], [g.hit(CTA.from), 36 * u]]),
  }
  // Colour rides the same spring as the shape, so card → pill is one morph.
  const accent = Math.round(clamp01(m.progress(frame, g.hit(CTA.from), 'snappy')) * 100)
  const breathe = 1 + 0.012 * g.pulse(frame - g.beat(PRODUCT.from)) * (frame < g.beat(CTA.from) ? 1 : 0)
  // One press on the last bar's third beat: the end card keeps moving.
  const pressAt = g.hit(CTA.from + 3)
  const press = m.track(frame, [[0, 1], [pressAt, 0.95, 'snappy'], [pressAt + 5, 1, 'snappy']])

  return (
    <AbsoluteFill className="film-stage" style={{ '--u': u } as CSSProperties}>
      <Html5Audio src={staticFile('audio/soundtrack.wav')} />

      {/* Hook */}
      <AbsoluteFill className="film-center">
        <div className="film-hook" style={frame >= g.hit(HOOK.to) ? exit(m, frame, g.hit(HOOK.to), { y: -40 * u, preset: 'heavy' }) : undefined}>
          {HOOK_WORDS.map((word, i) => (
            <span key={i} className="film-hook-word" style={enter(m, frame, g.hit(HOOK.from + i), { y: 28 * u, preset: 'heavy' })}>
              {word}
            </span>
          ))}
        </div>
      </AbsoluteFill>

      {/* The container */}
      {/* Mounted from its first hit: a zero-size box would still paint its border as a dot. */}
      <AbsoluteFill className="film-center">
        {frame >= g.hit(PRODUCT.from) && (
          <div
            className="film-box"
            style={{
              width: box.w,
              height: box.h,
              borderRadius: box.r,
              background: `color-mix(in srgb, var(--film-accent) ${accent}%, var(--film-card))`,
              borderColor: `color-mix(in srgb, var(--film-accent) ${accent}%, var(--film-line))`,
              transform: `scale(${breathe * press})`,
            }}
          >
            <div className="film-rows" style={{ opacity: m.swapAlpha(frame, g.hit(PRODUCT.from), g.hit(CTA.from)) }}>
              {ROWS_AT.map((beat, i) => (
                <div key={i} className="film-row" style={enter(m, frame, g.hit(beat), { x: 24 * u, preset: 'snappy' })}>
                  <span className="film-row-dot" />
                  Row {i + 1} lands on beat {beat}
                </div>
              ))}
            </div>
            <div className="film-cta" style={{ opacity: m.swapAlpha(frame, g.hit(CTA.from)) }}>
              Call to action
            </div>
          </div>
        )}
      </AbsoluteFill>

      {/* Logo under the CTA */}
      <AbsoluteFill className="film-center">
        <div style={{ transform: `translateY(${80 * u}px)` }}>
          <Logotype style={enter(m, frame, g.hit(CTA.from + 1), { y: 12 * u, preset: 'heavy' })} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
