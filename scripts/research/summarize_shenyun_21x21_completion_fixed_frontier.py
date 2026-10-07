#!/usr/bin/env python3
"""Curate reproducible CKT/M/D and load-gated frontiers from fixed-IVUAO search runs."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT/'research-notes/data'
FILES = ('shenyun-21x21-completion-fixed-face-search-pilot.json',
         'shenyun-21x21-completion-fixed-face-search-r1.json',
         'shenyun-21x21-completion-fixed-face-search-r2.json',
         'shenyun-21x21-completion-fixed-face-search-m40.json',
         'shenyun-21x21-completion-fixed-face-search-m39.json',
         'shenyun-21x21-completion-fixed-local-polish.json')
OUTPUT = DATA/'shenyun-21x21-completion-fixed-frontier.json'
HTML = Path(r'D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html')
paths = {name: DATA/name for name in FILES}
rows = {}
proposals = 0
scored = 0
for name, path in paths.items():
    doc = json.loads(path.read_text(encoding='utf8'))
    for row in doc['results']:
        key = tuple(row['state'])
        if key not in rows or row['ckt12'] < rows[key][0]['ckt12']:
            rows[key] = row, name
    if 'trials' in doc:
        proposals += sum(doc['trials'])
        scored += sum(stage['counts'].get('scored',0) for stage in doc['stages'].values())

baseline = json.loads((DATA/'shenyun-completion-ckt-fixed-r11.json').read_text(encoding='utf8'))['schemes']['S005']['modes']
anchors = [baseline[mode][kind] for mode,kind in
           (('keytao','character'),('sanpin','character'),('keytao','word'),('sanpin','word'))]
cap = json.loads(paths[FILES[2]].read_text(encoding='utf8'))['pCap']

def composite(r,tau):
    t=[value+tau*miss for value,miss in zip(r['times'],r['p2'])]
    ratio=[value/(base['completionUpperMs']+tau*base['p2']) for value,base in zip(t,anchors)]
    return 10*((ratio[0]**4+ratio[1]**4+2*ratio[2]**4+2*ratio[3]**4)/6)**.25

def brief(item):
    r,source = item
    return {key:r[key] for key in ('id','M','D','ckt12','Pmax','homeS2','eightWorstRatio')}

def select(cap_m,cap_d,load=False,eight=False):
    candidates = [item for item in rows.values() if item[0]['M']<=cap_m and item[0]['D']<=cap_d]
    if load:
        candidates = [item for item in candidates if item[0]['Pmax']<=cap+1e-12 and item[0]['homeS2']>=.5]
    if eight:
        candidates = [item for item in candidates if item[0]['eightWorstRatio']<1]
    return min(candidates,key=lambda item:item[0]['ckt12']) if candidates else None

caps=[(48,7),(45,3),(44,3),(43,2),(42,1),(41,1),(41,0),(40,0),(39,0),(38,0)]
frontier=[]
for m,d in caps:
    record={'maxM':m,'maxD':d}
    for tag,load,eight in (('fastest',False,False),('loadGated',True,False),('eightAndLoadGated',True,True)):
        hit=select(m,d,load,eight)
        record[tag]=brief(hit) if hit else None
    frontier.append(record)
important={entry[tag]['id'] for entry in frontier for tag in ('fastest','loadGated','eightAndLoadGated') if entry[tag]}
selected={}
for row,source in rows.values():
    if row['id'] not in important: continue
    selected[row['id']]={**brief((row,source)),'file':source,
                          'ckt12tau0':composite(row,0),'ckt12tau600':composite(row,600),
                          'eightPaths':{k:row[k] for k in ('j1','j2','s1','s2','wj1','wj2','ws1','ws2')},
                          'state':row['state']}
local=json.loads(paths[FILES[-1]].read_text(encoding='utf8'))['results']
result={'policy':{'tone':'IVUAO','domain':[21,21], 'wordBOrder':'Keytao first character first; Sanpin second character first',
                  'tauMs':150,'characterWeight':1,'wordWeight':2,'baseline':'S005',
                  'pCap':cap,'homeFloor':.5,'eightStrictlyLessThanS005':True},
        'source':{'currentHtmlSha256':hashlib.sha256(HTML.read_bytes()).hexdigest(),
                  'fixedArchiveSha256':json.loads((DATA/'shenyun-completion-ckt-fixed-r11.json').read_text(encoding='utf8'))['source']['htmlSha256']},
        'search':{'files':list(paths),'proposals':proposals,'validScoredProposals':scored,
                  'distinctSavedStates':len(rows),
                  'localNeighborProposals':sum(h['proposed'] for r in local for h in r['history']),
                  'localLegalNeighbors':sum(h['valid'] for r in local for h in r['history'])},
        'thresholdFrontier':frontier,'representatives':selected,
        'local':[{k:r[k] for k in ('id','sourceId','M','D','ckt12','history')} for r in local]}
OUTPUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({'output':str(OUTPUT),'search':result['search'],'representatives':len(selected)},ensure_ascii=False))
