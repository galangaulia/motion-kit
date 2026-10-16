// Sound that came from outside the kit (a bought or licensed track, a recorded
// sample) and the licence it came under. A film lists it in
// scripts/build-audio.mjs, which writes public/audio/sources.json; motion-review
// checks the list and writes CREDITS.txt, and `npm run deliver` refuses to ship
// while anything on it is unresolved.
//
// One entry: { file, kind, title, author, url, licence, checked }
//   file      the file in the film's sound/ folder
//   kind      music | sfx | voice (anything else reads as "sound")
//   url       the page the file came from, where its licence is shown
//   licence   as that page names it: "CC0 1.0", "Mixkit Stock Music Free License"…
//   checked   YYYY-MM-DD: the day someone last opened `url`, read the licence
//             and confirmed it still allows this film's use (brief → channel)
//
// Sources change their terms, so `checked` goes stale: re-open each page before
// the finals and update the date.

const REQUIRED = ['file', 'title', 'author', 'url', 'licence', 'checked']
const DAY = 86_400_000

/** Licence names that forbid what a brand film does with sound. */
const BLOCKED = [
  [/\bNC\b|non-?commercial/i, 'non-commercial licence: not for a brand film'],
  [/\bND\b|no-?deriv/i, 'no-derivatives licence: cutting it to picture is a derivative'],
]

/** Credit the post's description must carry, or null when none is required. */
const creditNeeded = (licence) => (/\bBY\b|attribution/i.test(licence) ? 'credit required in the post' : null)

/**
 * Check every source. `today` is a YYYY-MM-DD date; `maxAgeDays` is how old a
 * licence check may be before it must be done again.
 * Returns [{ source, problems: [string], note: string | null }].
 */
export function checkSources(sources, { today, maxAgeDays = 30 } = {}) {
  const now = Date.parse(`${today}T00:00:00Z`)
  return sources.map((source) => {
    const problems = REQUIRED.filter((k) => !String(source[k] ?? '').trim()).map((k) => `no ${k}`)
    for (const [pattern, why] of BLOCKED) if (pattern.test(source.licence ?? '')) problems.push(why)
    if (source.checked) {
      const at = /^\d{4}-\d{2}-\d{2}$/.test(source.checked) ? Date.parse(`${source.checked}T00:00:00Z`) : NaN
      if (Number.isNaN(at)) problems.push(`checked "${source.checked}" isn't a YYYY-MM-DD date`)
      else if (at > now) problems.push(`checked ${source.checked} is in the future`)
      else if ((now - at) / DAY > maxAgeDays) {
        problems.push(`licence last checked ${Math.round((now - at) / DAY)} days ago: re-open its page`)
      }
    }
    return { source, problems, note: creditNeeded(source.licence ?? '') }
  })
}

/** CREDITS.txt: the sound actually used, ready to paste into a post's description. */
export function creditsText(sources, title) {
  const kind = (k) => (['music', 'sfx', 'voice'].includes(k) ? k : 'sound')
  const lines = sources.map((s) => `- ${kind(s.kind)}: "${s.title}" by ${s.author}, ${s.licence}. ${s.url}`)
  return [
    `Sound in ${title}`,
    '',
    ...lines,
    '',
    'Everything else in the soundtrack was synthesized for this film.',
    '',
  ].join('\n')
}
