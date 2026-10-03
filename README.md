# [冰雪拼音](https://input.tansongchen.com)

> 优雅、高效、个性化的中文输入体验

[简体中文](#简体中文) · [English](#english) · [繁體中文](#繁體中文) · [下载 Release](https://github.com/ChenZhu-Xie/rime-snow-pinyin/releases/latest)

<a id="简体中文"></a>
## 简体中文

配方： ℞ **snow-pinyin**

[冰雪拼音](https://input.tansongchen.com)是一系列以普通话拼音为基础的中文输入方案。它们充分利用汉字的字音信息来实现自然优雅的编码；它们使用先进的离散优化技术和顶功技术来设计，使得编码十分高效；它们配备了智能算法，通过学习用户的语言习惯来个性化输入体验。

[冰雪拼音](https://input.tansongchen.com)包括[冰雪四拼](https://input.tansongchen.com/snow4/)、[冰雪三拼](https://input.tansongchen.com/snow3/)、[冰雪双拼](https://input.tansongchen.com/snow2/)、[冰雪一拼](https://input.tansongchen.com/snow1/)和[冰雪键道](https://input.tansongchen.com/snow-jiandao/)输入方案。您可以阅读[冰雪奇缘](https://input.tansongchen.com/snow.html)来概览各个方案，了解它们的设计理念及优缺点。您还可以点击上述各个方案的链接以进一步了解并选择适合您的输入方案。

### 无[飞键](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code)道・神韵 双拼（编码方案）

[冰雪键道](https://input.tansongchen.com/snow-jiandao/)和[冰雪三拼](https://input.tansongchen.com/snow3/)现共用 **无[飞键](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code)道・神韵**，使用 21×21 声韵键域和 5 个互斥辅键 `IVUAO`。

> [!NOTE]
> 由于作者也是[冰雪四拼](https://input.tansongchen.com/snow4/)用户，因此[冰雪三拼](https://input.tansongchen.com/snow3/)的五调辅键按照与[冰雪四拼](https://input.tansongchen.com/snow4/)相近的顺序排列。

本仓库采用的方案全名为 **[`R9-21X21-M40-02`](https://github.com/more-14-different/shuangpin-layout-benchmark)**，下文称 **[神韵 R9](https://github.com/more-14-different/shuangpin-layout-benchmark)**。它来自[双拼布局 Benchmark](https://github.com/more-14-different/shuangpin-layout-benchmark)的离散优化与冻结复核：在 21×21 键域和固定五辅键约束下，兼顾记忆量、击键成本、键位负载与规则一致性，因而被选作神韵的现行声韵布局。

**声韵映射**

[![无飞键道・神韵声韵映射图](docs/shenyun-r9-keyboard.svg)](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code)

**[神韵 R9](https://github.com/more-14-different/shuangpin-layout-benchmark) 日常八场景文稿 纯双拼键频图（含标点）**

![神韵文稿击键热力图](docs/shenyun-r9-keyboard-heat.svg)

双拼热力图基于日常八场景文稿的 2149 次击键。

> [!NOTE]
> 注意：只包含双拼部分，5 辅键未参与评估。

#### 声韵编码规则

普通声母均使用固定首键：

| 声母 | 首键 | 声母 | 首键 | 声母 | 首键 |
| --- | :---: | --- | :---: | --- | :---: |
| b | B | p | P | m | M |
| f | F | d | D | t | T |
| n | N | l | L | g | G |
| k | K | h | H | j | J |
| q | Q | x | X | zh | F |
| ch | W | sh | E | r | R |
| z | Z | c | C | s | S |

零声母完整码如下：

| 前导组 | 首键 | 完整音节编码 |
| --- | :---: | --- |
| ØA | Q | a=QW · ai=QH · an=QL · ang=QM · ao=QZ |
| ØE | Q | e=QS · ei=QX · en=QQ · eng=QN · er=QJ |
| ØO | Q | o=QE · ou=QF |
| ØY | Y | ya=YW · yan=YL · yang=YM · yao=YZ · ye=YS · yi=YK · yin=YG · ying=YD · yo=YE · yong=YP · you=YF · yu=YR · yuan=YE · yue=YY · yun=YQ |
| ØW | J | wa=JW · wai=JH · wan=JL · wang=JM · wei=JX · wen=JQ · weng=JN · wo=JE · wu=JJ |

韵母使用第二键；`v` 表示 `ü`，`ve` 表示 `üe`：

| 第二键 | 韵母 | 第二键 | 韵母 | 第二键 | 韵母 |
| :---: | --- | :---: | --- | :---: | --- |
| W | a | H | ai | L | an / ia |
| M | ang | Z | ao | S | e |
| X | ei | E | o / uan / van | N | eng / iong |
| K | i | P | ian / ong | F | iang / ou |
| C | iao / ua | B | ie | G | in / un |
| D | ing / uang | T | iu / uai | Q | en / vn |
| J | u / er | R | ui / v（ü） | Y | uo / ve（üe） |

- `zh/ch/sh → F/W/E`；零声母载体 `AOE/Y/W → Q/Y/J`。
- `j/q/x` 的 `u/uan/ue/un` 与零声母 YU 系列统一按 `v/van/ve/vn` 编码。
- 三拼声调 `I/V/U/A/O → 一/二/三/四/轻`；键道形码 `A/V/U/I/O → 折/横/撇/竖/点`。
- [神韵 R9](https://github.com/more-14-different/shuangpin-layout-benchmark) 的 [Common399](https://wwwhomes.uni-bielefeld.de/gibbon/Syllables/Mandarin) 全覆盖；实现另按同一规则推导 17 个扩展音节。`hng、m、n、ng、ê` 不编码。

#### [神韵 R9](https://github.com/more-14-different/shuangpin-layout-benchmark) 与 [星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts)、[首道 B04](https://sspai.com/post/108949) 的公平比较

三方案共用 [Common399](https://wwwhomes.uni-bielefeld.de/gibbon/Syllables/Mandarin)、冻结 20 合同、字词/形码数据和模型；[S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 是 21×21 的同键域基线，[B04 首道](https://sspai.com/post/108949)是 26×26 的同环境基线。

| 指标 | [神韵 R9](https://github.com/more-14-different/shuangpin-layout-benchmark) | [原键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://sspai.com/post/108949) | 何为好 |
| --- | ---: | ---: | ---: | --- |
| [M-R2](https://github.com/more-14-different/shuangpin-layout-benchmark) 记忆项[^m-r2] | 40 🥇 | 44 | 51 | 越低越好 |
| 不同二键码（[Common399](https://wwwhomes.uni-bielefeld.de/gibbon/Syllables/Mandarin)）[^common399] | 373 | 372 | 399 🥇 | 越高重码越少 |
| 裸 S2 [CKT](https://github.com/zhanghaozhecn/conditional-keystroke-timing)（ms/项）[^ckt] | 70.1891 🥇 | 82.0288 | 79.8901 | 越低越好 |
| 规则补全 [CKT](https://github.com/zhanghaozhecn/conditional-keystroke-timing)（ms/项）[^ckt] | 82.9727 | 90.2571 | 79.8901 🥇 | 固定五进制补全模型 |
| [系综当量 v5](https://github.com/more-14-different/shuangpin-layout-benchmark)[^ensemble-v5] | 10.3978 🥇 | 11.4790 | 11.0912 | 越低越好 |
| [系综当量 v4](https://github.com/more-14-different/shuangpin-layout-benchmark)[^ensemble-v4] | 10.7422 | 10.8058 | 10.5833 🥇 | 越低越好 |
| [系综当量 v6-CW150](https://github.com/more-14-different/shuangpin-layout-benchmark)[^ensemble-v6] | 9.4958 🥇 | 10.0000 | 9.5896 | 越低越好；排除 S2 |
| [LU-v1r](https://github.com/more-14-different/shuangpin-layout-benchmark)[^lu] | 75.0177 | 78.8976 | 83.1074 🥇 | 越高越一致 |
| S2 同指连击率[^sfb] | 3.35% 🥇 | 11.64% | 11.34% | 越低越好 |
| S2 同键率[^repeat] | 2.87% 🥇 | 5.06% | 4.56% | 越低越好 |
| S2 左右手交替率[^alternation] | 56.22% | 53.84% | 56.33% 🥇 | 非独立速度结论 |
| S2 主键区占比[^home] | 51.93% 🥇 | 49.00% | 36.60% | 越高越集中 |
| 20 合同右小指峰值[^right-pinky] | 5.10% | 2.77% | 1.89% 🥇 | 越低峰值越小 |
| 20 合同最大单指峰值[^max-finger] | 26.17% 🥇 | 29.53% | 29.27% | 越低峰值越小 |
| 日常纯汉字 [MX34](https://macroxue.github.io/shuangpin/eval.html)[^mx34] | 140.6807 🥇 | 134.6090 | 138.6378 | 同文稿越高越好；不含消歧 |
| 默认说明兼容标点 [MX34](https://macroxue.github.io/shuangpin/eval.html)[^mx34] | 145.9180 | 153.6883 | 156.1501 🥇 | 敏感性参考 |

[神韵 R9](https://github.com/more-14-different/shuangpin-layout-benchmark) 的[完整公平对比](reports/shenyun-r9-comparison.md)提供详细指标和分场景结果；[原始 JSON 快照](reports/shenyun-r9-comparison.json)可供机器复核。

[^m-r2]: 在 [Common399](https://wwwhomes.uni-bielefeld.de/gibbon/Syllables/Mandarin) 口径下计数非原键声韵映射及额外分派规则，表示需要记忆的映射／路由项数。来源：[双拼布局 Benchmark](https://github.com/more-14-different/shuangpin-layout-benchmark)。
[^common399]: 399 个共同音节实际得到的不同二键码数量；数量越少，音节重码越多。来源：[双拼布局 Benchmark](https://github.com/more-14-different/shuangpin-layout-benchmark)。
[^ckt]: [CKT](https://github.com/zhanghaozhecn/conditional-keystroke-timing) 按音节或编码项频率加权估算条件击键时间；“裸 S2”只含声韵二键，“规则补全”给重码桶各项追加等长五进制后缀。来源：[双拼布局 Benchmark](https://github.com/more-14-different/shuangpin-layout-benchmark)、[Conditional Keystroke Timing](https://github.com/zhanghaozhecn/conditional-keystroke-timing)。
[^ensemble-v5]: 以 [CKT](https://github.com/zhanghaozhecn/conditional-keystroke-timing) 为唯一计时模型，对冻结的 20 个编码合同相对基线归一化后取四次幂均值的综合分。来源：[双拼布局 Benchmark](https://github.com/more-14-different/shuangpin-layout-benchmark)、[Conditional Keystroke Timing](https://github.com/zhanghaozhecn/conditional-keystroke-timing)。
[^ensemble-v4]: 历史综合分：在冻结 20 合同上等权汇总公开击键当量与几何模型，再取四次幂均值。来源：[双拼布局 Benchmark](https://github.com/more-14-different/shuangpin-layout-benchmark)、[yuhao-assess 当量表](https://github.com/forfudan/yuhao-assess/blob/main/public/settings/equivTable.json)；网站说明：[宇浩输入法·统计指标](https://zhuyuhao.com/yu/docs/statistics.html)。
[^ensemble-v6]: 实验性字词情景分：单字与二字词各半，在 19 个合同的组内 [CKT](https://github.com/zhanghaozhecn/conditional-keystroke-timing) 上加入 `150 ms × 非首选率`，并以 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts)＝10 归一化；不含抽象 S2。来源：[双拼布局 Benchmark](https://github.com/more-14-different/shuangpin-layout-benchmark)、[Conditional Keystroke Timing](https://github.com/zhanghaozhecn/conditional-keystroke-timing)。
[^lu]: 0–100 的规则统一度，综合声韵拆分一致性、韵类规则支持和声母规律性，并取五种拆分模板中的最高分。来源：[双拼布局 Benchmark](https://github.com/more-14-different/shuangpin-layout-benchmark)。
[^sfb]: [Common399](https://wwwhomes.uni-bielefeld.de/gibbon/Syllables/Mandarin) 裸声韵二键由同一手指连续击打的频率加权占比。来源：[双拼布局 Benchmark](https://github.com/more-14-different/shuangpin-layout-benchmark)。
[^repeat]: [Common399](https://wwwhomes.uni-bielefeld.de/gibbon/Syllables/Mandarin) 裸声韵二键落在同一物理键上的频率加权占比。来源：[双拼布局 Benchmark](https://github.com/more-14-different/shuangpin-layout-benchmark)。
[^alternation]: [Common399](https://wwwhomes.uni-bielefeld.de/gibbon/Syllables/Mandarin) 裸声韵二键由左右手交替击打的频率加权占比；它不能单独代表输入速度。来源：[双拼布局 Benchmark](https://github.com/more-14-different/shuangpin-layout-benchmark)。
[^home]: [Common399](https://wwwhomes.uni-bielefeld.de/gibbon/Syllables/Mandarin) 裸声韵击键落在键盘主行的频率加权占比。来源：[双拼布局 Benchmark](https://github.com/more-14-different/shuangpin-layout-benchmark)。
[^right-pinky]: 每个合同先汇总右小指负责的 P、[、]、反斜线、;、'、/ 击键占比，再取 20 个合同中的最高值。来源：[双拼布局 Benchmark](https://github.com/more-14-different/shuangpin-layout-benchmark)。
[^max-finger]: 每个合同先按手指汇总其负责键的击键占比，再取所有手指、所有 20 合同中的最高值。来源：[双拼布局 Benchmark](https://github.com/more-14-different/shuangpin-layout-benchmark)。
[^mx34]: 在 [macroxue](https://macroxue.github.io/shuangpin/eval.html) 原生 30 键移动手模型上扩展 [、]、反斜线、' 四键，按 `200 × 有效输出字符数 ÷ 相对总时间` 评分；两行分别回放日常八场景纯汉字和原站默认说明兼容标点，均不含形辅、空格或选重。来源：[macroxue/shuangpin](https://github.com/macroxue/shuangpin)；在线评测：[双拼方案评测和优化](https://macroxue.github.io/shuangpin/eval.html)。

结论是：相对同键域 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts)，神韵的主要优势是裸 S2 [CKT](https://github.com/zhanghaozhecn/conditional-keystroke-timing)、同指连击、主键区覆盖和日常文稿路径，代价是加权非首选音节、补全额外键、右小指峰值和较低 [LU](https://github.com/more-14-different/shuangpin-layout-benchmark)。相对 [B04](https://sspai.com/post/108949)，神韵以更小键域取得若干裸码和路径优势，但 [B04](https://sspai.com/post/108949) 在零碰撞、补全、部分小指/行区负载与若干综合分上更好。神韵是综合折中前沿，不是全指标支配；模型分数也不等同真人测速。

```powershell
bun scripts/验证神韵双拼.ts "路径/benchmark.html"
bun scripts/生成神韵R9对比.ts "路径/benchmark.html"
bun run --cwd scripts keyboard:extract -- "路径/benchmark.html"
bun scripts/导出神韵热力图.ts "路径/benchmark.html"
```

#### 神韵固顶与二字词简码

固顶表与简码概况：

- `AA` 的 441 个位置由 377 个二码单字和 64 个二简完整覆盖；其中 59 个二简使用天然空码，5 个让极冷音码下沉到第三键。
- 三拼 630 当前为 105 个二码位＋509 个三码位；键道 630 为 105＋525。低质量槽位允许留空，每码只固定一个候选，父子码不重复固定同一词。
- 三拼二字词二、三码候选清单见 [`snow_sanpin.fixed.630.txt`](snow_sanpin.fixed.630.txt)：630 个理论码位中 550 个有合法候选，每码最多列 10 项，供逐级选词复核，不直接替代一码一候选的固顶表。
- [二字词逐级排序结果](reports/sipin-bigram-ranking-research.md)覆盖 133,205 条可编码读音。
- 多字轻声 `de/le` 尾词改走 `;`/`/` 尾字键；已有结构略码、完整码首选或日常收益不足的词不强占固顶位。

```powershell
bun scripts/生成神韵固顶词.ts
bun scripts/生成神韵固顶词.ts --check
bun scripts/生成三拼简词.ts
bun scripts/生成三拼简词.ts --check
bun scripts/验证神韵双拼.ts
```

批量校验覆盖布局快照、421 音节、规则分支、空间数量、编码公式、一码一候选、父子码/词语重复、生成结果时效，以及尾字键和结构略码约束。

### 快捷键

以下只列[冰雪键道](https://input.tansongchen.com/snow-jiandao/)、[冰雪四拼](https://input.tansongchen.com/snow4/)、[冰雪清韵](https://input.tansongchen.com/snow-qingyun/)和[冰雪三拼](https://input.tansongchen.com/snow3/)均可使用的快捷键。

#### 候选选择与翻页

| 功能 | 快捷键 |
| --- | --- |
| 确认当前高亮候选 | `Space` |
| 选择当前页第 2～6 候选 | `2 / 3 / 8 / 9 / 0` |
| 上移/下移一个候选 | `Up` / `Down`，或 `Ctrl+K` / `Ctrl+J` |
| 上移/下移两个候选 | `Ctrl+H` / `Ctrl+L` |
| 下一页 | `Tab`、`Ctrl+V` 或 `Page_Down` |
| 上一页 | `Ctrl+M`、`Alt+V` 或 `Page_Up`；翻页后也可用 `Shift+Tab` |

#### 输入码编辑与定位

| 功能 | 快捷键 |
| --- | --- |
| 光标左移/右移一位 | `Left` / `Right` |
| 光标移到输入码开头/末尾 | `Home` / `End`，或 `Ctrl+A` / `Ctrl+E` |
| 从输入码开头右移两位 | `Ctrl+P`（`Home → Right → Right`） |
| 输入码物理左移/右移一位并在边界循环 | `Ctrl+Y` / `Ctrl+O` |
| 上一个/下一个逻辑字位或音节 | `Ctrl+U` / `Ctrl+I` |
| 定位或推进到第 1～4 字位/输入末尾 | `1 / 4 / 5 / 6 / 7` |
| 撤销最近一次选词，否则删除光标前一个输入码 | `BackSpace` |
| 回退一个音节 | `Ctrl+BackSpace` |
| 删除光标后的输入码 | `Delete` 或 `Ctrl+D` |
| 清空当前输入 | `Escape`、`Ctrl+G` 或 `Ctrl+[` |
| 以词定字：上屏当前多字候选的首字/末字 | `[` / `]` |

#### 上屏方式

| 功能 | 快捷键 |
| --- | --- |
| 上屏原始输入码 | `Enter` |
| 上屏转换后的脚本文本 | `Ctrl+Enter` |
| 上屏当前候选的注释 | `Ctrl+Shift+Enter` |

#### 输入模式与方案开关

| 功能 | 快捷键 |
| --- | --- |
| 切换结束/缓冲 | `Ctrl+.` |
| 切换到下一个输入方案 | `Ctrl+Shift+1` |
| 切换中/西文 | `Ctrl+Shift+2` |
| 切换半角/全角 | `Ctrl+Shift+3` |
| 切换简体/繁体 | `Ctrl+Shift+4` |
| 切换中文/西文标点 | `Ctrl+Shift+5` |

#### 历史、删词与方案固定词

| 功能 | 快捷键 |
| --- | --- |
| 在历史面板选择第 2～6 项 | `Ctrl+2/3/8/9/0` 或 `Alt+2/3/8/9/0` |
| 删除高亮的普通 Rime 用户词 | `Ctrl+Delete` |
| 固定/取消固定当前候选 | `Ctrl+,` |
| 开始手动加词；再次按下完成添加 | `Ctrl+'`；过程中可按 `Escape` 取消 |
| 将已固定候选上移/下移一位 | `Ctrl+[` / `Ctrl+]` |
| 重置当前编码下的方案固定候选 | `Ctrl+\` |

普通 Rime 用户词和方案固定词是两套机制：前者使用 `Ctrl+Delete` 删除；通过 `Ctrl+'` 手动加入的方案固定词，选中后使用 `Ctrl+,` 取消或禁用。静态 YAML 词典中的正式词条不能通过快捷键删除。

### 研究报告与审计资料

[`reports/`](reports/) 集中保存布局评测、固顶证据与功能审计，便于复核正文中的结论：

- [固顶候选语料摘要](reports/fixed-corpus-summary.md)：公开候选来源、独立家族、缺失来源和关注词覆盖情况。
- [神韵与原冰雪键道双拼碰撞对比](reports/shenyun-collision-comparison.md)：按 Top 500～全量比较二字内部、四字内部及跨词长碰撞。
- [神韵 R9 与原键道碰撞解读及双拼设计启发](reports/shenyun-collision-design-notes.md)：解释碰撞数据的取舍、结构原因和布局设计启发。
- [神韵 R9 固顶受约束选优报告](reports/shenyun-fixed-optimization.md)：记录二简、AA 单字、三拼/键道 630 和去冗余约束。
- [神韵 R9 公平对比](reports/shenyun-r9-comparison.md)：与 S005、B04 的完整 Benchmark 指标、分场景结果和边界说明。
- [神韵 R9 公平对比原始 JSON](reports/shenyun-r9-comparison.json)：上述对比的机器可复核数据快照。
- [当前方案快捷键审计与上游对照](reports/shortcut-audit.md)：四个方案的共享、专属及相对上游变化的快捷键。
- [四拼二字词逐级排序对神韵固顶的参考调研](reports/sipin-bigram-ranking-research.md)：以四拼逐级候选名次为键道、三拼固顶提供有限旁证，不把四拼视为 R9 的组成部分。
- [神韵双拼八方案 500 字最短键码实战测评](reports/神韵双拼八方案_500字_最短键码实战测评.txt)：同一篇 500 字赛文下八条冻结或现行回放轨的实际按键比较。

### 关于词库的说明

[冰雪拼音](https://input.tansongchen.com)词库收词范围与[雾凇拼音](https://github.com/iDvel/rime-ice)相同。其特点为：

1. 大词库：与[雾凇拼音](https://github.com/iDvel/rime-ice)共享 180 万词库
2. 持续更新：上游[雾凇拼音](https://github.com/iDvel/rime-ice)更新后，本仓库也会随之更新
3. 单字读音遵循《通用规范汉字字典》规范
4. 词语读音尽可能使用单字已有的读音，便于自动造词。这意味着
    - 不考虑因弱化产生的轻声，如「知识」为 `zhī shí`，不为 `zhī shi`
    - 不考虑连读变调，如「一个」为 `yī gè`，不为 `yí gè`
    - 部分专有名词中的专用音允许例外，例如「冒顿」可以是 `mò dú`

---

<a id="english"></a>
## English

Recipe: ℞ **snow-pinyin**

[Snow Pinyin](https://input.tansongchen.com) is a family of Mandarin-based Chinese input methods. It combines phonetic information, discrete optimization, top-up coding, and adaptive learning for natural, efficient, and personalized input. The family includes [Snow Four-Code](https://input.tansongchen.com/snow4/), [Snow Three-Code](https://input.tansongchen.com/snow3/), [Snow Double Pinyin](https://input.tansongchen.com/snow2/), [Snow One-Code](https://input.tansongchen.com/snow1/), and [Snow KeyTao](https://input.tansongchen.com/snow-jiandao/).

### [Wufei KeyTao・Shenyun](https://input.tansongchen.com/snow-jiandao/) double-pinyin (coding scheme)

[Snow KeyTao](https://input.tansongchen.com/snow-jiandao/) and [Snow Three-Code](https://input.tansongchen.com/snow3/) now share **[Wufei KeyTao・Shenyun](https://input.tansongchen.com/snow-jiandao/)**, using a 21×21 sound-code domain and five disjoint auxiliary keys, `IVUAO`.

> [!NOTE]
> Because the author also uses [Snow Four-Code](https://input.tansongchen.com/snow4/), [Snow Three-Code](https://input.tansongchen.com/snow3/)'s five tone auxiliary keys are arranged in an order similar to [Snow Four-Code](https://input.tansongchen.com/snow4/)'s.

The adopted scheme's full name is **[`R9-21X21-M40-02`](https://github.com/more-14-different/shuangpin-layout-benchmark)**, referred to below as **[Shenyun R9](https://github.com/more-14-different/shuangpin-layout-benchmark)**. It comes from the discrete optimization and frozen review in [Shuangpin Layout Benchmark](https://github.com/more-14-different/shuangpin-layout-benchmark), balancing memory load, keystroke cost, key load, and rule consistency within a 21×21 domain with five fixed auxiliary keys.

**Initial/final mapping**

![Shenyun initial/final mapping](docs/shenyun-r9-keyboard.svg)

**[Shenyun R9](https://github.com/more-14-different/shuangpin-layout-benchmark) daily-document pure-double-pinyin key-frequency map (with punctuation)**

![Shenyun document heat map](docs/shenyun-r9-keyboard-heat.svg)

The double-pinyin heat map contains 2,149 keystrokes from eight daily-use scenarios.

> [!NOTE]
> It covers only the double-pinyin layer; the five auxiliary keys were not evaluated.

#### Coding rules

All ordinary initials have a fixed first key; the exceptions to the letter itself are `zh/ch/sh → F/W/E`. Zero-onset carriers are `AOE/Y/W → Q/Y/J`. Finals are mapped as follows (`v` means `ü`):

| Key | Finals | Key | Finals | Key | Finals |
| :---: | --- | :---: | --- | :---: | --- |
| W | a | H | ai | L | an / ia |
| M | ang | Z | ao | S | e |
| X | ei | E | o / uan / van | N | eng / iong |
| K | i | P | ian / ong | F | iang / ou |
| C | iao / ua | B | ie | G | in / un |
| D | ing / uang | T | iu / uai | Q | en / vn |
| J | u / er | R | ui / v | Y | uo / ve |

The `j/q/x` u-series and the zero-onset YU series normalize to `v/van/ve/vn`. [Three-Code](https://input.tansongchen.com/snow3/) tone keys are `I/V/U/A/O → 1/2/3/4/neutral`; [KeyTao](https://input.tansongchen.com/snow-jiandao/) shape keys are `A/V/U/I/O → bend/horizontal/left-falling/vertical/dot`. [Common399](https://wwwhomes.uni-bielefeld.de/gibbon/Syllables/Mandarin) is fully covered, 17 extension syllables are derived by the same rules, and `hng/m/n/ng/ê` remain unencoded.

#### Fair comparison of [Shenyun R9](https://github.com/more-14-different/shuangpin-layout-benchmark) with [Starry KeyTao S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) and [Shoudao B04](https://sspai.com/post/108949)

The three layouts use the same [Common399](https://wwwhomes.uni-bielefeld.de/gibbon/Syllables/Mandarin) data, frozen 20 contracts, dictionaries, shapes, and models. [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) is the same-domain 21×21 baseline; [B04](https://sspai.com/post/108949) is a 26×26 same-environment baseline.

| Metric | [Shenyun R9](https://github.com/more-14-different/shuangpin-layout-benchmark) | [KeyTao S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [Shoudao B04](https://sspai.com/post/108949) |
| --- | ---: | ---: | ---: |
| [M-R2](https://github.com/more-14-different/shuangpin-layout-benchmark) | 40 🥇 | 44 | 51 |
| Unique [Common399](https://wwwhomes.uni-bielefeld.de/gibbon/Syllables/Mandarin) two-key codes | 373 | 372 | 399 🥇 |
| Bare S2 [CKT](https://github.com/zhanghaozhecn/conditional-keystroke-timing) (ms/item) | 70.1891 🥇 | 82.0288 | 79.8901 |
| Completion-aware [CKT](https://github.com/zhanghaozhecn/conditional-keystroke-timing) | 82.9727 | 90.2571 | 79.8901 🥇 |
| [系综当量 v5](https://github.com/more-14-different/shuangpin-layout-benchmark) | 10.3978 🥇 | 11.4790 | 11.0912 |
| [系综当量 v4](https://github.com/more-14-different/shuangpin-layout-benchmark) | 10.7422 | 10.8058 | 10.5833 🥇 |
| [系综当量 v6-CW150](https://github.com/more-14-different/shuangpin-layout-benchmark) | 9.4958 🥇 | 10.0000 | 9.5896 |
| [LU-v1r](https://github.com/more-14-different/shuangpin-layout-benchmark) | 75.0177 | 78.8976 | 83.1074 🥇 |
| S2 same-finger rate | 3.35% 🥇 | 11.64% | 11.34% |
| S2 home-area share | 51.93% 🥇 | 49.00% | 36.60% |
| 20-contract right-pinky peak | 5.10% | 2.77% | 1.89% 🥇 |
| Daily Han-only [MX34](https://macroxue.github.io/shuangpin/eval.html) | 140.6807 🥇 | 134.6090 | 138.6378 |

The [Shenyun R9](https://github.com/more-14-different/shuangpin-layout-benchmark) [complete comparison](reports/shenyun-r9-comparison.md) provides detailed metrics and per-scenario results. A [raw JSON snapshot](reports/shenyun-r9-comparison.json) is available for machine review.

Against [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts), Shenyun's main wins are bare [CKT](https://github.com/zhanghaozhecn/conditional-keystroke-timing), same-finger rate, home-area coverage, and daily-document paths; its costs include weighted misses, completion keys, right-pinky peaks, and lower [LU](https://github.com/more-14-different/shuangpin-layout-benchmark). Against [B04](https://sspai.com/post/108949) there is no overall dominance: Shenyun gets several bare-code and path benefits in a smaller domain, while [B04](https://sspai.com/post/108949) wins collision freedom, completion, several load measures, and some aggregates. These are model results, not human speed tests.

#### Fixed candidates and staged two-character abbreviations

The current layout produces 64 two-key abbreviations plus 377 two-key characters, 105+509 [Three-Code](https://input.tansongchen.com/snow3/) 630 candidates, and 105+525 [KeyTao](https://input.tansongchen.com/snow-jiandao/) 630 candidates. [`snow_sanpin.fixed.630.txt`](snow_sanpin.fixed.630.txt) separately records up to ten two-character candidates for each populated two- and three-key [Three-Code](https://input.tansongchen.com/snow3/) slot: 550 of 630 theoretical slots are populated. This audit list does not replace the one-candidate-per-code fixed tables.

The [staged bigram ranking study](reports/sipin-bigram-ranking-research.md) also checks 133,205 encodable readings along the real [Four-Code](https://input.tansongchen.com/snow4/) completion path. It found no automatic replacement that both improves multiple stages and remains non-first at full code, so the evidence is retained without forcing extra fixed-candidate changes.

```powershell
bun scripts/生成神韵固顶词.ts --check
bun scripts/生成三拼简词.ts --check
bun scripts/验证神韵双拼.ts
```

### Reports and audits

[`reports/`](reports/) collects reproducible layout measurements, fixed-candidate evidence, and feature audits:

- [Fixed-candidate corpus summary](reports/fixed-corpus-summary.md): public sources, independent families, missing inputs, and coverage of selected words.
- [Shenyun versus original Snow KeyTao collision comparison](reports/shenyun-collision-comparison.md): two-character, four-character, and cross-length collisions from Top 500 through the full corpus.
- [Shenyun R9 collision interpretation and design lessons](reports/shenyun-collision-design-notes.md): tradeoffs, structural causes, and implications for double-pinyin layout design.
- [Shenyun R9 constrained fixed-candidate optimization](reports/shenyun-fixed-optimization.md): two-key abbreviations, AA characters, Three-Code/KeyTao 630 spaces, and redundancy constraints.
- [Complete Shenyun R9 benchmark comparison](reports/shenyun-r9-comparison.md): full metrics and scenario results against S005 and B04, with scope limits.
- [Raw Shenyun R9 comparison JSON](reports/shenyun-r9-comparison.json): machine-reviewable snapshot underlying the comparison.
- [Shortcut audit and upstream comparison](reports/shortcut-audit.md): shared and scheme-specific shortcuts plus local changes from upstream.
- [Four-Code staged bigram ranking study](reports/sipin-bigram-ranking-research.md): limited ranking evidence for KeyTao and Three-Code fixed candidates; Four-Code itself is not part of R9.
- [Eight-scheme 500-character shortest-code replay](reports/神韵双拼八方案_500字_最短键码实战测评.txt): actual keystroke comparison over one shared 500-character text.

### Dictionaries

[Snow Pinyin](https://input.tansongchen.com) follows the vocabulary scope of [Rime Ice](https://github.com/iDvel/rime-ice): roughly 1.8 million shared entries, continuous upstream synchronization, standard single-character readings, and predictable word pronunciations suitable for user-defined words.

---

<a id="繁體中文"></a>
## 繁體中文

配方： ℞ **snow-pinyin**

[冰雪拼音](https://input.tansongchen.com)是一系列以普通話拼音為基礎的中文輸入方案，結合字音資訊、離散最佳化、頂功技術與使用習慣學習，提供自然、高效且個人化的輸入體驗。系列包含[冰雪四拼](https://input.tansongchen.com/snow4/)、[冰雪三拼](https://input.tansongchen.com/snow3/)、[冰雪雙拼](https://input.tansongchen.com/snow2/)、[冰雪一拼](https://input.tansongchen.com/snow1/)及[冰雪鍵道](https://input.tansongchen.com/snow-jiandao/)。

### 無[飛鍵](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code)道・神韻 雙拼（編碼方案）

[冰雪鍵道](https://input.tansongchen.com/snow-jiandao/)與[冰雪三拼](https://input.tansongchen.com/snow3/)現共用 **無[飛鍵](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code)道・神韻**，使用 21×21 聲韻鍵域與 5 個互斥輔鍵 `IVUAO`。

> [!NOTE]
> 由於作者也是[冰雪四拼](https://input.tansongchen.com/snow4/)使用者，因此[冰雪三拼](https://input.tansongchen.com/snow3/)的五調輔鍵按照與[冰雪四拼](https://input.tansongchen.com/snow4/)相近的順序排列。

本倉庫採用的方案全名為 **[`R9-21X21-M40-02`](https://github.com/more-14-different/shuangpin-layout-benchmark)**，下文稱 **[神韻 R9](https://github.com/more-14-different/shuangpin-layout-benchmark)**。它來自[雙拼布局 Benchmark](https://github.com/more-14-different/shuangpin-layout-benchmark)的離散最佳化與凍結複核：在 21×21 鍵域和固定五輔鍵約束下，兼顧記憶量、擊鍵成本、鍵位負載與規則一致性，因而被選作神韻的現行聲韻布局。

**聲韻映射**

[![無飛鍵道・神韻聲韻映射圖](docs/shenyun-r9-keyboard.svg)](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code)

**[神韻 R9](https://github.com/more-14-different/shuangpin-layout-benchmark) 日常八場景文稿 純雙拼鍵頻圖（含標點）**

![神韻文稿擊鍵熱力圖](docs/shenyun-r9-keyboard-heat.svg)

雙拼熱力圖基於日常八場景文稿的 2149 次擊鍵。

> [!NOTE]
> 注意：只包含雙拼部分，5 輔鍵未參與評估。

#### 聲韻規則

普通聲母均使用固定首鍵，`zh/ch/sh → F/W/E`；零聲母載體為 `AOE/Y/W → Q/Y/J`。韻母映射如下（`v` 表示 `ü`）：

| 第二鍵 | 韻母 | 第二鍵 | 韻母 | 第二鍵 | 韻母 |
| :---: | --- | :---: | --- | :---: | --- |
| W | a | H | ai | L | an / ia |
| M | ang | Z | ao | S | e |
| X | ei | E | o / uan / van | N | eng / iong |
| K | i | P | ian / ong | F | iang / ou |
| C | iao / ua | B | ie | G | in / un |
| D | ing / uang | T | iu / uai | Q | en / vn |
| J | u / er | R | ui / v | Y | uo / ve |

`j/q/x` 的 u 系列與零聲母 YU 系列統一成 `v/van/ve/vn`。[三拼](https://input.tansongchen.com/snow3/)聲調鍵為 `I/V/U/A/O → 一/二/三/四/輕`，[鍵道](https://input.tansongchen.com/snow-jiandao/)形碼鍵為 `A/V/U/I/O → 折/橫/撇/豎/點`。[Common399](https://wwwhomes.uni-bielefeld.de/gibbon/Syllables/Mandarin) 全覆蓋，另依同一規則推導 17 個擴充音節；`hng、m、n、ng、ê` 不編碼。

#### [神韻 R9](https://github.com/more-14-different/shuangpin-layout-benchmark) 與 [星空鍵道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts)、[首道 B04](https://sspai.com/post/108949) 的公平比較

三方案共用 [Common399](https://wwwhomes.uni-bielefeld.de/gibbon/Syllables/Mandarin)、凍結 20 合約、詞形資料與模型；[S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 是 21×21 的同鍵域基線，[B04](https://sspai.com/post/108949) 是 26×26 的同環境基線。

| 指標 | [神韻 R9](https://github.com/more-14-different/shuangpin-layout-benchmark) | [原鍵道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://sspai.com/post/108949) |
| --- | ---: | ---: | ---: |
| [M-R2](https://github.com/more-14-different/shuangpin-layout-benchmark) | 40 🥇 | 44 | 51 |
| [Common399](https://wwwhomes.uni-bielefeld.de/gibbon/Syllables/Mandarin) 不同二鍵碼 | 373 | 372 | 399 🥇 |
| 裸 S2 [CKT](https://github.com/zhanghaozhecn/conditional-keystroke-timing)（ms/項） | 70.1891 🥇 | 82.0288 | 79.8901 |
| 補全後 [CKT](https://github.com/zhanghaozhecn/conditional-keystroke-timing) | 82.9727 | 90.2571 | 79.8901 🥇 |
| [系综当量 v5](https://github.com/more-14-different/shuangpin-layout-benchmark) | 10.3978 🥇 | 11.4790 | 11.0912 |
| [系综当量 v4](https://github.com/more-14-different/shuangpin-layout-benchmark) | 10.7422 | 10.8058 | 10.5833 🥇 |
| [系综当量 v6-CW150](https://github.com/more-14-different/shuangpin-layout-benchmark) | 9.4958 🥇 | 10.0000 | 9.5896 |
| [LU-v1r](https://github.com/more-14-different/shuangpin-layout-benchmark) | 75.0177 | 78.8976 | 83.1074 🥇 |
| S2 同指連擊率 | 3.35% 🥇 | 11.64% | 11.34% |
| S2 主鍵區占比 | 51.93% 🥇 | 49.00% | 36.60% |
| 20 合約右小指峰值 | 5.10% | 2.77% | 1.89% 🥇 |
| 日常純漢字 [MX34](https://macroxue.github.io/shuangpin/eval.html) | 140.6807 🥇 | 134.6090 | 138.6378 |

[神韻 R9](https://github.com/more-14-different/shuangpin-layout-benchmark) 的[完整公平對比](reports/shenyun-r9-comparison.md)提供詳細指標與分場景結果；另附[原始 JSON](reports/shenyun-r9-comparison.json)供機器複核。

相對 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts)，神韻的主要優勢是裸 [CKT](https://github.com/zhanghaozhecn/conditional-keystroke-timing)、同指連擊、主鍵區覆蓋與日常文稿路徑；代價是加權非首選、補全鍵、右小指峰值與較低 [LU](https://github.com/more-14-different/shuangpin-layout-benchmark)。相對 [B04](https://sspai.com/post/108949) 並無全指標支配：神韻以較小鍵域取得若干裸碼與路徑優勢，[B04](https://sspai.com/post/108949) 則在零碰撞、補全、部分負載與若干綜合分勝出。這些均是模型值，而非真人測速。

#### 固頂與二字詞逐級簡碼

當前方案生成 64 個二簡與 377 個二碼單字；三拼 630 為 105＋509，鍵道 630 為 105＋525。[`snow_sanpin.fixed.630.txt`](snow_sanpin.fixed.630.txt)另列三拼二字詞二、三碼候選：630 個理論碼位中 550 個有候選，每碼最多 10 項，供逐級複核，不取代「一碼一候選」固頂表。

[二字詞逐級排序結果](reports/sipin-bigram-ranking-research.md)覆蓋 133,205 條可編碼讀音。

```powershell
bun scripts/生成神韵固顶词.ts --check
bun scripts/生成三拼简词.ts --check
bun scripts/验证神韵双拼.ts
```

### 研究報告與稽核資料

[`reports/`](reports/) 集中保存布局評測、固頂證據與功能稽核，方便複核正文結論：

- [固頂候選語料摘要](reports/fixed-corpus-summary.md)：公開候選來源、獨立家族、缺失來源與關注詞覆蓋。
- [神韻與原冰雪鍵道雙拼碰撞對比](reports/shenyun-collision-comparison.md)：按 Top 500 至全量比較二字內部、四字內部及跨詞長碰撞。
- [神韻 R9 與原鍵道碰撞解讀及雙拼設計啟發](reports/shenyun-collision-design-notes.md)：解釋碰撞資料的取捨、結構原因與布局設計啟發。
- [神韻 R9 固頂受約束選優報告](reports/shenyun-fixed-optimization.md)：記錄二簡、AA 單字、三拼/鍵道 630 與去冗餘約束。
- [神韻 R9 公平對比](reports/shenyun-r9-comparison.md)：與 S005、B04 的完整 Benchmark 指標、分場景結果與邊界說明。
- [神韻 R9 公平對比原始 JSON](reports/shenyun-r9-comparison.json)：上述對比的機器可複核資料快照。
- [目前方案快捷鍵稽核與上游對照](reports/shortcut-audit.md)：四個方案的共用、專屬及相對上游變更的快捷鍵。
- [四拼二字詞逐級排序對神韻固頂的參考調研](reports/sipin-bigram-ranking-research.md)：以四拼逐級候選名次為鍵道、三拼固頂提供有限旁證，不把四拼視為 R9 的組成部分。
- [神韻雙拼八方案 500 字最短鍵碼實戰測評](reports/神韵双拼八方案_500字_最短键码实战测评.txt)：同一篇 500 字賽文下八條凍結或現行回放軌的實際按鍵比較。

### 詞庫說明

[冰雪拼音](https://input.tansongchen.com)的收詞範圍與[霧凇拼音](https://github.com/iDvel/rime-ice)相同，包含約 180 萬共享詞條、持續上游同步、規範單字讀音，以及適合自動造詞的穩定詞語讀音。
