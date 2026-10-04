// The review's view of a film that exists only as rendered frames (HyperFrames,
// Manim): its size from src/formats.ts, its rate and length from src/timeline.ts
// — never from the video, so a render with a frame too many still gets flagged —
// and any frame cut out of --video. Key stills come from the engine instead,
// rendered once at full size (`renderStills`), since there may be no video yet.

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { still as grab } from '@motion-kit/media'

/** The `FORMATS` entry `comp` names in src/formats.ts: `{ width, height }` at half size. */
export async function filmFormat(comp) {
  const path = resolve('src', 'formats.ts')
  if (!existsSync(path)) throw new Error('src/formats.ts is missing: it exports FORMATS, each format with its half-size width and height.')
  const { FORMATS } = await import(pathToFileURL(path).href)
  const format = FORMATS?.[comp]
  if (!format) throw new Error(`No format "${comp}" in src/formats.ts (it has ${Object.keys(FORMATS ?? {}).join(', ') || 'none'}).`)
  return format
}

/**
 * @param {{ comp: string, video?: string, timeline: Record<string, any>, stills?: boolean,
 *   renderStills?: (frames: number[], meta: object) => Promise<Map<number, Buffer>> }} opts
 */
export async function openVideo({ comp, video, timeline, stills, renderStills }) {
  if (!Number.isFinite(timeline?.FPS) || !Number.isInteger(timeline?.TOTAL_FRAMES)) {
    throw new Error('src/timeline.ts has to export FPS and TOTAL_FRAMES (and load in Node).')
  }
  const { width, height } = await filmFormat(comp)
  const meta = { fps: timeline.FPS, width, height, durationInFrames: timeline.TOTAL_FRAMES }
  let rendered = new Map()

  return {
    meta,
    /** Key stills are rendered by the engine in one go, before any is asked for. */
    async prepare(frames) {
      if (stills) rendered = await renderStills(frames, meta)
    },
    async still(frame, scale) {
      if (stills) return rendered.get(frame)
      if (!video) throw new Error(`This engine is reviewed from its render: pass --video (e.g. out/${comp.toLowerCase()}.mp4).`)
      return grab(video, frame, Math.round(width * scale), Math.round(height * scale))
    },
    close: async () => {},
  }
}
