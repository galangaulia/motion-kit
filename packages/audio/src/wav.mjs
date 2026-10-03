import { readFileSync, writeFileSync } from 'node:fs'
import { SR } from './dsp.mjs'

/** Write a stereo buffer as 16-bit PCM WAV. Values are clamped to [-1, 1]. */
export function writeWav(path, [L, R], sr = SR) {
  const n = L.length
  const data = Buffer.alloc(n * 4)
  const q = (v) => Math.round(Math.max(-1, Math.min(1, v)) * 32767)
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(q(L[i]), i * 4)
    data.writeInt16LE(q(R[i]), i * 4 + 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(2, 22) // stereo
  header.writeUInt32LE(sr, 24)
  header.writeUInt32LE(sr * 4, 28)
  header.writeUInt16LE(4, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  writeFileSync(path, Buffer.concat([header, data]))
}

/**
 * Read a PCM (16/24-bit) or float (32-bit) WAV into a stereo buffer at `sr`
 * (mono is duplicated; other rates are resampled linearly). For a supplied
 * music track, convert it to WAV first: npx remotion ffmpeg -i song.mp3 song.wav
 */
export function readWav(path, sr = SR) {
  const buf = readFileSync(path)
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${path}: not a WAV file`)
  }
  let fmt
  let dataAt = -1
  let dataLen = 0
  for (let p = 12; p + 8 <= buf.length; ) {
    const id = buf.toString('ascii', p, p + 4)
    const size = buf.readUInt32LE(p + 4)
    if (id === 'fmt ') {
      fmt = {
        format: buf.readUInt16LE(p + 8),
        channels: buf.readUInt16LE(p + 10),
        rate: buf.readUInt32LE(p + 12),
        bits: buf.readUInt16LE(p + 22),
      }
    } else if (id === 'data') {
      dataAt = p + 8
      dataLen = Math.min(size, buf.length - dataAt)
    }
    p += 8 + size + (size % 2)
  }
  if (!fmt || dataAt < 0) throw new Error(`${path}: missing fmt or data chunk`)
  const float = fmt.format === 3 || (fmt.format === 0xfffe && fmt.bits === 32)
  const bytes = fmt.bits / 8
  const frames = Math.floor(dataLen / (bytes * fmt.channels))
  const read = (o) => {
    if (float) return buf.readFloatLE(o)
    if (fmt.bits === 16) return buf.readInt16LE(o) / 32768
    if (fmt.bits === 24) return buf.readIntLE(o, 3) / 8388608
    throw new Error(`${path}: ${fmt.bits}-bit PCM not supported`)
  }
  const src = [new Float32Array(frames), new Float32Array(frames)]
  for (let i = 0; i < frames; i++) {
    const o = dataAt + i * bytes * fmt.channels
    src[0][i] = read(o)
    src[1][i] = fmt.channels > 1 ? read(o + bytes) : src[0][i]
  }
  if (fmt.rate === sr) return src
  const ratio = fmt.rate / sr
  const n = Math.floor(frames / ratio)
  return src.map((ch) => {
    const out = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const x = i * ratio
      const j = Math.floor(x)
      out[i] = ch[j] + ((ch[Math.min(j + 1, frames - 1)] ?? 0) - ch[j]) * (x - j)
    }
    return out
  })
}
