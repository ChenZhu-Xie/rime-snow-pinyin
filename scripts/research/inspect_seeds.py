import json
import gzip
import base64
import re
from pathlib import Path

html_path = Path(r'D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html')
text = html_path.read_text(encoding='utf-8')
match = re.search(r'<script id="payload"[^>]*>([^<]+)</script>', text)
data = json.loads(gzip.decompress(base64.b64decode(match.group(1))))

e21 = [x for x in data['entries'] if x.get('capacity') == [21, 21]]
print(f'Total 21x21 entries: {len(e21)}')
sample = e21[0]
print('Sample id:', sample['id'])
print('Sample keys:', list(sample.keys()))
if 'state' in sample:
    print('state exists directly in entry!')
else:
    print('state is reconstructed via b.opt.state(entry, b.DATA)')
