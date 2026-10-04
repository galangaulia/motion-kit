"""python -m motionkit.render <scene.py> <SceneClass>

Renders the job in $MOTIONKIT_JOB (written by motion-manim) to a PNG sequence:
out/f00000.png … at 2x the half-size format, RGBA when transparent. Text
caches are cleared first: Manim keys them by family name, not by font file.
"""

from __future__ import annotations

import glob
import importlib.util
import json
import os
import shutil
import sys

from manim import tempconfig


def main() -> None:
    path, class_name = sys.argv[1], sys.argv[2]
    job = json.loads(os.environ["MOTIONKIT_JOB"])
    width, height, out = job["width"], job["height"], job["out"]
    scale = job.get("scale", 2)  # 2: finals size (1080 on the short side); 1: a quick preview
    os.makedirs(out, exist_ok=True)
    for old in glob.glob(os.path.join(out, "*.png")):
        os.remove(old)
    shutil.rmtree(os.path.join(job["media"], "texts"), ignore_errors=True)

    settings = {
        "pixel_width": width * scale,
        "pixel_height": height * scale,
        "frame_rate": job["fps"],
        # Set both: changing pixel size from Python leaves Manim's frame size alone.
        "frame_height": 8.0,
        "frame_width": 8.0 * width / height,
        "background_color": job.get("background", "#000000"),
        "transparent": bool(job.get("transparent")),
        "seed": 0,
        "disable_caching": True,
        "media_dir": job["media"],
        "images_dir": out,
        "output_file": "f",
        "format": "png",
        "zero_pad": 5,
        "verbosity": "WARNING",
        "progress_bar": "none",
    }
    with tempconfig(settings):
        spec = importlib.util.spec_from_file_location(os.path.splitext(os.path.basename(path))[0], path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        getattr(module, class_name)().render()


if __name__ == "__main__":
    main()
