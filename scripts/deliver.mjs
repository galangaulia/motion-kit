#!/usr/bin/env node
// Copy a film's finished renders to its brand's delivery folder.
//
//   npm run deliver -- example-launch
//
// Reads films/<film>/out/final/*.mp4 (made by the film's `npm run render:final`)
// and copies them to brands/<brand>/brand.json → deliver.to, into a folder named
// after the film without the brand prefix (example-launch → launch). Films and
// brands are looked up in the kit and in studio/.
//
// Sound from outside the kit (public/audio/sources.json) ships with a CREDITS.txt,
// and nothing ships while one of those sources has a licence problem.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { checkSources, creditsText } from '../packages/review/src/sound-sources.mjs'
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

// The film's brand: package.json → motionKit.brand, or for Remotion films made
// before that field, whichever brands/<name> its Root imports.
const pkgPath = join(filmDir, 'package.json')
const rootPath = join(filmDir, 'src', 'Root.tsx')
let brand = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf8')).motionKit?.brand : undefined
if (!brand && existsSync(rootPath)) brand = readFileSync(rootPath, 'utf8').match(/brands\/([\w-]+)/)?.[1]
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

const sourcesPath = join(filmDir, 'public', 'audio', 'sources.json')
const sources = existsSync(sourcesPath) ? JSON.parse(readFileSync(sourcesPath, 'utf8')) : []
const unresolved = checkSources(sources, { today: new Date().toISOString().slice(0, 10) }).filter((c) => c.problems.length)
if (unresolved.length) {
  console.error('not delivering: sound sources with licence problems')
  for (const { source, problems } of unresolved) console.error(`  ${source.file || source.title || '?'}: ${problems.join('; ')}`)
  console.error(`fix SOURCES in ${rel(join(filmDir, 'scripts', 'build-audio.mjs'))}, run \`npm run audio\`, and try again`)
  process.exit(1)
}

const name = film.replace(new RegExp(`^${brand}-`), '')
const to = join(config.deliver.to.replace(/^~(?=$|\/)/, homedir()), name)
mkdirSync(to, { recursive: true })
const files = readdirSync(finals).filter((f) => f.endsWith('.mp4'))
for (const f of files) {
  copyFileSync(join(finals, f), join(to, f))
  console.log(`${f}  ${(statSync(join(to, f)).size / 1e6).toFixed(1)} MB`)
}
if (sources.length) {
  writeFileSync(join(to, 'CREDITS.txt'), creditsText(sources, name))
  console.log('CREDITS.txt')
}
console.log(`→ ${to}  (${files.length} files)`)
