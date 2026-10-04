---
name: reel
description: Make a motion-graphics film (launch reel, feature teaser, social ad, product promo) in this studio repo with Remotion, springs, a beat grid, synthesized sound and a scored critique loop. Use when the user asks for a video, reel, motion piece, teaser or promo, or says "/reel".
---

# /reel

Turn a request into a finished film in `films/<slug>` (or `studio/films/<slug>`
when the brand lives in `studio/`), following CLAUDE.md.
The prompt is the small part; the gates below are what make the film good.

## 1. Intake (one round)

Start from the brand's `brand.json` (in `brands/` or `studio/brands/`): voice,
proof and CTA are already there. Collect the gaps with one AskUserQuestion
call, so the person answers once:

- brand, and the one-line point of the film
- audience + channel (muted feed? sound on?) and formats (1:1, 9:16, 16:9)
- length (default 15–20 s)
- reference film or frame to learn from (optional, strongly encouraged)
- music: synthesized (default) or a supplied licensed track

## 2. Scaffold

```bash
npm run new -- <slug> --brand <brand>
```

Fill the new film's `brief.md` from the intake.

## 3. Reference (if given)

Before designing, work out how the reference moves: shot length against the
beat, how shots hand over, how far the type scale swings. Record it in a style
guide (`templates/style_guide.md`) translated into the brand's tokens. Its
structure is fair game; its words, colours and faces are not.

## 4. Real assets

Use the product's real UI. Capture screens from the running app or the
marketing site (built-in browser screenshot, or Playwright). If a UI must be
recreated in code (e.g. text too small to read at 360 px), say so in the brief
and keep it faithful to the real component.

## 5. Shotlist → STOP

Pick the archetype (an arc of shots, or a one-shape UI tour) and write
`shotlist.md` in beats (120 BPM = 15 frames/beat at 30 fps), with motion
preset and sound cue per shot and one key still per shot, and run its
checklist. **Show it to the user and wait for approval.** No building before a
yes.

## 6. Key stills → STOP

Write `src/timeline.ts` far enough to place the shots, list the key stills in
its `STILLS`, and build only those frames in `src/Film.tsx`: layout, type,
colour, the real product. Motion can stay rough. Then:

```bash
npm run stills
```

Look at `stills.png` and `phone.png` yourself first (every word read at
360 px? in 9:16, everything inside the outline?), then **show them to the user
and wait for approval of the look.** No animating the rest before a yes.

## 7. Build

- `src/timeline.ts`: every beat the shotlist names.
- `src/Film.tsx`: springs from `motion(FPS)`, `enter`/`exit`, `track()` for
  morphing containers, `swapAlpha()` for text inside them, `g.hit(n)` for hits,
  `g.pulse()` for kick-synced breathing, `zoom()` for the camera (a punch-in on
  impacts), `trackVelocity()` then `release()` where motion crosses a cut or a
  drag lets go, `Flood` to change shots without a dissolve. Layout from
  `useVideoConfig()` so every format reframes instead of cropping.
- `scripts/build-audio.mjs`: bed on the same grid, one cue per visual hit,
  `mixdown()` to −14 LUFS.

## 8. Review loop (minimum 2 rounds)

Snapshot the film first (a commit in its repo, or a copy of `src/`), so a round
that makes things worse can be rolled back.

```bash
npm run render && npm run review
```

Open `out/review/<stamp>-<comp>/contact.png`, `phone.png`, `report.md` and,
when there is one, `flags.png`. The report opens with motion checks on every
frame: freezes, stretches with no new picture, glitches, snaps, cuts off the
beat and flashes are counted for you; a flash ✗ has to be fixed before
anything else. Then spawn **two fresh critic subagents** in parallel
(read-only, never saw the build, never saw each other or earlier rounds) with
those paths, the brief's one-liner and CLAUDE.md, and have each score the seven
criteria with frame-number evidence and mark each issue P0 (breaks a house
rule, or can't be read), P1 or P2. A round's score per criterion is the
**lower** of the two; fix P0s first, then the issues both raise. One critic's
7-or-8 swings with who is judging (the demo film saw Stop go 8, 7, 8, 7 on an
unchanged opening); two steady it. Don't self-score: it ran ~2 points high. Log
both sets and the round's score in `review_log.md`.
The checks can't judge taste, so also hunt for: text too small at 360 px,
crossfades or pure fades, overlapping text during swaps, a cue whose lift is
under ~4 dB, and whether each ⚠ in the motion checks is a real flaw.
Fix the three worst, re-render, repeat until every score is 8+. If scores
plateau for 3+ rounds or critics start contradicting each other, stop and
hand the user the film, the score history and the open issues to decide.

## 9. Finals

`npm run render:all` for the requested formats, review each format once with
`--strict` (`motion-review --comp Vertical --video out/vertical.mp4 --strict`),
then hand the user the files plus the last review's scores. Don't commit
renders.
