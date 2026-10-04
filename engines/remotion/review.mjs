// The review's view of a Remotion film: bundle src/index.ts once, then render
// any frame of a composition straight from the source at any scale. motion-review
// (@motion-kit/review) loads this for films whose package.json says
// "motionKit": { "engine": "remotion" } — or says nothing, like older films.

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { bundle } from '@remotion/bundler'
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer'

/**
 * @param {{ comp: string, entry?: string, tmp: string }} opts
 * @returns {Promise<{ meta: { fps: number, width: number, height: number, durationInFrames: number },
 *   still: (frame: number, scale: number) => Promise<Buffer>, close: () => Promise<void> }>}
 */
export async function open({ comp, entry = 'src/index.ts', tmp }) {
  console.log('bundling…')
  // A film that customises webpack (e.g. to render a product's own components)
  // keeps the override in webpack-override.mjs next to its package.json; the
  // CLI picks it up from remotion.config.ts, the review has to load it itself.
  const overridePath = resolve('webpack-override.mjs')
  const webpackOverride = existsSync(overridePath) ? (await import(pathToFileURL(overridePath).href)).default : undefined
  const serveUrl = await bundle({ entryPoint: resolve(entry), outDir: join(tmp, 'bundle'), ...(webpackOverride ? { webpackOverride } : {}) })
  const composition = await selectComposition({ serveUrl, id: comp })
  const { fps, width, height, durationInFrames } = composition
  const browser = await openBrowser('chrome')

  return {
    meta: { fps, width, height, durationInFrames },
    async still(frame, scale) {
      const output = join(tmp, `${frame}-${scale.toFixed(3)}.png`)
      await renderStill({ composition, serveUrl, frame, scale, output, imageFormat: 'png', puppeteerInstance: browser })
      return readFileSync(output)
    },
    close: () => browser.close({ silent: true }),
  }
}
