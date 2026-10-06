#!/usr/bin/env python3
"""Apply the semantic keyboard palette to the standalone R11 HTML atlas.

The atlas is intentionally ignored by Git; this script keeps the UI changes
reproducible after regenerating the embedded data. It is safe to rerun.
"""

from __future__ import annotations

import argparse
from pathlib import Path

DEFAULT_HTML = Path(r"D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html")


def recolor(html: str) -> str:
    def change(old: str, new: str, *, minimum: int = 1) -> None:
        nonlocal html
        if old == new:
            return
        if html.count(new) >= minimum:
            return
        count = html.count(old)
        if count >= minimum:
            html = html.replace(old, new)
        else:
            raise AssertionError(f"Missing keyboard UI anchor: {old[:100]!r}")

    # Sound-key occupancy is usually both I and R: let that majority recede.
    # Blue is only-I, ochre is only-R, green is auxiliary-only, grey is unused.
    change("baseFill={both:'#f8f6f0',ionly:'#e9eeeb',ronly:'#f0e9df',none:'#ecebe6'}",
           "baseFill={both:'#fbfaf7',ionly:'#e3eef4',ronly:'#f6ebd6',none:ks.auxIndex>=0?'#e4f1e9':'#eeece6'}")
    if "stroke={both:'#82988c',ionly:'#879ba8',ronly:'#ad9979',none:'#b9bab2'}" in html:
        html = html.replace("stroke={both:'#82988c',ionly:'#879ba8',ronly:'#ad9979',none:'#b9bab2'}",
                            "stroke={both:'#b8b7af',ionly:'#7399ad',ronly:'#b39253',none:ks.auxIndex>=0?'#77a08c':'#b9bab2'}")
    change("stroke={both:'#b8b7af',ionly:'#7399ad',ronly:'#b39253',none:ks.auxIndex>=0?'#77a08c':'#b9bab2'}",
           "stroke=rh.length>1?'#9a784e':{both:'#b8b7af',ionly:'#7399ad',ronly:'#b39253',none:ks.auxIndex>=0?'#77a08c':'#b9bab2'}")
    change("base=loads?hp.fill:`url(#${rh.length>1?'nf4-multi':'nf4-'+ks.type})`",
           "base=loads?hp.fill:(ks.type==='both'?'#fbfaf7':ks.type==='none'&&ks.auxIndex>=0?'#e4f1e9':`url(#nf4-${ks.type})`)")
    if "stroke=loads?hp.stroke:{both:'#8d7e90',ionly:'#748ea2',ronly:'#ad8c61',none:'#aaa6a4'}" in html:
        html = html.replace("stroke=loads?hp.stroke:{both:'#8d7e90',ionly:'#748ea2',ronly:'#ad8c61',none:'#aaa6a4'}",
                            "stroke=loads?hp.stroke:{both:'#b8b7af',ionly:'#7399ad',ronly:'#b39253',none:ks.auxIndex>=0?'#77a08c':'#aaa6a4'}")
    change("stroke=loads?hp.stroke:{both:'#b8b7af',ionly:'#7399ad',ronly:'#b39253',none:ks.auxIndex>=0?'#77a08c':'#aaa6a4'}[ks.type]",
           "stroke=loads?hp.stroke:(rh.length>1?'#9a784e':{both:'#b8b7af',ionly:'#7399ad',ronly:'#b39253',none:ks.auxIndex>=0?'#77a08c':'#aaa6a4'}[ks.type])")
    change("${ks.type==='both'?`<rect x=\"${x+4}\"", "${rh.length>1?`<rect x=\"${x+4}\"")
    change(".legkey.both{border:2px solid #82988c}",
           ".legkey.both{border:1.5px solid #b8b7af;background:#fbfaf7}")
    change(".legkey.ionly{border:2px dashed #879ba8;background:#e9eeeb}",
           ".legkey.ionly{border:2px dashed #7399ad;background:#e3eef4}")
    change(".legkey.ronly{border:2px dotted #ae9a79;background:#f0e9df}",
           ".legkey.ronly{border:2px dotted #b39253;background:#f6ebd6}")
    if ".legmulti{width:26px;height:16px;border:3px solid #82988c;border-radius:4px;background:#f8f6f0" in html:
        html = html.replace(".legmulti{width:26px;height:16px;border:3px solid #82988c;border-radius:4px;background:#f8f6f0",
                            ".legmulti{width:26px;height:16px;border:3px solid #9a784e;border-radius:4px;background:#fbfaf7")
    change(".legmulti{width:26px;height:16px;border:3px solid #82988c;border-radius:4px;background:#fbfaf7",
           ".legmulti{width:26px;height:16px;border:3px solid #9a784e;border-radius:4px;background:#fbfaf7")
    change(".auxchip{display:inline-block;padding:1px 6px;border:1px solid #aaa0b2;border-radius:8px;background:#e9e3eb;color:#675c70",
           ".auxchip{display:inline-block;padding:1px 6px;border:1px solid #77a08c;border-radius:8px;background:#e4f1e9;color:#426b59")
    change('fill="#e8e2ea" stroke="#a79cad"', 'fill="#e4f1e9" stroke="#77a08c"')
    change('fill="#eee8f0" stroke="#9d8da5"', 'fill="#e4f1e9" stroke="#77a08c"')
    change('fill="#5f5265"', 'fill="#426b59"', minimum=2)
    change("function nf4HeatPalette(r){return r<=.001?{fill:'#f3f0ea',ink:'#3f4850',stroke:'#b7b0aa'}:r<=.2?{fill:'#e8dfda',ink:'#3f4850',stroke:'#b9a9a6'}:r<=.4?{fill:'#d8cace',ink:'#393b43',stroke:'#aa969d'}:r<=.6?{fill:'#b8aab3',ink:'#302f36',stroke:'#8e7f89'}:r<=.8?{fill:'#746e7b',ink:'#fffdf8',stroke:'#5d5864'}:{fill:'#625f70',ink:'#fffdf8',stroke:'#504e5d'}}",
           "function nf4HeatPalette(r){return r<=.001?{fill:'#f4f3ed',ink:'#394d45',stroke:'#b7b9ae'}:r<=.2?{fill:'#e4eee5',ink:'#394d45',stroke:'#9db8a4'}:r<=.4?{fill:'#c8dfce',ink:'#2d5140',stroke:'#83aa91'}:r<=.6?{fill:'#9fc9ae',ink:'#244735',stroke:'#649c77'}:r<=.8?{fill:'#5e9b73',ink:'#fffdf8',stroke:'#45845d'}:{fill:'#316f4f',ink:'#fffdf8',stroke:'#24583d'}}")
    # The later NF4 stylesheet overrides the earlier legend; keep them aligned.
    change(".legkey.both{border-color:#8d7e90!important;background:repeating-linear-gradient(135deg,#f6f1f4 0,#f6f1f4 5px,#eadfe7 5px,#eadfe7 10px)!important}",
           ".legkey.both{border-color:#b8b7af!important;background:#fbfaf7!important}")
    change(".legkey.ionly{border-color:#768fa3!important;background:repeating-linear-gradient(90deg,#e7edf2 0,#e7edf2 4px,#f4f5f3 4px,#f4f5f3 8px)!important}",
           ".legkey.ionly{border-color:#7399ad!important;background:#e3eef4!important}")
    change(".legkey.ronly{border-color:#ad8c61!important;background:radial-gradient(circle at 3px 3px,#bd9d70 1px,#f3ebdf 1.5px)!important}",
           ".legkey.ronly{border-color:#b39253!important;background:#f6ebd6!important}")
    change(".legkey.none{border-color:#aaa6a4!important;background:repeating-linear-gradient(135deg,#efede9 0,#efede9 5px,#e5e2df 5px,#e5e2df 6px)!important}",
           ".legkey.none{border-color:#aaa6a4!important;background:#eeece6!important}")
    change(".legmulti{border-color:#806f86!important;background:repeating-linear-gradient(45deg,#ded1dc 0,#ded1dc 4px,#f3edf2 4px,#f3edf2 8px)!important}",
           ".legmulti{border-color:#9a784e!important;background:#fbfaf7!important}")
    change('<pattern id="nf4-both" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#f7f2f5"/><path d="M-3 3L3-3M0 12L12 0M9 15L15 9" stroke="#8d7e90" stroke-opacity=".2"/></pattern>',
           '<pattern id="nf4-both" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#fbfaf7"/></pattern>')
    change('<pattern id="nf4-ionly" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#e8eef2"/><path d="M2 0V9M7 0V9" stroke="#748ea2" stroke-opacity=".18"/></pattern>',
           '<pattern id="nf4-ionly" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#e3eef4"/><path d="M2 0V9M7 0V9" stroke="#7399ad" stroke-opacity=".18"/></pattern>')
    change('<pattern id="nf4-ronly" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#f3ebdf"/><circle cx="3" cy="3" r="1.15" fill="#ad8c61" fill-opacity=".3"/></pattern>',
           '<pattern id="nf4-ronly" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#f6ebd6"/><circle cx="3" cy="3" r="1.15" fill="#b39253" fill-opacity=".3"/></pattern>')
    change('<pattern id="nf4-multi" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#eee6ed"/><path d="M-2 2L2-2M0 9L9 0M7 11L11 7" stroke="#806f86" stroke-width="1.6" stroke-opacity=".27"/></pattern>',
           '<pattern id="nf4-multi" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#f8efe2"/><path d="M-2 2L2-2M0 9L9 0M7 11L11 7" stroke="#9a784e" stroke-width="1.6" stroke-opacity=".27"/></pattern>')
    change('stroke-opacity=".38"/>`:\'\'}<g clip-path="url(#${clip})">',
           'stroke-opacity=".38"/>`:\'\'}${k===\'F\'||k===\'J\'?`<rect x="${x+33}" y="${y+124}" width="26" height="4" rx="2" fill="#a05b37"/>`:\'\'}<g clip-path="url(#${clip})">')
    change('}/><text x="${x+10}" y="${y+23}" font-family="sans-serif" font-size="18"',
           '}/>${k===\'F\'||k===\'J\'?`<rect x="${x+33}" y="${y+124}" width="26" height="4" rx="2" fill="#a05b37"/>`:\'\'}<text x="${x+10}" y="${y+23}" font-family="sans-serif" font-size="18"')
    change('<span class="legenditem"><i class="legmulti"></i>粗边框＝多韵键</span>',
           '<span class="legenditem"><i class="legmulti"></i>粗边框＝多韵键</span><span class="legenditem"><span style="color:#a05b37;font-weight:750">F / J</span>键帽底部短横＝定位键</span><span class="legenditem"><i class="legkey" style="background:#e4f1e9;border:2px solid #77a08c"></i>辅键专用</span>')
    assert html.count("k==='F'||k==='J'") == 2
    assert '.legkey.both{border-color:#b8b7af!important;background:#fbfaf7!important}' in html
    return html


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--benchmark', type=Path, default=DEFAULT_HTML)
    args = parser.parse_args()
    path = args.benchmark.resolve()
    before = path.read_text(encoding='utf-8')
    after = recolor(before)
    if after != before:
        path.write_text(after, encoding='utf-8')
    print(f'{path}: palette {"updated" if after != before else "already current"}')


if __name__ == '__main__':
    main()
