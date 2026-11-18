# 冰雪莲道

冰雪莲道（`snow_jiandao_toned`）使用 benchmark 的「CR-LAN-f19a0ad1dc · 带调键道 · 固定兰道声母 · 稳健第一辅序」布局，覆盖旧 MARS10 布局。声调合入双拼第二码，后续只补形笔辅；形辅映射、630、飞花／飞码式四码顶、缓冲造词、大写补韵、反查、候选处理和快捷键沿用冰雪兰道。

## 冻结来源

来源为 `more-14-different/shuangpin-layout-benchmark` 的提交 `82dbcb9b9558f78142615aa5efd6a0b3715c3cd1`。研究布局见 `research/notes/2026-11-17-cr-lan-f19-stability-finalists.json`，页面码表见 `a7_CKT_R11_integrated_materials/cr_lan_f19/CR-LAN-f19a0ad1dc.fixture.json`，发布辅序审计见 `research/notes/2026-11-17-cr-lan-f19-r11-columns.json`。本仓库的冻结映射、来源文件 SHA-256 和独立的 1,407 条带调音节码表保存在 [snow-jiandao-toned-mapping.json](../config/snow-jiandao-toned-mapping.json)，生成与 CI 不依赖外部仓库。

普通声母与冰雪兰道完全一致，包括 `l→E`、`k→P`，`zh/ch/sh→K/S/L`，A 零声母用 R，E/O 零声母用 C，W/Y 载体保持原键。研究记忆口径 lower/guard 为 `24/25`、普通声母位移 D 为 `2`、纯形辅 CKT v5.1 为 `9.107001929844568`。

## 带调布局

四声走上排，二、三声走中排，一声和轻声走下排；第二码已经含调，不追加独立调辅。拼音先还原 `iu/ui/un` 为 `iou/uei/uen`，还原 y/w 的韵母及 j/q/x 的 ü，再按下表取码。

| 韵组 | 所含韵母 | 四声 | 二、三声 | 一声、轻声 |
| --- | --- | --- | --- | --- |
| a | a、ia、ua | R | S | X |
| en/ou | en、uen、ou、iou | E | S | N |
| ing | ing | E | G | M |
| ao/eng/ü | ao、iao、eng、ueng、ü | T | K | C |
| e/ei | e、ie、üe、ei、uei | W | D | M |
| ong/u | ong、iong、u | P | J | M |
| in/ün/o | in、ün、o、io、uo | P | G | B |
| i | i | R | F | B |
| ai/ang | ai、uai、ang、iang、uang | Y | H | Z |
| an/er | an、ian、uan、üan、er | Q | L | N |

例如「冰」`bing1→bm`、「雪」`xue3→xd`、「拼」`pin1→pb`。研究音节表占用 `432/441` 桶，余 9 桶；旧 MARS10 占用 `427/441` 桶，余 14 桶。研究空桶是 `wf/rf/rb/rm/ff/fb/gf/hf/lg`；本仓库运行时忽略频率 0/1 的大字集兜底读音，另可回收 `rg`，共 10 个声声桶。两种口径分别回归，不能把研究空桶数直接当成实际可用桶数。

## 形辅和码长

五辅按「折、横、撇、竖、点」为 `AVUIO`，对应调序 `IVUAO`，保留 `42310` 语义不变；纯形笔辅与冰雪兰道共用 `radical_jiandao.txt` 和拆分词典。

| 词长 | 标准主码 | 形辅顺序 | 标准最长码 |
| --- | --- | --- | --- |
| 单字 | 声韵两码（已含调） | 本字前四辅 | 6 |
| 二字 | 两字各取声韵 | `21`，各取首辅 | 6 |
| 三字 | 三字各取声母 | `213`，各取首辅 | 6 |
| 四字 | 四字各取声母 | `14`，各取首辅 | 6 |

三字及以上的大写补韵沿用冰雪兰道，前三字可以用大写第二码明确音节。例如「输入法」标准码 `lrfuva`（入 u、输 v、法 a），补韵路径为 `lMrPfS`；「人工智能」为 `rgknia`（人 i、能 a）。「冰雪」为 `bmxdvo`（雪 v、冰 o）。单字、二字和声声桶的形辅上限分别为四辅、两辅、四辅；达到上限后继续按形辅不会继续增加编码。

声声空桶的二字词取标准辅序 `21` 的反序 `12`，先连续取第一字两辅，再连续取第二字两辅，总码长最多 6。比如「软饭」逐级为 `rf → rfv → rfva → rfvau → rfvaua`；这条路径不会把辅码当作第二字的带调音节。实际占用的音节和全部 26 个字母入口仍保留原用途。

固顶表按带调音码重算单字、数字和空桶二简词，并完整保留冰雪兰道的 630 表；字母仍为大写第二、小写第三。固定词典数据库改为独立的 `snow_jiandao_toned_cr_lan_f19a0ad1dc`，避免旧 MARS10 的学习编码影响新布局。键位图在空输入中文模式下按 `v` 打开，桌面 SVG 和移动皮肤 PNG 同源生成。

## 生成和验证

在仓库根目录运行：

```powershell
bun scripts/generate-jiandao-toned.ts
bun scripts/align-fixed-with-sipin.ts
bun scripts/generate-keymaps.ts
bun scripts/generate-jiandao-toned.ts --check
bun scripts/check-pinyin-dict.ts
bun test scripts/fixed-corpus/test/jiandao-toned.test.ts scripts/fixed-corpus/test/keymaps.test.ts
```

纯 Lua 回归为 `spec/jiandao-toned-shape.test.lua`，检查真实形辅过滤函数、三个辅序、声声反序和编码导航。真实 Rime 候选测试为 `spec/snow_jiandao_toned.test.yaml`，推送后由 GitHub Actions 在 librime 1.13.1 和 1.17 上验证；不在本机运行 Mira。
