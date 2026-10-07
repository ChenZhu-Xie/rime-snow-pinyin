"""Add the fixed-IVUAO CKT v2 column and two penalty sliders to the R11 atlas."""
from __future__ import annotations

import argparse
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--html', type=Path, required=True)
    args = parser.parse_args()
    source = args.html.read_text(encoding='utf-8')

    def once(old: str, new: str):
        nonlocal source
        count = source.count(old)
        if count != 1:
            raise ValueError(f'expected one anchor, got {count}: {old[:90]}')
        source = source.replace(old, new, 1)

    once("bench:'table',tau:'150',locals:", "bench:'table',tau:'1000',auxPenalty:'500',locals:")
    once('tau:UX.tau,detail:UX.detail', 'tau:UX.tau,auxPenalty:UX.auxPenalty,detail:UX.detail')
    once("UX.tau=s.tau||'150';UX.locals", "UX.tau=s.tau||'1000';UX.auxPenalty=s.auxPenalty||'500';UX.locals")
    once('function bCompletionFixedRow(e){return D.completionBFixed?.schemes?.[e.id]?.modes||null}',
         'function bCompletionFixedRow(e){return D.completionBFixed?.schemes?.[e.id]?.modes||null}\n'
         'function bCompletionV2Row(e){return D.completionBV2?.schemes?.[e.id]?.modes||null}')
    once('return Number.isFinite(n)&&n>=0?n:150}', 'return Number.isFinite(n)&&n>=0?n:1000}\n'
         'function bCompletionAuxPenalty(){const n=Number(UX.auxPenalty);return Number.isFinite(n)&&n>=0?n:500}')
    once('function bCompletionMixed(m,mode,tau){',
         "function bCompletionScoreV2(m,tau,aux,reference){if(!m||!reference)return null;let sum=0,total=0;for(const [, ,mode,kind] of B_COMPLETION_TRACKS){const r=m[mode]?.[kind],b=reference[mode]?.[kind],base=kind==='word'?4:2;if(!r||!b)return null;const a=r.completionUpperMs+tau*r.p2+aux*(r.meanKeys-base),c=b.completionUpperMs+tau*b.p2+aux*(b.meanKeys-base);if(!(a>0&&c>0))return null;const weight=kind==='word'?2:1;sum+=weight*(a/c)**4;total+=weight}return 10*(sum/total)**.25}\n"
         'function bCompletionMixed(m,mode,tau){')
    once("help:'bCompositeFixed'},{label:", "help:'bCompositeFixed'},{label:'综合补全 CKT v2 · 固定 IVUAO · 字:词=1:2 · ×10',help:'bCompositeV2'},{label:")
    once("fixedWord2=bCompletionScore(fixedM,tau,2,bCompletionFixedRow({id:'S005'})),scoreTau=",
         "fixedWord2=bCompletionScore(fixedM,tau,2,bCompletionFixedRow({id:'S005'})),v2M=bCompletionV2Row(e),v2Score=bCompletionScoreV2(v2M,tau,bCompletionAuxPenalty(),bCompletionV2Row({id:'S005'})),scoreTau=")
    once('oldS,scoreWord2,fixedWord2,scoreTau];', 'oldS,scoreWord2,fixedWord2,v2Score,scoreTau];')
    once('num(scoreWord2,5),num(fixedWord2,5),num(scoreTau,5),', 'num(scoreWord2,5),num(fixedWord2,5),num(v2Score,5),num(scoreTau,5),')
    lines = source.splitlines(keepends=True)
    count = 0
    for index, line in enumerate(lines):
        if '<input id="uxTau" type="number"' in line:
            start = line.index('<label class="b-tau-inline">')
            end = line.index('</label>', start) + len('</label>')
            line = (line[:start] +
                    '<label class="b-tau-inline"><span>${uxTerm(\'selectioncost\',\'一次选重时间 τ\')}</span><input id="uxTau" type="range" min="0" max="2000" step="10" value="${esc(tau)}" aria-label="一次选重时间，毫秒"><output id="uxTauValue">${esc(tau)} ms</output></label>'
                    '<label class="b-tau-inline"><span>每辅键惩罚</span><input id="uxAuxPenalty" type="range" min="0" max="1000" step="5" value="${esc(bCompletionAuxPenalty())}" aria-label="每次追加 IVUAO 辅键的惩罚，毫秒"><output id="uxAuxValue">${esc(bCompletionAuxPenalty())} ms/键</output></label>'
                    + line[end:])
            lines[index] = line
            count += 1
        elif "const input=$('#uxTau');input.onchange=" in line:
            lines[index] = "  for(const [id,out,key,suffix] of [['uxTau','uxTauValue','tau',' ms'],['uxAuxPenalty','uxAuxValue','auxPenalty',' ms/键']]){const slider=$('#'+id);slider.oninput=()=>{$('#'+out).textContent=slider.value+suffix};slider.onchange=()=>{UX[key]=slider.value;uxRenderFair();uxCommit()}};\n"
            count += 1
    if count != 2:
        raise ValueError(f'expected two slider anchors, got {count}')
    source = ''.join(lines)
    once('τ是一次残余选重的情景耗时；改动输入框并按 Enter 或离开输入框即可重算。',
         'τ 是一次残余选重的情景耗时；α 是每追加一个 IVUAO 辅键的惩罚。移动滑杆并松开后重算。综合补全 CKT v2 使用上游新角色表，其余补全列保留冻结模型。')
    source = source.replace('τ是输入框中的一次选重时间假设', 'τ是滑杆中的一次选重时间假设')
    once("UG.bV7={title:",
         "UG.bCompositeV2={title:'综合补全 CKT v2 · 固定 IVUAO · 字:词=1:2',brief:'上游新段当量表，另加选重和每次追加辅键的惩罚；S005 恒为 10。',detail:'四组路径：键道字、三拼字各权重 1，键道二字词、三拼二字词各权重 2。每组按 S005 在相同两个滑杆值下归一，再取四阶均值。每个实际追加的 IVUAO 辅键都计一次惩罚。非原生四键使用冻结 R11 外推增量；5/6 键沿用冻结长度保护量。',formula:'T_g=新补全CKT_g+τ·p2_g+α·(平均码长−基础码长)；基础码长：字2、词4。C_v2=10·[Σw_g(T_g/T_g(S005))⁴/Σw_g]^(1/4)',direction:'相同滑杆下越低越好',related:['bCompositeFixed','selectioncost'],sources:['cktV2','completionBV2'],controls:['uxTau','uxAuxPenalty']};\nUG.bV7={title:")
    once("'completionB','completionBFixed','audit'", "'completionB','completionBFixed','cktV2','completionBV2','audit'")
    from upgrade_ckt_v2_three_sliders import upgrade
    source = upgrade(source)
    args.html.write_text(source, encoding='utf-8')
    print('Patched CKT v2 UI:', args.html)


if __name__ == '__main__':
    main()
