#!/usr/bin/env python3
"""Exhaust final-pair swaps and physical-key transpositions near fixed-IVUAO endpoints."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research-notes/data'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--files', nargs='+', type=Path, required=True)
parser.add_argument('--ids', nargs='+', required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--max-rounds', type=int, default=5)
a = parser.parse_args()
a.files = [p.resolve() for p in a.files]
a.output = a.output.resolve()
for k in ('OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','NUMBA_NUM_THREADS'):
    os.environ[k] = '1'
replay = Path(os.environ['TEMP']) / 'rime-21x21-search/R11_integrated_replay'
os.chdir(replay)
sys.path[:0] = [str(replay), str(ROOT/'scripts/research')]
sys.argv = ['benchmark_shenyun_21x21_b_sets.py', '--replay', str(replay),
            '--output', str(DATA/'shenyun-21x21-b-sets-benchmark.json')]
spec = importlib.util.spec_from_file_location('b_sets', ROOT/'scripts/research/benchmark_shenyun_21x21_b_sets.py')
b = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(b)
import numpy as np
from fast_completion_word2 import FastCompletion
from b_path_fast import FastBuckets, NAMES

html = Path(r'D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html')
ckt = FastCompletion(b, html, first_word=True)
fast = FastBuckets(b, first_word=True)
frozen = json.loads((DATA/'shenyun-completion-ckt-fixed-r11.json').read_text(encoding='utf8'))['schemes']['S005']['modes']
base = np.array([frozen[mode][kind]['completionUpperMs'] + 150*frozen[mode][kind]['p2']
                 for mode,kind in (('keytao','character'),('sanpin','character'),('keytao','word'),('sanpin','word'))])
weights = np.array([1.,1.,2.,2.])
aux = {b.opt.META['keys'].index(key) for key in 'IVUAO'}
physical = [k for k in range(26) if k not in aux]
rows = {}
for path in a.files:
    for row in json.loads(path.read_text(encoding='utf8'))['results']:
        rows[row['id']] = row


def evaluate(state, cap):
    unique, m, d = b.se.stats(state, b.opt.PARAMS[-2], b.opt.PARAMS[-1], 21, 7, 1)
    if unique < 0 or m > cap or d != 0:
        return None
    times, misses = ckt.score(state)
    value = float(10*((weights*((times+150*misses)/base)**4).sum()/6)**.25)
    return value, int(m), list(map(float,times)), list(map(float,misses))


def moves(state):
    for i in range(27,62):
        for j in range(i+1,62):
            if state[i] != state[j]:
                neighbor = state.copy()
                neighbor[i],neighbor[j] = neighbor[j],neighbor[i]
                yield neighbor, ('final-pair',i,j)
    for i,k in enumerate(physical):
        for other in physical[i+1:]:
            neighbor = state.copy()
            for z in range(62):
                if state[z] == k: neighbor[z] = other
                elif state[z] == other: neighbor[z] = k
            yield neighbor, ('physical-keys',k,other)


results=[]
for ident in a.ids:
    source=rows[ident]
    assert source['D']==0
    cap=source['M']
    state=np.array(source['state'],dtype=np.int32)
    start=evaluate(state,cap)
    assert start and abs(start[0]-source['ckt12'])<1e-9
    history=[]
    for step in range(a.max_rounds):
        score,m,times,misses=evaluate(state,cap)
        best=score
        winner=None
        proposed=0
        valid=0
        for next_state,move in moves(state):
            proposed+=1
            outcome=evaluate(next_state,cap)
            if outcome is None: continue
            valid+=1
            if outcome[0]<best-1e-10:
                best=outcome[0]
                winner=(next_state,move)
        history.append({'round':step,'proposed':proposed,'valid':valid,'score':score,
                        'bestNeighbor':best,'bestMove':winner[1] if winner else None})
        print(ident,'round',step,'score',round(score,9),'neighbors',proposed,'legal',valid,
              'best',round(best,9),flush=True)
        if winner is None: break
        state=winner[0]
    score,m,times,misses=evaluate(state,cap)
    final_id='BCL-'+hashlib.sha256(state.tobytes()).hexdigest()[:12]
    entry=b.opt.toentry(state,b.DATA,final_id)
    bm=fast.score(entry['codeList'])
    result={'id':final_id,'sourceId':ident,'state':list(map(int,state)),
            'ckt12':score,'M':m,'D':0,'times':times,'p2':misses,
            'Pmax':float(b.r5.rp(state)[1]), 'homeS2':float(b.r5.home(state)[0]),
            'eightWorstRatio':max(bm[key]/frozen[mode][kind][stage]
                for key,mode,kind,stage in (('j1','keytao','character','p1'),('j2','keytao','character','p2'),
                    ('s1','sanpin','character','p1'),('s2','sanpin','character','p2'),
                    ('wj1','keytao','word','p1'),('wj2','keytao','word','p2'),
                    ('ws1','sanpin','word','p1'),('ws2','sanpin','word','p2'))),
            **bm,'history':history}
    results.append(result)
a.output.parent.mkdir(parents=True,exist_ok=True)
a.output.write_text(json.dumps({'purpose':__doc__,'results':results},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
print('saved',a.output,flush=True)
