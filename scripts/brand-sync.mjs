// Copy a brand's source-of-truth files (tokens, fonts, logo) from its product
// repo into brands/<brand>/ (in the kit or in studio/), as listed under "sync"
// in its brand.json. The snapshots are committed, so an upstream change shows
// up as a git diff before any film renders with it.
//
//   npm run brand:sync -- <brand>

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { brandBase, rel } from './places.mjs'

const name = process.argv[2]
if (!name) {
  console.error('usage: npm run brand:sync -- <brand>')
  process.exit(1)
}

const base = brandBase(name)
if (!base) {
  console.error(`no brand named ${name} in brands/ or studio/brands/`)
  process.exit(1)
}
const dir = join(base, 'brands', name)
const brand = JSON.parse(readFileSync(join(dir, 'brand.json'), 'utf8'))
if (!brand.sync) {
  console.log(`${name}: no "sync" in brand.json, nothing to do`)
  process.exit(0)
}

const source = brand.sync.root.replace(/^~(?=\/|$)/, homedir())
let changed = 0
let missing = 0
for (const [from, to] of Object.entries(brand.sync.files)) {
  const src = join(source, from)
  const dst = join(dir, to)
  if (!existsSync(src)) {
    console.warn(`  missing   ${from}`)
    missing++
    continue
  }
  const same = existsSync(dst) && readFileSync(src).equals(readFileSync(dst))
  if (!same) {
    mkdirSync(dirname(dst), { recursive: true })
    copyFileSync(src, dst)
    changed++
  }
  console.log(`  ${same ? 'unchanged' : 'updated  '} ${to}`)
}
console.log(`${name}: ${changed} updated, ${missing} missing. Review with: git diff ${rel(dir)}`)
if (missing) process.exit(1)
