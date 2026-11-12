// Where the review's sheets come from. The film's render (--video) stands in for
// the composition when it matches it: one ffmpeg pass cuts every tile of a sheet,
// where rendering from source costs a Chrome render per tile. Pure, so the rules
// are tested in test.mjs.

/**
 * A composition's size, rate and length without opening the engine: `FPS` and
 * `TOTAL_FRAMES` from src/timeline.ts, and the video's size at half scale (films
 * are laid out at 540 on the short side, CLAUDE.md). Null when either is missing.
 * Remotion only learns the real ones by bundling the film, which is what this
 * spares when every tile can come from the render.
 */
export function guessMeta(timeline, info) {
  if (!info || !Number.isFinite(timeline?.FPS) || !Number.isInteger(timeline?.TOTAL_FRAMES)) return null
  const k = 540 / Math.min(info.width, info.height)
  return { fps: timeline.FPS, durationInFrames: timeline.TOTAL_FRAMES, width: Math.round(info.width * k), height: Math.round(info.height * k) }
}

/**
 * Why `video` (probed as `info`) can't supply tiles `tileWidth` px wide for the
 * composition `meta`, or null when it can. It has to have the composition's
 * length, rate and shape and be newer than every source (`stale` false); and,
 * when the engine can draw the frame itself (`fromSource`), be at least as wide
 * as a tile, so no tile is upscaled.
 */
export function whyNotVideo({ video, info, meta, stale, tileWidth, fromSource }) {
  if (!video || !info) return 'no `--video`'
  if (stale) return `src/, scripts/, public/ or manim/ changed after \`${video}\` was rendered`
  if (!Number.isFinite(info.frames)) return `\`${video}\` doesn't say how many frames it has`
  if (info.frames !== meta.durationInFrames) return `\`${video}\` has ${info.frames} frames, the composition ${meta.durationInFrames}`
  if (Math.abs(info.fps - meta.fps) > 0.01) return `\`${video}\` runs at ${info.fps} fps, the composition at ${meta.fps}`
  if (Math.abs(info.width / info.height - meta.width / meta.height) > 0.01) {
    return `\`${video}\` is ${info.width}×${info.height}, the composition ${meta.width}×${meta.height}`
  }
  if (fromSource && info.width < tileWidth) return `\`${video}\` is ${info.width} px wide, the tiles ${tileWidth}`
  return null
}

/** The report's line on where a sheet's tiles came from. */
export function tileLine(file, why, { video, info, fromSource }) {
  if (!why) return `- \`${file}\`: cut from \`${video}\` (${info.width}×${info.height})`
  return `- \`${file}\`: ${fromSource ? 'rendered from source' : 'cut from the video one frame at a time'} (${why})`
}
