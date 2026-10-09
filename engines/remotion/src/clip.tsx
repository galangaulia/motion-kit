// A clip in a Remotion film: public/clips/<name>.webm (VP9 with alpha) shown
// from beat `from` to beat `to` of CLIPS.<name> in src/timeline.ts — the same
// entry the clip itself is timed by, so picture, clip and soundtrack share one
// set of beats.
//
//   import { Clip } from '@motion-kit/remotion/clip'
//   <Clip name="formula" clip={CLIPS.formula} g={g} style={{ left: 40, top: 120 }} />
//
// Usually the clip is a Manim scene that `npm run clips` built from
// manim/<name>.py (engines/manim/BUILD.md). It doesn't have to be: `npm run
// clips` only builds the names it finds in manim/, so a transparent webm put in
// public/clips/ by hand, with a CLIPS entry to time it, is left alone and plays
// the same way. A cut-out of real footage is the usual reason — see CLAUDE.md,
// "Picture".

import type { CSSProperties } from 'react'
import { OffthreadVideo, Sequence, staticFile } from 'remotion'

/** A CLIPS entry: beats `from`–`to`, size in half-size px. */
export type ClipSpec = { from: number; to: number; width: number; height: number }

export function Clip({ name, clip, g, style }: { name: string; clip: ClipSpec; g: { beat: (n: number) => number }; style?: CSSProperties }) {
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

/** @deprecated The old name for `Clip`, from when every clip was a Manim scene. */
export const ManimClip = Clip
