// A Manim clip in a Remotion film: public/clips/<name>.webm (VP9 with alpha,
// built by `npm run clips` from manim/<name>.py) shown from beat `from` to beat
// `to` of CLIPS.<name> in src/timeline.ts — the same entry the Python scene is
// timed by, so picture, clip and soundtrack share one set of beats.
//
//   import { ManimClip } from '@motion-kit/remotion/clip'
//   <ManimClip name="formula" clip={CLIPS.formula} g={g} style={{ left: 40, top: 120 }} />

import type { CSSProperties } from 'react'
import { OffthreadVideo, Sequence, staticFile } from 'remotion'

/** A CLIPS entry: beats `from`–`to`, size in half-size px. */
export type ClipSpec = { from: number; to: number; width: number; height: number }

export function ManimClip({ name, clip, g, style }: { name: string; clip: ClipSpec; g: { beat: (n: number) => number }; style?: CSSProperties }) {
  const from = g.beat(clip.from)
  return (
    <Sequence from={from} durationInFrames={g.beat(clip.to) - from} layout="none">
      <OffthreadVideo
        src={staticFile(`clips/${name}.webm`)}
        transparent
        muted
        style={{ position: 'absolute', width: clip.width, height: clip.height, ...style }}
      />
    </Sequence>
  )
}
