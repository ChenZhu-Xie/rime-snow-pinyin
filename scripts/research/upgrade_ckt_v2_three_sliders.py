"""Upgrade the embedded R11 v2 column to three separate extra-delay sliders."""
from __future__ import annotations
import argparse
from pathlib import Path


def upgrade(source: str) -> str:
    def replace(old: str, new: str) -> None:
        nonlocal source
        if source.count(old) != 1:
            raise ValueError(f'Expected one occurrence ({source.count(old)}): {old[:110]}')
        source = source.replace(old, new, 1)
    replace("tau:'1000',auxPenalty:'500'", "tau:'500',firstAuxPenalty:'100',secondAuxPenalty:'150'")
    replace('tau:UX.tau,auxPenalty:UX.auxPenalty,detail:', 'tau:UX.tau,firstAuxPenalty:UX.firstAuxPenalty,secondAuxPenalty:UX.secondAuxPenalty,detail:')
    replace("UX.tau=s.tau||'1000';UX.auxPenalty=s.auxPenalty||'500';", "UX.tau=s.tau??'500';UX.firstAuxPenalty=s.firstAuxPenalty??'100';UX.secondAuxPenalty=s.secondAuxPenalty??'150';")
    replace('return Number.isFinite(n)&&n>=0?n:1000}', 'return Number.isFinite(n)&&n>=0?n:500}')
    replace('function bCompletionAuxPenalty(){const n=Number(UX.auxPenalty);return Number.isFinite(n)&&n>=0?n:500}',
            'function bCompletionFirstAuxPenalty(){const n=Number(UX.firstAuxPenalty);return Number.isFinite(n)&&n>=0?n:100}\nfunction bCompletionSecondAuxPenalty(){const n=Number(UX.secondAuxPenalty);return Number.isFinite(n)&&n>=0?n:150}')
    start=source.index('function bCompletionScoreV2(')
    end=source.index('\nfunction bCompletionMixed(',start)
    source=source[:start]+'''function bCompletionScoreV2(m,tau,firstAux,secondAux,reference){if(!m||!reference)return null;let sum=0,total=0;for(const [, ,mode,kind] of B_COMPLETION_TRACKS){const r=m[mode]?.[kind],b=reference[mode]?.[kind],base=kind==='word'?4:2;if(!r||!b)return null;const f=1-r.stageWeight[0],bf=1-b.stageWeight[0];const a=r.completionUpperMs+tau*r.p2+firstAux*f+secondAux*(r.meanKeys-base-f),c=b.completionUpperMs+tau*b.p2+firstAux*bf+secondAux*(b.meanKeys-base-bf);if(!(a>0&&c>0))return null;const weight=kind==='word'?2:1;sum+=weight*(a/c)**4;total+=weight}return 10*(sum/total)**.25}'''+source[end:]
    replace('bCompletionScoreV2(v2M,tau,bCompletionAuxPenalty(),bCompletionV2Row', 'bCompletionScoreV2(v2M,tau,bCompletionFirstAuxPenalty(),bCompletionSecondAuxPenalty(),bCompletionV2Row')
    start=source.index("UG.bCompositeV2={")
    end=source.index('\nUG.bV7=',start)
    source=source[:start]+"UG.bCompositeV2={title:'综合补全 CKT v2 · 固定 IVUAO · 字:词=1:2',brief:'上游新段当量表计入每个实际辅键的 CKT，再分别加选重、首辅键、次辅键的额外延迟；S005 恒为 10。',detail:'上游 CKT 含 IVUAO 辅键自身击键时间；首键另加默认 100 ms，次键再另加默认 150 ms，一次选重默认 500 ms。四组路径分别按相同三滑杆值的 S005 归一，字组各权重 1、二字词组各权重 2。5/6 键仍沿用旧长度保护量，非原生符号键保留旧外推增量。',formula:'T_g=新补全CKT_g+τ·p2_g+α₁·(1−首选基础码率)+α₂·(平均码长−基础码长−(1−首选基础码率))；基础码长字2词4。C_v2=10·[Σw_g(T_g/T_g(S005))⁴/Σw_g]^(1/4)',direction:'同三个滑杆值下越低越好',related:['bCompositeFixed','selectioncost'],sources:['cktV2','completionBV2'],controls:['uxTau','uxFirstAuxPenalty','uxSecondAuxPenalty']};"+source[end:]
    import re
    old=re.search(r'<label class="b-tau-inline"><span>每辅键惩罚</span>.*?</label>',source)
    if not old:raise ValueError('missing old auxiliary slider')
    new='''<label class="b-tau-inline"><span>第一个辅键额外延迟</span><input id="uxFirstAuxPenalty" type="range" min="0" max="1000" step="5" value="${esc(bCompletionFirstAuxPenalty())}" aria-label="第一个追加 IVUAO 辅键在模型 CKT 以外增加的毫秒"><output id="uxFirstAuxValue">${esc(bCompletionFirstAuxPenalty())} ms</output></label><label class="b-tau-inline"><span>第二个辅键额外延迟</span><input id="uxSecondAuxPenalty" type="range" min="0" max="1000" step="5" value="${esc(bCompletionSecondAuxPenalty())}" aria-label="第二个追加 IVUAO 辅键在模型 CKT 以外增加的毫秒"><output id="uxSecondAuxValue">${esc(bCompletionSecondAuxPenalty())} ms</output></label>'''
    source=source.replace(old.group(),new,1)
    replace("[['uxTau','uxTauValue','tau',' ms'],['uxAuxPenalty','uxAuxValue','auxPenalty',' ms/键']]", "[['uxTau','uxTauValue','tau',' ms'],['uxFirstAuxPenalty','uxFirstAuxValue','firstAuxPenalty',' ms'],['uxSecondAuxPenalty','uxSecondAuxValue','secondAuxPenalty',' ms']]")
    source=source.replace('τ 是一次残余选重的情景耗时；α 是每追加一个 IVUAO 辅键的惩罚。移动滑杆并松开后重算。', 'τ 为一次选重额外时间；第一个、第二个辅键滑杆分别设定在 IVUAO 自身 CKT 之外叠加的延迟。移动滑杆并松开后重算。')
    return source


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--html',type=Path,required=True)
    a=p.parse_args()
    a.html.write_text(upgrade(a.html.read_text(encoding='utf-8')),encoding='utf-8')
    print('Set three CKT v2 penalty sliders:',a.html)

if __name__=='__main__':main()
