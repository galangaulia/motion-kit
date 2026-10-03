// Brand module contract: export `fonts` (for loadFonts) and `Logotype`, and
// import the brand's CSS (synced tokens first, then brand.css with the
// --film-* roles). Copy this folder to brands/<name> and fill it in.

import type { FontSource } from '@motion-kit/core'
// import './tokens.css'
import './brand.css'
// import display from './fonts/Display.woff2'

export const fonts: FontSource[] = [
  // { family: 'Display', url: display, weight: '100 900' },
]

export function Logotype({ style }: { style?: React.CSSProperties }) {
  return (
    <div style={{ fontFamily: 'var(--film-font-display)', fontWeight: 800, fontSize: 22, ...style }}>
      Brand
    </div>
  )
}
