// The review's view of a Manim film: size from src/formats.ts, rate and length
// from src/timeline.ts, sheets cut from the render (--video), key stills drawn
// by FrameScene for just those frames. Loaded by motion-review.

import { openVideo } from '@motion-kit/review/video-adapter'
import { stills } from './src/project.mjs'

export function open({ comp, video, stills: keyStills, timeline }) {
  return openVideo({ comp, video, timeline, stills: keyStills, renderStills: (frames) => stills({ format: comp, frames }) })
}
