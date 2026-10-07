#!/usr/bin/env python3
"""Integrate reviewed CKT v2 frontier representatives into the offline R11 atlas."""
from __future__ import annotations
import argparse
import json
import subprocess
import tempfile
from pathlib import Path

from integrate_shenyun_21x21_b_paths import DATA, DEFAULT_HTML, DEFAULT_REPLAY, load_benchmark, load_module, new_entry, score_missing_exact
from integrate_shenyun_21x21_completion_fixed_frontier import pack, ensemble, write_payload
from correct_shenyun_completion_word_order import PATHS

SCORER=Path(__file__).with_name('score_shenyun_completion_ckt.js')
SOURCE='shenyun-21x21-completion-v2-face-search.json'


def adjusted(row,kind,penalties):
    base=4 if kind=='word' else 2
    first=1-row['stageWeight'][0]
    selection, first_aux, second_aux = penalties
    return row['completionUpperMs']+selection*row['p2']+first_aux*first+second_aux*(row['meanKeys']-base-first)


def composite(modes,reference,penalties):
    weighted=[]
    for mode in ('keytao','sanpin'):
        for kind in ('character','word'):
            weight=2 if kind=='word' else 1
            weighted.append(weight*(adjusted(modes[mode][kind],kind,penalties)/adjusted(reference[mode][kind],kind,penalties))**4)
    return 10*(sum(weighted)/6)**.25


def select_rows(document,existing,baseline,penalties):
    pool=document['results']
    chosen=[]
    for cap_m,cap_d in ((48,7),(45,3),(44,3),(43,2),(42,1),(41,0),(40,0),(39,0)):
        candidates=[r for r in pool if r['M']<=cap_m and r['D']<=cap_d and r['id'] not in existing and not r.get('atlasId') and r['id'] not in {c['id'] for c in chosen}]
        old_scores=(composite(row['modes'],baseline['S005']['modes'],penalties) for row in baseline.values() if row.get('tone')=='IVUAO' and row.get('capacity')==[21,21] and row.get('memory') is not None and row['memory']<=cap_m and row.get('displaced') is not None and row['displaced']<=cap_d)
        chosen_scores=(row['ckt12'] for row in chosen if row['M']<=cap_m and row['D']<=cap_d)
        previous=min((*old_scores,*chosen_scores),default=float('inf'))
        if candidates:
            best=min(candidates,key=lambda r:r['ckt12'])
            if best['ckt12']+1e-9<previous:chosen.append(best)
    return chosen


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--html',type=Path,default=DEFAULT_HTML)
    parser.add_argument('--replay',type=Path,default=DEFAULT_REPLAY)
    parser.add_argument('--search',type=Path,default=DATA/SOURCE)
    parser.add_argument('--ids',nargs='*',help='Explicit reviewed result IDs; default selects improving M/D constrained minima')
    args=parser.parse_args()
    html_path=args.html.resolve()
    html=html_path.read_text(encoding='utf-8')
    old=load_module('old_21x21_integrator',Path(__file__).with_name('integrate_shenyun_21x21_low_miss.py'))
    helper=old.load_helper(html_path)
    data,body,end=helper.extract_payload(html)
    existing={e['id'] for e in data['entries']}
    doc=json.loads(args.search.read_text(encoding='utf-8'))
    penalties=(doc['tauMs'],doc['firstAuxiliaryExtraMs'],doc['secondAuxiliaryExtraMs'])
    source_name=args.search.name
    if set(data['completionBV2']['schemes'])!=existing:raise ValueError('Incomplete v2 atlas catalogue')
    if args.ids:
        lookup={r['id']:r for r in doc['results']}
        chosen=[lookup[i] for i in args.ids if i not in existing]
    else:chosen=select_rows(doc,existing,data['completionBV2']['schemes'],penalties)
    if not chosen:
        print(json.dumps({'alreadyIntegrated':True,'catalogue':len(existing)}))
        return
    ids=[r['id'] for r in chosen]
    before=helper.preservation_snapshot(data,existing)
    benchmark,historical_fast=load_benchmark(args.replay.resolve())
    from b_path_fast import FastBuckets
    current_fast=FastBuckets(benchmark,first_word=True)
    missing=[i for i in ids if not (args.replay/'exact'/(i+'.json')).exists()]
    if missing:score_missing_exact(args.replay,benchmark,{r['id']:(r,'') for r in chosen},missing)
    import numpy as np
    entries,exact=[],{}
    for r in chosen:
        ident=r['id']
        scored=json.loads((args.replay/'exact'/(ident+'.json')).read_text(encoding='utf-8'))
        expected=benchmark.opt.toentry(np.asarray(r['state'],dtype=np.int32),benchmark.DATA,ident)
        if scored['entry']['codeList']!=expected['codeList']:raise ValueError('Code mismatch '+ident)
        prepared={**r,'S2ms':scored['tracks']['S2']['upperMs'],'v5':scored['scores']['ensembleV5']['score']}
        entry=new_entry(helper,scored,prepared,'固定 IVUAO · CKT v2 字词 1:2 前沿')
        entry['subfamily']='AVUIO 锁定·CKT v2 补全面搜索'
        entry['source']='upstream role v5 CKT: '+data['cktV2']['upstreamCommit']+f'; staged {penalties[0]}/{penalties[1]}/{penalties[2]} ms search'
        entry['notes'].append(f'First auxiliary +{penalties[1]}ms, second auxiliary +{penalties[2]}ms on top of their modelled IVUAO CKT; selection +{penalties[0]}ms.')
        entry['bPathMetrics']=historical_fast.score(entry['codeList'])
        entry['bPathMetricsNative']=current_fast.score(entry['codeList'])
        for key,mode,kind,stage in PATHS:
            if abs(entry['bPathMetricsNative'][key]-r[key])>1e-12:raise ValueError('Eight-path mismatch '+ident+' '+key)
        entries.append(entry)
        exact[ident]=scored
    data=old.integrate_colliding(helper,data,entries,exact,args.replay)
    helper.integrate_macroxue(data,entries,args.replay)
    if before!=helper.preservation_snapshot(data,existing):raise ValueError('Original catalogue changed')
    data['r11Research']['counts']['postR11ResearchExtensions']+=len(entries)
    data['r11Research']['scopeRows'].append(['Snow Shenyun fixed IVUAO 21x21 CKT v2 frontier',f'{len(entries)} verified {penalties[0]}/{penalties[1]}/{penalties[2]} ms search representatives'])
    data['fourCodeCollisionBenchmark']['catalogueCount']=len(data['entries'])
    data['bPathBenchmark']['schemeCount']=len(data['entries'])
    if source_name not in data['bPathBenchmark']['selectedSources']:data['bPathBenchmark']['selectedSources'].append(source_name)
    with tempfile.TemporaryDirectory(prefix='ckt-v2-integration-') as location:
        temp=Path(location)
        staged=temp/'scored.html'
        staged.write_text(html[:body]+pack(data)+html[end:],encoding='utf-8')
        result={}
        for mapping in ('native','fixed','v2'):
            target=temp/(mapping+'.json')
            cmd=['node',str(SCORER),'--html',str(staged),'--output',str(target),'--ids',','.join(ids),'--mapping','fixed' if mapping=='v2' else mapping]
            if mapping=='v2':cmd.extend(['--model','v2'])
            subprocess.run(cmd,check=True,cwd=Path(__file__).resolve().parents[2])
            result[mapping]=json.loads(target.read_text(encoding='utf-8'))['schemes']
        reference=data['completionBV2']['schemes']['S005']['modes']
        for r in chosen:
            ident=r['id'];v2=result['v2'][ident]
            score=composite(v2['modes'],reference,penalties)
            if abs(score-r['ckt12'])>1e-9:raise ValueError(f'Fast/exact v2 mismatch: {ident} {score} {r["ckt12"]}')
            parts=[v2['modes'][mode][kind] for mode,kind in (('keytao','character'),('sanpin','character'),('keytao','word'),('sanpin','word'))]
            if max(abs(r['times'][i]-parts[i]['completionUpperMs']) for i in range(4))>1e-8:raise ValueError('Time mismatch '+ident)
            if max(abs(r['firstAuxCounts'][i]-(1-parts[i]['stageWeight'][0])) for i in range(4))>1e-12:raise ValueError('Aux mismatch '+ident)
            data['completionBV2']['schemes'][ident]=v2
            for mapping in ('native','fixed'):
                block=data['completionB' if mapping=='native' else 'completionBFixed']
                item=result[mapping][ident]
                if item['modes']!=result['native' if mapping=='fixed' else 'fixed'][ident]['modes']:raise ValueError('Fixed-native mismatch '+ident)
                block['schemes'][ident]=item
                base=block['schemes']['S005']['modes']
                block['ensembleScores'][ident]={
                    'equal':{str(t):ensemble(item['modes'],base,t,1) for t in (0,150,300,600)},
                    'word2':{str(t):ensemble(item['modes'],base,t,2) for t in (0,150,300,600)},
                }
        all_ids={e['id'] for e in data['entries']}
        if len(all_ids)!=len(existing)+len(ids) or any(set(data[name]['schemes'])!=all_ids for name in ('completionB','completionBFixed','completionBV2')):raise ValueError('Catalogue mismatch')
        for name in ('completionB','completionBFixed','completionBV2'):
            data[name]['source'].setdefault('extensions',[]).append({'ids':ids,'source':source_name,'searchPenaltiesMs':{'selection':penalties[0],'firstAux':penalties[1],'secondAux':penalties[2]}})
        write_payload(html_path,html,body,end,data)
        (DATA/'shenyun-completion-ckt-fixed-v2.json').write_text(json.dumps(data['completionBV2'],ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print(json.dumps({'added':ids,'catalogue':len(data['entries']),'scores':{r['id']:r['ckt12'] for r in chosen}},ensure_ascii=False))

if __name__=='__main__':main()
