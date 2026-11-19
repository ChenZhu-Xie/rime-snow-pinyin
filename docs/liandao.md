# 冰雪莲道

冰雪莲道（`snow_jiandao_toned`）使用 benchmark 的「CR-REF-7e650f7a4c · 带调键道 · M21 · 默认/加倍综合改良」布局，替换此前的 CR-LAN-f19a0ad1dc 生产布局。声调合入双拼第二码，后续只补形笔辅；形辅映射、630、飞花／飞码式四码顶、缓冲造词、大写补韵、反查、候选处理和快捷键沿用冰雪兰道。

## 冻结来源

来源为 `more-14-different/shuangpin-layout-benchmark` 的提交 `10f8aa35dc57bb1c53495645f4945037ad45f3e0`。以用户指定的 `a7_CKT_R11.html` 内嵌发布记录为准，交叉核对 `a7_CKT_R11_integrated_materials/recent_cr_v52/CR-REF-7e650f7a4c.fixture.json` 和同目录的 `.native.json`。冻结映射、来源文件 SHA-256 和独立的 1,407 条带调音节码表保存在 [snow-jiandao-toned-mapping.json](../config/snow-jiandao-toned-mapping.json)，生成与 CI 不依赖外部仓库。

普通声母除 `k→P`、`s→C` 外保留原键，`zh/ch/sh→E/S/K`；A/E/O 零声母统一用 R，W/Y 载体保持原键。研究记忆口径 lower/guard 为 `21/24`、普通声母位移 D 为 `2`；纯形辅 CKT v5.1 为 `9.127012207314616`，v5.2 为 `9.132009149242153`。页面最终发布辅序为 `21/231/14`；fixture 顶层的 `policy` 是研究基线，生产采用 `publication.wordAuxiliaryPolicy` 和 native 合同中一致的发布辅序。

## 带调布局

四声走上排，二、三声走中排，一声和轻声走下排；第二码已经含调，不追加独立调辅。拼音先还原 `iu/ui/un` 为 `iou/uei/uen`，还原 y/w 的韵母及 j/q/x 的 ü，再按下表取码。

| 韵组 | 所含韵母 | 四声 | 二、三声 | 一声、轻声 |
| --- | --- | --- | --- | --- |
| a | a、ia、ua | R | S | X |
| en/ou | en、uen、ou、iou | E | S | M |
| ing | ing | E | G | Z |
| ao/eng/er/ü | ao、iao、eng、ueng、er、ü | T | L | C |
| e/ei | e、ie、üe、ei、uei | W | D | N |
| in/ün/ong/u | in、ün、ong、iong、u | P | J | N |
| o | o、io、uo | P | G | B |
| i | i | R | F | B |
| ai/ang | ai、uai、ang、iang、uang | Y | H | Z |
| an | an、ian、uan、üan | Q | K | M |

例如「冰」`bing1→bz`、「雪」`xue3→xd`、「拼」`pin1→pn`。研究音节表占用 `433/441` 桶，余 8 桶，为 `fb/ff/gf/hf/kg/rf/sg/wf`；此前 CR-LAN 占用 `432/441` 桶，余 9 桶。实际运行时按 `vacancy.lua` 的整组兜底音节表判空，不能直接用单条读音的频率是否大于 1 替代。新布局的 `kg` 被本地大字集「杓 shuo2」（频率 1）占用，因 `shuo` 并非整组低频兜底音节而保留，实际可用声声桶为 `fb/ff/gf/hf/rf/sg/wf`，共 7 桶；旧布局按相同运行时口径也是 7 桶，为 `fb/ff/gf/hf/rb/rf/wf`。两种口径分别回归，固顶二简词只占真实空桶。

## 形辅和码长

五辅按「折、横、撇、竖、点」为 `AVUIO`，对应调序 `IVUAO`，保留 `42310` 语义不变；纯形笔辅与冰雪兰道共用 `radical_jiandao.txt` 和拆分词典。

| 词长 | 标准主码 | 形辅顺序 | 标准最长码 |
| --- | --- | --- | --- |
| 单字 | 声韵两码（已含调） | 本字前四辅 | 6 |
| 二字 | 两字各取声韵 | `21`，各取首辅 | 6 |
| 三字 | 三字各取声母 | `231`，各取首辅 | 6 |
| 四字 | 四字各取声母 | `14`，各取首辅 | 6 |

三字及以上的大写补韵沿用冰雪兰道，前三字可以用大写第二码明确音节。例如「输入法」标准码 `krfuav`（入 u、法 a、输 v），补韵路径为 `kNrPfS`；「人工智能」为 `rgenia`（人 i、能 a）。「冰雪」为 `bzxdvo`（雪 v、冰 o）。单字、二字和声声桶的形辅上限分别为四辅、两辅、四辅；达到上限后继续按形辅不会继续增加编码。

声声空桶的二字词取标准辅序 `21` 的反序 `12`，先连续取第一字两辅，再连续取第二字两辅，总码长最多 6。比如「软饭」逐级为 `rf → rfv → rfva → rfvau → rfvaua`；这条路径不会把辅码当作第二字的带调音节。实际占用的音节和全部 26 个字母入口仍保留原用途。

固顶表按带调音码重算单字、数字和空桶二简词，并按新声母重映射冰雪兰道全部 630 简词；新旧 630 均保留全部 630 个词，新布局合为 601 个码位，其中 29 个同码槽按原表顺序保留候选；字母仍为大写第二、小写第三。固定词典数据库改为独立的 `snow_jiandao_toned_cr_ref_7e650f7a4c`，避免旧布局的学习编码影响新布局。键位图在空输入中文模式下按 `v` 打开，桌面 SVG 和移动皮肤 PNG 同源生成。

候选处理保留冰雪兰道的首选后置：目标已在较短码的首选时应直接上屏，继续补辅可能把新候选提到前面。「拼」与「哭」现在同为 `pn`，固顶依照冰雪四拼的优先级保留「哭」首选；字母 O/o 仍占 `xd` 第二、三位。干净部署的 `bzxd` 首选为「冰雪」，继续补到 `bzxdvo` 后首选为「冰鞋」、「冰雪」排第二；「软饭」的声声路径仍为 `rfvaua`，首选为「软风」、「软饭」排第二。真实候选次序由隔离部署的 Actions 回归验证。

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

纯 Lua 回归为 `spec/jiandao-toned-shape.test.lua`，检查真实形辅过滤函数、三个辅序、声声反序和编码导航。真实 Rime 候选测试为 `spec/snow_jiandao_toned.test.yaml`，推送后由 GitHub Actions 在 librime 1.13.1 和 1.17 上验证；性能门禁另测单字、二三四字词、声声四辅、退格和反查，统一使用至少 200 轮的延迟预算。不在本机运行 Mira。
