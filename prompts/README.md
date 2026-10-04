# Prompts that worked

Short, reusable asks for Claude Code in this repo. Add one when a prompt
saves real back-and-forth; note which film it came from.

## New film
```text
/reel <length> <format(s)> for <brand>: <one-line point>. Reference: <link or path>. Music: synthesized.
```

## Learn from a reference
```text
Open <reference> and fill templates/style_guide.md from it: how long shots last against the beat,
how one shot hands over to the next, how big the type gets. Map each finding to brands/<brand>
tokens. Nothing from the reference's copy, colours or faces carries over. No code in this step.
```

## Critique round
```text
Render and review, then hand contact.png, phone.png, report.md and flags.png to two fresh
critic subagents. Log both sets of scores in review_log.md, citing frames; the lower one counts.
Fix the P0s and what cost the most points (three things at most), and go round again until
nothing scores under 8.
```

## Retime to the beat
```text
Move every visual hit in timeline.ts onto the beat grid (g.hit) and make sure nothing on
screen stays unchanged for more than 8 beats. Re-run audio so the cues follow.
```

## Add a format
```text
Add the Vertical (9:16) format: reframe type and UI for it from useVideoConfig(), don't crop.
Review its phone sheet.
```
