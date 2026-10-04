"""Text and number effects: a port of packages/core/src/text.ts.

hash() reproduces the TypeScript bit for bit (32-bit integer maths emulated),
so a "random" layout seeded the same way is the same in every engine.
"""

from __future__ import annotations

import math
import re

from .beats import js_round


def _i32(x: int) -> int:
    x &= 0xFFFFFFFF
    return x - 0x100000000 if x & 0x80000000 else x


def _u32(x: int) -> int:
    return x & 0xFFFFFFFF


def _imul(a: int, b: int) -> int:
    return _i32(_u32(a) * _u32(b))


def hash(*n: float) -> float:  # noqa: A001 - same name as the TypeScript
    """Integer hash -> [0, 1). Same inputs, same output, every render."""
    h = 2166136261
    for v in n:
        h = _i32(_i32(h) ^ _i32(math.floor(v) + 0x9E3779B9))
        h = _imul(h ^ (_u32(h) >> 15), 2246822507)
        h = _imul(h ^ (_u32(h) >> 13), 3266489909)
        h = _i32(h ^ (_u32(h) >> 16))
    return _u32(h) / 4294967296


GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+/<>=?"
_WORD = re.compile(r"[A-Za-z0-9]")


def scramble(text: str, frame: float, progress: float, seed: int = 1, rate: int = 2) -> str:
    """Characters scramble, then lock left to right as `progress` goes 0 -> 1."""
    locked = math.floor(max(0.0, min(1.0, progress)) * len(text))
    out = []
    for i, ch in enumerate(text):
        if i < locked or not _WORD.match(ch):
            out.append(ch)
        else:
            out.append(GLYPHS[math.floor(hash(seed, i, math.floor(frame / rate)) * len(GLYPHS))])
    return "".join(out)


def count_up(progress: float, to: float, start: float = 0) -> int:
    """Integer count-up for a 0 -> 1 progress."""
    return js_round(start + (to - start) * max(0.0, min(1.0, progress)))
