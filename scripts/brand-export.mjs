// A brand, exported for engines that don't import its React module.
//
//   html   (HyperFrames) → <out>/: the brand's CSS files in order (brand.json → css,
//          @imports followed), its font files, fonts.css with an @font-face per
//          brand.json → fontFiles entry, and logo.html — the brand's <Logotype />
//          rendered once to static markup, so a film has one logo whatever engine.
//   manim  → <out>/brand.json: the --film-* roles resolved to hex (Manim can't read
//          CSS), the first family of each font role, and the font files to convert.
//
// The roles are read from top-level :root blocks only: @media blocks (a dark
// scheme, reduced motion) are skipped, as a light-scheme browser would.

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { brandBase } from './places.mjs'

/** `{ dir, json }` for brands/<name> in the kit or studio/, or throws. */
export function brand(name) {
  const base = brandBase(name)
  if (!base) throw new Error(`no brand at brands/${name}/brand.json (kit or studio/)`)
  const dir = join(base, 'brands', name)
  return { dir, json: JSON.parse(readFileSync(join(dir, 'brand.json'), 'utf8')) }
}

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** The brand's CSS files, each after the files it @imports (paths relative to the brand). */
export function cssFiles(dir, json) {
  const order = []
  const visit = (file) => {
    if (order.includes(file)) return
    const path = join(dir, file)
    if (!existsSync(path)) throw new Error(`${file} is listed in brand.json → css (or @imported) but missing`)
    for (const [, url] of stripComments(readFileSync(path, 'utf8')).matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)['"]?\s*\)?[^;]*;/g)) {
      // Kept with forward slashes: these become hrefs in a page, on Windows too.
      if (!/^[a-z]+:/i.test(url)) visit(relative(dir, resolve(dirname(path), url)).split(sep).join('/'))
    }
    order.push(file)
  }
  for (const file of json.css ?? ['brand.css']) visit(file)
  return order
}

/** Custom properties declared in top-level `:root { … }` blocks, later files and blocks winning. */
export function rootVars(cssTexts) {
  const vars = new Map()
  for (const text of cssTexts) {
    const css = stripComments(text)
    let depth = 0
    let prelude = ''
    let body = ''
    let capture = false
    for (const ch of css) {
      if (ch === '{') {
        if (depth === 0) capture = prelude.split(',').some((s) => s.trim() === ':root')
        else if (capture && depth >= 1) body += ch
        depth++
        prelude = ''
      } else if (ch === '}') {
        depth--
        if (depth === 0) {
          if (capture) {
            for (const decl of body.split(';')) {
              const m = decl.match(/^\s*(--[\w-]+)\s*:\s*([\s\S]+?)\s*$/)
              if (m) vars.set(m[1], m[2])
            }
          }
          capture = false
          body = ''
        } else if (capture) body += ch
      } else if (depth === 0) {
        prelude += ch
        if (ch === ';') prelude = '' // e.g. an @import line
      } else if (capture && depth === 1) body += ch
    }
  }
  return vars
}

const hex2 = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')

/** `value` with every var() substituted from `vars` (fallbacks honoured). */
export function resolveValue(value, vars, seen = []) {
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g, (_, name, fallback) => {
    if (seen.includes(name)) throw new Error(`${name} refers to itself (${[...seen, name].join(' → ')})`)
    if (vars.has(name)) return resolveValue(vars.get(name), vars, [...seen, name])
    if (fallback !== undefined) return resolveValue(fallback.trim(), vars, seen)
    throw new Error(`${seen[0] ?? name} uses ${name}, which no :root block defines`)
  })
}

/** A CSS colour as #rrggbb (or #rrggbbaa): hex and rgb()/rgba() only. */
export function toHex(color, role = 'colour') {
  const c = color.trim().toLowerCase()
  if (/^#[0-9a-f]{3,4}$/.test(c)) return `#${[...c.slice(1)].map((d) => d + d).join('')}`
  if (/^#([0-9a-f]{6}|[0-9a-f]{8})$/.test(c)) return c
  const m = c.match(/^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/)
  if (m) {
    const ch = (v) => (v.endsWith('%') ? (parseFloat(v) * 255) / 100 : parseFloat(v))
    const a = m[4] === undefined ? '' : hex2((m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])) * 255)
    return `#${hex2(ch(m[1]))}${hex2(ch(m[2]))}${hex2(ch(m[3]))}${a === 'ff' ? '' : a}`
  }
  throw new Error(`${role} is "${color}": only hex and rgb() can be handed to Manim — give the token a hex value`)
}

/** The first family of a font stack, unquoted. */
export const firstFamily = (stack) => stack.split(',')[0].trim().replace(/^['"]|['"]$/g, '')

const COLOR_ROLES = { bg: 'bg', card: 'card', ink: 'ink', ink2: 'ink-2', accent: 'accent', onAccent: 'on-accent', line: 'line' }
const FONT_ROLES = { display: 'font-display', ui: 'font-ui', mono: 'font-mono' }

/** The --film-* roles as hex colours and font families. */
export function roles(dir, json) {
  const vars = rootVars(cssFiles(dir, json).map((f) => readFileSync(join(dir, f), 'utf8')))
  const out = { colors: {}, fonts: {} }
  for (const [key, role] of Object.entries(COLOR_ROLES)) {
    const name = `--film-${role}`
    if (vars.has(name)) out.colors[key] = toHex(resolveValue(vars.get(name), vars, [name]), name)
  }
  for (const [key, role] of Object.entries(FONT_ROLES)) {
    const name = `--film-${role}`
    if (vars.has(name)) out.fonts[key] = firstFamily(resolveValue(vars.get(name), vars, [name]))
  }
  for (const key of ['bg', 'ink', 'accent']) if (!out.colors[key]) throw new Error(`the brand's CSS sets no --film-${COLOR_ROLES[key]}`)
  return out
}

/** brand.json → fontFiles, checked: `[{ family, src, weight, style }]` with `src` relative to the brand. */
export function fontFiles(dir, json) {
  const files = json.fontFiles ?? []
  if (!files.length) throw new Error(`${relative(process.cwd(), dir)}/brand.json lists no fontFiles (see docs/brand.md)`)
  for (const f of files) if (!f.family || !f.src || !existsSync(join(dir, f.src))) throw new Error(`fontFiles entry ${JSON.stringify(f)}: needs family and an existing src`)
  return files
}

/** The brand's <Logotype /> as static markup, or '' when its module has none. */
async function logoMarkup(dir, workDir) {
  const entry = join(dir, 'index.tsx')
  if (!existsSync(entry)) return ''
  const require = createRequire(join(workDir, 'package.json'))
  const esbuild = await import(pathToFileURL(require.resolve('esbuild')).href)
  const out = join(workDir, '.logo.mjs')
  await esbuild.build({
    entryPoints: [entry], outfile: out, bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', logLevel: 'silent',
    external: ['react', 'react/jsx-runtime', 'remotion'],
    loader: { '.css': 'empty', '.woff2': 'empty', '.woff': 'empty', '.ttf': 'empty', '.otf': 'empty', '.svg': 'dataurl', '.png': 'dataurl' },
  })
  try {
    const mod = await import(`${pathToFileURL(out).href}?t=${Date.now()}`)
    if (typeof mod.Logotype !== 'function') return ''
    const React = await import(pathToFileURL(require.resolve('react')).href)
    const { renderToStaticMarkup } = await import(pathToFileURL(require.resolve('react-dom/server')).href)
    return renderToStaticMarkup(React.createElement(mod.Logotype))
  } finally {
    rmSync(out, { force: true })
  }
}

/**
 * Export brand `name` for an HTML engine into `out`. `workDir` is where esbuild,
 * react and react-dom resolve from (the film); `prefix` is `out` as the page sees
 * it (e.g. 'brand/'), for the @font-face rules returned to inline in the page.
 */
export async function exportHtml(name, out, workDir, prefix = '') {
  const { dir, json } = brand(name)
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  const css = cssFiles(dir, json)
  for (const f of css) {
    mkdirSync(dirname(join(out, f)), { recursive: true })
    copyFileSync(join(dir, f), join(out, f))
  }
  const files = fontFiles(dir, json)
  const face = (f, base) =>
    `@font-face { font-family: '${f.family}'; src: url('${base}${f.src}'); font-weight: ${f.weight ?? 'normal'}; font-style: ${f.style ?? 'normal'}; font-display: block; }`
  for (const f of files) {
    mkdirSync(dirname(join(out, f.src)), { recursive: true })
    copyFileSync(join(dir, f.src), join(out, f.src))
  }
  writeFileSync(join(out, 'fonts.css'), `${files.map((f) => face(f, '')).join('\n')}\n`)
  const logo = await logoMarkup(dir, workDir)
  writeFileSync(join(out, 'logo.html'), logo)
  return { css, fontsCss: files.map((f) => face(f, prefix)).join('\n'), fonts: files.map((f) => `${prefix}${f.src}`), logo }
}

/** Export brand `name` for Manim: `<out>/brand.json` with hex roles, families and absolute font paths. */
export function exportManim(name, out) {
  const { dir, json } = brand(name)
  mkdirSync(out, { recursive: true })
  const data = {
    name: json.name,
    ...roles(dir, json),
    fontFiles: fontFiles(dir, json).map((f) => ({ ...f, src: join(dir, f.src) })),
    logo: json.logo ? join(dir, json.logo) : null,
  }
  writeFileSync(join(out, 'brand.json'), `${JSON.stringify(data, null, 2)}\n`)
  return data
}
