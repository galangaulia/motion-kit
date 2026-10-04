"""python -m motionkit.fonts <brand.json> <out-dir>

Brand faces as TTF files Pango can register: WOFF2 decompressed, and a variable
face cut into static instances every 100 of weight (Pango picks weights from
static faces reliably; a variable font's axis is not always honoured). Prints
the paths written, one per line.
"""

from __future__ import annotations

import json
import os
import re
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer


def slug(family: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "-", family).strip("-")


def convert(src: str, family: str, out: str) -> list[str]:
    font = TTFont(src)
    font.flavor = None
    axes = {a.axisTag: a for a in font["fvar"].axes} if "fvar" in font else {}
    if "wght" not in axes:
        path = os.path.join(out, f"{slug(family)}-{font['OS/2'].usWeightClass}.ttf")
        font.save(path)
        return [path]
    paths = []
    low, high = axes["wght"].minValue, axes["wght"].maxValue
    for weight in range(100, 1000, 100):
        if not low <= weight <= high:
            continue
        pins = {tag: (weight if tag == "wght" else axis.defaultValue) for tag, axis in axes.items()}
        try:
            static = instancer.instantiateVariableFont(TTFont(src), pins, updateFontNames=True)
        except Exception:  # no STAT table to name the instance from: the weight class still says it
            static = instancer.instantiateVariableFont(TTFont(src), pins)
        static.flavor = None
        static["OS/2"].usWeightClass = weight
        path = os.path.join(out, f"{slug(family)}-{weight}.ttf")
        static.save(path)
        paths.append(path)
    return paths


def main() -> None:
    brand_path, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    with open(brand_path) as f:
        brand = json.load(f)
    for face in brand["fontFiles"]:
        for path in convert(face["src"], face["family"], out):
            print(path)


if __name__ == "__main__":
    main()
