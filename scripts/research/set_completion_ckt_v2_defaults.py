"""Set the fixed-IVUAO v2 scenario defaults and stable slider geometry."""
from __future__ import annotations

import argparse
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--html', type=Path, required=True)
    args = parser.parse_args()
    source = args.html.read_text(encoding='utf-8')

    def replace(old: str, new: str) -> None:
        nonlocal source
        if source.count(old) != 1:
            raise ValueError(f'Expected one instance ({source.count(old)}): {old[:100]}')
        source = source.replace(old, new, 1)

    replace("bench:'table',tau:'500',firstAuxPenalty:'100',secondAuxPenalty:'150'",
            "bench:'table',tau:'600',firstAuxPenalty:'300',secondAuxPenalty:'300'")
    replace("UX.tau=s.tau??'500';UX.firstAuxPenalty=s.firstAuxPenalty??'100';UX.secondAuxPenalty=s.secondAuxPenalty??'150';",
            "UX.tau=s.tau??'600';UX.firstAuxPenalty=s.firstAuxPenalty??'300';UX.secondAuxPenalty=s.secondAuxPenalty??'300';")
    replace('return Number.isFinite(n)&&n>=0?n:500}', 'return Number.isFinite(n)&&n>=0?n:600}')
    replace('return Number.isFinite(n)&&n>=0?n:100}', 'return Number.isFinite(n)&&n>=0?n:300}')
    replace('return Number.isFinite(n)&&n>=0?n:150}', 'return Number.isFinite(n)&&n>=0?n:300}')
    replace('首键另加默认 100 ms，次键再另加默认 150 ms，一次选重默认 500 ms',
            '首键另加默认 300 ms，次键再另加默认 300 ms，一次选重默认 600 ms')
    replace('.b-tau-inline{display:inline-flex;align-items:center;gap:.55rem;white-space:nowrap;flex-wrap:nowrap}\n'
            '.b-tau-inline input{width:8rem;min-width:6rem;padding:.36rem .5rem;font:inherit}\n'
            '.b-tau-inline .ux-term{white-space:nowrap}',
            '.b-tau-inline{display:grid;grid-template-columns:11.5rem 9rem 5.5rem;align-items:center;gap:.55rem;width:27.1rem;flex:0 0 27.1rem}\n'
            '.b-tau-inline>span{min-width:0;white-space:nowrap}\n'
            '.b-tau-inline input[type="range"]{display:block;box-sizing:border-box;width:9rem;min-width:0;margin:0;padding:0}\n'
            '.b-tau-inline output{display:block;box-sizing:border-box;width:5.5rem;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}\n'
            '@media(max-width:450px){.b-tau-inline{grid-template-columns:minmax(0,1fr) 8rem 5rem;width:100%;flex:0 0 100%}.b-tau-inline input[type="range"]{width:8rem}.b-tau-inline output{width:5rem}}')
    args.html.write_text(source, encoding='utf-8')
    print('Updated defaults and fixed slider geometry:', args.html)


if __name__ == '__main__':
    main()
