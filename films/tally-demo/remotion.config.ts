import { Config } from '@remotion/cli/config'

// Compositions are authored at half size (540 on the short side) so brand
// token sizes read at their literal values; rendering at 2× gives 1080p.
Config.setScale(2)
Config.setCodec('h264')
Config.setCrf(16)
Config.setVideoImageFormat('jpeg')
Config.setJpegQuality(95)
Config.setPixelFormat('yuv420p')
Config.setOverwriteOutput(true)
