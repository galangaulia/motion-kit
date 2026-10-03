# Review log — tally-demo

One entry per round: `npm run render && npm run review`, then a fresh critic
subagent scores the round from contact.png, phone.png and report.md. The film
ships when no row is under 8.

Rows: stop (point by 2 s) · read (360 px) · change (no idle stretch) ·
moves (beats, springs) · layout · brand · sound.

## Round 1 — 2026-10-03

Fresh critic subagent (never saw the source), sheets for 1:1 and 9:16. Verdict: do not ship.

| Format | Stop | Read | Change | Moves | Layout | Brand | Sound |
|---|---|---|---|---|---|---|---|
| 1:1 | 6 | 6 | 5 | 7 | 6 | 6 | 7 |
| 9:16 | 5 | 6 | 5 | 7 | 4 | 6 | 7 |

Costliest issues:
1. Type too small at 360 px (rows ≈ 12 px, CTA ≈ 11 px at 3.4:1); 9:16 is the square centred, every shot in a band ≤ 20 % of the height.
2. The product never does anything: rows arrive with filled dots, then f105–f171 only the 1 px breathe. "One tap" is never shown; the done signal is sound-only.
3. End card waits for the clock (f226 = f239) and has no destination ("· example.com" dropped).
Also: rows "Read 10 pages", "Lights out by 11" break the brief's "no numbers"; card turns green before it starts to shrink (f178).

Fixed (for round 2):
- Rows 30 px, CTA 30 px (36 px in 9:16), URL 24 px; brand green darkened to #178257 (4.8:1 with white). Hook stacked one word per line at 64–66 px; 9:16 gets a taller card, a bigger pill and a 1.35× end lockup.
- Rows land with empty rings on beats 5–7; each is tapped to a check on beats 8–10 (fill + drawn check, `snappy`, tick cue). Rows rewritten without numbers.
- End card: example.com lands on beat 14, the pill takes one press on beat 15 (cues on both). Card colour now rides the morph spring instead of switching at the hit. Zero-size container no longer leaves a dot in the hook.

## Round 2 — 2026-10-03

New critic subagent (never saw round 1 or the source); it also decoded every frame of both mp4s. Verdict: do not ship.

| Format | Stop | Read | Change | Moves | Layout | Brand | Sound |
|---|---|---|---|---|---|---|---|
| 1:1 | 6 | 8 | 8 | 5 | 7 | 8 | 7 |
| 9:16 | 5 | 8 | 7 | 5 | 5 | 8 | 7 |

Costliest issues:
1. Shot changes read as fades: the hook fades in place under the growing card (f59–62), rows leave by fading (f173–175), card → pill passes through a see-through mint in ~4 frames (f179–183); row, logo and URL entrances have little travel.
2. 9:16 under-scaled (content in the middle third, small end group); the card shows empty at f62–73 and f175–178.
3. Hook is plain black type (not huge, no accent); muted viewers never see a tap, the rings just fill.
Also: the habit card is a drawn mock and the brief didn't say so; URL cue only +5 dB over a loud bed.

Fixed (for round 3):
- The hook lifts off the top on `heavy`, fully opaque (no fade), starting a quarter beat before the card opens, so the two never dissolve.
- Rows land on the off-beats 4.5–6.5 (card never shown empty), enter with 56 px of travel, and lift out 3 frames before the morph.
- Card → pill: size on `default` (~12 frames); the green sweeps up through it as a solid clip, no blended mint; the label waits until the pill is nearly filled.
- 9:16 gets its own scale: card 490 × 400, rows 38 px, pill 420 × 100 with a 42 px label, end lockup 1.6×. 1:1 end lockup 1.25×.
- "Streaks," in the brand green; each row is pressed (0.95, `snappy`) as its ring fills, so the tap reads muted.
- Logo and URL rise 30 px; whooshes start 6 frames ahead instead of 9; URL cue louder; brief says the habit card is recreated UI.

## Round 3 — 2026-10-03

New critic subagent; frame strips decoded from both mp4s. Verdict: do not ship.

| Format | Stop | Read | Change | Moves | Layout | Brand | Sound |
|---|---|---|---|---|---|---|---|
| 1:1 | 6 | 8 | 8 | 6 | 7 | 9 | 8 |
| 9:16 | 5 | 8 | 8 | 6 | 6 | 9 | 8 |

Costliest issues:
1. Card → pill reads as a bottom-up wipe with a hard edge and a white cap (f179–f186), not one shape. (Round 2 had flagged the blended colour as a see-through mint, but on a ~4-frame morph; the morph is now ~12 frames, so the colour goes back to riding the shape's spring.)
2. Hook isn't thumb-stopping: ≈ 30 px at phone width, words arrive mostly by fading.
3. 9:16 still reads as the square centred: lots of empty paper around the card and the end group.
Also: the tap is still not visible enough; the rings just fill.

Fixed (for round 4):
- Card → pill is one shape again: its colour blends (in OKLCH, so the midpoint stays saturated) on the same `default` spring as its size, over ~12 frames. The wipe layer is gone.
- Hook: "Streaks," and "not" at 88 px (100 in 9:16), "spreadsheets." sized to the frame width; each word rises out of its own line mask on `heavy`, no fade anywhere in the hook.
- Each tap now shows: a ring spreads from the check as it fills, on top of the row press.
- 9:16: card 490 × 460 with 42 px rows and 64 px spacing, pill 460 × 112 with a 46 px label, end lockup 2×.

## Round 4 — 2026-10-03

New critic subagent; every frame of both mp4s decoded and measured. Verdict: do not ship.

| Format | Stop | Read | Change | Moves | Layout | Brand | Sound |
|---|---|---|---|---|---|---|---|
| 1:1 | 7 | 8 | 8 | 6 | 8 | 9 | 8 |
| 9:16 | 7 | 9 | 8 | 6 | 7 | 9 | 8 |

Costliest issues:
1. Rows leave by fading in ~2 frames with ~2 px of lift (f175–177). (It also asked for a green sweep instead of the tint; round 3 called the sweep a glitch. Kept the tint: it is the morph itself, size and colour on one spring.)
2. Hook words first show a frame after their notes (f16, f31) because the line mask hides the start of the rise; frame 0 is blank.
3. 9:16: hook and card run to ~5 % side margins (under feed icons) while top and bottom stay empty; the card is two-thirds empty while only one row is in (f68–82).

Fixed (for round 5):
- Rows leave one by one, two frames apart, each lifting 48 px on `snappy` with the fade riding along; the last is gone a frame before the morph.
- Hook words release 6 frames ahead of their beat, so they show on the note and frame 0 already shows "Streaks," rising.
- The card's height follows its rows (one, two, three), so it never sits mostly empty.
- 9:16: card 84 % of the width (≈8 % margins, clear of feed icons), rows 38 px with 60 px spacing; hook 96/64 px.

## Round 5 — 2026-10-03

New critic subagent. Verdict: do not ship.

| Format | Stop | Read | Change | Moves | Layout | Brand | Sound |
|---|---|---|---|---|---|---|---|
| 1:1 | 8 | 8 | 8 | 7 | 7 | 9 | 9 |
| 9:16 | 7 | 8 | 8 | 7 | 6 | 9 | 9 |

Costliest issues:
1. 9:16 content sits in a middle band (hook ≈ 25 %, card ≈ 33 % of the height); both end cards are a small cluster, the logotype smaller than the pill label.
2. Logo (f194) and URL (f210) travel little while fading, so they read as fade-ins; rows' exit is mostly opacity; the press (≈ 2 % at 360 px) can't be seen.
3. A dead dip f176–184: empty white card, then a pale mint block, just before the payoff.
Also: 16:9 is a deliverable but wasn't reviewed.

Fixed (for round 6):
- End card is one composed group: the pill travels up into its slot as it morphs; logotype 2× (2.6× in 9:16), bigger than the label; URL under it. Logo and URL each rise out of a line mask on `heavy`, released 6 frames ahead.
- Press deepened to 0.92 with a 6-frame rebound. Colour change on `snappy`, so the shape is mostly green within a few frames; rows lift 80 px and only fade once well on their way.
- 9:16: hook 110/64 px, card 88 % wide, rows 42 px with 72 px spacing. 16:9 reviewed this round too.

## Round 6 — 2026-10-03

New critic subagent, all three formats. Verdict: do not ship.

| Format | Stop | Read | Change | Moves | Layout | Brand | Sound |
|---|---|---|---|---|---|---|---|
| 1:1 | 7 | 8 | 9 | 8 | 7 | 9 | 8 |
| 9:16 | 7 | 9 | 9 | 8 | 6 | 9 | 8 |
| 16:9 | 5 | 3 | 8 | 8 | 3 | 9 | 8 |

Costliest issues:
1. 16:9 is the 540 layout dropped into a wide frame: rows ≈ 6 px cap height at 360 px, ~65 % of the frame empty.
2. End card and hook leave 1:1 and 9:16 underfilled; the end group should be the clear focus.
3. The tap is a few pixels at 360 px; also a blank card for ~2 frames before the morph.

Fixed (for round 7):
- 16:9 zooms the compact layout 1.45× (it still fits the 540 height), so text and card scale with the wider frame.
- End group larger in both feed formats: pill 360 × 84 (470 × 124 in 9:16) with a 34 / 50 px label, logotype 2.4× / 3.2×, URL 1.4× / 1.9×.
- Tap: row presses to 0.93 and its label turns green while pushed in; the ring spreads ~2× wider and heavier. 9:16 row spacing tightened to 56 px.
- Morph starts a frame earlier (hit lead 3), so the card isn't left blank.

## Round 7 — 2026-10-03

New critic subagent, all three formats. Verdict: do not ship (16:9 only).

| Format | Stop | Read | Change | Moves | Layout | Brand | Sound |
|---|---|---|---|---|---|---|---|
| 1:1 | 8 | 9 | 9 | 8 | 8 | 9 | 8 |
| 9:16 | 8 | 9 | 9 | 8 | 8 | 9 | 8 |
| 16:9 | 8 | 7 | 9 | 8 | 7 | 9 | 8 |

Costliest issues:
1. 16:9 still under-scaled at 360 px: rows and URL ≈ 14–15 px, card ≈ 66 % of the width and 45 % of the height.
2. End card: "Try Tally" pill and "Tally" logotype compete as two focal points (called partly taste; not changed, since 1:1 and 9:16 pass).
3. Optional: the full hook holds ≈ 0.7 s.

Fixed (for round 8):
- 16:9 zoom 1.45 → 1.75 (the tallest groups, hook and end card, still fit the 540 height).

## Round 8 — 2026-10-03

New critic subagent, all three formats (every frame of square.mp4 checked). Verdict: **ship** — every score 8+.

| Format | Stop | Read | Change | Moves | Layout | Brand | Sound |
|---|---|---|---|---|---|---|---|
| 1:1 | 8 | 9 | 9 | 8 | 9 | 9 | 8 |
| 9:16 | 8 | 9 | 9 | 8 | 8 | 9 | 8 |
| 16:9 | 8 | 8 | 9 | 8 | 8 | 9 | 8 |

Left for a later pass (none blocks shipping, per the critic):
1. f176–178: one unchanged white card frame, then the colour moves ahead of the size; start the shrink a couple of frames earlier.
2. f188–191: the "Try Tally" label arrives after the pill has settled; bring it in while the pill is still moving.
3. f0 cuts "Streaks," at its mask; use a later poster frame where the platform allows.
