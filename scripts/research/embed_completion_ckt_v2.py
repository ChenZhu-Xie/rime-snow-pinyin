"""Embed the regenerated upstream role table and exact fixed-IVUAO cohort scores.

Run once with --model after upstream 组装当量表.py, then run the JS scorer
with --model v2, then run again with --scores. The old CKT column stays frozen.
"""
from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import re
from pathlib import Path

import numpy as np

ROLE_NAMES = ('L2i1', 'L3i1', 'L3i2', 'L4i1', 'L4i2', 'L4i3')
NATIVE_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ;,./'
PAYLOAD = re.compile(r'(<script id="payload"[^>]*>)([^<]+)(</script>)')


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--html', type=Path, required=True)
    ap.add_argument('--model', type=Path)
    ap.add_argument('--scores', type=Path)
    ap.add_argument('--upstream-commit')
    args = ap.parse_args()
    if bool(args.model) == bool(args.scores):
        ap.error('exactly one of --model and --scores is required')
    html = args.html.read_text(encoding='utf-8')
    found = PAYLOAD.search(html)
    if not found:
        raise ValueError('R11 payload not found')
    data = json.loads(gzip.decompress(base64.b64decode(found[2])))
    if args.model:
        raw = args.model.read_bytes()
        npz = np.load(args.model, allow_pickle=False)
        if int(npz['version']) != 5 or ''.join(npz['letters']) != NATIVE_KEYS.lower():
            raise ValueError('unexpected upstream role table')
        model = {
            'version': 'upstream-role-v5-2026-10-07',
            'upstreamCommit': args.upstream_commit,
            'sourceSha256': hashlib.sha256(raw).hexdigest(),
            'source': 'conditional-keystroke-timing/产物/段当量表.npz',
            'keys': NATIVE_KEYS,
            'longGuardMs': data['ckt']['calibration']['long_code']['guard_per_extra_segment_ms'],
            'extension': 'For the four nonnative keys, retain the frozen R11 cost increment relative to the strongest native donor; 5/6-key codes retain the frozen R11 long-code guard.',
            'tables': {name: base64.b64encode(np.asarray(npz[f'seg_{name}'], dtype='<f8').tobytes()).decode('ascii')
                       for name in ROLE_NAMES},
        }
        data['cktV2'] = model
    else:
        scores = json.loads(args.scores.read_text(encoding='utf-8'))
        if len(scores['schemes']) != len(data['entries']):
            raise ValueError('scheme count differs from atlas')
        if set(scores['schemes']) != {entry['id'] for entry in data['entries']}:
            raise ValueError('scheme IDs differ from atlas')
        scores['modelSource'] = {key: data['cktV2'][key] for key in ('version', 'upstreamCommit', 'sourceSha256', 'extension')}
        scores['penaltyDefinition'] = {
            'defaultSelectionMs': 500,
            'defaultFirstAuxiliaryMs': 100,
            'defaultSecondAuxiliaryMs': 150,
            'formula': 'completionUpperMs + selectionMs*p2 + firstAuxiliaryMs*(1-stageWeight[0]) + secondAuxiliaryMs*(meanKeys-baseCodeLength-(1-stageWeight[0]))',
            'baseCodeLength': {'character': 2, 'word': 4},
            'normalization': 'Each of four groups divides by S005 at the same three penalties; fourth-power mean with character:word weights 1:2.',
        }
        data['completionBV2'] = scores
    encoded = base64.b64encode(gzip.compress(json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode('utf-8'), mtime=0)).decode('ascii')
    html = html[:found.start(2)] + encoded + html[found.end(2):]
    args.html.write_text(html, encoding='utf-8')
    print('Embedded', 'model' if args.model else 'scores', 'in', args.html)


if __name__ == '__main__':
    main()
