// The review's view of a HyperFrames film: size from src/formats.ts, rate and
// length from src/timeline.ts, sheets cut from the render (--video), key stills
// snapshotted from the built page at 2×. Loaded by motion-review.

import { openVideo } from '@motion-kit/review/video-adapter'
import { stills } from './src/project.mjs'

export function open({ comp, video, stills: keyStills, timeline }) {
  return openVideo({ comp, video, timeline, stills: keyStills, renderStills: (frames) => stills({ format: comp, frames }) })
}
