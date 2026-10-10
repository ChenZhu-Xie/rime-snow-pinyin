import json
import gzip
import base64
import re
from pathlib import Path

html_path = Path(r"D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html")
text = html_path.read_text(encoding="utf-8")
match = re.search(r'<script id="payload"[^>]*>([^<]+)</script>', text)
data = json.loads(gzip.decompress(base64.b64decode(match.group(1))))

print("Total schemes in HTML:", len(data["entries"]))
target_ids = [
    # Round 3 (5 schemes)
    "BCW-e806ff772afe",
    "BCW-a430bb64e17b",
    "BCW-121d11f6b6c4",
    "BCW-3c47744cf2f7",
    "BCW-4119add30591",
    # Round 4 (27 schemes: high-value seeds + frontier & basin champions)
    "BCW-f420619c19db",
    "BCW-d18a30c7ca84",
    "BCW-ee2924bf75d6",
    "BCW-e20b131daf85",
    "BCW-4f7b475cca86",
    "BCW-af71075edb2d",
    "BCW-34dd9890bd1b",
    "BCW-1e7bff4b6512",
    "BCW-cb37113b38ff",
    "BCW-865b326cd700",
    "BCW-618ed33d99d7",
    "BCW-5cc76bebb7e9",
    "BCW-695b434e897f",
    "BCW-0612e4476c25",
    "BCW-6b1cc27a7754",
    "BCW-d632acb6efb5",
    "BCW-cf5b93b6f0f2",
    "BCW-1b52baf9e888",
    "BCW-6b733a54e711",
    "BCW-9a856552678a",
    "BCW-233a0ea09076",
    "BCW-9bb794f486aa",
    "BCW-135c591af5a3",
    "BCW-f7538fe6f956",
    "BCW-2dd583d61844",
    "BCW-1a11061c8293",
    "BCW-2662bd325b7d",
]

entries_map = {e["id"]: e for e in data["entries"]}
all_ids = set(entries_map.keys())
assert len(all_ids) == 715, f"Expected 715 schemes, got {len(all_ids)}"
assert set(data["completionB"]["schemes"].keys()) == all_ids
assert set(data["completionBFixed"]["schemes"].keys()) == all_ids
assert set(data["completionBV2"]["schemes"].keys()) == all_ids
assert set(data["completionBV3"]["schemes"].keys()) == all_ids

for tid in target_ids:
    e = entries_map.get(tid)
    assert e is not None, f"Missing entry: {tid}"
    assert len(e["initialMap"]) > 0, f"Empty initialMap: {tid}"
    assert len(e["finalMap"]) > 0, f"Empty finalMap: {tid}"
    assert "bPathMetrics" in e and "bPathMetricsNative" in e, f"Missing 8B metrics: {tid}"
    assert "memoryAuditR2" in e and "logicAudit" in e and "sound" in e, f"Missing entry audit/sound: {tid}"
    assert len(data["ckt"]["tracks"][tid]) == 20, f"Incomplete 20-tracks: {tid}"
    assert tid in data["r11LoadSummaries"], f"Missing load summary (heatmap): {tid}"
    assert tid in data["ensembleV5"]["values"] and tid in data["ensembleV6"]["values"], f"Missing ensemble V5/V6: {tid}"
    assert tid in data["r11PairMetrics"]["values"], f"Missing r11PairMetrics: {tid}"
    assert tid in data["fairCKT"]["values"], f"Missing fairCKT: {tid}"
    assert tid in data["completionB"]["schemes"], f"Missing completionB: {tid}"
    assert tid in data["completionBFixed"]["schemes"], f"Missing completionBFixed: {tid}"
    assert tid in data["completionBV2"]["schemes"], f"Missing completionBV2: {tid}"
    assert tid in data["completionBV3"]["schemes"], f"Missing completionBV3: {tid}"
    v3_modes = data["completionBV3"]["schemes"][tid]["modes"]
    assert "keytao" in v3_modes and "sanpin" in v3_modes, f"Incomplete v3 modes: {tid}"
    print(f"Verified {tid}: {e['name']} | 20-tracks OK | V5/V6/Pair OK | Heatmap OK | 8B OK | CKT v1/v2/v3 OK")

print(f"\nAll {len(target_ids)} Round 3 + Round 4 schemes (715 total in catalogue) verified successfully in a7_CKT_R11.html!")
