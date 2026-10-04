"""Beat grid: a port of packages/core/src/beats.ts.

Films write their timeline in beats; picture and sound read the same grid.
Rounding follows JavaScript's Math.round (halves go up, also below zero),
not Python's round() (halves go to even): beat(3.5) at 15 frames a beat is
frame 53 in both engines.
"""

from __future__ import annotations

import math


def js_round(x: float) -> int:
    """Math.round: the nearest integer, halves toward +infinity."""
    down = math.floor(x)
    return down + 1 if x - down >= 0.5 else down


class Grid:
    def __init__(self, bpm: float, fps: float, offset: float = 0, beats_per_bar: int = 4):
        self.bpm = bpm
        self.fps = fps
        self.offset = offset
        self.beats_per_bar = beats_per_bar
        self.per_beat = (60 / bpm) * fps

    def beat(self, n: float) -> int:
        """Frame of beat `n` (0-based)."""
        return js_round(self.offset + n * self.per_beat)

    def bar(self, n: float) -> int:
        """Frame of the downbeat of bar `n` (0-based)."""
        return self.beat(n * self.beats_per_bar)

    def hit(self, n: float, lead: int = 2) -> int:
        """Release frame for a visual hit on beat `n`, led in so it lands on the beat."""
        return self.beat(n) - lead

    def seconds(self, n: float) -> float:
        """Seconds at beat `n`."""
        return (self.offset + n * self.per_beat) / self.fps

    def at(self, frame: float) -> float:
        """Beats elapsed at `frame`."""
        return (frame - self.offset) / self.per_beat

    def pulse(self, frame: float, every: float = 1, decay: float = 6) -> float:
        """1 on every `every`-th beat, decaying over `decay` frames."""
        b = (frame - self.offset) / self.per_beat
        if b < 0:
            return 0.0
        return math.exp(-(math.fmod(b, every) * self.per_beat) / decay)


def grid(bpm: float, fps: float, offset: float = 0, beats_per_bar: int = 4) -> Grid:
    return Grid(bpm, fps, offset, beats_per_bar)
