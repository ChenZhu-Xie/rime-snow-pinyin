# 神韵两代布局与 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts)、[B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 四方案比较

方案来源：[神韵(Overall-17) 21×26 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md)出自 `production/ckt-v4-2126-strict-d0-20261030` 分支的提交 `7a7e154`；[无飞键道(U357) 21×21 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md)出自 `production/ckt-v4-2121-strict-avuio-20261024` 分支的提交 `11713b6`。方案名分别链接到对应固定提交的最终报告，报告记录了搜索过程、候选取舍和定稿映射。

本文把两个现行专有名词置于同等地位：**[无飞键道(U357) 21×21 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md)**与**[神韵(Overall-17) 21×26 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md)**。另以[星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts)、[首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 为参照。四方案共用 [Common399](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md)、冻结 20 合同、同一字词与形码数据、[CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 模型及日常八场景文稿。

必须同时注意合同边界：[无飞键道(U357)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md)与 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 按传统 21×21 合同计分；[神韵(Overall-17)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md)原生遵循[飞花式四码顶](https://input.tansongchen.com/snow-feihua/basic.html)；[B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 采用原资料记录的 `AEUIO` 形辅与 `IEUAO` 调辅，本报告为其套用同一[飞花式四码顶](https://input.tansongchen.com/snow-feihua/basic.html)路由和统一字形／笔画源。21×26／26×26 相比 21×21 扩大了韵码域，不能把跨键域领先直接解释成同键域映射胜负。

表中在[神韵(Overall-17)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md)、[无飞键道(U357)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md)与原键道 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 三个方案间拉通排名：第 1 名数值加粗并标 ★★，第 2 名数值加粗并标 ★，第 3 名不加粗、不标星；[首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 不参与三方案名次。🥇 独立比较全部四方案，可以与星标同时出现在同一单元格。并列采用竞赛排名，例如并列第 1 名后的下一名为第 3 名；并列单元格使用相同格式。

## 总览

| 指标 | [神韵(Overall-17) 21×26 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md) | [无飞键道(U357) 21×21 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md) | [星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) | 何为好 |
| --- | --- | --- | --- | --- | --- |
| [M-R2](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 记忆项 | **36.000000** ★★ 🥇 | **40.000000** ★ | 44.000000 | 51.000000 | 越低越好 |
| 全声母／字母声母／传统声母／韵母乱序度 A/I/D/V | **5 / 2 / 1 / 1** ★★ | 4 / 1 / 0 / 5 | **3 / 0 / 0 / 4** ★ | 1 / 0 / 0 / 0 🥇 | A、I 为诊断；仍按 D+V 越低越好 |
| 飞键成分（声母／零声母组／韵母） | **0 / 0 / 0** ★★ 🥇 | **0 / 0 / 0** ★★ 🥇 | 2 / 0 / 1 | 0 / 1 / 7 | 越少越好 |
| [FA-1](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 逻辑审计 | **98.298315** ★★ | **98.298315** ★★ | 97.708694 | 99.763391 🥇 | 越高越一致 |
| [LU-v1r](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 逻辑均匀度 | **81.043390** ★★ | 73.529803 | **78.897555** ★ | 83.107434 🥇 | 越高越统一 |
| [Common399](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 唯一码 | **399** ★★ 🥇 | 357 | **372** ★ | 399 🥇 | 越高越少重码 |
| 频率加权 S2 miss | **0.000%** ★★ 🥇 | 3.270% | **0.929%** ★ | 0.000% 🥇 | 越低越好 |
| S2 补全平均码长 | **2.0000** ★★ 🥇 | 2.1474 | **2.0725** ★ | 2.0000 🥇 | 越低越好 |
| S2 补全中心时间（ms） | **75.672** ★★ 🥇 | **89.917** ★ | 90.257 | 79.890 | 越低越好 |
| S2 异键同指率 | **9.252%** ★ | **4.255%** ★★ 🥇 | 11.638% | 11.343% | 越低越好 |
| 综合补全 [CKT v3](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) | **9.630039** ★★ | **9.782135** ★ | 10.000000 | 9.461105 🥇 | 越低越好；历史情景 |
| 综合补全 [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) | **9.185254** ★★ | **9.716421** ★ | 10.000000 | 9.184607 🥇 | 越低越好；现行主指标 |
| 综合补全 CKT v5 | **9.195026** ★★ 🥇 | **9.715587** ★ | 10.000000 | 9.195422 | 越低越好；六候选页与方案专属辅序 |
| 综合补全 CKT v5.1 | **9.204752** ★★ | **9.717167** ★ | 9.999357 | 9.202834 🥇 | 越低越好；原生路由最长六码 |
| [A7E-v3](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 系综当量 | **10.620559** ★★ | **10.737188** ★ | 10.740028 | 10.519452 🥇 | 越低越好；冻结历史轴 |
| [A7E-v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 系综当量 | **10.684702** ★★ | **10.804598** ★ | 10.805830 | 10.583290 🥇 | 越低越好；冻结历史轴 |
| [A7E-v5](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 系综当量 | **10.821925** ★ | **10.473306** ★★ 🥇 | 11.478960 | 11.091225 | 越低越好；CKT-only |
| [A7E-v6-CW150](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) | **9.534119** ★ | **9.512904** ★★ 🥇 | 10.000000 | 9.589632 | 越低越好；情景指标 |
| 八轨综合选重率 | **0.609%** ★★ | **1.443%** ★ | 1.532% | 0.572% 🥇 | 越低越好 |
| 八轨第一辅键率 | **20.831%** ★★ | **26.150%** ★ | 26.413% | 19.746% 🥇 | 越低越好 |
| 八轨第二辅键率 | **4.459%** ★★ | **7.040%** ★ | 7.201% | 4.158% 🥇 | 越低越好 |
| 日常同手率 | **45.882%** ★★ | 46.533% | **45.882%** ★★ | 45.416% 🥇 | 越低越好；非独立速度结论 |
| 日常平均有效距离 | 0.7118 | **0.6555** ★★ 🥇 | **0.6796** ★ | 0.7012 | 越低越好 |
| 20 合同 QAZ 左小指组峰值 | 18.895% | **16.312%** ★★ 🥇 | **17.160%** ★ | 16.661% | 越低越好 |
| 20 合同 P 区右小指组峰值 | **3.516%** ★ | 5.104% | **2.774%** ★★ | 1.888% 🥇 | 越低越好 |
| 20 合同最大单指峰值 | **27.671%** ★ | **25.215%** ★★ 🥇 | 29.531% | 29.271% | 越低越好 |
| S2 主键区占比 | 37.025% | **52.031%** ★★ 🥇 | **49.001%** ★ | 36.600% | 越高越好 |
| 20 合同 TYB 双食指组峰值 | **12.422%** ★★ | **14.092%** ★ | 14.733% | 12.358% 🥇 | 越低越好 |
| 20 合同主键区下限 | 24.733% | **37.620%** ★★ 🥇 | **30.815%** ★ | 24.243% | 越高越好 |
| 日常纯双拼移动手分数（含标点） | 132.219 | **143.380** ★★ 🥇 | **138.672** ★ | 135.310 | 越高越好 |

“全声母／字母声母／传统声母／韵母乱序度 A/I/D/V”保留 benchmark 的 D/V 原义，并只追加两个诊断视角：D 统计 18 个传统单字母声母的可用键集不再恰好等于同名原键的数量；I 在 D 之外计入 W/Y 两个零声母族；A 再计入 A/E/O 三个零声母族；V 对基础韵母 `a/e/i/o/u` 使用同一口径。因此保留原键同时增加飞键仍计乱序，例如 [B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 的 E→E/U 使 A 增加 1。M 已逐条包含这些非直映映射与路由成本，故不随新增视角修正；历史排名仍按 D+V，A/I 不参与排名。乱序与按实际二键码统计的飞键仍是两个不同指标。

“S2 异键同指率”统计 S2 相邻键对中“两键不同、但由同一物理手指负责”的码内与边界频率权重，再除以全部键对权重；同键重复另计，不包含在此项中。

CKT v5 使用 6 项候选页；[神韵(Overall-17)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md)的冰雪简道／冰雪散拼辅序为 `12/21/42`、`12/21/13`，[无飞键道(U357)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md)的冰雪健道／冰雪弎拼辅序为 `12/23/24`、`12/21/23`，[S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 固定为 `12/21/24`、`12/21/23`。[首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 按原生 `AEUIO` 形辅、`IEUAO` 调辅与五项认知系数 0%～500% 独立扰动网格，对 144 套完整规则按平均名次取稳健综合第一，形辅／调辅分别为 `12/12/23`、`21/12/23`。每段两位数字表示 CKT v5 优化并计分的前两辅；运行时冰雪健道、冰雪弎拼的三字词会按剩余字位补第三辅，四字词最多两辅。CKT v5 在第二辅后直接按选重计费，因此不含三字词第三辅的成本与消歧收益。

CKT v5.1 保留各布局的原生主码路由，并把二／三／四字词的最长总码长统一为 6：二／四字词均为 4 主码＋2 辅码；传统 21×21 的三字词由 `AAA+BB` 补为 `AAA+BBB`，[神韵(Overall-17)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md)与[首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 的四码顶三字词继续使用既有 `AAAU+BB`，不改变其编码。第一、第二、第三辅键与选重决策、候选扫描、翻页六项系数分别在 0%～500%、步长 50% 上独立扰动，共 `11⁶=1,771,561` 点；每个成员在 144 套完整规则中按最低平均名次取稳健第一。四布局的形／调稳健辅序依次为：[神韵(Overall-17)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md) `12/21/14`、`12/21/13`；[无飞键道(U357)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md) `12/231/24`、`12/213/23`；[S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) `12/231/24`、`12/213/23`；[首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) `12/12/23`、`21/12/23`。神韵与首道沿用 CKT v5 辅序时各轨绝对成本完全不变；其 CKT v5.1 归一分仍会因 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 三字词补入第三辅而变化。

四方案的飞键成分（声母／零声母组／韵母）依次为：[神韵(Overall-17) 21×26 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md) **0 / 0 / 0** ★★ 🥇、[无飞键道(U357) 21×21 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md) **0 / 0 / 0** ★★ 🥇、[星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 2 / 0 / 1、[首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 0 / 1 / 7。飞键按 [Common399](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 实际二键码统计；不同成分共用一键或成分整体移位不计飞键。

## [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 成本分解

[CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 按单字、二字、三字、四字词权重 `1:3:1:1`，冰雪健道与冰雪弎拼等权，以 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts)＝10 做四次幂聚合。第一／第二辅键各按 300 ms；非首选固定决策 600 ms，每排除一个更高候选 50 ms，每跨 9 个候选翻页 300 ms。

| 方案 | 运动（ms） | 第一辅键（ms） | 第二辅键（ms） | 固定选重决策（ms） | 候选扫描（ms） | 翻页（ms） | 线性总计（ms） |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [神韵(Overall-17) 21×26 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md) | **345.236** ★★ 🥇 | **62.492** ★★ | **13.378** ★★ | **3.655** ★★ | **0.386** ★★ | **0.0002** ★★ 🥇 | **425.148** ★★ |
| [无飞键道(U357) 21×21 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md) | **348.003** ★ | **78.450** ★ | **21.121** ★ | **8.660** ★ | **1.138** ★ | 0.0167 | **457.389** ★ |
| [星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | 359.225 | 79.240 | 21.604 | 9.192 | 1.234 | **0.0165** ★ | 470.511 |
| [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) | 345.472 | 59.239 🥇 | 12.474 🥇 | 3.429 🥇 | 0.364 🥇 | 0.0003 | 420.978 🥇 |

线性总计只用于解释成本来源，正式 [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 仍按八条轨的四次幂聚合。

| [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 情景 | [神韵(Overall-17) 21×26 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md) | [无飞键道(U357) 21×21 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md) | [星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) |
| --- | --- | --- | --- | --- |
| 仅运动时间 | **9.576826** ★★ | **9.634568** ★ | 10.000000 | 9.573778 🥇 |
| 运动＋两级辅键，不计选重／扫描／翻页 | **9.227535** ★★ | **9.718997** ★ | 10.000000 | 9.219064 🥇 |
| 完整默认情景，但翻页为 0 ms | **9.185356** ★★ | **9.716408** ★ | 10.000000 | 9.184685 🥇 |
| 完整默认 [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) | **9.185254** ★★ | **9.716421** ★ | 10.000000 | 9.184607 🥇 |

## 冻结语料加权非首选率

| 编码轨 | 词长 | [神韵(Overall-17) 21×26 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md) | [无飞键道(U357) 21×21 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md) | [星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) |
| --- | --- | --- | --- | --- | --- |
| 冰雪健道 | 单字 | **0.443%** ★★ 🥇 | 0.489% | **0.480%** ★ | 0.443% 🥇 |
| 冰雪健道 | 二字词 | **0.412%** ★ | 0.440% | **0.374%** ★★ 🥇 | 0.413% |
| 冰雪健道 | 三字词 | **0.809%** ★★ | **4.948%** ★ | 5.498% | 0.729% 🥇 |
| 冰雪健道 | 四字词 | **0.421%** ★ | **0.366%** ★★ 🥇 | 0.499% | 0.383% |
| 冰雪弎拼 | 单字 | **0.702%** ★★ 🥇 | 0.786% | **0.774%** ★ | 0.702% 🥇 |
| 冰雪弎拼 | 二字词 | **0.582%** ★ | 0.632% | **0.564%** ★★ 🥇 | 0.587% |
| 冰雪弎拼 | 三字词 | **1.321%** ★★ | **6.948%** ★ | 7.610% | 1.090% 🥇 |
| 冰雪弎拼 | 四字词 | **0.631%** ★ | **0.565%** ★★ | 0.708% | 0.512% 🥇 |

## 逐级辅键后的频率加权残余非首选率

“零辅后”是裸编码后仍需第一辅键的权重；“一辅后”是第一辅键后仍需第二辅键的权重；“二辅后”是第二辅键后仍需人工选重的权重。

| 编码轨 | 词长 | 阶段 | [神韵(Overall-17) 21×26 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md) | [无飞键道(U357) 21×21 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md) | [星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) |
| --- | --- | --- | --- | --- | --- | --- |
| 冰雪健道 | 单字 | 零辅后 | **20.851%** ★★ 🥇 | **21.960%** ★ | 22.061% | 20.851% 🥇 |
| 冰雪健道 | 单字 | 一辅后 | **4.097%** ★★ 🥇 | 4.653% | **4.567%** ★ | 4.097% 🥇 |
| 冰雪健道 | 单字 | 二辅后 | **0.443%** ★★ 🥇 | 0.489% | **0.480%** ★ | 0.443% 🥇 |
| 冰雪健道 | 二字词 | 零辅后 | **18.490%** ★★ 🥇 | 20.066% | **18.927%** ★ | 18.533% |
| 冰雪健道 | 二字词 | 一辅后 | **3.640%** ★ | 3.795% | **3.474%** ★★ 🥇 | 3.639% |
| 冰雪健道 | 二字词 | 二辅后 | **0.412%** ★ | 0.440% | **0.374%** ★★ 🥇 | 0.413% |
| 冰雪健道 | 三字词 | 零辅后 | **24.456%** ★★ | **50.365%** ★ | 51.729% | 21.566% 🥇 |
| 冰雪健道 | 三字词 | 一辅后 | **6.167%** ★★ | **19.783%** ★ | 21.108% | 5.251% 🥇 |
| 冰雪健道 | 三字词 | 二辅后 | **0.809%** ★★ | **4.948%** ★ | 5.498% | 0.729% 🥇 |
| 冰雪健道 | 四字词 | 零辅后 | **24.132%** ★★ | **24.301%** ★ | 27.835% | 20.385% 🥇 |
| 冰雪健道 | 四字词 | 一辅后 | **3.962%** ★ | **3.822%** ★★ | 4.562% | 3.263% 🥇 |
| 冰雪健道 | 四字词 | 二辅后 | **0.421%** ★ | **0.366%** ★★ 🥇 | 0.499% | 0.383% |
| 冰雪弎拼 | 单字 | 零辅后 | **21.001%** ★★ 🥇 | **22.111%** ★ | 22.208% | 21.001% 🥇 |
| 冰雪弎拼 | 单字 | 一辅后 | **4.748%** ★★ 🥇 | 5.379% | **5.062%** ★ | 4.748% 🥇 |
| 冰雪弎拼 | 单字 | 二辅后 | **0.702%** ★★ 🥇 | 0.786% | **0.774%** ★ | 0.702% 🥇 |
| 冰雪弎拼 | 二字词 | 零辅后 | **18.490%** ★★ 🥇 | 20.066% | **18.927%** ★ | 18.533% |
| 冰雪弎拼 | 二字词 | 一辅后 | **3.960%** ★ | 4.275% | **3.916%** ★★ 🥇 | 3.961% |
| 冰雪弎拼 | 二字词 | 二辅后 | **0.582%** ★ | 0.632% | **0.564%** ★★ 🥇 | 0.587% |
| 冰雪弎拼 | 三字词 | 零辅后 | **24.456%** ★★ | **50.365%** ★ | 51.729% | 21.566% 🥇 |
| 冰雪弎拼 | 三字词 | 一辅后 | **7.044%** ★★ | **22.103%** ★ | 23.400% | 5.996% 🥇 |
| 冰雪弎拼 | 三字词 | 二辅后 | **1.321%** ★★ | **6.948%** ★ | 7.610% | 1.090% 🥇 |
| 冰雪弎拼 | 四字词 | 零辅后 | **24.132%** ★★ | **24.301%** ★ | 27.835% | 20.385% 🥇 |
| 冰雪弎拼 | 四字词 | 一辅后 | **4.692%** ★ | **4.535%** ★★ | 5.545% | 3.739% 🥇 |
| 冰雪弎拼 | 四字词 | 二辅后 | **0.631%** ★ | **0.565%** ★★ | 0.708% | 0.512% 🥇 |

## 二／三／四字词的终局碰撞桶

单元格依次为“碰撞桶数／残余条目数／跨词长桶数／最大桶成员数”。不同合同的共享池结构不同，复合单元格不标单一胜负。

| 编码轨 | 词长 | [神韵(Overall-17) 21×26 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md) | [无飞键道(U357) 21×21 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md) | [星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) |
| --- | --- | --- | --- | --- | --- |
| 冰雪健道 | 二字词 | 3352／4000／735／7 | 3499／4298／404／8 | 3063／3671／411／8 | 3314／3965／714／9 |
| 冰雪健道 | 三字词 | 2157／2713／630／8 | 8070／13632／0／25 | 8806／15424／0／15 | 1873／2295／740／9 |
| 冰雪健道 | 四字词 | 1200／1482／354／8 | 950／1159／320／13 | 1158／1473／340／8 | 962／1143／482／8 |
| 冰雪弎拼 | 二字词 | 4806／6147／1036／9 | 5126／6741／712／9 | 4641／5968／746／9 | 4903／6278／1151／10 |
| 冰雪弎拼 | 三字词 | 3060／4272／969／10 | 9642／18936／0／21 | 9925／20476／0／21 | 2640／3491／1095／11 |
| 冰雪弎拼 | 四字词 | 1690／2083／586／9 | 1412／1721／545／9 | 1711／2096／547／10 | 1263／1466／683／11 |

## 边界与结论

- [神韵(Overall-17)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md)以 21×26 声韵域实现 [Common399](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 399 个唯一码、[M-R2](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md)＝36，并采用[飞花式四码顶](https://input.tansongchen.com/snow-feihua/basic.html)；它在现行 [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 中与 [B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 接近，同时保持零飞键，但日常文稿移动手分数及主键区指标不如[无飞键道(U357)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md)。
- [无飞键道(U357)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md)在 21×21 键域中保留 42 个音节重码桶，换来更高的日常纯双拼移动手分数、较高主键区占比和较低最大单指峰值；它与 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 才是直接的同键域比较。
- [B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 的 26×26 大码域、原资料记录的辅键映射以及本报告套用的[飞花式四码顶](https://input.tansongchen.com/snow-feihua/basic.html)路由带来零音节重码及较低补全成本；这不是 [B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 原方案的顶功声明，其飞键、记忆项和日常路径指标也采用另一种取舍。
- 所有模型分数都用于同语料、同模型横向复算，不等同真人输入速度。

机器可复核数据见 [`shenyun-comparison.json`](shenyun-comparison.json)。[神韵(Overall-17)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md)的底层方案 ID 为 `SNOW-SHENYUN-21X26-PRODUCTION`。两代方案的来源、得来过程与定稿映射以上述固定提交报告为准。

## 次世代布局追加对比

上面的历史四方案报告原样保留。本节追加当前 D3/V1 21×26 与 QZ-e8f37a 21×21，并把已经冻结的 Overall-17 与 U357 明确标为“·初代”。以下所有表格统一比较 D3/V1、QZ-e8f37a、Overall-17·初代、U357·初代、原键道 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 与[首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 六个方案；[S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 同时继续充当 CKT 归一化锚点。

表中在 D3/V1、QZ-e8f37a、Overall-17·初代、U357·初代与原键道 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 五个方案间拉通排名：第 1 名数值加粗并标 ★★，第 2 名数值加粗并标 ★，其余名次不加粗、不标星；[首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 不参与五方案名次。🥇 独立比较全部六方案，可以与星标同时出现在同一单元格。并列采用竞赛排名，例如并列第 1 名后的下一名为第 3 名；并列单元格使用相同格式。

D3/V1 的定稿与稳健辅序见 [`2026-11-09-d3v1-ckt-v51-soft-balance-aux-order-robustness.md`](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/research/notes/2026-11-09-d3v1-ckt-v51-soft-balance-aux-order-robustness.md)，QZ-e8f37a 的定稿与稳健辅序见 [`2026-11-09-e8f37a-ckt-v51-aux-order-robustness.md`](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/research/notes/2026-11-09-e8f37a-ckt-v51-aux-order-robustness.md)。D3/V1 的冰雪简道／冰雪散拼辅序为 `12/12/24`、`12/21/13`；QZ-e8f37a 的冰雪健道／冰雪弎拼辅序为 `12/213/24`、`12/213/23`。初代方案继续使用历史报告中冻结的映射与辅序。

| 指标 | D3/V1 21×26 | QZ-e8f37a 21×21 | Overall-17·初代 21×26 | U357·初代 21×21 | 原键道 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) | 何为好 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M-R2 记忆项 | **40.000000** ★ | 42.000000 | **36.000000** ★★ 🥇 | **40.000000** ★ | 44.000000 | 51.000000 | 越低越好 |
| 全声母／字母声母／传统声母／韵母乱序度 A/I/D/V | **8 / 5 / 3 / 1** ★ | 5 / 2 / 2 / 5 | **5 / 2 / 1 / 1** ★★ | 4 / 1 / 0 / 5 | **3 / 0 / 0 / 4** ★ | 1 / 0 / 0 / 0 🥇 | A、I 为诊断；仍按 D+V 越低越好 |
| 飞键成分（声母／零声母组／韵母） | **0 / 0 / 0** ★★ 🥇 | **0 / 0 / 0** ★★ 🥇 | **0 / 0 / 0** ★★ 🥇 | **0 / 0 / 0** ★★ 🥇 | 2 / 0 / 1 | 0 / 1 / 7 | 越少越好 |
| [FA-1](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 逻辑审计 | **98.759026** ★★ | **98.538896** ★ | 98.298315 | 98.298315 | 97.708694 | 99.763391 🥇 | 越高越一致 |
| [LU-v1r](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 逻辑均匀度 | **81.165916** ★★ | 71.510417 | **81.043390** ★ | 73.529803 | 78.897555 | 83.107434 🥇 | 越高越统一 |
| [Common399](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 唯一码／唯一率 | **399 / 100.000%** ★★ 🥇 | 345 / 86.466% | **399 / 100.000%** ★★ 🥇 | 357 / 89.474% | 372 / 93.233% | 399 / 100.000% 🥇 | 越高越好 |
| [Common399](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 重码桶 | **0** ★★ 🥇 | 54 | **0** ★★ 🥇 | 42 | 27 | 0 🥇 | 越低越好 |
| [Common399](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 受影响音节 | **0** ★★ 🥇 | 108 | **0** ★★ 🥇 | 84 | 54 | 0 🥇 | 越低越好 |
| 频率加权 S2 miss | **0.000%** ★★ 🥇 | 2.610% | **0.000%** ★★ 🥇 | 3.270% | 0.929% | 0.000% 🥇 | 越低越好 |
| S2 补全平均码长 | **2.000000** ★★ 🥇 | 2.109822 | **2.000000** ★★ 🥇 | 2.147408 | 2.072546 | 2.000000 🥇 | 越低越好 |
| S2 补全中心时间（ms） | **70.023** ★★ 🥇 | 86.219 | **75.672** ★ | 89.917 | 90.257 | 79.890 | 越低越好 |
| S2 异键同指率 | 5.346% | **4.059%** ★★ 🥇 | 9.252% | **4.255%** ★ | 11.638% | 11.343% | 越低越好 |
| 综合补全 [CKT v3](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) | **9.586334** ★★ | 9.662072 | **9.630039** ★ | 9.782135 | 10.000000 | 9.461105 🥇 | 越低越好 |
| 综合补全 [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) | **9.083575** ★★ 🥇 | 9.560735 | **9.185254** ★ | 9.716421 | 10.000000 | 9.184607 | 越低越好 |
| 综合补全 CKT v5 | **9.096336** ★★ 🥇 | 9.564806 | **9.195026** ★ | 9.715587 | 10.000000 | 9.195422 | 越低越好 |
| 综合补全 CKT v5.1 | **9.103000** ★★ 🥇 | 9.567898 | **9.204752** ★ | 9.717167 | 9.999357 | 9.202834 | 越低越好 |
| [A7E-v3](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 系综当量 | **10.607264** ★★ | 10.749064 | **10.620559** ★ | 10.737188 | 10.740028 | 10.519452 🥇 | 越低越好 |
| [A7E-v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 系综当量 | **10.670636** ★★ | 10.815673 | **10.684702** ★ | 10.804598 | 10.805830 | 10.583290 🥇 | 越低越好 |
| [A7E-v5](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 系综当量 | **10.258404** ★★ 🥇 | 10.599488 | 10.821925 | **10.473306** ★ | 11.478960 | 11.091225 | 越低越好 |
| [A7E-v6-CW150](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) | **9.263108** ★★ 🥇 | 9.587200 | 9.534119 | **9.512904** ★ | 10.000000 | 9.589632 | 越低越好 |
| 八轨综合选重率 | **0.623%** ★ | 1.259% | **0.609%** ★★ | 1.443% | 1.532% | 0.572% 🥇 | 越低越好 |
| 八轨第一辅键率 | **20.940%** ★ | 25.162% | **20.831%** ★★ | 26.150% | 26.413% | 19.746% 🥇 | 越低越好 |
| 八轨第二辅键率 | **4.490%** ★ | 6.449% | **4.459%** ★★ | 7.040% | 7.201% | 4.158% 🥇 | 越低越好 |
| 日常同手率 | **41.508%** ★★ 🥇 | 46.906% | **45.882%** ★ | 46.533% | **45.882%** ★ | 45.416% | 越低越好；非独立速度结论 |
| 日常平均有效距离 | **0.663015** ★ | 0.694670 | 0.711833 | **0.655492** ★★ 🥇 | 0.679555 | 0.701172 | 越低越好 |
| 20 合同 QAZ 左小指组峰值 | 17.048% | **16.717%** ★ | 18.895% | **16.312%** ★★ 🥇 | 17.160% | 16.661% | 越低越好 |
| 20 合同 P 区右小指组峰值 | **3.150%** ★ | 4.750% | 3.516% | 5.104% | **2.774%** ★★ | 1.888% 🥇 | 越低越好 |
| 20 合同最大单指峰值 | 34.439% | **26.392%** ★ | 27.671% | **25.215%** ★★ 🥇 | 29.531% | 29.271% | 越低越好 |
| 日常纯双拼移动手分数（含标点） | **142.322** ★ | 135.218 | 132.219 | **143.380** ★★ 🥇 | 138.672 | 135.310 | 越高越好 |
| S2 主键区占比 | 43.912% | **54.542%** ★★ 🥇 | 37.025% | **52.031%** ★ | 49.001% | 36.600% | 越高越好 |
| 20 合同 TYB 双食指组峰值 | **11.595%** ★★ 🥇 | 14.101% | **12.422%** ★ | 14.092% | 14.733% | 12.358% | 越低越好 |
| 20 合同主键区下限 | 32.519% | **34.733%** ★ | 24.733% | **37.620%** ★★ 🥇 | 30.815% | 24.243% | 越高越好 |

这里的全部总览值均直接取自同一份 `a7_CKT_R11.html` 冻结 payload；初代、[S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 与 [B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 数值沿用上方历史快照。六个方案跨 21×21、21×26 与 26×26 键域，表中排名用于同语料复算，不把跨键域差异解释为同键域映射的单变量胜负。

### 六方案 [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 成本分解

| 方案 | 运动（ms） | 第一辅键（ms） | 第二辅键（ms） | 固定选重决策（ms） | 候选扫描（ms） | 翻页（ms） | 线性总计（ms） |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D3/V1 21×26 | **340.641** ★★ 🥇 | **62.820** ★ | **13.471** ★ | **3.738** ★ | **0.400** ★ | **0.0004** ★ | **421.070** ★★ |
| QZ-e8f37a 21×21 | 345.465 | 75.486 | 19.347 | 7.553 | 0.959 | 0.0091 | 448.819 |
| Overall-17·初代 21×26 | **345.236** ★ | **62.492** ★★ | **13.378** ★★ | **3.655** ★★ | **0.386** ★★ | **0.0002** ★★ 🥇 | **425.148** ★ |
| U357·初代 21×21 | 348.003 | 78.450 | 21.121 | 8.660 | 1.138 | 0.0167 | 457.389 |
| 原键道 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | 359.225 | 79.240 | 21.604 | 9.192 | 1.234 | 0.0165 | 470.511 |
| [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) | 345.472 | 59.239 🥇 | 12.474 🥇 | 3.429 🥇 | 0.364 🥇 | 0.0003 | 420.978 🥇 |

| [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 情景 | D3/V1 21×26 | QZ-e8f37a 21×21 | Overall-17·初代 21×26 | U357·初代 21×21 | 原键道 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) |
| --- | --- | --- | --- | --- | --- | --- |
| 仅运动时间 | **9.435276** ★★ 🥇 | **9.568147** ★ | 9.576826 | 9.634568 | 10.000000 | 9.573778 |
| 运动＋两级辅键，不计选重／扫描／翻页 | **9.123788** ★★ 🥇 | 9.579634 | **9.227535** ★ | 9.718997 | 10.000000 | 9.219064 |
| 完整默认情景，但翻页为 0 ms | **9.083677** ★★ 🥇 | 9.560828 | **9.185356** ★ | 9.716408 | 10.000000 | 9.184685 |
| 完整默认 [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) | **9.083575** ★★ 🥇 | 9.560735 | **9.185254** ★ | 9.716421 | 10.000000 | 9.184607 |

### 六方案冻结语料加权非首选率

| 编码轨 | 词长 | D3/V1 21×26 | QZ-e8f37a 21×21 | Overall-17·初代 21×26 | U357·初代 21×21 | 原键道 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 冰雪健道 | 单字 | **0.443%** ★★ 🥇 | 0.515% | **0.443%** ★★ 🥇 | 0.489% | 0.480% | 0.443% 🥇 |
| 冰雪健道 | 二字词 | 0.416% | **0.380%** ★ | 0.412% | 0.440% | **0.374%** ★★ 🥇 | 0.413% |
| 冰雪健道 | 三字词 | **0.857%** ★ | 4.303% | **0.809%** ★★ | 4.948% | 5.498% | 0.729% 🥇 |
| 冰雪健道 | 四字词 | 0.457% | **0.251%** ★★ 🥇 | 0.421% | **0.366%** ★ | 0.499% | 0.383% |
| 冰雪弎拼 | 单字 | **0.702%** ★★ 🥇 | 0.773% | **0.702%** ★★ 🥇 | 0.786% | 0.774% | 0.702% 🥇 |
| 冰雪弎拼 | 二字词 | 0.595% | **0.575%** ★ | 0.582% | 0.632% | **0.564%** ★★ 🥇 | 0.587% |
| 冰雪弎拼 | 三字词 | **1.369%** ★ | 6.002% | **1.321%** ★★ | 6.948% | 7.610% | 1.090% 🥇 |
| 冰雪弎拼 | 四字词 | 0.615% | **0.397%** ★★ 🥇 | 0.631% | **0.565%** ★ | 0.708% | 0.512% |

### 六方案逐级辅键后的频率加权残余非首选率

“零辅后”是裸编码后仍需第一辅键的权重；“一辅后”是第一辅键后仍需第二辅键的权重；“二辅后”是第二辅键后仍需人工选重的权重。本节沿用 [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 的两级辅键观察面，CKT v5.1 的三字词第三辅另见稳健辅序报告。

| 编码轨 | 词长 | 阶段 | D3/V1 21×26 | QZ-e8f37a 21×21 | Overall-17·初代 21×26 | U357·初代 21×21 | 原键道 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 冰雪健道 | 单字 | 零辅后 | **20.851%** ★★ 🥇 | 21.812% | **20.851%** ★★ 🥇 | 21.960% | 22.061% | 20.851% 🥇 |
| 冰雪健道 | 单字 | 一辅后 | **4.097%** ★★ 🥇 | 4.549% | **4.097%** ★★ 🥇 | 4.653% | 4.567% | 4.097% 🥇 |
| 冰雪健道 | 单字 | 二辅后 | **0.443%** ★★ 🥇 | 0.515% | **0.443%** ★★ 🥇 | 0.489% | 0.480% | 0.443% 🥇 |
| 冰雪健道 | 二字词 | 零辅后 | **18.533%** ★ | 19.438% | **18.490%** ★★ 🥇 | 20.066% | 18.927% | 18.533% |
| 冰雪健道 | 二字词 | 一辅后 | 3.643% | **3.572%** ★ | 3.640% | 3.795% | **3.474%** ★★ 🥇 | 3.639% |
| 冰雪健道 | 二字词 | 二辅后 | 0.416% | **0.380%** ★ | 0.412% | 0.440% | **0.374%** ★★ 🥇 | 0.413% |
| 冰雪健道 | 三字词 | 零辅后 | **24.659%** ★ | 48.666% | **24.456%** ★★ | 50.365% | 51.729% | 21.566% 🥇 |
| 冰雪健道 | 三字词 | 一辅后 | **6.258%** ★ | 18.132% | **6.167%** ★★ | 19.783% | 21.108% | 5.251% 🥇 |
| 冰雪健道 | 三字词 | 二辅后 | **0.857%** ★ | 4.303% | **0.809%** ★★ | 4.948% | 5.498% | 0.729% 🥇 |
| 冰雪健道 | 四字词 | 零辅后 | 24.455% | **22.107%** ★★ | **24.132%** ★ | 24.301% | 27.835% | 20.385% 🥇 |
| 冰雪健道 | 四字词 | 一辅后 | 4.073% | **2.846%** ★★ 🥇 | 3.962% | **3.822%** ★ | 4.562% | 3.263% |
| 冰雪健道 | 四字词 | 二辅后 | 0.457% | **0.251%** ★★ 🥇 | 0.421% | **0.366%** ★ | 0.499% | 0.383% |
| 冰雪弎拼 | 单字 | 零辅后 | **21.001%** ★★ 🥇 | 21.961% | **21.001%** ★★ 🥇 | 22.111% | 22.208% | 21.001% 🥇 |
| 冰雪弎拼 | 单字 | 一辅后 | **4.748%** ★★ 🥇 | 5.149% | **4.748%** ★★ 🥇 | 5.379% | 5.062% | 4.748% 🥇 |
| 冰雪弎拼 | 单字 | 二辅后 | **0.702%** ★★ 🥇 | 0.773% | **0.702%** ★★ 🥇 | 0.786% | 0.774% | 0.702% 🥇 |
| 冰雪弎拼 | 二字词 | 零辅后 | **18.533%** ★ | 19.438% | **18.490%** ★★ 🥇 | 20.066% | 18.927% | 18.533% |
| 冰雪弎拼 | 二字词 | 一辅后 | 3.975% | 4.030% | **3.960%** ★ | 4.275% | **3.916%** ★★ 🥇 | 3.961% |
| 冰雪弎拼 | 二字词 | 二辅后 | 0.595% | **0.575%** ★ | 0.582% | 0.632% | **0.564%** ★★ 🥇 | 0.587% |
| 冰雪弎拼 | 三字词 | 零辅后 | **24.659%** ★ | 48.666% | **24.456%** ★★ | 50.365% | 51.729% | 21.566% 🥇 |
| 冰雪弎拼 | 三字词 | 一辅后 | **7.196%** ★ | 20.294% | **7.044%** ★★ | 22.103% | 23.400% | 5.996% 🥇 |
| 冰雪弎拼 | 三字词 | 二辅后 | **1.369%** ★ | 6.002% | **1.321%** ★★ | 6.948% | 7.610% | 1.090% 🥇 |
| 冰雪弎拼 | 四字词 | 零辅后 | 24.455% | **22.107%** ★★ | **24.132%** ★ | 24.301% | 27.835% | 20.385% 🥇 |
| 冰雪弎拼 | 四字词 | 一辅后 | 4.658% | **3.610%** ★★ 🥇 | 4.692% | **4.535%** ★ | 5.545% | 3.739% |
| 冰雪弎拼 | 四字词 | 二辅后 | 0.615% | **0.397%** ★★ 🥇 | 0.631% | **0.565%** ★ | 0.708% | 0.512% |

### 六方案二／三／四字词终局碰撞桶

单元格依次为“碰撞桶数／残余条目数／跨词长桶数／最大桶成员数”。不同合同的共享池结构不同，复合单元格不标单一胜负。

| 编码轨 | 词长 | D3/V1 21×26 | QZ-e8f37a 21×21 | Overall-17·初代 21×26 | U357·初代 21×21 | 原键道 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 冰雪健道 | 二字词 | 3355／4006／742／9 | 3096／3742／235／6 | 3352／4000／735／7 | 3499／4298／404／8 | 3063／3671／411／8 | 3314／3965／714／9 |
| 冰雪健道 | 三字词 | 2206／2767／682／8 | 7541／12214／0／14 | 2157／2713／630／8 | 8070／13632／0／25 | 8806／15424／0／15 | 1873／2295／740／9 |
| 冰雪健道 | 四字词 | 1250／1530／411／9 | 681／836／185／8 | 1200／1482／354／8 | 950／1159／320／13 | 1158／1473／340／8 | 962／1143／482／8 |
| 冰雪弎拼 | 二字词 | 4873／6264／1118／10 | 4690／6069／531／8 | 4806／6147／1036／9 | 5126／6741／712／9 | 4641／5968／746／9 | 4903／6278／1151／10 |
| 冰雪弎拼 | 三字词 | 3178／4370／1068／10 | 9163／17129／0／20 | 3060／4272／969／10 | 9642／18936／0／21 | 9925／20476／0／21 | 2640／3491／1095／11 |
| 冰雪弎拼 | 四字词 | 1689／2062／642／10 | 1051／1265／371／10 | 1690／2083／586／9 | 1412／1721／545／9 | 1711／2096／547／10 | 1263／1466／683／11 |
