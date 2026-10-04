# Bring your own brand

A film never hard-codes a colour or a font. It reads a small set of **roles**
(`--film-bg`, `--film-accent`, …) and two exports from a **brand module**. Swap
the brand and the same film renders in another design system. The kit ships two:

- `brands/example` — Tally, a fictional brand you can try things on.
- `brands/_blank` — the empty starting point for yours.

## What a brand is

```text
brands/<name>/
  brand.json    voice, proof rules, CTA, colour roles, CSS files and font files,
                optional sync + deliver
  brand.css     the --film-* roles, pointed at your tokens
  tokens.css    your design tokens (optional: synced from your product repo)
  fonts/        the faces you use, plus their licence
  index.tsx     what Remotion films import: `fonts`, `Logotype` (and optionally `LogoMark`)
```

### The roles every film reads

| Role | Used for |
|---|---|
| `--film-bg` | the stage behind everything |
| `--film-card` | cards, panels, the morphing container |
| `--film-ink` | main text |
| `--film-ink-2` | secondary text (URL, captions) |
| `--film-accent` | the one accent: CTA, checks, highlights |
| `--film-on-accent` | text on the accent |
| `--film-line` | hairlines and card borders |
| `--film-font-display` | the display face (hooks, headlines) |
| `--film-font-ui` | the UI face (rows, labels, buttons) |
| `--film-font-mono` | optional: code, numbers in tables |

Point each role at one of **your** tokens (`var(--brand-500)`), not at a hex
copied from a screenshot. The house rules allow one accent unless a brief asks
for more, and one display face plus one UI face.

### The module contract

`index.tsx` imports the brand's CSS (tokens first, then `brand.css`) and exports:

- `fonts: FontSource[]` — each face as an imported `.woff2` with its weight range.
  `loadFonts(fonts)` holds the render until they are ready, so no frame is
  captured in a fallback face.
- `Logotype` — a component for the end card. Draw it as SVG or styled text from
  your tokens; it takes an optional `style`.
- `LogoMark` (optional) — the mark on its own, for films that need it.

`brands/example/index.tsx` is a complete, small example.

### For HyperFrames and Manim films

Those engines don't import `index.tsx`; they read the same files through
`brand.json`:

```json
"css": ["tokens.css", "brand.css"],
"fontFiles": [
  { "family": "Acme Sans", "src": "fonts/AcmeSans-Variable.woff2", "weight": "100 900" }
]
```

- `css` — the brand's CSS files in the order a page loads them (an `@import`
  inside one is followed). Default: `["brand.css"]`.
- `fontFiles` — every face, with the family name the `--film-font-*` roles use.
  HyperFrames turns them into `@font-face` rules; Manim converts them to TTF.
- HyperFrames films get the logo by rendering your `Logotype` once to static
  HTML, so it stays the one you wrote in `index.tsx`.
- Manim can't read CSS, so the `--film-*` colour roles are resolved to hex
  from the top-level `:root` blocks (a dark-scheme `@media` block is skipped).
  Every role has to end in a hex or `rgb()` value; `logo` in `brand.json` may
  point at an SVG of the logotype (text converted to outlines).

## Make yours

1. **Copy the blank:** `cp -R brands/_blank brands/acme`.
2. **Fonts:** put the `.woff2` files and their licence in `fonts/`, import them in
   `index.tsx`, list them in `fonts` and in `brand.json` → `fontFiles`, and name
   them in the `--film-font-*` roles.
   Only ship faces whose licence allows embedding in video (OFL, or a licence you
   hold).
3. **Tokens**, either way:
   - paste them into `tokens.css`, import it at the top of `index.tsx` and list
     it first in `brand.json` → `css`, or
   - keep them in sync with your product: fill `sync` in `brand.json` (`root` is
     your product repo, `files` maps source → destination) and run
     `npm run brand:sync -- acme`. The copies are committed, so a design change in
     the product shows up as a `git diff` here before any film renders with it.
4. **Roles:** in `brand.css`, point every `--film-*` role at a token.
5. **Logo:** write `Logotype` (and `LogoMark`) in `index.tsx`.
6. **brand.json:** fill `voice`, `proof` (what may be claimed on screen, and what
   must never be invented), `cta`, and optionally `deliver.to` (where
   `npm run deliver` copies finished films).
7. **Try it:** `npm run new -- acme-test --brand acme`, then
   `cd films/acme-test && npm run studio`. The starter film reads only the roles,
   so it shows your brand straight away.

## Private brands

A client's or your company's brand usually shouldn't land in a public fork. Put
it in `studio/brands/<name>` instead (see the README's *Private work*). The
layout is identical, `npm run new` creates the film in `studio/films/`, and
imports work unchanged.

## Going further than the roles

The roles cover the starter film. A film can also use your tokens and
component classes directly (a product's own `global.css`, badge variants, real
spacing scale): import them in `index.tsx` and use them in that film's CSS. Keep
the house rules either way: colours and faces come only from the brand.
