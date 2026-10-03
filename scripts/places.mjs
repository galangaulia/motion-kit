// Where brands and films live. The public kit keeps its own under brands/ and
// films/; private work lives in studio/ (its own git repo, ignored here) with
// the same layout, so a film's relative imports work in either place.

import { existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const STUDIO = join(ROOT, 'studio')
const BASES = [ROOT, STUDIO]

/** The base (ROOT or STUDIO) holding brands/<name>, or undefined. */
export const brandBase = (name) => BASES.find((b) => existsSync(join(b, 'brands', name, 'brand.json')))

/** Absolute path of films/<slug> in either base, or undefined. */
export const findFilm = (slug) => BASES.map((b) => join(b, 'films', slug)).find((p) => existsSync(p))

/** A path relative to the repo root, for messages. */
export const rel = (p) => relative(ROOT, p) || '.'
