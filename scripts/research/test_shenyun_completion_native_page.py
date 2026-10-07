#!/usr/bin/env python3
"""Verify the atlas exposes a consistent native B comparison for every scheme."""

from __future__ import annotations

import base64
import gzip
import json
import unittest
from pathlib import Path


HTML = Path(r"D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html")
PATHS = (("j1", "keytao", "character", "p1"), ("j2", "keytao", "character", "p2"),
         ("s1", "sanpin", "character", "p1"), ("s2", "sanpin", "character", "p2"),
         ("wj1", "keytao", "word", "p1"), ("wj2", "keytao", "word", "p2"),
         ("ws1", "sanpin", "word", "p1"), ("ws2", "sanpin", "word", "p2"))


class NativePageTests(unittest.TestCase):
    def test_all_entries_have_native_b_rates_and_fixed_control_survives(self) -> None:
        text = HTML.read_text(encoding="utf-8")
        start = text.index(">", text.index('<script id="payload"')) + 1
        end = text.index("</script>", start)
        data = json.loads(gzip.decompress(base64.b64decode(text[start:end])))
        entries = data["entries"]
        native = data["completionB"]
        fixed = data["completionBFixed"]
        self.assertEqual(native["policy"]["mappingMode"], "native")
        self.assertEqual(fixed["policy"]["toneKeys"], "IVUAO")
        self.assertEqual(native["policy"]["wordBOrder"],
                         "keytao: 21x21 first character then second; other domains second then first; sanpin: second then first")
        self.assertEqual(set(native["schemes"]), {e["id"] for e in entries})
        self.assertEqual(set(fixed["schemes"]), set(native["schemes"]))
        self.assertEqual(data["bPathBenchmark"]["schemeCount"], len(entries))
        self.assertEqual(data["bPathBenchmark"]["wordBOrder"], native["policy"]["wordBOrder"])
        self.assertEqual(data["bPathBenchmark"]["deployed21x21KeytaoWordOrder"],
                         "first character then second (snow_jiandao shape_filter.lua)")
        self.assertIn("21×21 键道与 snow_jiandao 实际二字全码形码顺序一致", text)
        self.assertNotIn("现行 Lua 键道二字词仍是次字先", text)
        self.assertNotAlmostEqual(native["schemes"]["S005"]["modes"]["keytao"]["word"]["p1"],
                                  data["bPathBenchmarkLegacy"]["referenceS005"]["wj1"], places=12)
        for entry in entries:
            modes = native["schemes"][entry["id"]]["modes"]
            rates = entry["bPathMetricsNative"]
            for field, mode, kind, stage in PATHS:
                self.assertAlmostEqual(rates[field], modes[mode][kind][stage], places=10)
                self.assertEqual(modes[mode][kind]["coverage"], 1)
            if entry["tone"] == "IVUAO":
                self.assertEqual(modes, fixed["schemes"][entry["id"]]["modes"])
        self.assertIn("completionBFixed", text)


if __name__ == "__main__":
    unittest.main()
