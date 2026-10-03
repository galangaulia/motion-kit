#!/usr/bin/env node
// Copy a film's finished renders to its brand's delivery folder.
//
//   npm run deliver -- example-launch
//
// Reads films/<film>/out/final/*.mp4 (made by the film's `npm run render:final`)
// and copies them to brands/<brand>/brand.json → deliver.to, into a folder named
// after the film without the brand prefix (example-launch → launch). Films and
// brands are looked up in the kit and in studio/.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { brandBase, findFilm, rel } from './places.mjs'

const film = process.argv[2]
if (!film) {
  console.error('usage: npm run deliver -- <film>')
  process.exit(1)
}
const filmDir = findFilm(film)
if (!filmDir) {
  console.error(`no film named ${film} in films/ or studio/films/`)
  process.exit(1)
}
const finals = join(filmDir, 'out', 'final')
if (!existsSync(finals)) {
  console.error(`no renders in ${rel(finals)} — run \`npm run render:final\` in ${rel(filmDir)} first`)
  process.exit(1)
}

// The film's brand is whichever brands/<name> its Root imports.
const rootSrc = readFileSync(join(filmDir, 'src', 'Root.tsx'), 'utf8')
const brand = rootSrc.match(/brands\/([\w-]+)/)?.[1]
const base = brand && brandBase(brand)
if (!base) {
  console.error(`can't tell which brand ${rel(filmDir)} uses`)
  process.exit(1)
}
const config = JSON.parse(readFileSync(join(base, 'brands', brand, 'brand.json'), 'utf8'))
if (!config.deliver?.to) {
  console.error(`${rel(join(base, 'brands', brand))}/brand.json has no deliver.to`)
  process.exit(1)
}

const to = join(config.deliver.to.replace(/^~(?=$|\/)/, homedir()), film.replace(new RegExp(`^${brand}-`), ''))
mkdirSync(to, { recursive: true })
const files = readdirSync(finals).filter((f) => f.endsWith('.mp4'))
for (const f of files) {
  copyFileSync(join(finals, f), join(to, f))
  console.log(`${f}  ${(statSync(join(to, f)).size / 1e6).toFixed(1)} MB`)
}
console.log(`→ ${to}  (${files.length} files)`)
