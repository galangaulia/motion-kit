"""Springs, solved in closed form: a port of packages/core/src/springs.ts.

Every value is the position of a damped harmonic oscillator at rest on 0 and
released toward 1, written as an exact function of elapsed time, so any frame
can be computed on its own. Presets use the designer-facing pair
(duration: seconds per cycle of the undamped spring; bounce: 1 - damping ratio).

The numbers match the TypeScript to within float noise; tests/test_parity.py
checks them against a fixture written from the TypeScript.
"""

from __future__ import annotations

import math
from typing import Mapping, Sequence, Union

PRESETS: dict[str, dict[str, float]] = {
    "snappy": {"duration": 0.22, "bounce": 0.2},
    "default": {"duration": 0.4, "bounce": 0.14},
    "heavy": {"duration": 0.5, "bounce": 0.0},
    "playful": {"duration": 0.5, "bounce": 0.55},
}

Preset = Union[str, Mapping[str, float], None]


def _shape(preset: Preset) -> Mapping[str, float]:
    if preset is None:
        return PRESETS["default"]
    return PRESETS[preset] if isinstance(preset, str) else preset


def spring_at(seconds: float, preset: Preset = None) -> float:
    """Position (0 -> 1, may pass 1 briefly) `seconds` after release; 0 before."""
    if not seconds > 0:
        return 0.0
    shape = _shape(preset)
    w0 = 2 * math.pi / shape["duration"]
    zeta = 1 - shape["bounce"]
    t = seconds
    if zeta < 1:
        decay = zeta * w0
        wd = w0 * math.sqrt(1 - zeta * zeta)
        envelope = math.exp(-decay * t)
        return 1 - envelope * (math.cos(wd * t) + (decay / wd) * math.sin(wd * t))
    if zeta == 1:
        return 1 - math.exp(-w0 * t) * (1 + w0 * t)
    spread = w0 * math.sqrt(zeta * zeta - 1)
    fast = -zeta * w0 - spread
    slow = -zeta * w0 + spread
    return 1 + (slow * math.exp(fast * t) - fast * math.exp(slow * t)) / (fast - slow)


def spring_velocity(seconds: float, preset: Preset = None) -> float:
    """Speed of spring_at (travel per second) `seconds` after release."""
    if not seconds > 0:
        return 0.0
    shape = _shape(preset)
    w0 = 2 * math.pi / shape["duration"]
    zeta = 1 - shape["bounce"]
    t = seconds
    if zeta < 1:
        decay = zeta * w0
        wd = w0 * math.sqrt(1 - zeta * zeta)
        return (w0 * w0 / wd) * math.exp(-decay * t) * math.sin(wd * t)
    if zeta == 1:
        return w0 * w0 * t * math.exp(-w0 * t)
    spread = w0 * math.sqrt(zeta * zeta - 1)
    fast = -zeta * w0 - spread
    slow = -zeta * w0 + spread
    return slow * fast * (math.exp(fast * t) - math.exp(slow * t)) / (fast - slow)


def peak_overshoot(preset: Preset = None) -> float:
    """How far past the target a preset swings at its first peak (0.05 = 5 %)."""
    zeta = 1 - _shape(preset)["bounce"]
    if zeta >= 1:
        return 0.0
    return math.exp(-math.pi * zeta / math.sqrt(1 - zeta * zeta))


def _clamp01(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x


TrackKey = Sequence  # (frame, value) or (frame, value, preset)


class Motion:
    """Frame-based helpers bound to a frame rate, as motion(fps) in TypeScript."""

    def __init__(self, fps: float):
        self.fps = fps

    def progress(self, frame: float, at: float, preset: Preset = None) -> float:
        """0 -> 1 for a spring released on frame `at`."""
        return spring_at((frame - at) / self.fps, preset)

    def spring(self, frame: float, at: float, start: float, end: float, preset: Preset = None) -> float:
        """Spring from `start` to `end`, released on frame `at`."""
        return start + (end - start) * self.progress(frame, at, preset)

    def track(self, frame: float, keys: Sequence[TrackKey], preset: Preset = None) -> float:
        """A value retargeted several times; each key's spring adds to the others."""
        if not keys:
            return 0.0
        value = keys[0][1]
        for i in range(1, len(keys)):
            at, target = keys[i][0], keys[i][1]
            own = keys[i][2] if len(keys[i]) > 2 else None
            if at >= frame:
                continue
            value += (target - keys[i - 1][1]) * self.progress(frame, at, own if own is not None else preset)
        return value

    def track_velocity(self, frame: float, keys: Sequence[TrackKey], preset: Preset = None) -> float:
        """Speed of a track() at `frame`, in units per second."""
        speed = 0.0
        for i in range(1, len(keys)):
            at, target = keys[i][0], keys[i][1]
            own = keys[i][2] if len(keys[i]) > 2 else None
            if at >= frame:
                continue
            speed += (target - keys[i - 1][1]) * spring_velocity((frame - at) / self.fps, own if own is not None else preset)
        return speed

    def release(self, frame: float, at: float, start: float, velocity: float, end: float, preset: Preset = None) -> float:
        """A spring let go on frame `at` at `start`, already moving at `velocity`, heading for `end`."""
        t = (frame - at) / self.fps
        if not t > 0:
            return start
        w0 = 2 * math.pi / _shape(preset)["duration"]
        return end + (start - end) * (1 - spring_at(t, preset)) + velocity * spring_velocity(t, preset) / (w0 * w0)

    def zoom(self, frame: float, keys: Sequence[TrackKey], preset: Preset = None) -> float:
        """A scale moved in log space: each doubling takes the same time."""
        logged = [(k[0], math.log(k[1]), *k[2:]) for k in keys]
        return math.exp(self.track(frame, logged, preset))

    def swap_alpha(self, frame: float, in_at: float, out_at: float = math.inf) -> float:
        """Opacity for copy inside a morphing shape: in just after `in_at`, out just before `out_at`."""
        t = frame / self.fps
        show_from = in_at / self.fps + 0.08
        hide_by = out_at / self.fps - 0.1
        return min(_clamp01((t - show_from) / 0.12), _clamp01((hide_by - t) / 0.1))


def motion(fps: float) -> Motion:
    return Motion(fps)
