"""将清韵 character=true 的独立实测并入当前报告，其他方案保持原数据。"""
import csv
import hashlib
import io
import json
import re
import shutil
from decimal import Decimal, ROUND_HALF_UP
fmt = lambda v: str(Decimal(v).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP))
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'output/qingyun-character-full'
REPORTS = ROOT / 'reports'
RUN = BASE / 'run/snow_qingyun'
read = lambda p: p.read_text(encoding='utf-8-sig')
load = lambda p: json.loads(read(p))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
manifest = load(RUN / 'results/manifest.json')
assert manifest['queryOptions']['character'] is True
obs = {r['code']: r for r in map(json.loads, read(RUN / 'results/observations.jsonl').splitlines())}
expanded_path = BASE / 'supplement/local-observations.json'
if expanded_path.exists():
    for code,r in load(expanded_path):
        if code in obs:
            assert [c['text'] for c in obs[code]['candidates']] == r['candidates'][:6]
        obs[code] = dict(code=code,candidates=[dict(text=t) for t in r['candidates']],commit=r['commit'],completed=r['completed'])
audit = load(RUN / 'audit.json')['results'][0]
assert audit['targets'] == 8000
first = {r['text']: r['choice'] for r in audit['characters']}
choices = {t: dict(code=v['code'], keys=v['keys'], rank=1) for t,v in first.items() if v}
for code,r in obs.items():
    if not r['completed'] or r['commit']: continue
    for index,c in enumerate(r['candidates']):
        t=c['text']
        if t not in first or first[t]: continue
        rank=index+1
        keys=len(code)+sum(x.isupper() for x in code)+(0 if rank==1 else (rank-1)//6+1)
        v=dict(code=code,keys=keys,rank=rank)
        old=choices.get(t)
        if old is None or (keys,rank,code)<(old['keys'],old['rank'],old['code']): choices[t]=v
assert len(choices)==8000, '仍有缺测字，先补证再发布'
backup=BASE/'previous-reports';backup.mkdir(exist_ok=True)
cohorts=[500,1000,1500,2000,3000,4000,5000,6000,8000]
evidence=dict(mode='character=true',revision=manifest['revision'],fingerprint=manifest['fingerprint'],observationsSha256=sha(RUN/'results/observations.jsonl'),queryOptions=manifest['queryOptions'],scope='仅清韵重采为持续单字模式；其余方案沿用上一轮')
evidence['productionFilesSha256']={f:sha(ROOT/f) for f in ['lua/snow/qingyun.lua','lua/snow/qingyun_mode.lua','snow_qingyun.schema.yaml']}
if expanded_path.exists(): evidence['expandedObservationsSha256']=sha(expanded_path)
for stem in ['8000字_十二方案含选重键数','8000字_十二方案最短首选键数']:
    selection='含选重' in stem
    path=REPORTS/stem
    meta=load(path.with_suffix('.json'));rows=list(csv.reader(io.StringIO(read(path.with_suffix('.tsv'))),delimiter='\t'))
    i=next(i for i,s in enumerate(meta['schemes']) if s['id']=='qingyun');scheme=meta['schemes'][i]
    for ext in ['json','tsv','md']:
        dest=backup/(stem+'.'+ext)
        if not dest.exists(): shutil.copyfile(path.with_suffix('.'+ext),dest)
    for r in rows[1:]:
        v=choices[r[1]] if selection else first[r[1]]
        if selection: r[2+i*3:5+i*3]=[v['code'],str(v['keys']),str(int(v['rank']>1))]
        else:r[3+i*2:5+i*2]=[str(v['keys']) if v else 'NA',v['code'] if v else 'NA']
    for n in cohorts:
        dist={};missing=[];total=0;selected=0;weighted=0;freqsum=0
        for r in rows[1:n+1]:
            v=choices[r[1]] if selection else first[r[1]]
            if not v:missing.append(r[1]);continue
            k=v['keys'];dist[str(k)]=dist.get(str(k),0)+1;total+=k
            if selection:selected+=v['rank']>1
            else: weighted+=k*int(r[2]);freqsum+=int(r[2])
        c=dict(count=n,distribution=dist,mean=total/n if not missing else None)
        if selection:c.update(selection=selected,unresolved=missing)
        else:c.update(covered=n-len(missing),missing=missing,coveredMean=total/(n-len(missing)),frequencyWeightedCoveredMean=weighted/freqsum)
        scheme['cohorts'][str(n)]=c
    scheme['evaluationOptions']={'character':True};meta['qingyunCharacterModeEvidence']=evidence
    md=read(path.with_suffix('.md'));parts=re.split(r'(?=## 前 \d+ 字)',md)
    parts[0]+='清韵本轮采用持续「单字」模式（character=true）；其他方案沿用原观测。\n\n'
    for j in range(1,len(parts)):
        n=int(re.search(r'## 前 (\d+) 字',parts[j]).group(1))
        lengths=sorted({int(k) for s in meta['schemes'] for k in s['cohorts'][str(n)]['distribution']})
        cell=lambda v:f'{v}／{v*100/n:.2f}%'
        lines=[f'## 前 {n} 字','']
        if selection:
            lines+=['| 方案 | 均键 | 选重 | '+' | '.join(f'{k}键' for k in lengths)+' |','| --- | '+' | '.join(['---:']*(len(lengths)+2))+' |']
            ordered=sorted(meta['schemes'],key=lambda s:s['cohorts'][str(n)]['mean'] if s['cohorts'][str(n)]['mean'] is not None else float('inf'))
            for s in ordered:
                c=s['cohorts'][str(n)];lines.append('| '+s['name']+' | '+(fmt(c['mean']) if c['mean'] is not None else '待核实')+' | '+cell(c['selection'])+' | '+' | '.join(cell(c['distribution'].get(str(k),0)) for k in lengths)+' |')
        else:
            lines+=['| 方案 | '+' | '.join(f'{k}键' for k in lengths)+' | 未获首选 | 全体均键 | 已覆盖均键 |','| --- | '+' | '.join(['---:']*(len(lengths)+3))+' |']
            for s in meta['schemes']:
                c=s['cohorts'][str(n)];lines.append('| '+s['name']+' | '+' | '.join(cell(c['distribution'].get(str(k),0)) for k in lengths)+' | '+cell(len(c['missing']))+' | '+(fmt(c['mean']) if c['mean'] is not None else '—')+' | '+fmt(c['coveredMean'])+' |')
        parts[j]='\n'.join(lines)+'\n\n'
    path.with_suffix('.md').write_text(''.join(parts).rstrip()+'\n',encoding='utf-8')
    with path.with_suffix('.tsv').open('w',encoding='utf-8',newline='') as f:csv.writer(f,delimiter='\t',lineterminator='\n').writerows(rows)
    if selection:
        txt=REPORTS/'各方案8000字码表/冰雪清韵_8000字_字频序.txt'
        if not (backup/txt.name).exists():shutil.copyfile(txt,backup/txt.name)
        lines=['# 清韵持续单字模式 character=true；全部 8000 字已实测。优先无选重，否则计翻页与选重；最短性限于已枚举路径。','字\t编码\t总键数\t选重\t来源\t字频序\t冻结频次']
        counts={}
        for r in rows[1:]:
            v=choices[r[1]];source='空词典引擎观测' if v['rank']==1 else ('实测候选＋理想选重一键' if v['rank']<=6 else '实测后续页候选＋翻页及选重')
            lines.append('\t'.join([r[1],v['code'],str(v['keys']),str(int(v['rank']>1)),source,r[0],r[-1]]))
        txt.write_text('\n'.join(lines)+'\n',encoding='utf-8')
        for file in (REPORTS/'各方案8000字码表').glob('*.txt'):
            for line in read(file).splitlines()[2:]:
                x=line.split('\t');counts[x[4]]=counts.get(x[4],0)+1
        meta['sourceCounts']=counts
        with path.with_suffix('.csv').open('w',encoding='utf-8-sig',newline='') as f:csv.writer(f).writerows(rows)
        # 更新报告说明中的总实测数量。
        text=read(path.with_suffix('.md'))
        text=re.sub(r'首选实测 \d+ 条，首页选重实测 \d+ 条，后续页选重实测 \d+ 条',f"首选实测 {counts.get('空词典引擎观测',0)} 条，首页选重实测 {counts.get('实测候选＋理想选重一键',0)} 条，后续页选重实测 {counts.get('实测后续页候选＋翻页及选重',0)} 条",text)
        path.with_suffix('.md').write_text(text,encoding='utf-8')
    path.with_suffix('.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Qingyun single-character mode',len([v for v in first.values() if v]),'first;',8000-sum(v is not None for v in first.values()),'selection; mean',sum(v['keys'] for v in choices.values())/8000)
