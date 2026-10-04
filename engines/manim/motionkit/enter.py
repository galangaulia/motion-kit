"""enter / exit: a port of packages/core/src/enter.ts for Manim.

The TypeScript returns a CSS transform; here the same numbers come back as a
Move (offset in half-size px, y down like CSS, plus scale and opacity) for
FrameScene.place(). Opacity rides along; it is never the entrance by itself.
"""

from __future__ import annotations

from dataclasses import dataclass

from .springs import Motion, Preset


@dataclass(frozen=True)
class Move:
    x: float = 0.0
    y: float = 0.0
    scale: float = 1.0
    opacity: float = 1.0


STILL = Move()


def _offsets(x, y, scale, preset, default_y):
    # TypeScript's default is `{ y: ±16 }`, used only when nothing is given.
    if x is None and y is None and scale is None and preset is None:
        y = default_y
    return x or 0.0, y or 0.0, scale


def enter(m: Motion, frame: float, at: float, x: float | None = None, y: float | None = None,
          scale: float | None = None, preset: Preset = None) -> Move:
    """Spring into place from an offset and/or scale, released on frame `at`."""
    x, y, scale = _offsets(x, y, scale, preset, 16)
    p = m.progress(frame, at, preset)
    s = 1.0 if scale is None else scale + (1 - scale) * p
    return Move(x * (1 - p), y * (1 - p), s, min(1.0, max(0.0, p * 2.5)))


def exit(m: Motion, frame: float, at: float, x: float | None = None, y: float | None = None,  # noqa: A001
         scale: float | None = None, preset: Preset = None) -> Move:
    """The mirror of enter: spring away to an offset, opacity riding along."""
    x, y, scale = _offsets(x, y, scale, preset, -16)
    p = m.progress(frame, at, preset)
    s = 1.0 if scale is None else 1 + (scale - 1) * p
    return Move(x * p, y * p, s, min(1.0, max(0.0, 1 - p * 2.5)))
