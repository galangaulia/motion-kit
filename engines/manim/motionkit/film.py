"""FrameScene: a Manim scene that draws every frame from its frame number.

motion-manim renders a scene with a job (in $MOTIONKIT_JOB): the size at half
scale, the frame rate, which film frames to draw, the film's timeline and brand.
A scene builds every mobject once in build() and moves them in frame(f), where
f is the film's own frame number, so beats from src/timeline.ts line up:

    class Clip(FrameScene):
        def build(self):
            self.dot = Circle(radius=self.px(40), fill_opacity=1, color=self.color("accent"))
            self.add(self.dot)

        def frame(self, f):
            self.place(self.dot, 270, 270, enter(self.m, f, self.g.hit(8), scale=0.6, preset="heavy"))

Before each frame every mobject is restored to what build() left, so frame()
always starts from the same state, whatever frame came before.
"""

from __future__ import annotations

import json
import os
from types import SimpleNamespace

import numpy as np
from manim import Group, ManimColor, Scene, Text, UpdateFromAlphaFunc, config, linear
from manimpango import register_font

from .beats import grid
from .enter import STILL, Move
from .springs import motion

# Manim font_size per (CSS px x scene units per half-size px): a word set at
# 26 px is as wide in Manim as in Chrome. Calibrated on Geist.
PX_TO_FONT_SIZE = 73.12

WEIGHTS = {100: "THIN", 200: "ULTRALIGHT", 300: "LIGHT", 400: "NORMAL", 500: "MEDIUM",
           600: "SEMIBOLD", 700: "BOLD", 800: "ULTRABOLD", 900: "HEAVY"}


def frame_at(time: float, fps: float) -> float:
    """time x fps, snapped to a whole frame when within float noise of one."""
    f = time * fps
    whole = round(f)
    return whole if abs(f - whole) < 1e-6 else f


def _namespace(exported: dict) -> SimpleNamespace:
    values = dict(exported.get("values", {}))
    for name, g in exported.get("grids", {}).items():
        values[name] = grid(g["bpm"], g["fps"], g.get("offset", 0), g.get("beatsPerBar", 4))
    return SimpleNamespace(**values)


class Film:
    """What a job tells a scene: format, frames, timeline, brand."""

    def __init__(self, job: dict):
        self.job = job
        self.width = job["width"]
        self.height = job["height"]
        self.fps = job["fps"]
        self.start = job.get("start", 0)
        self.frames = job.get("frames", 0)
        self.frame_list = job.get("frame_list")
        with open(job["timeline"]) as f:
            self.timeline = _namespace(json.load(f))
        with open(job["brand"]) as f:
            brand = json.load(f)
        self.name = brand.get("name") or ""
        self.colors = brand["colors"]
        self.fonts = brand["fonts"]
        self.logo = brand.get("logo")
        for path in job.get("font_files", []):
            register_font(path)

    @classmethod
    def from_env(cls) -> "Film":
        return cls(json.loads(os.environ["MOTIONKIT_JOB"]))


class FrameScene(Scene):
    """Subclass and write build() and frame(f). See the module docstring."""

    def build(self) -> None:
        raise NotImplementedError("FrameScene.build(): create and self.add() every mobject here")

    def frame(self, f: float) -> None:
        raise NotImplementedError("FrameScene.frame(f): move the mobjects for film frame f")

    def construct(self):
        film = self.film = Film.from_env()
        self.m = motion(film.fps)
        self.tl = film.timeline
        self.g = getattr(self.tl, "g", None)
        self.u = config.frame_height / film.height  # scene units per half-size px

        self.build()
        # Everything has to be part of the one animation: Manim freezes any
        # mobject outside it into a static background after its first frame.
        tops = list(self.mobjects)
        for mob in tops:
            mob.save_state()
        count = len(film.frame_list) if film.frame_list else film.frames
        # Frames are captured at t = i / fps; ending half a frame after the last
        # one keeps the count exact whatever the float error in the run time.
        run_time = (count - 0.5) / film.fps

        def update(_group, alpha):
            i = frame_at(alpha * run_time, film.fps)
            if i != int(i) or i >= count:
                return  # Manim's closing call at alpha = 1, after the last frame
            f = film.frame_list[int(i)] if film.frame_list else film.start + int(i)
            for mob in tops:
                mob.restore()
            self.frame(f)

        self.play(UpdateFromAlphaFunc(Group(*tops), update), run_time=run_time, rate_func=linear)

    # ── Layout in the half-size px every engine uses ─────────────────────

    def px(self, n: float) -> float:
        """Half-size px as scene units."""
        return n * self.u

    def at(self, x: float, y: float) -> np.ndarray:
        """A point from half-size px, origin top-left, y down (as in CSS)."""
        return np.array([-config.frame_width / 2 + x * self.u, config.frame_height / 2 - y * self.u, 0.0])

    def color(self, role: str) -> ManimColor:
        """A brand colour role: bg, card, ink, ink2, accent, onAccent, line."""
        return ManimColor(self.film.colors[role])

    def text(self, words: str, size: float, weight: int = 400, role: str = "ui", color: str = "ink", **kwargs) -> Text:
        """Words in a brand face (role display / ui / mono) at `size` CSS px."""
        family = self.film.fonts.get(role) or self.film.fonts["ui"]
        return Text(words, font=family, weight=WEIGHTS[weight], font_size=size * self.u * PX_TO_FONT_SIZE,
                    color=self.color(color), **kwargs)

    def place(self, mob, x: float, y: float, move: Move = STILL, scale: float = 1.0, opacity: float = 1.0):
        """Centre `mob` on (x, y) half-size px, moved, scaled and faded by `move`."""
        s = scale * move.scale
        if s != 1:
            mob.scale(s)
        mob.move_to(self.at(x + move.x, y + move.y))
        o = opacity * move.opacity
        if o < 1:
            mob.fade(1 - max(0.0, o))
        return mob
