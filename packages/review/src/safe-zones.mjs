// Where a 9:16 film is safe from the apps' own buttons and captions.
//
// Meta's Reels ad guidance (first-party, checked 2026-10) asks for 14 % of the
// top, 35 % of the bottom and 6 % of each side to stay clear of words, logos and
// key elements. TikTok and YouTube Shorts publish no single figure; their action
// buttons run down the right edge above the caption, so the outline also steps
// in there (approximate, from their overlay templates as of 2026-10).
//
// Pure: no I/O, so test.mjs can load it.

export const SAFE_ZONE = {
  top: 0.14,
  bottom: 0.35,
  side: 0.06,
  /** The action buttons: this far in from the right, from this far down. */
  rail: { right: 0.18, from: 0.45 },
}

/** Tall enough to be a Reels / TikTok / Shorts frame (9:16, not 4:5). */
export const isStoryFormat = (width, height) => height / width >= 1.7

/** Outline of the safe area as polygon points, in pixels of a `width` × `height` frame. */
export function safeOutline(width, height, z = SAFE_ZONE) {
  const left = z.side * width
  const right = (1 - z.side) * width
  const rail = (1 - z.rail.right) * width
  const top = z.top * height
  const railFrom = z.rail.from * height
  const bottom = (1 - z.bottom) * height
  return [
    [left, top],
    [right, top],
    [right, railFrom],
    [rail, railFrom],
    [rail, bottom],
    [left, bottom],
  ]
}

/** The outline as an SVG the size of the frame: a white line on a dark one, so it shows on any background. */
export function safeOutlineSvg(width, height) {
  const points = safeOutline(width, height)
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')
  return (
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
    `<polygon points="${points}" fill="none" stroke="#000" stroke-opacity="0.6" stroke-width="3"/>` +
    `<polygon points="${points}" fill="none" stroke="#fff" stroke-width="1" stroke-dasharray="4 3"/>` +
    `</svg>`
  )
}
