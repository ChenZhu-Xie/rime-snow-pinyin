#!/usr/bin/env python3
"""Integration checks for native auxiliary mapping in the frozen R11 scorer."""

from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HTML = Path(r"D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html")
SCORER = ROOT / "scripts/research/score_shenyun_completion_ckt.js"
IDS = "S005,SNOW-SHENYUN-21X28-TONE"


class NativeCompletionTests(unittest.TestCase):
    def test_word_order_depends_on_domain_only_for_keytao(self) -> None:
        script = r"""
const {makeRows} = require('./scripts/research/score_shenyun_completion_ckt.js');
const data={characters:[],words:[['甲乙',0,1,1,2,10,1,true]],shapes:{snowshape:{甲:'I',乙:'E'}}};
const stroke={primary:new Map(),alternatives:new Map()};
function codes(capacity){const entry={id:'test',capacity,tone:'IVUAO',codeList:['AB','CD']};return makeRows(data,entry,stroke,'native').words[0]}
const a=codes([21,21]),b=codes([21,26]);
if(a.keytao[1][0]!=='ABCDI'||a.keytao[2][0]!=='ABCDIV')throw Error('21x21 must encode first character B before second');
if(b.keytao[1][0]!=='ABCDV'||b.keytao[2][0]!=='ABCDVI')throw Error('non-21x21 must encode second character B before first');
if(a.sanpin[1][0]!==b.sanpin[1][0]||a.sanpin[2][0]!==b.sanpin[2][0])throw Error('sanpin order changed by domain');
"""
        result = subprocess.run(["node", "-e", script], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def score(self, mapping: str) -> dict:
        with tempfile.TemporaryDirectory(prefix="r11-native-test-") as directory:
            output = Path(directory) / "scores.json"
            subprocess.run(["node", str(SCORER), "--html", str(HTML), "--output", str(output),
                            "--ids", IDS, "--mapping", mapping], check=True, cwd=ROOT,
                           capture_output=True, text=True)
            return json.loads(output.read_text(encoding="utf-8"))

    def test_native_mapping_preserves_matching_order_and_changes_other_order(self) -> None:
        native = self.score("native")
        fixed = self.score("fixed")
        self.assertEqual(native["policy"]["mappingMode"], "native")
        self.assertEqual(native["policy"]["wordBOrder"],
                         "keytao: 21x21 first character then second; other domains second then first; sanpin: second then first")
        self.assertEqual(native["schemes"]["S005"]["modes"], fixed["schemes"]["S005"]["modes"])
        other = "SNOW-SHENYUN-21X28-TONE"
        self.assertNotEqual(native["schemes"][other]["modes"], fixed["schemes"][other]["modes"])
        for scored in native["schemes"].values():
            for mode in ("keytao", "sanpin"):
                for kind in ("character", "word"):
                    metric = scored["modes"][mode][kind]
                    self.assertEqual(metric["coverage"], 1)
                    self.assertGreaterEqual(metric["p1"], metric["p2"] - 1e-12)


if __name__ == "__main__":
    unittest.main()
