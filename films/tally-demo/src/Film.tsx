import { enter, motion } from '@motion-kit/core'
import type { CSSProperties } from 'react'
import { AbsoluteFill, Html5Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { Logotype } from '../../../brands/example'
import { CHECKS_AT, CTA, CTA_TEXT, FPS, HOOK, HOOK_OUT, HOOK_WORDS, PRESS_AT, PRODUCT, ROWS, ROWS_AT, URL_AT, URL_TEXT, g } from './timeline'

// Demo film for the fictional Tally brand: the starter's grammar in 16 beats,
// with real copy — springs, hits on the beat, one shape that morphs from shot to shot.
//
//   bar 0    hook words stack in, one per beat (heavy), then lift away on 3.75
//   bar 1–2  the container springs in as a card; habits land on the off-beats
//            with empty rings, then each row is pressed and its ring fills to a
//            check on beats 8–10
//   bar 3    the rows lift out, the card morphs into the CTA pill while green
//            sweeps up through it; the logo lands, the destination lands, the
//            pill takes one press

const m = motion(FPS)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** A habit's ring: empty until `at`, then it fills and draws its check. */
function Check({ frame, at }: { frame: number; at: number }) {
  const fill = m.progress(frame, at, 'snappy')
  const draw = clamp01(m.progress(frame, at + 3, 'snappy'))
  // The tap itself: one ring spreads from the check and thins out as it goes.
  const ripple = clamp01(m.progress(frame, at, 'default'))
  return (
    <svg className="film-check" viewBox="0 0 30 30" overflow="visible" aria-hidden>
      {ripple > 0 && ripple < 1 && (
        <circle cx="15" cy="15" r={13 + ripple * 24} fill="none" stroke="var(--film-accent)" strokeWidth={4 * (1 - ripple)} opacity={1 - ripple} />
      )}
      <circle cx="15" cy="15" r="13" fill="none" stroke="var(--film-accent)" strokeWidth="2.5" />
      <circle cx="15" cy="15" r="13.5" fill="var(--film-accent)" transform={`translate(15 15) scale(${fill}) translate(-15 -15)`} />
      <path
        d="M9 15.5l4 4 8-9"
        fill="none"
        stroke="var(--film-on-accent)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={1 - draw}
      />
    </svg>
  )
}

export function Film() {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const u = Math.min(width, height) / 540 // 1 at the 540 square
  const tall = height > width * 1.2
  const wide = width > height * 1.2
  // 16:9 keeps the compact layout but zooms it to fill the wider frame (it still fits the 540 height).
  const zoom = wide ? 1.75 : 1

  // Sizes per format: 9:16 is laid out for its own frame, not the square centred.
  // 9:16 keeps ~8 % side margins (clear of feed icons) and spends its height on spacing.
  const cardW = tall ? width * 0.88 : Math.min(width - 80 * u, 440 * u)
  const rowSize = (tall ? 42 : 30) * u
  const rowGap = (tall ? 56 : 22) * u
  const rowPad = (tall ? 50 : 32) * u
  // The card is always as tall as the rows it holds, so it never sits mostly empty.
  const cardFor = (rows: number) => 2 * rowPad + rows * rowSize * 1.2 + (rows - 1) * rowGap
  const pillW = (tall ? 470 : 360) * u
  const pillH = (tall ? 124 : 84) * u
  // End card: pill, logotype (the hero, larger than the label) and URL, stacked and
  // centred as one group. The pill travels up into its slot as it morphs.
  const logoScale = tall ? 3.2 : 2.4
  const urlScale = tall ? 1.9 : 1.4
  const logoH = 26 * logoScale * u
  const urlH = 29 * urlScale * u
  const gapA = (tall ? 70 : 40) * u
  const gapB = (tall ? 36 : 22) * u
  const groupH = pillH + gapA + logoH + gapB + urlH
  const pillY = -groupH / 2 + pillH / 2
  const logoY = pillY + pillH / 2 + gapA + logoH / 2
  const urlY = logoY + logoH / 2 + gapB + urlH / 2
  // Hook: the two short words big, the long one sized to the frame's width.
  const hookBig = (tall ? 110 : 88) * u
  const hookLong = (tall ? 64 : 66) * u

  // The one container: size and radius track through each shot, never cut.
  const morphAt = g.hit(CTA.from, 3)
  const box = {
    w: m.track(frame, [[0, 0], [g.hit(PRODUCT.from), cardW], [morphAt, pillW]]),
    h: m.track(frame, [
      [0, 0],
      [g.hit(PRODUCT.from), cardFor(1)],
      [g.hit(ROWS_AT[1]), cardFor(2)],
      [g.hit(ROWS_AT[2]), cardFor(3)],
      [morphAt, pillH],
    ]),
    r: m.track(frame, [[0, 0], [g.hit(PRODUCT.from), 22 * u], [morphAt, pillH / 2]]),
    y: m.track(frame, [[0, 0], [morphAt, pillY]]),
  }
  // Colour changes with the shape, on a quicker spring so the pill is green early.
  const accent = Math.round(clamp01(m.progress(frame, morphAt, 'snappy')) * 100)
  const breathe = 1 + 0.012 * g.pulse(frame - g.beat(PRODUCT.from)) * (frame < g.beat(CTA.from) ? 1 : 0)
  const press = m.track(frame, [[0, 1], [g.hit(PRESS_AT), 0.92, 'snappy'], [g.hit(PRESS_AT) + 6, 1, 'snappy']])
  // Rows lift out one after another just before the morph; the label waits until the pill is nearly green.
  const rowsOut = morphAt - 8
  const labelAt = morphAt + 8
  const label = m.progress(frame, labelAt, 'snappy')
  const logoRise = m.progress(frame, g.hit(CTA.from + 1, 6), 'heavy')
  const urlRise = m.progress(frame, g.hit(URL_AT, 6), 'heavy')

  return (
    <AbsoluteFill
      className="film-stage"
      style={{ '--u': u, '--row-size': `${rowSize}px`, '--cta-size': `${(tall ? 50 : 34) * u}px` } as CSSProperties}
    >
      <Html5Audio src={staticFile('audio/soundtrack.wav')} />
      <AbsoluteFill style={zoom === 1 ? undefined : { transform: `scale(${zoom})` }}>

        {/* Hook: one word per line, left-aligned block in the middle of the frame. Each
            word rises out of its own line mask, and the block leaves by moving off the
            top, fully opaque: nothing in the hook fades. */}
        <AbsoluteFill className="film-center">
          <div className="film-hook" style={{ transform: `translateY(${-m.progress(frame, g.hit(HOOK_OUT), 'heavy') * height * 0.8}px)` }}>
            {HOOK_WORDS.map((word, i) => {
              // Released 6 frames ahead (not the usual 2): the line mask hides the first part of the rise.
              const rise = m.progress(frame, g.hit(HOOK.from + i, 6), 'heavy')
              const last = i === HOOK_WORDS.length - 1
              return (
                <span key={i} className="film-hook-line">
                  <span
                    className={i === 0 ? 'film-hook-word film-hook-accent' : 'film-hook-word'}
                    style={{ fontSize: last ? hookLong : hookBig, transform: `translateY(${(1 - rise) * 115}%)` }}
                  >
                    {word}
                  </span>
                </span>
              )
            })}
          </div>
        </AbsoluteFill>

        {/* The container. Mounted from its first hit: a zero-size box would still paint its border as a dot. */}
        <AbsoluteFill className="film-center">
          {frame >= g.hit(PRODUCT.from) && (
            <div
              className="film-box"
              style={{
                width: box.w,
                height: box.h,
                borderRadius: box.r,
                background: `color-mix(in oklch, var(--film-accent) ${accent}%, var(--film-card))`,
                borderColor: `color-mix(in oklch, var(--film-accent) ${accent}%, var(--film-line))`,
                transform: `translateY(${box.y}px) scale(${breathe * press})`,
              }}
            >
              {frame < morphAt && (
                <div className="film-rows" style={{ gap: rowGap, padding: `${rowPad}px ${rowPad * 0.9}px` }}>
                  {ROWS_AT.map((beat, i) => {
                    const tap = m.track(frame, [[0, 1], [g.hit(CHECKS_AT[i]) - 3, 0.93, 'snappy'], [g.hit(CHECKS_AT[i]) + 3, 1, 'snappy']])
                    const style = enter(m, frame, g.hit(beat), { x: 56 * u, preset: 'snappy' })
                    // Leaving: lift 80 px on its own spring, two frames after the row above; the fade
                    // only starts once the row is well on its way.
                    const lift = clamp01(m.progress(frame, rowsOut + i * 2, 'snappy'))
                    return (
                      <div
                        key={i}
                        className="film-row"
                        style={{
                          opacity: Number(style.opacity) * (1 - clamp01((lift - 0.4) / 0.45)),
                          transform: `${style.transform} translateY(${-lift * 80 * u}px) scale(${tap})`,
                          // The press tints the label green for as long as the row is pushed in.
                          color: `color-mix(in oklch, var(--film-accent) ${Math.round(clamp01((1 - tap) / 0.07) * 100)}%, var(--film-ink))`,
                        }}
                      >
                        <Check frame={frame} at={g.hit(CHECKS_AT[i])} />
                        {ROWS[i]}
                      </div>
                    )
                  })}
                </div>
              )}
              <div
                className="film-cta"
                style={{ opacity: m.swapAlpha(frame, labelAt), transform: `translateY(${(1 - label) * 14 * u}px)` }}
              >
                {CTA_TEXT}
              </div>
            </div>
          )}
        </AbsoluteFill>

        {/* Logo, then the destination, under the pill: each rises out of its own mask. */}
        <AbsoluteFill className="film-center">
          <div className="film-mask" style={{ transform: `translateY(${logoY}px) scale(${logoScale})` }}>
            <div style={{ transform: `translateY(${(1 - logoRise) * 120}%)` }}>
              <Logotype />
            </div>
          </div>
        </AbsoluteFill>
        <AbsoluteFill className="film-center">
          <div className="film-mask" style={{ transform: `translateY(${urlY}px) scale(${urlScale})` }}>
            <div className="film-url" style={{ transform: `translateY(${(1 - urlRise) * 120}%)` }}>
              {URL_TEXT}
            </div>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
