// Cue audition page: a sound.html next to report.md so a human reviewer can
// actually hear each cue — in the mix, by seeking it, and alone, from the dry
// clip build-audio.mjs wrote to public/audio/cues/ (docs/sound.md).

const escapeXml = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c])

/** cues: [{ name, time (s), lift (dB) | null, clip: href | null }]. mix: href of the full mixed track. */
export function soundReportHtml({ cues, mix }) {
  const e = escapeXml
  const rows = cues
    .map(
      (c) =>
        `<tr><td><button onclick="seek(${c.time})">${c.time.toFixed(2)}s</button></td><td>${e(c.name)}</td>` +
        `<td>${c.lift == null ? '—' : `${c.lift >= 0 ? '+' : ''}${c.lift.toFixed(1)} dB`}</td>` +
        `<td>${c.clip ? `<audio controls preload=none src="${e(c.clip)}"></audio>` : '<span class=m>no dry clip</span>'}</td></tr>`,
    )
    .join('')
  return `<!doctype html><meta charset=utf-8><title>Sound — cue audition</title>
<style>body{font-family:system-ui;background:#111;color:#eee;margin:20px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #333;padding:8px;text-align:left}.m{color:#999;font-size:12px}audio{height:28px;vertical-align:middle}button{background:#d97757;color:#fff;border:0;border-radius:6px;padding:6px 10px;cursor:pointer}</style>
<h1>Sound — cue audition</h1>
<p>Click a time to hear that cue inside the mix; the last column is the same cue alone. Lift is how far it rises over the bed's floor just before it (report.md has the full table).</p>
<audio id=mix controls preload=none src="${e(mix)}"></audio>
<table><tr><th>time</th><th>cue</th><th>lift</th><th>alone</th></tr>${rows}</table>
<script>function seek(t){var a=document.getElementById('mix');a.currentTime=Math.max(0,t-0.3);a.play()}</script>`
}
