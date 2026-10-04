// Sanity checks for scripts/brand-export.mjs. Run: npm test

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { brand, cssFiles, firstFamily, resolveValue, roles, rootVars, toHex } from './brand-export.mjs'

// :root only — a dark-scheme override inside @media must not win.
const vars = rootVars([
  `/* tokens */ :root { --paper: #f4f1ea; --ink: rgb(22, 24, 29); --a: var(--b); --b: #abc; }
   @media (prefers-color-scheme: dark) { :root { --paper: #000000; } }
   html, body { color: red; }`,
  `:root, .theme { --film-bg: var(--paper); --film-ink: var(--ink); --film-accent: var(--missing, #178257); }`,
])
assert.equal(vars.get('--paper'), '#f4f1ea', 'top-level :root wins over @media')
assert.equal(resolveValue(vars.get('--film-bg'), vars), '#f4f1ea')
assert.equal(resolveValue(vars.get('--a'), vars), '#abc', 'var chains resolve')
assert.equal(resolveValue(vars.get('--film-accent'), vars), '#178257', 'var() fallbacks resolve')
assert.throws(() => resolveValue('var(--nope)', vars), /no :root block defines/)

assert.equal(toHex('#ABC'), '#aabbcc')
assert.equal(toHex('rgb(22, 24, 29)'), '#16181d')
assert.equal(toHex('rgba(255 0 0 / 50%)'), '#ff000080')
assert.throws(() => toHex('oklch(0.6 0.1 150)', '--film-accent'), /only hex and rgb/)
assert.equal(firstFamily(`'Geist', system-ui, sans-serif`), 'Geist')

// @imports come before the file that imports them, each file once.
const dir = mkdtempSync(join(tmpdir(), 'brand-test-'))
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))
writeFileSync(join(dir, 'tokens.css'), ':root { --x: #111111; }')
writeFileSync(join(dir, 'global.css'), "@import './tokens.css';\nbody { margin: 0 }")
writeFileSync(join(dir, 'brand.css'), "@import url('tokens.css');\n:root { --film-bg: var(--x); --film-ink: #fff; --film-accent: #f00; }")
assert.deepEqual(cssFiles(dir, { css: ['global.css', 'brand.css'] }), ['tokens.css', 'global.css', 'brand.css'])

// The example brand resolves end to end.
const example = brand('example')
const r = roles(example.dir, example.json)
assert.deepEqual(r.colors, { bg: '#f4f1ea', card: '#ffffff', ink: '#16181d', ink2: '#5d6370', accent: '#178257', onAccent: '#ffffff', line: '#e2ddd2' })
assert.deepEqual(r.fonts, { display: 'Geist', ui: 'Geist', mono: 'Geist Mono' })

console.log('brand-export: ok')
