import { cancelRender, continueRender, delayRender } from 'remotion'

export type FontSource = {
  family: string
  /** URL from `staticFile()` or from importing the font file. */
  url: string
  /** CSS weight or range, e.g. '100 900' for a variable font. */
  weight?: string
  style?: string
}

/**
 * Load font faces and hold rendering until they're ready, so no frame is ever
 * captured in a fallback face. Call once at module level (e.g. in Root.tsx).
 */
export function loadFonts(fonts: FontSource[]) {
  const handle = delayRender(`Loading ${fonts.map((f) => f.family).join(', ')}`)
  Promise.all(
    fonts.map((f) =>
      new FontFace(f.family, `url('${f.url}') format('woff2')`, {
        weight: f.weight ?? '400',
        style: f.style ?? 'normal',
      }).load(),
    ),
  )
    .then((faces) => {
      faces.forEach((face) => document.fonts.add(face))
      continueRender(handle)
    })
    .catch((err) => cancelRender(err))
}
