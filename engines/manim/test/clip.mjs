// Clip contract: a Manim clip comes out as VP9 with real alpha — clear outside
// what the scene draws, solid inside — at 2× its CLIPS size, for exactly the
// frames between its beats. Run: node engines/manim/test/clip.mjs (needs pixi)

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { probe, run } from '@motion-kit/media'
import { clips } from '../src/project.mjs'

const KIT = resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..')
const dir = mkdtempSync(join(tmpdir(), 'manim-clip-'))
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

mkdirSync(join(dir, 'src'))
mkdirSync(join(dir, 'manim'))
writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: '@films/clip-test', type: 'module', motionKit: { engine: 'remotion', brand: 'example' } }))
writeFileSync(join(dir, 'src', 'timeline.ts'), `import { grid } from ${JSON.stringify(join(KIT, 'packages/core/src/beats.ts'))}
export const FPS = 30
export const g = grid(120, FPS)
export const CLIPS = { dot: { from: 1, to: 3, width: 120, height: 80 } }
`)
writeFileSync(join(dir, 'manim', 'dot.py'), `from manim import Circle
from motionkit import FrameScene


class Clip(FrameScene):
    def build(self):
        self.dot = Circle(radius=self.px(20), fill_opacity=1, stroke_width=0, color=self.color("accent"))
        self.add(self.dot)

    def frame(self, f):
        self.place(self.dot, 60, 40)
`)

const [webm] = await clips({ dir })
assert.ok(webm, 'the clip was rendered')
const info = probe(webm)
assert.deepEqual([info.width, info.height], [240, 160], 'clips render at 2× their CLIPS size')
// WebM keeps no frame count in its header: count them.
const frames = Number(run('ffprobe', ['-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', webm]).toString().trim())
assert.equal(frames, 30, 'beats 1–3 at 120 BPM / 30 fps are frames 15–44: 30 frames')

const png = run('ffmpeg', ['-c:v', 'libvpx-vp9', '-i', webm, '-vf', 'trim=start_frame=10:end_frame=11', '-frames:v', '1', '-pix_fmt', 'rgba', '-c:v', 'png', '-f', 'image2pipe', '-'])
const { data, info: px } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const at = (x, y) => Array.from(data.subarray((y * px.width + x) * 4, (y * px.width + x) * 4 + 4))
assert.equal(at(4, 4)[3], 0, 'outside the dot is transparent')
assert.ok(at(120, 80)[3] > 250, 'the dot is opaque')
const [r, g, b] = at(120, 80)
assert.ok(Math.abs(r - 23) < 8 && Math.abs(g - 130) < 8 && Math.abs(b - 87) < 8, `the dot is the brand accent (#178257), got ${r},${g},${b}`)

const again = await clips({ dir })
assert.deepEqual(again, [], 'an up-to-date clip is not rendered again')
console.log('manim clip: ok')
