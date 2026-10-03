import { enter, exit, motion } from '@motion-kit/core'
import type { CSSProperties } from 'react'
import { AbsoluteFill, Html5Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { Logotype } from '../../../brands/example'
import { CTA, CTA_TEXT, FPS, HOOK, HOOK_WORDS, PRODUCT, ROWS, ROWS_AT, g } from './timeline'

// Demo film for the fictional Tally brand: the starter's grammar in 16 beats,
// with real copy — springs, hits on the beat, one shape that morphs from shot to shot.
//
//   bar 0  hook words land one per beat (heavy), leave on the bar line
//   bar 1–2  the container springs in as a card; rows land on beats; the
//            card breathes with the kick
//   bar 3  the same container morphs into the CTA pill; logo lands

const m = motion(FPS)

export function Film() {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const u = Math.min(width, height) / 540 // 1 at the 540 square

  // The one container: size and radius track through each shot, never cut.
  const cardW = Math.min(width - 80 * u, 420 * u)
  const box = {
    w: m.track(frame, [[0, 0], [g.hit(PRODUCT.from), cardW], [g.hit(CTA.from), 200 * u, 'snappy']]),
    h: m.track(frame, [[0, 0], [g.hit(PRODUCT.from), 180 * u], [g.hit(CTA.from), 56 * u, 'snappy']]),
    r: m.track(frame, [[0, 0], [g.hit(PRODUCT.from), 18 * u], [g.hit(CTA.from), 28 * u]]),
  }
  const breathe = 1 + 0.012 * g.pulse(frame - g.beat(PRODUCT.from)) * (frame < g.beat(CTA.from) ? 1 : 0)

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
      <AbsoluteFill className="film-center">
        <div
          className={frame >= g.hit(CTA.from) ? 'film-box film-box-accent' : 'film-box'}
          style={{ width: box.w, height: box.h, borderRadius: box.r, transform: `scale(${breathe})` }}
        >
          <div className="film-rows" style={{ opacity: m.swapAlpha(frame, g.hit(PRODUCT.from), g.hit(CTA.from)) }}>
            {ROWS_AT.map((beat, i) => (
              <div key={i} className="film-row" style={enter(m, frame, g.hit(beat), { x: 24 * u, preset: 'snappy' })}>
                <span className="film-row-dot" />
                {ROWS[i]}
              </div>
            ))}
          </div>
          <div className="film-cta" style={{ opacity: m.swapAlpha(frame, g.hit(CTA.from)) }}>
            {CTA_TEXT}
          </div>
        </div>
      </AbsoluteFill>

      {/* Logo under the CTA */}
      <AbsoluteFill className="film-center">
        <div style={{ transform: `translateY(${70 * u}px)` }}>
          <Logotype style={enter(m, frame, g.hit(CTA.from + 1), { y: 12 * u, preset: 'heavy' })} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
