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
target_ids = [
    "BCW-52efebf27ff1",
    "BCW-45ead2c51d37",
    "BCW-d976864e1f53",
    "BCW-b77e2d88ac94",
    "BCW-511d69ea162d",
    "BCW-72a9341d2fdc",
    "BCW-5ec69bbb9ec9"
]

entries_map = {e["id"]: e for e in data["entries"]}
for tid in target_ids:
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
    print(f"Verified {tid}: {e['name']} | 20-tracks OK | LoadSummary keys: {list(data['r11LoadSummaries'][tid].keys())} | CKT v3 OK")

print("\nAll 7 schemes verified successfully in a7_CKT_R11.html!")

