import { loadFonts } from '@motion-kit/core'
import { Composition } from 'remotion'
import { fonts } from '../../../brands/example'
import './film.css'
import { Film } from './Film'
import { FPS, TOTAL_FRAMES } from './timeline'

loadFonts(fonts)

// One timeline, three frames. Authored at half size and rendered at 2×
// (remotion.config.ts): 1080×1080, 1080×1920, 1920×1080.
const FORMATS = [
  { id: 'Square', width: 540, height: 540 },
  { id: 'Vertical', width: 540, height: 960 },
  { id: 'Wide', width: 960, height: 540 },
]

export function RemotionRoot() {
  return (
    <>
      {FORMATS.flatMap((f) => [
        <Composition key={f.id} id={f.id} component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={f.width} height={f.height} defaultProps={{ blur: false }} />,
        // The same film with motion blur, for finals (npm run render:final → out/final/).
        <Composition key={`${f.id}-Final`} id={`${f.id}-Final`} component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={f.width} height={f.height} defaultProps={{ blur: true }} />,
      ])}
    </>
  )
}
