// HyperFrames' producer depends on Puppeteer, whose install would download a
// Chrome (about 560 MB) that nothing here uses: Remotion fetches its own, and
// motion-hf fetches the one HyperFrames pins.
module.exports = { skipDownload: true }
