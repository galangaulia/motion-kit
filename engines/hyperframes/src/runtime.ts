// The page side of a HyperFrames film. The film hands over one function of the
// frame number; every frame HyperFrames captures is drawn from it alone, so frames
// can be rendered in any order, by any number of workers, and come out the same.
//
//   import { mount, apply } from '@motion-kit/hyperframes/runtime'
//   mount({ fps: FPS, render: (frame) => apply(el, enter(m, frame, g.hit(4))) })
//
// HyperFrames seeks the page to each capture time and fires `hf-seek` with it;
// nothing here plays, ticks or remembers an earlier frame.

export type Render = (frame: number) => void

type HfSeek = CustomEvent<{ time: number }>
type HfWindow = Window & { __hf?: { buildReady?: Record<string, Promise<unknown>> } }

/**
 * A capture time × fps as a frame number: whole when it is within float noise of
 * one (so `frame >= g.hit(n)` holds on the frame it should), fractional otherwise —
 * motion blur samples between frames and needs the in-between positions.
 */
export function frameAt(time: number, fps: number) {
  const f = time * fps
  const whole = Math.round(f)
  return Math.abs(f - whole) < 1e-6 ? whole : f
}

/** Draw every captured frame with `render`, once all the page's font faces have loaded. */
export function mount({ fps, render }: { fps: number; render: Render }) {
  window.addEventListener('hf-seek', (e) => render(frameAt((e as HfSeek).detail.time, fps)))
  // Hold the first capture until every @font-face face is loaded: a face nothing
  // has used yet would otherwise still be loading when its first word is drawn.
  const hf = ((window as HfWindow).__hf ??= {})
  hf.buildReady ??= {}
  hf.buildReady.fonts = Promise.allSettled([...document.fonts].map((face) => face.load())).then((results) => {
    const failed = [...document.fonts].filter((_, i) => results[i].status === 'rejected').map((f) => `${f.family} ${f.weight}`)
    if (failed.length) flagFontError(failed)
    render(0)
  })
  render(0)
}

/**
 * HyperFrames renders on with a stand-in face when a font fails to load. Make
 * that impossible to miss instead: a red bar across every frame, naming the face.
 */
function flagFontError(faces: string[]) {
  console.error(`motion-kit: font failed to load: ${faces.join(', ')}`)
  const bar = document.createElement('div')
  bar.textContent = `FONT FAILED TO LOAD: ${faces.join(', ')}`
  bar.style.cssText =
    'position:fixed;left:0;right:0;top:40%;z-index:2147483647;padding:12px;background:#d00;color:#fff;font:700 20px/1.2 sans-serif;text-align:center'
  document.body.append(bar)
}

/**
 * Set inline styles on `el`. Values from `enter()` / `exit()` go straight in;
 * custom properties (`--u`) and an empty string (back to the stylesheet) work too.
 */
export function apply(el: HTMLElement | null, style: Record<string, string | number | undefined>) {
  if (!el) return
  for (const [key, value] of Object.entries(style)) {
    const v = value === undefined ? '' : String(value)
    if (key.startsWith('--')) el.style.setProperty(key, v)
    else (el.style as unknown as Record<string, string>)[key] = v
  }
}

/** Clear what `apply` set for these keys, handing them back to the stylesheet. */
export const reset = (el: HTMLElement | null, ...keys: string[]) => apply(el, Object.fromEntries(keys.map((k) => [k, ''])))
