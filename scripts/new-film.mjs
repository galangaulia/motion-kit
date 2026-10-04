// Scaffold a film from templates/film plus the brief, shotlist and review log.
//
//   npm run new -- <slug> --brand <brand>
//
// The film goes next to its brand: films/ for a brand in the kit, studio/films/
// for a brand in studio/.
//
// Then fill brief.md → shotlist.md (get it approved) → key stills (get them
// approved) → build → review loop.

import { cpSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { ROOT, brandBase, rel } from './places.mjs'

const { values, positionals } = parseArgs({ allowPositionals: true, options: { brand: { type: 'string' } } })
const slug = positionals[0]
const brand = values.brand

if (!slug || !brand || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  console.error('usage: npm run new -- <slug> --brand <brand>   (slug: lowercase, digits, dashes)')
  process.exit(1)
}
const base = brandBase(brand)
if (!base || !existsSync(join(base, 'brands', brand, 'index.tsx'))) {
  console.error(`no brand module at brands/${brand}/index.tsx (kit or studio/) — copy brands/_blank first`)
  process.exit(1)
}
const dest = join(base, 'films', slug)
if (existsSync(dest)) {
  console.error(`${rel(dest)} already exists — pick another slug, existing films are left alone`)
  process.exit(1)
}

cpSync(join(ROOT, 'templates', 'film'), dest, { recursive: true })
for (const doc of ['brief.md', 'shotlist.md', 'review_log.md']) cpSync(join(ROOT, 'templates', doc), join(dest, doc))

// Path from the film to the kit root, for the template's tsconfig.
const kit = base === ROOT ? '../..' : '../../..'
const fill = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) fill(p)
    else if (/\.(json|ts|tsx|mjs|css|md)$/.test(name)) {
      writeFileSync(p, readFileSync(p, 'utf8').replaceAll('__SLUG__', slug).replaceAll('__BRAND__', brand).replaceAll('__KIT__', kit))
    }
  }
}
fill(dest)

// Link the new workspace so @motion-kit/* resolve.
spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: ROOT, stdio: 'inherit' })

console.log(`
${rel(dest)} is ready (brand: ${brand}).

  cd ${rel(dest)}
  npm run studio      # preview the starter
  # 1. fill brief.md   2. write shotlist.md and get it approved
  # 2b. npm run stills and get the look approved   3. build
  npm run render && npm run review   # every round, until all scores are 8+
`)
