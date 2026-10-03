// Tally, a fictional demo brand: Geist faces (SIL OFL, fonts/OFL.txt), the
// --film-* roles and a logotype. A film imports this once:
//
//   import { fonts, Logotype } from '../../../brands/example'
//   loadFonts(fonts)

import type { FontSource } from '@motion-kit/core'
import './brand.css'
import geist from './fonts/Geist-Variable.woff2'
import geistMono from './fonts/GeistMono-Variable.woff2'

export const fonts: FontSource[] = [
  { family: 'Geist', url: geist, weight: '100 900' },
  { family: 'Geist Mono', url: geistMono, weight: '100 900' },
]

/** Three tally strokes of rising height. */
export function LogoMark() {
  return (
    <span className="tally-mark" aria-hidden>
      <i style={{ height: 10 }} />
      <i style={{ height: 16 }} />
      <i style={{ height: 22 }} />
    </span>
  )
}

export function Logotype({ style }: { style?: React.CSSProperties }) {
  return (
    <div className="tally-logotype" style={style}>
      <LogoMark />
      Tally
    </div>
  )
}
