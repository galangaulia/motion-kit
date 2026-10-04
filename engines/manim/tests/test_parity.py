"""The Python port against the TypeScript (tests/fixture.json, written by
test/fixture.mjs). Beats, hash and text exactly; springs to float noise.
Run: pixi run --manifest-path engines/manim/pixi.toml test
"""

import json
import math
import os
import unittest

from motionkit import count_up, enter, exit, grid, hash, motion, peak_overshoot, scramble, spring_at, spring_velocity

with open(os.path.join(os.path.dirname(__file__), "fixture.json"), encoding="utf-8") as f:
    FIX = json.load(f)

TOL = 1e-9


class Parity(unittest.TestCase):
    def close(self, got, want, what):
        if want is None:  # JSON has no Infinity; the TypeScript wrote null
            self.assertTrue(math.isinf(got) or math.isnan(got), f"{what}: {got} vs non-finite")
        else:
            self.assertAlmostEqual(got, want, delta=TOL, msg=what)

    def test_springs(self):
        for p, preset in enumerate(FIX["presets"]):
            for s, t in enumerate(FIX["seconds"]):
                self.close(spring_at(t, preset), FIX["springAt"][p][s], f"spring_at({t}, {preset})")
                self.close(spring_velocity(t, preset), FIX["springVelocity"][p][s], f"spring_velocity({t}, {preset})")
            self.close(peak_overshoot(preset), FIX["peakOvershoot"][p], f"peak_overshoot({preset})")

    def test_motion(self):
        m = motion(30)
        keys, zoom_keys = FIX["keys"], FIX["zoomKeys"]
        for i, f in enumerate(FIX["frames"]):
            want = FIX["motion"][i]
            self.close(m.progress(f, 10, "heavy"), want["progress"], f"progress {f}")
            self.close(m.spring(f, 20, 5, -40), want["spring"], f"spring {f}")
            self.close(m.track(f, keys), want["track"], f"track {f}")
            self.close(m.track_velocity(f, keys), want["trackVelocity"], f"track_velocity {f}")
            self.close(m.release(f, 30, 100, -800, 20, "snappy"), want["release"], f"release {f}")
            self.close(m.zoom(f, zoom_keys), want["zoom"], f"zoom {f}")
            self.close(m.swap_alpha(f, 10, 120), want["swapAlpha"], f"swap_alpha {f}")
            self.close(m.swap_alpha(f, 10), want["swapAlphaOpen"], f"swap_alpha open {f}")

    def test_grids(self):
        for want in FIX["grids"]:
            g = grid(want["bpm"], want["fps"], want["offset"], want["beatsPerBar"])
            self.assertEqual([g.beat(b) for b in want["beats"]], want["beat"], "beat (Math.round, halves up)")
            self.assertEqual([g.hit(b) for b in want["beats"]], want["hit"])
            self.assertEqual([g.bar(b) for b in [0, 1, 2.5]], want["bar"])
            for b, s in zip(want["beats"], want["seconds"]):
                self.close(g.seconds(b), s, f"seconds({b})")
            for f, a, p, p2 in zip(FIX["frames"], want["at"], want["pulse"], want["pulse2"]):
                self.close(g.at(f), a, f"at({f})")
                self.close(g.pulse(f), p, f"pulse({f})")
                self.close(g.pulse(f, 2, 9), p2, f"pulse({f}, 2, 9)")

    def test_hash_and_text(self):
        for case in FIX["hash"]:
            self.assertEqual(hash(*case["args"]), case["value"], f"hash{tuple(case['args'])}")
        for case in FIX["scramble"]:
            self.assertEqual(scramble(case["text"], case["frame"], case["progress"], seed=case["seed"]), case["value"])
        for case in FIX["countUp"]:
            self.assertEqual(count_up(case["p"], case["to"], case["from"]), case["value"])

    def test_enter_exit(self):
        m = motion(30)
        cases = {
            "enter": lambda f: enter(m, f, 10, y=28, preset="heavy"),
            "enterDefault": lambda f: enter(m, f, 10),
            "enterScale": lambda f: enter(m, f, 10, x=-24, scale=0.9, preset="snappy"),
            "exit": lambda f: exit(m, f, 30, y=-40, preset="heavy"),
        }
        for name, fn in cases.items():
            for f, want in zip(FIX["frames"], FIX[name]):
                got = fn(f)
                for key in ("x", "y", "scale", "opacity"):
                    self.close(getattr(got, key), want[key], f"{name}({f}).{key}")


if __name__ == "__main__":
    unittest.main()
