// The review's view of a Remotion film: bundle src/index.ts once, then render
// any frame of a composition straight from the source at any scale. motion-review
// (@motion-kit/review) loads this for films whose package.json says
// "motionKit": { "engine": "remotion" } — or says nothing, like older films.
//
// Bundling and Chrome wait until they are needed. Handed a `guess` at the
// composition's size, rate and length (motion-review makes one from
// src/timeline.ts and the render, when the sheets can be cut from it), `open`
// returns at once; the first `still()` or `resolveMeta()` bundles the film.

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { bundle } from '@remotion/bundler'
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer'

/**
 * @param {{ comp: string, entry?: string, tmp: string,
 *   guess?: { fps: number, width: number, height: number, durationInFrames: number } | null }} opts
 * @returns {Promise<{ meta: { fps: number, width: number, height: number, durationInFrames: number },
 *   guessed: boolean, fromSource: true, resolveMeta: () => Promise<object>,
 *   still: (frame: number, scale: number) => Promise<Buffer>, close: () => Promise<void> }>}
 */
export async function open({ comp, entry = 'src/index.ts', tmp, guess = null }) {
  let source = null
  const load = () => (source ??= openSource({ comp, entry, tmp }))

  return {
    meta: guess ?? (await load()).meta,
    guessed: Boolean(guess),
    fromSource: true,
    /** The composition's own size, rate and length (bundles the film, once). */
    resolveMeta: async () => (await load()).meta,
    async still(frame, scale) {
      const { composition, serveUrl, browser } = await load()
      const output = join(tmp, `${frame}-${scale.toFixed(3)}.png`)
      await renderStill({ composition, serveUrl, frame, scale, output, imageFormat: 'png', puppeteerInstance: browser })
      return readFileSync(output)
    },
    close: async () => {
      if (source) await source.then((s) => s.browser.close({ silent: true }), () => {})
    },
  }
}

async function openSource({ comp, entry, tmp }) {
  console.log('bundling…')
  // A film that customises webpack (e.g. to render a product's own components)
  // keeps the override in webpack-override.mjs next to its package.json; the
  // CLI picks it up from remotion.config.ts, the review has to load it itself.
  const overridePath = resolve('webpack-override.mjs')
  const webpackOverride = existsSync(overridePath) ? (await import(pathToFileURL(overridePath).href)).default : undefined
  const serveUrl = await bundle({ entryPoint: resolve(entry), outDir: join(tmp, 'bundle'), ...(webpackOverride ? { webpackOverride } : {}) })
  const browser = await openBrowser('chrome')
  let composition
  try {
    composition = await selectComposition({ serveUrl, id: comp, puppeteerInstance: browser })
  } catch (e) {
    await browser.close({ silent: true })
    throw e
  }
  const { fps, width, height, durationInFrames } = composition
  return { composition, serveUrl, browser, meta: { fps, width, height, durationInFrames } }
}
