import json
import gzip
import base64
import re
from pathlib import Path

html_path = Path(r"D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html")
text = html_path.read_text(encoding="utf-8")
match = re.search(r'<script id="payload"[^>]*>([^<]+)</script>', text)
data = json.loads(gzip.decompress(base64.b64decode(match.group(1))))
s005 = data["completionBV3"]["schemes"]["S005"]["modes"]

TRACKS_V3 = [
  ('keytao', 'character', 1, 2),
  ('keytao', 'word2', 3, 4),
  ('keytao', 'word3', 1, 3),
  ('keytao', 'word4', 1, 4),
  ('sanpin', 'character', 1, 2),
  ('sanpin', 'word2', 3, 4),
  ('sanpin', 'word3', 1, 3),
  ('sanpin', 'word4', 1, 4),
]

def analyze(ident, modes, tau=600, first_aux=300, second_aux=300):
    print(f"\n=================== {ident} ===================")
    tot = 0.0
    weighted_sum = 0.0
    for mode, kind, w, base in TRACKS_V3:
        r = modes[mode][kind]
        br = s005[mode][kind]
        f = 1.0 - (r['stageWeight'][0] if r.get('stageWeight') else 1.0)
        bf = 1.0 - (br['stageWeight'][0] if br.get('stageWeight') else 1.0)
        f2 = max(0.0, r['meanKeys'] - base - f)
        bf2 = max(0.0, br['meanKeys'] - base - bf)
        a = r['completionUpperMs'] + tau * r['p2'] + first_aux * f + second_aux * f2
        c = br['completionUpperMs'] + tau * br['p2'] + first_aux * bf + second_aux * bf2
        ratio = a / c
        term = w * (ratio ** 4)
        weighted_sum += term
        tot += w
        print(f"  {mode[:1]}.{kind:9s} (w={w}): CKT={r['completionUpperMs']:5.1f}ms p2={r['p2']*100:5.2f}% f1={f*100:5.2f}% f2={f2*100:5.2f}% | adj={a:6.1f} / {c:6.1f} -> ratio={ratio:.5f} (term={term:.4f})")
    v3 = 10.0 * ((weighted_sum / tot) ** 0.25)
    print(f"Total CKT v3: {v3:.5f}")

analyze("BCW-18389e333036", data["completionBV3"]["schemes"]["BCW-18389e333036"]["modes"])
analyze("BCW-52efebf27ff1", data["completionBV3"]["schemes"]["BCW-52efebf27ff1"]["modes"])
analyze("BCW-b77e2d88ac94", data["completionBV3"]["schemes"]["BCW-b77e2d88ac94"]["modes"])
analyze("BCW-5ec69bbb9ec9", data["completionBV3"]["schemes"]["BCW-5ec69bbb9ec9"]["modes"])
