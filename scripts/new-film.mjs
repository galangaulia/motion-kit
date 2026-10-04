// Scaffold a film: the engine's starter (engines/<engine>/template), the timeline
// and soundtrack script every engine shares (templates/shared), and the brief,
// shotlist and review log.
//
//   npm run new -- <slug> --brand <brand> [--engine remotion|hyperframes|manim]
//
// Remotion is the default. The film goes next to its brand: films/ for a brand in
// the kit, studio/films/ for a brand in studio/.
//
// Then fill brief.md → shotlist.md (get it approved) → key stills (get them
// approved) → build → review loop.

import { cpSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { ROOT, brandBase, rel } from './places.mjs'

const ENGINES = ['remotion', 'hyperframes', 'manim']
const { values, positionals } = parseArgs({ allowPositionals: true, options: { brand: { type: 'string' }, engine: { type: 'string', default: 'remotion' } } })
const slug = positionals[0]
const { brand, engine } = values

if (!slug || !brand || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  console.error('usage: npm run new -- <slug> --brand <brand> [--engine remotion|hyperframes|manim]   (slug: lowercase, digits, dashes)')
  process.exit(1)
}
const template = join(ROOT, 'engines', engine, 'template')
if (!ENGINES.includes(engine) || !existsSync(template)) {
  console.error(`no engine "${engine}" — pick one of ${ENGINES.filter((e) => existsSync(join(ROOT, 'engines', e, 'template'))).join(', ')}`)
  process.exit(1)
}
const base = brandBase(brand)
if (!base) {
  console.error(`no brand at brands/${brand}/brand.json (kit or studio/) — copy brands/_blank first`)
  process.exit(1)
}
// Remotion films import the brand's React module; the others read its CSS and
// font files, listed in brand.json → fontFiles (docs/brand.md).
const brandDir = join(base, 'brands', brand)
if (engine === 'remotion' && !existsSync(join(brandDir, 'index.tsx'))) {
  console.error(`no brand module at ${rel(brandDir)}/index.tsx — copy brands/_blank first`)
  process.exit(1)
}
if (engine !== 'remotion' && !JSON.parse(readFileSync(join(brandDir, 'brand.json'), 'utf8')).fontFiles?.length) {
  console.error(`${rel(brandDir)}/brand.json lists no fontFiles, which ${engine} films load their faces from (see docs/brand.md)`)
  process.exit(1)
}
const dest = join(base, 'films', slug)
if (existsSync(dest)) {
  console.error(`${rel(dest)} already exists — pick another slug, existing films are left alone`)
  process.exit(1)
}

cpSync(join(ROOT, 'templates', 'shared'), dest, { recursive: true })
cpSync(template, dest, { recursive: true })
for (const doc of ['brief.md', 'shotlist.md', 'review_log.md']) cpSync(join(ROOT, 'templates', doc), join(dest, doc))

// Path from the film to the kit root, for the template's tsconfig and scripts.
const kit = base === ROOT ? '../..' : '../../..'
const fill = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) fill(p)
    else if (/\.(json|ts|tsx|mjs|css|md|html|py|toml)$/.test(name)) {
      writeFileSync(p, readFileSync(p, 'utf8').replaceAll('__SLUG__', slug).replaceAll('__BRAND__', brand).replaceAll('__KIT__', kit))
    }
  }
}
fill(dest)

// Link the new workspace so @motion-kit/* resolve. HyperFrames finds or fetches
// its own pinned Chrome, so Puppeteer's download is skipped.
spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: '1' } })

console.log(`
${rel(dest)} is ready (brand: ${brand}, engine: ${engine}).

  cd ${rel(dest)}
  npm run studio      # preview the starter
  # 1. fill brief.md   2. write shotlist.md and get it approved
  # 2b. npm run stills and get the look approved   3. build
  npm run render && npm run review   # every round, until all scores are 8+
`)
