"""Starter film: the house grammar in 16 beats, the same film as the Remotion and
HyperFrames starters, drawn by Manim. Replace the content, keep the grammar:
springs, hits on the beat, one shape that morphs from shot to shot.

  bar 0    hook words land one per beat (heavy), leave on the bar line
  bar 1-2  the container springs in as a card; rows land on beats; the card
           breathes with the kick
  bar 3    the same container morphs (size and colour together) into the CTA
           pill; the logo lands; the pill takes one press so the end card never
           waits for the clock

build() makes every mobject once; frame(f) moves them for film frame f, starting
each time from what build() left (engines/manim/BUILD.md). Positions and sizes
are half-size px, as in the other engines' starters.
"""

from manim import RIGHT, Circle, RoundedRectangle, SVGMobject, VGroup

from motionkit import FrameScene, enter, exit


class FilmScene(FrameScene):
    def build(self):
        tl = self.tl
        self.W, self.H = self.film.width, self.film.height
        k = self.k = min(self.W, self.H) / 540  # 1 at the 540 square

        # Hook words, wrapped the way the CSS starter wraps them.
        self.words = [self.text(w, 56 * k, 800, role="display") for w in tl.HOOK_WORDS]
        self.word_at = self.wrap(self.words, width=0.9 * self.W, gap=14 * k, line=56 * 1.05 * k)

        # The one container, rebuilt every frame at its tracked size; rows and CTA ride on it.
        self.box = RoundedRectangle(width=1, height=1, corner_radius=0.1)
        self.rows = []
        for i, beat in enumerate(tl.ROWS_AT):
            dot = Circle(radius=self.px(8 * k), fill_opacity=1, stroke_width=0, color=self.color("accent"))
            label = self.text(f"Row {i + 1} lands on beat {beat}", 26 * k, 600)
            self.rows.append(VGroup(dot, label.next_to(dot, RIGHT, buff=self.px(14 * k))))
        self.cta = self.text("Call to action", 28 * k, 700, color="onAccent")

        # The brand's logo SVG when brand.json names one, else its name as a wordmark.
        if self.film.logo:
            self.logo = SVGMobject(self.film.logo).scale_to_fit_height(self.px(22 * k))
        else:
            self.logo = self.text(self.film.name, 26 * k, 800, role="display")

        self.add(*self.words, self.box, *self.rows, self.cta, self.logo)

    def wrap(self, words, width, gap, line):
        """Centre lines of words in the frame, breaking before a word that won't fit."""
        lines, current = [], []
        for w in words:
            if current and sum(x.width for x in current) / self.u + gap * len(current) + w.width / self.u > width:
                lines.append(current)
                current = []
            current.append(w)
        lines.append(current)
        spots, top = [], self.H / 2 - line * len(lines) / 2
        for row, ws in enumerate(lines):
            total = sum(x.width for x in ws) / self.u + gap * (len(ws) - 1)
            x = self.W / 2 - total / 2
            for w in ws:
                spots.append((x + w.width / self.u / 2, top + line * (row + 0.5)))
                x += w.width / self.u + gap
        return spots

    def frame(self, f):
        m, g, tl, k = self.m, self.g, self.tl, self.k
        HOOK, PRODUCT, CTA = tl.HOOK, tl.PRODUCT, tl.CTA
        cx, cy = self.W / 2, self.H / 2

        # Hook: each word lands on its beat; the line leaves on the bar line.
        leave = exit(m, f, g.hit(HOOK["to"]), y=-40 * k, preset="heavy") if f >= g.hit(HOOK["to"]) else None
        for i, (word, (x, y)) in enumerate(zip(self.words, self.word_at)):
            move = enter(m, f, g.hit(HOOK["from"] + i), y=28 * k, preset="heavy")
            if leave:
                self.place(word, x, y + move.y + leave.y, opacity=move.opacity * leave.opacity)
            else:
                self.place(word, x, y, move)

        # The container: size, radius and colour track through each shot, never cut.
        card_w = min(self.W - 80 * k, 440 * k)
        w = m.track(f, [(0, 0), (g.hit(PRODUCT["from"]), card_w), (g.hit(CTA["from"]), 280 * k, "snappy")])
        h = m.track(f, [(0, 0), (g.hit(PRODUCT["from"]), 220 * k), (g.hit(CTA["from"]), 72 * k, "snappy")])
        r = m.track(f, [(0, 0), (g.hit(PRODUCT["from"]), 22 * k), (g.hit(CTA["from"]), 36 * k)])
        accent = max(0.0, min(1.0, m.progress(f, g.hit(CTA["from"]), "snappy")))
        breathe = 1 + 0.012 * g.pulse(f - g.beat(PRODUCT["from"])) * (1 if f < g.beat(CTA["from"]) else 0)
        press_at = g.hit(CTA["from"] + 3)
        press = m.track(f, [(0, 1), (press_at, 0.95, "snappy"), (press_at + 5, 1, "snappy")])
        s = breathe * press
        if f >= g.hit(PRODUCT["from"]) and w > 1 and h > 1:
            # Colour rides the same spring as the shape, so card -> pill is one morph.
            fill = self.color("card").interpolate(self.color("accent"), accent)
            edge = self.color("line").interpolate(self.color("accent"), accent)
            box = RoundedRectangle(width=self.px(w), height=self.px(h), corner_radius=self.px(min(r, w / 2, h / 2)),
                                   fill_color=fill, fill_opacity=1, stroke_color=edge, stroke_width=1.0)
            self.box.become(box.scale(s).move_to(self.at(cx, cy)))
        else:
            self.box.set_opacity(0)

        # Rows: a column centred in the card, 32 px in from its left edge.
        rows_alpha = m.swap_alpha(f, g.hit(PRODUCT["from"]), g.hit(CTA["from"]))
        pitch = 26 * 1.2 * k + 18 * k
        for i, (row, beat) in enumerate(zip(self.rows, tl.ROWS_AT)):
            move = enter(m, f, g.hit(beat), x=24 * k, preset="snappy")
            y = cy + (i - (len(self.rows) - 1) / 2) * pitch
            x = cx - w / 2 + 32 * k + row.width / self.u / 2
            self.place(row, cx + (x - cx) * s, cy + (y - cy) * s, move, scale=s, opacity=rows_alpha)
        self.place(self.cta, cx, cy, scale=s, opacity=m.swap_alpha(f, g.hit(CTA["from"])))

        # Logo under the CTA.
        self.place(self.logo, cx, cy + 80 * k, enter(m, f, g.hit(CTA["from"] + 1), y=12 * k, preset="heavy"))
