import json
import gzip
import base64
import re
from pathlib import Path

html_path = Path(r"D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html")
text = html_path.read_text(encoding="utf-8")
match = re.search(r'<script id="payload"[^>]*>([^<]+)</script>', text)
data = json.loads(gzip.decompress(base64.b64decode(match.group(1))))

print("Total schemes:", len(data["entries"]))
round2_ids = [
    "BCW-40d7168c0550",
    "BCW-12d72973b5b5",
    "BCW-e3a5ec0586d5",
    "BCW-4e12e84ed877",
    "BCW-9d3ffcc750b2",
    "BCW-106d38018322"
]

entries_map = {e["id"]: e for e in data["entries"]}
for tid in round2_ids:
    e = entries_map.get(tid)
    assert e is not None, f"Missing entry: {tid}"
    assert len(e["initialMap"]) > 0, f"Empty initialMap: {tid}"
    assert len(e["finalMap"]) > 0, f"Empty finalMap: {tid}"
    assert len(data["ckt"]["tracks"][tid]) == 20, f"Incomplete 20-tracks: {tid}"
    assert tid in data["r11LoadSummaries"], f"Missing load summary (heatmap): {tid}"
    assert tid in data["completionB"]["schemes"], f"Missing completionB: {tid}"
    assert tid in data["completionBFixed"]["schemes"], f"Missing completionBFixed: {tid}"
    assert tid in data["completionBV2"]["schemes"], f"Missing completionBV2: {tid}"
    assert tid in data["completionBV3"]["schemes"], f"Missing completionBV3: {tid}"
    v3_modes = data["completionBV3"]["schemes"][tid]["modes"]
    assert "keytao" in v3_modes and "sanpin" in v3_modes, f"Incomplete v3 modes: {tid}"
    print(f"Verified {tid}: {e['name']} | 20-tracks OK | Heatmap OK | CKT v3 OK")

print("\nAll 6 Round 2 breakthrough schemes verified successfully in a7_CKT_R11.html!")
