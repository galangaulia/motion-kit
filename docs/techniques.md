# Techniques

Recipes for the moves the archetypes in `templates/shotlist.md` ask for, built
on `@motion-kit/core` so they work the same in Remotion and HyperFrames. Every
one is a function of the frame number (CLAUDE.md, Determinism).

Several come from Barty-Bart/motion-graphics (MIT), whose explainer skills
render their own HTML pages. They're rewritten here for the kit's springs, beat
grid and rules; what was left out, and why, is at the end.

The snippets assume:

```ts
import { countUp, motion } from '@motion-kit/core'
import { FPS, g } from './timeline'
const m = motion(FPS)
```

## The camera

The camera is one wrapper around the world, with one transform. To put world
point `(x, y)` in the middle of the frame at scale `s` (with
`transform-origin: 0 0`):

```ts
transform: `translate(${W / 2}px, ${H / 2}px) scale(${s}) translate(${-x}px, ${-y}px)`
```

- **Scale** comes from `m.zoom()` and **position** from `m.track()`, both on
  `default`, one key per thing the camera frames. Release each key a few frames
  before the action lands there (`g.hit(n) - 6`), so it is framed when it
  arrives.
- **Push into a line of text** until it spans about 75 % of the frame, on
  `heavy`, so the type doesn't overshoot. The text stays small in the layout;
  the camera makes it big.
- **Ride along with typing.** Put the caret at the centre: measure the typed
  string's width with the brand face once fonts are loaded (a canvas
  `measureText`), and set the camera's x to the caret's x while typing. Steady
  typing is already smooth; `track()` only eases the camera onto the caret and
  off it.
- **Pull back** to the whole screen for a beat after each result, so the viewer
  knows where they are, then glide on.
- **Follow a moving hero** by keying the camera to each station it reaches.
  The springs lag behind on their own; nothing needs to remember earlier
  frames. Keep the hero in the middle half of the frame.
- **Reveal and dive.** A pull-out to the whole course is one `zoom()` key
  (2.2 → 0.3 keeps one apparent speed, because it runs in log scale); the dive
  back is another. A slight tilt (`perspective` plus `rotateX` of 15–25°)
  gives the reveal depth; fade a wrapper, never the `preserve-3d` element.
- **A grid that moves with the world** (`GridField` with the camera's `x`, `y`
  and `zoom`) makes every camera move readable on a flat background.

## Type

- **Typing**: show `full.slice(0, n)`, with
  `n = Math.max(0, Math.floor(((frame - at) / FPS) * 25))` (about 25 characters
  a second, the speed real UI typing reads at). The caret blinks from the frame
  number, once a second: `Math.floor(frame / (FPS / 2)) % 2 === 0`.
- **Count-ups**: `countUp(m.progress(frame, at, 'heavy'), 312)`. Only for
  numbers the brand's proof rules allow.
- **Kinetic triplet**: three words, two beats each, swapped hard on the beat.
  Each word is revealed by a mask (`clip-path: inset()`) while it rises on
  `heavy`; the old word leaves by the same mask on the same frame. Alternate the
  background between the brand's roles.
- **Weight morph** (thin → black) needs the brand's display face as a variable
  font: set `font-variation-settings` to `'wght' N`, with
  `N = m.spring(frame, at, 100, 900, 'heavy')`.
- **Highlight sweep** behind a key word: a box in the accent at 15–20 %
  opacity whose width springs from 0 on `snappy`. It's the front edge of
  something that stretches, so it leads.

## Shapes that carry a cut

- **Flood from a point that matters** (Remotion: `<Flood cx cy at …>`). In
  HyperFrames it's the same thing by hand: a circle `clip-path` whose radius is
  a `track()` from 0 to past the farthest corner.
- **A dot that becomes the next scene**: wrap the full stop, or the dot on an
  i, in a span, measure where it sits, and flood from there in the accent. The
  viewer's eye is already on it.
- **A line that floods**: a thin bar whose leading edge springs across the
  frame on `snappy` and whose trailing edge follows on `default`, so it
  stretches; then its height springs to the full frame and becomes the next
  background.

## A hero with weight

For the one-take journey: one object that moves through the product's stations.

- **Hops and falls land on the beat.** Between two contacts, x moves in a
  straight line and y under one gravity for the whole film, with the starting
  speed solved so the landing is exact:

  ```ts
  /** Position between contacts on frames a → b, gravity in px/s² (down is positive). */
  function hop(frame: number, a: number, b: number, from: Pt, to: Pt, gravity: number): Pt {
    const T = (b - a) / FPS
    const t = Math.min(Math.max((frame - a) / FPS, 0), T)
    const vy = (to.y - from.y - 0.5 * gravity * T * T) / T
    return { x: from.x + ((to.x - from.x) * t) / T, y: from.y + vy * t + 0.5 * gravity * t * t }
  }
  ```

  Put each contact on `g.hit(n)`.
- **Squash on contact, stretch in flight.** Squash is a short track,
  `s = m.track(frame, [[0, 0], [contact, 1, 'snappy'], [contact + 2, 0, 'snappy']])`,
  drawn as `scale(${1 + 0.25 * s}, ${1 - 0.2 * s})`. Stretch follows the speed
  (`vy + gravity * t`), up to 1.15 × 0.9 along the direction of travel. Use
  `playful` only when the hero is a character, never on interface.
- **The station follows the hero.** A slider's value, a progress bar's fill and
  a tooltip's number all come from the hero's position, so they can't drift
  apart.
- **The empty slot.** When the hero was part of a station (a knob, a thumb) and
  leaves, a dim outline stays where it was and fills again when it returns.
- **A slow-motion launch.** Choose the apex first: with the film's gravity it
  fixes the real flight time. Then stretch that flight over the reveal, slowest
  at the top. Build the time warp once, as a table from constants, which keeps
  it a function of the frame number:

  ```ts
  // Screen-time fraction at each of N steps of the flight; speed 1 − 0.9·sin(πu)^0.6.
  const N = 240
  const WARP = [0]
  for (let i = 1; i <= N; i++) WARP.push(WARP[i - 1] + 1 / (1 - 0.9 * Math.sin((Math.PI * (i - 0.5)) / N) ** 0.6))
  for (let i = 0; i <= N; i++) WARP[i] /= WARP[N]
  /** Flight fraction (0–1) for a screen-time fraction (0–1). */
  const flightAt = (s: number) => {
    s = Math.min(1, Math.max(0, s))
    const i = Math.max(1, WARP.findIndex((v) => v >= s))
    return (i - 1 + (s - WARP[i - 1]) / (WARP[i] - WARP[i - 1] || 1)) / N
  }
  ```

  Reset the stations during the reveal's hold, after the viewer has seen the
  whole course, not at the launch.

## The pointer

- It moves on `snappy`. Key y a couple of frames after x, so it travels on a
  gentle curve instead of a ruler line.
- It arrives a beat before it clicks: the viewer sees where it is going.
- **Press**: `p = m.track(frame, [[0, 0], [click, 1, 'snappy'], [click + 3, 0, 'snappy']])`,
  drawn as `scale(${1 - 0.08 * p})` on the pointer and on the control it presses.
- **Ripple**: one ring on the clicked control, radius springing from 0 on
  `default`, its opacity riding along as it grows. Hover states change too.

## Depth

- **Stacked results**: each card behind is a little smaller, a little higher
  and a little blurred (static `filter: blur()`, more for each step back).
  Never put the filter on a `preserve-3d` element.
- **Parallax**: things near the camera move further and are larger; things far
  away move less and stay sharp.
- **Speed (HyperFrames)**: large `filter: blur()` and big blurred gradients are
  slow to capture. Draw them once as an image (a PNG in `public/`) and move the
  image.

## Loops

- **The last frame matches the first.** In a journey, the loop point is the
  hero landing on the first station: the dive ends on frame `TOTAL_FRAMES` in
  the same pose as frame 0.
- **Anything that straddles the seam** (a landing squash, a key press) is drawn
  at both ends: read the frame as `frame - TOTAL_FRAMES` near the end.
- **Sound tails**: add a late cue a second time at `frame - TOTAL_FRAMES` in
  `build-audio.mjs`. `place()` starts it partway through, so its tail plays at
  the start of the loop.

## Left out, and why

- **Dissolves and blur-dissolves between scenes**: shots never dissolve here
  (CLAUDE.md, Movement). The camera, a morph, a hard cut on the beat or a
  `Flood` does that job.
- **A HUD** (corner brackets, scene counter, timecode): a border around the
  frame and corner captions read as a template (CLAUDE.md, Picture).
- **Eased keyframes for the camera**: everything that moves is on a spring from
  `motion(FPS)`; `zoom()` already keeps a deep push at one speed.
- **Overshooting type**: type never overshoots, so it's always `heavy`.
- **Rebuilt UI by default**: the product is captured; a rebuild is the
  exception, and the brief names it.
- **The source's palette and its display/serif/mono trio**: colour and type
  come from the brand alone.
- **Particle bursts and glows**: on CLAUDE.md's stock-template list.
- **WebAudio synthesis in the page and its own Playwright renderer**: the kit's
  soundtrack is `@motion-kit/audio` on the same beat grid, mixed to −14 LUFS,
  and Remotion and HyperFrames already render in parallel with motion blur.
