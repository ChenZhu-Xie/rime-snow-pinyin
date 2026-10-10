import json
import gzip
import base64
import re
from pathlib import Path

db = json.loads(Path('research-notes/data/shenyun-21x21-round2-summary.json').read_text(encoding='utf-8'))
lookup = {r['id']: r for r in db}

html_path = Path(r'D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html')
text = html_path.read_text(encoding='utf-8')
match = re.search(r'<script id="payload"[^>]*>([^<]+)</script>', text)
data = json.loads(gzip.decompress(base64.b64decode(match.group(1))))
s005 = data['completionBV3']['schemes']['S005']['modes']

def print_detail(cid):
    r = lookup[cid]
    print(f"\n=== {cid} (v3={r['ckt_v3']:.5f}, M={r['M']}, D={r['D']}, 8B={r['eightWorstRatio']:.4f}) ===")
    for m in ('keytao', 'sanpin'):
        for k in ('character', 'word2', 'word3', 'word4'):
            part = r['modes'][m][k]
            b = s005[m][k]
            f = 1.0 - (part['stageWeight'][0] if part.get('stageWeight') else 1.0)
            f2 = max(0.0, part['meanKeys'] - (2 if k=='character' else 4 if k in ('word2','word4') else 3) - f)
            adj = part['completionUpperMs'] + 600 * part['p2'] + 300 * f + 300 * f2
            bf = 1.0 - (b['stageWeight'][0] if b.get('stageWeight') else 1.0)
            bf2 = max(0.0, b['meanKeys'] - (2 if k=='character' else 4 if k in ('word2','word4') else 3) - bf)
            badj = b['completionUpperMs'] + 600 * b['p2'] + 300 * bf + 300 * bf2
            ratio = adj / badj
            print(f"  {m[:1]}.{k:9s}: CKT={part['completionUpperMs']:5.1f}ms p2={part['p2']*100:4.2f}% f1={f*100:4.1f}% | adj={adj:5.1f} / {badj:5.1f} -> ratio={ratio:.5f}")

print_detail('BCW-40d7168c0550')
print_detail('BCW-12d72973b5b5')
print_detail('BCW-e3a5ec0586d5')
print_detail('BCW-4e12e84ed877')
print_detail('BCW-9d3ffcc750b2')
