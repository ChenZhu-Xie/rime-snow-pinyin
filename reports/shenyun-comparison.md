# 神韵两代布局与 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts)、[B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) 四方案比较

方案来源：[神韵(Overall-17) 21×26 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md)出自 `production/ckt-v4-2126-strict-d0-20261030` 分支的提交 `7a7e154`；[无飞键道(U357) 21×21 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md)出自 `production/ckt-v4-2121-strict-avuio-20261024` 分支的提交 `11713b6`。方案名分别链接到对应固定提交的最终报告，报告记录了搜索过程、候选取舍和定稿映射。

本文把两个现行专有名词置于同等地位：**[无飞键道(U357) 21×21 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md)**与**[神韵(Overall-17) 21×26 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md)**。另以[星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts)、[首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) 为参照。四方案共用 [Common399](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#common399)、冻结 20 合同、同一字词与形码数据、[CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/docs/CKT_v4_SPEC.md) 模型及日常八场景文稿。

必须同时注意合同边界：[无飞键道(U357)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md)与 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 按传统 21×21 合同计分；[神韵(Overall-17)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md)原生遵循[飞花式四码顶](https://input.tansongchen.com/snow-feihua/basic.html)；[B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) 采用原资料记录的 `AEUIO` 形辅与 `IEUAO` 调辅，本报告为其套用同一[飞花式四码顶](https://input.tansongchen.com/snow-feihua/basic.html)路由和统一字形／笔画源。21×26／26×26 相比 21×21 扩大了韵码域，不能把跨键域领先直接解释成同键域映射胜负。

表中在[神韵(Overall-17)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md)、[无飞键道(U357)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md)与原键道 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 三个方案间拉通排名：第 1 名数值加粗并标 ★★，第 2 名数值加粗并标 ★，第 3 名不加粗、不标星；[首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) 不参与三方案名次。🥇 独立比较全部四方案，可以与星标同时出现在同一单元格。并列采用竞赛排名，例如并列第 1 名后的下一名为第 3 名；并列单元格使用相同格式。

## 总览

| 指标 | [神韵(Overall-17) 21×26 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md) | [无飞键道(U357) 21×21 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md) | [星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) | 何为好 |
| --- | --- | --- | --- | --- | --- |
| [M-R2](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 记忆项 | **36.000000** ★★ 🥇 | **40.000000** ★ | 44.000000 | 51.000000 | 越低越好 |
| 全声母／字母声母／传统声母／韵母乱序度 A/I/D/V | **5 / 2 / 1 / 1** ★★ | 4 / 1 / 0 / 5 | **3 / 0 / 0 / 4** ★ | 1 / 0 / 0 / 0 🥇 | A、I 为诊断；仍按 D+V 越低越好 |
| 飞键成分（声母／零声母组／韵母） | **0 / 0 / 0** ★★ 🥇 | **0 / 0 / 0** ★★ 🥇 | 2 / 0 / 1 | 0 / 1 / 7 | 越少越好 |
| [FA-1](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#代表方案性能) 逻辑审计 | **98.298315** ★★ | **98.298315** ★★ | 97.708694 | 99.763391 🥇 | 越高越一致 |
| [LU-v1r](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#代表方案性能) 逻辑均匀度 | **81.043390** ★★ | 73.529803 | **78.897555** ★ | 83.107434 🥇 | 越高越统一 |
| [Common399](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#common399) 唯一码 | **399** ★★ 🥇 | 357 | **372** ★ | 399 🥇 | 越高越少重码 |
| 频率加权 S2 miss | **0.000%** ★★ 🥇 | 3.270% | **0.929%** ★ | 0.000% 🥇 | 越低越好 |
| S2 补全平均码长 | **2.0000** ★★ 🥇 | 2.1474 | **2.0725** ★ | 2.0000 🥇 | 越低越好 |
| S2 补全中心时间（ms） | **75.672** ★★ 🥇 | **89.917** ★ | 90.257 | 79.890 | 越低越好 |
| S2 异键同指率 | **9.252%** ★ | **4.255%** ★★ 🥇 | 11.638% | 11.343% | 越低越好 |
| 综合补全 [CKT v3](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/docs/POST_R11_EXPLORATION.md) | **9.630039** ★★ | **9.782135** ★ | 10.000000 | 9.461105 🥇 | 越低越好；历史情景 |
| 综合补全 [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/docs/CKT_v4_SPEC.md) | **9.185254** ★★ | **9.716421** ★ | 10.000000 | 9.184607 🥇 | 越低越好；现行主指标 |
| 综合补全 CKT v5 | **9.195026** ★★ 🥇 | **9.715587** ★ | 10.000000 | 9.195422 | 越低越好；六候选页与方案专属辅序 |
| 综合补全 CKT v5.1 | **9.204752** ★★ | **9.717167** ★ | 9.999357 | 9.202834 🥇 | 越低越好；原生路由最长六码 |
| [A7E-v3](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#代表方案性能) 系综当量 | **10.620559** ★★ | **10.737188** ★ | 10.740028 | 10.519452 🥇 | 越低越好；冻结历史轴 |
| [A7E-v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#代表方案性能) 系综当量 | **10.684702** ★★ | **10.804598** ★ | 10.805830 | 10.583290 🥇 | 越低越好；冻结历史轴 |
| [A7E-v5](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#代表方案性能) 系综当量 | **10.821925** ★ | **10.473306** ★★ 🥇 | 11.478960 | 11.091225 | 越低越好；CKT-only |
| [A7E-v6-CW150](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#代表方案性能) | **9.534119** ★ | **9.512904** ★★ 🥇 | 10.000000 | 9.589632 | 越低越好；情景指标 |
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

“全声母／字母声母／传统声母／韵母乱序度 A/I/D/V”保留 benchmark 的 D/V 原义，并只追加两个诊断视角：D 统计 18 个传统单字母声母的可用键集不再恰好等于同名原键的数量；I 在 D 之外计入 W/Y 两个零声母族；A 再计入 A/E/O 三个零声母族；V 对基础韵母 `a/e/i/o/u` 使用同一口径。因此保留原键同时增加飞键仍计乱序，例如 [B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) 的 E→E/U 使 A 增加 1。M 已逐条包含这些非直映映射与路由成本，故不随新增视角修正；历史排名仍按 D+V，A/I 不参与排名。乱序与按实际二键码统计的飞键仍是两个不同指标。

“S2 异键同指率”统计 S2 相邻键对中“两键不同、但由同一物理手指负责”的码内与边界频率权重，再除以全部键对权重；同键重复另计，不包含在此项中。

CKT v5 使用 6 项候选页；[神韵(Overall-17)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md)的冰雪鹤道／冰雪鹤拼辅序为 `12/21/42`、`12/21/13`，[无飞键道(U357)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md)的冰雪兰道／冰雪兰拼辅序为 `12/23/24`、`12/21/23`，[S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 固定为 `12/21/24`、`12/21/23`。[首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) 按原生 `AEUIO` 形辅、`IEUAO` 调辅与五项认知系数 0%～500% 独立扰动网格，对 144 套完整规则按平均名次取稳健综合第一，形辅／调辅分别为 `12/12/23`、`21/12/23`。每段两位数字表示 CKT v5 优化并计分的前两辅；运行时冰雪兰道、冰雪兰拼的三字词会按剩余字位补第三辅，四字词最多两辅。CKT v5 在第二辅后直接按选重计费，因此不含三字词第三辅的成本与消歧收益。

CKT v5.1 保留各布局的原生主码路由，并把二／三／四字词的最长总码长统一为 6：二／四字词均为 4 主码＋2 辅码；传统 21×21 的三字词由 `AAA+BB` 补为 `AAA+BBB`，[神韵(Overall-17)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md)与[首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) 的四码顶三字词继续使用既有 `AAAU+BB`，不改变其编码。第一、第二、第三辅键与选重决策、候选扫描、翻页六项系数分别在 0%～500%、步长 50% 上独立扰动，共 `11⁶=1,771,561` 点；每个成员在 144 套完整规则中按最低平均名次取稳健第一。四布局的形／调稳健辅序依次为：[神韵(Overall-17)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md) `12/21/14`、`12/21/13`；[无飞键道(U357)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md) `12/231/24`、`12/213/23`；[S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) `12/231/24`、`12/213/23`；[首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) `12/12/23`、`21/12/23`。神韵与首道沿用 CKT v5 辅序时各轨绝对成本完全不变；其 CKT v5.1 归一分仍会因 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 三字词补入第三辅而变化。

四方案的飞键成分（声母／零声母组／韵母）依次为：[神韵(Overall-17) 21×26 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md) **0 / 0 / 0** ★★ 🥇、[无飞键道(U357) 21×21 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md) **0 / 0 / 0** ★★ 🥇、[星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 2 / 0 / 1、[首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) 0 / 1 / 7。飞键按 [Common399](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#common399) 实际二键码统计；不同成分共用一键或成分整体移位不计飞键。

## [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/docs/CKT_v4_SPEC.md) 成本分解

[CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/docs/CKT_v4_SPEC.md) 按单字、二字、三字、四字词权重 `1:3:1:1`，冰雪兰道与冰雪兰拼等权，以 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts)＝10 做四次幂聚合。第一／第二辅键各按 300 ms；非首选固定决策 600 ms，每排除一个更高候选 50 ms，每跨 9 个候选翻页 300 ms。

| 方案 | 运动（ms） | 第一辅键（ms） | 第二辅键（ms） | 固定选重决策（ms） | 候选扫描（ms） | 翻页（ms） | 线性总计（ms） |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [神韵(Overall-17) 21×26 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md) | **345.236** ★★ 🥇 | **62.492** ★★ | **13.378** ★★ | **3.655** ★★ | **0.386** ★★ | **0.0002** ★★ 🥇 | **425.148** ★★ |
| [无飞键道(U357) 21×21 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md) | **348.003** ★ | **78.450** ★ | **21.121** ★ | **8.660** ★ | **1.138** ★ | 0.0167 | **457.389** ★ |
| [星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | 359.225 | 79.240 | 21.604 | 9.192 | 1.234 | **0.0165** ★ | 470.511 |
| [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) | 345.472 | 59.239 🥇 | 12.474 🥇 | 3.429 🥇 | 0.364 🥇 | 0.0003 | 420.978 🥇 |

线性总计只用于解释成本来源，正式 [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/docs/CKT_v4_SPEC.md) 仍按八条轨的四次幂聚合。

| [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/docs/CKT_v4_SPEC.md) 情景 | [神韵(Overall-17) 21×26 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md) | [无飞键道(U357) 21×21 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md) | [星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) |
| --- | --- | --- | --- | --- |
| 仅运动时间 | **9.576826** ★★ | **9.634568** ★ | 10.000000 | 9.573778 🥇 |
| 运动＋两级辅键，不计选重／扫描／翻页 | **9.227535** ★★ | **9.718997** ★ | 10.000000 | 9.219064 🥇 |
| 完整默认情景，但翻页为 0 ms | **9.185356** ★★ | **9.716408** ★ | 10.000000 | 9.184685 🥇 |
| 完整默认 [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/docs/CKT_v4_SPEC.md) | **9.185254** ★★ | **9.716421** ★ | 10.000000 | 9.184607 🥇 |

## 冻结语料加权非首选率

| 编码轨 | 词长 | [神韵(Overall-17) 21×26 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md) | [无飞键道(U357) 21×21 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md) | [星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) |
| --- | --- | --- | --- | --- | --- |
| 冰雪兰道 | 单字 | **0.443%** ★★ 🥇 | 0.489% | **0.480%** ★ | 0.443% 🥇 |
| 冰雪兰道 | 二字词 | **0.412%** ★ | 0.440% | **0.374%** ★★ 🥇 | 0.413% |
| 冰雪兰道 | 三字词 | **0.809%** ★★ | **4.948%** ★ | 5.498% | 0.729% 🥇 |
| 冰雪兰道 | 四字词 | **0.421%** ★ | **0.366%** ★★ 🥇 | 0.499% | 0.383% |
| 冰雪兰拼 | 单字 | **0.702%** ★★ 🥇 | 0.786% | **0.774%** ★ | 0.702% 🥇 |
| 冰雪兰拼 | 二字词 | **0.582%** ★ | 0.632% | **0.564%** ★★ 🥇 | 0.587% |
| 冰雪兰拼 | 三字词 | **1.321%** ★★ | **6.948%** ★ | 7.610% | 1.090% 🥇 |
| 冰雪兰拼 | 四字词 | **0.631%** ★ | **0.565%** ★★ | 0.708% | 0.512% 🥇 |

## 逐级辅键后的频率加权残余非首选率

“零辅后”是裸编码后仍需第一辅键的权重；“一辅后”是第一辅键后仍需第二辅键的权重；“二辅后”是第二辅键后仍需人工选重的权重。

| 编码轨 | 词长 | 阶段 | [神韵(Overall-17) 21×26 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md) | [无飞键道(U357) 21×21 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md) | [星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) |
| --- | --- | --- | --- | --- | --- | --- |
| 冰雪兰道 | 单字 | 零辅后 | **20.851%** ★★ 🥇 | **21.960%** ★ | 22.061% | 20.851% 🥇 |
| 冰雪兰道 | 单字 | 一辅后 | **4.097%** ★★ 🥇 | 4.653% | **4.567%** ★ | 4.097% 🥇 |
| 冰雪兰道 | 单字 | 二辅后 | **0.443%** ★★ 🥇 | 0.489% | **0.480%** ★ | 0.443% 🥇 |
| 冰雪兰道 | 二字词 | 零辅后 | **18.490%** ★★ 🥇 | 20.066% | **18.927%** ★ | 18.533% |
| 冰雪兰道 | 二字词 | 一辅后 | **3.640%** ★ | 3.795% | **3.474%** ★★ 🥇 | 3.639% |
| 冰雪兰道 | 二字词 | 二辅后 | **0.412%** ★ | 0.440% | **0.374%** ★★ 🥇 | 0.413% |
| 冰雪兰道 | 三字词 | 零辅后 | **24.456%** ★★ | **50.365%** ★ | 51.729% | 21.566% 🥇 |
| 冰雪兰道 | 三字词 | 一辅后 | **6.167%** ★★ | **19.783%** ★ | 21.108% | 5.251% 🥇 |
| 冰雪兰道 | 三字词 | 二辅后 | **0.809%** ★★ | **4.948%** ★ | 5.498% | 0.729% 🥇 |
| 冰雪兰道 | 四字词 | 零辅后 | **24.132%** ★★ | **24.301%** ★ | 27.835% | 20.385% 🥇 |
| 冰雪兰道 | 四字词 | 一辅后 | **3.962%** ★ | **3.822%** ★★ | 4.562% | 3.263% 🥇 |
| 冰雪兰道 | 四字词 | 二辅后 | **0.421%** ★ | **0.366%** ★★ 🥇 | 0.499% | 0.383% |
| 冰雪兰拼 | 单字 | 零辅后 | **21.001%** ★★ 🥇 | **22.111%** ★ | 22.208% | 21.001% 🥇 |
| 冰雪兰拼 | 单字 | 一辅后 | **4.748%** ★★ 🥇 | 5.379% | **5.062%** ★ | 4.748% 🥇 |
| 冰雪兰拼 | 单字 | 二辅后 | **0.702%** ★★ 🥇 | 0.786% | **0.774%** ★ | 0.702% 🥇 |
| 冰雪兰拼 | 二字词 | 零辅后 | **18.490%** ★★ 🥇 | 20.066% | **18.927%** ★ | 18.533% |
| 冰雪兰拼 | 二字词 | 一辅后 | **3.960%** ★ | 4.275% | **3.916%** ★★ 🥇 | 3.961% |
| 冰雪兰拼 | 二字词 | 二辅后 | **0.582%** ★ | 0.632% | **0.564%** ★★ 🥇 | 0.587% |
| 冰雪兰拼 | 三字词 | 零辅后 | **24.456%** ★★ | **50.365%** ★ | 51.729% | 21.566% 🥇 |
| 冰雪兰拼 | 三字词 | 一辅后 | **7.044%** ★★ | **22.103%** ★ | 23.400% | 5.996% 🥇 |
| 冰雪兰拼 | 三字词 | 二辅后 | **1.321%** ★★ | **6.948%** ★ | 7.610% | 1.090% 🥇 |
| 冰雪兰拼 | 四字词 | 零辅后 | **24.132%** ★★ | **24.301%** ★ | 27.835% | 20.385% 🥇 |
| 冰雪兰拼 | 四字词 | 一辅后 | **4.692%** ★ | **4.535%** ★★ | 5.545% | 3.739% 🥇 |
| 冰雪兰拼 | 四字词 | 二辅后 | **0.631%** ★ | **0.565%** ★★ | 0.708% | 0.512% 🥇 |

## 二／三／四字词的终局碰撞桶

单元格依次为“碰撞桶数／残余条目数／跨词长桶数／最大桶成员数”。不同合同的共享池结构不同，复合单元格不标单一胜负。

| 编码轨 | 词长 | [神韵(Overall-17) 21×26 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md) | [无飞键道(U357) 21×21 双拼](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md) | [星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) |
| --- | --- | --- | --- | --- | --- |
| 冰雪兰道 | 二字词 | 3352／4000／735／7 | 3499／4298／404／8 | 3063／3671／411／8 | 3314／3965／714／9 |
| 冰雪兰道 | 三字词 | 2157／2713／630／8 | 8070／13632／0／25 | 8806／15424／0／15 | 1873／2295／740／9 |
| 冰雪兰道 | 四字词 | 1200／1482／354／8 | 950／1159／320／13 | 1158／1473／340／8 | 962／1143／482／8 |
| 冰雪兰拼 | 二字词 | 4806／6147／1036／9 | 5126／6741／712／9 | 4641／5968／746／9 | 4903／6278／1151／10 |
| 冰雪兰拼 | 三字词 | 3060／4272／969／10 | 9642／18936／0／21 | 9925／20476／0／21 | 2640／3491／1095／11 |
| 冰雪兰拼 | 四字词 | 1690／2083／586／9 | 1412／1721／545／9 | 1711／2096／547／10 | 1263／1466／683／11 |

## 边界与结论

- [神韵(Overall-17)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md)以 21×26 声韵域实现 [Common399](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#common399) 399 个唯一码、[M-R2](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md)＝36，并采用[飞花式四码顶](https://input.tansongchen.com/snow-feihua/basic.html)；它在现行 [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/docs/CKT_v4_SPEC.md) 中与 [B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) 接近，同时保持零飞键，但日常文稿移动手分数及主键区指标不如[无飞键道(U357)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md)。
- [无飞键道(U357)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md)在 21×21 键域中保留 42 个音节重码桶，换来更高的日常纯双拼移动手分数、较高主键区占比和较低最大单指峰值；它与 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 才是直接的同键域比较。
- [B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) 的 26×26 大码域、原资料记录的辅键映射以及本报告套用的[飞花式四码顶](https://input.tansongchen.com/snow-feihua/basic.html)路由带来零音节重码及较低补全成本；这不是 [B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) 原方案的顶功声明，其飞键、记忆项和日常路径指标也采用另一种取舍。
- 所有模型分数都用于同语料、同模型横向复算，不等同真人输入速度。

机器可复核数据见 [`shenyun-comparison.json`](shenyun-comparison.json)。[神韵(Overall-17)](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md)的底层方案 ID 为 `SNOW-SHENYUN-21X26-PRODUCTION`。两代方案的来源、得来过程与定稿映射以上述固定提交报告为准。

## 次世代布局追加对比

上面的历史四方案报告原样保留。本节追加当前 RC26-39a5bfdc045342cd 21×26 与 UED-3158ce08b5bc 21×21，并把已经冻结的 Overall-17 与 U357 明确标为“·初代”。以下所有表格统一比较 RC26-39a5bfdc045342cd、UED-3158ce08b5bc、Overall-17·初代、U357·初代、原键道 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 与[首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) 六个方案；[S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 同时继续充当 CKT 归一化锚点。

表中在 RC26-39a5bfdc045342cd、UED-3158ce08b5bc、Overall-17·初代、U357·初代与原键道 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 五个方案间拉通排名：第 1 名数值加粗并标 ★★，第 2 名数值加粗并标 ★，其余名次不加粗、不标星；[首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) 不参与五方案名次。🥇 独立比较全部六方案，可以与星标同时出现在同一单元格。并列采用竞赛排名，例如并列第 1 名后的下一名为第 3 名；并列单元格使用相同格式。

RC26-39a5bfdc045342cd 的定稿与稳健辅序见 [`2026-11-09-rc26-ckt-v51-soft-balance-aux-order-robustness.md`](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/research/notes/2026-11-09-rc26-ckt-v51-soft-balance-aux-order-robustness.md)，UED-3158ce08b5bc 的定稿与稳健辅序见 [`2026-11-15-untoned-2121-candidates-aux-robustness.json`](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/research/notes/2026-11-15-untoned-2121-candidates-aux-robustness.json)。RC26-39a5bfdc045342cd 的冰雪鹤道／冰雪鹤拼辅序为 `12/12/24`、`12/21/13`；UED-3158ce08b5bc 的冰雪兰道／冰雪兰拼辅序为 `12/213/24`、`12/213/23`。初代方案继续使用历史报告中冻结的映射与辅序。

| 指标 | RC26-39a5bfdc045342cd 21×26 | UED-3158ce08b5bc 21×21 | Overall-17·初代 21×26 | U357·初代 21×21 | 原键道 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) | 何为好 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M-R2 记忆项 | **40.000000** ★ | 41.000000 | **36.000000** ★★ 🥇 | **40.000000** ★ | 44.000000 | 51.000000 | 越低越好 |
| 全声母／字母声母／传统声母／韵母乱序度 A/I/D/V | **8 / 5 / 3 / 1** ★ | 5 / 2 / 2 / 5 | **5 / 2 / 1 / 1** ★★ | 4 / 1 / 0 / 5 | **3 / 0 / 0 / 4** ★ | 1 / 0 / 0 / 0 🥇 | A、I 为诊断；仍按 D+V 越低越好 |
| 飞键成分（声母／零声母组／韵母） | **0 / 0 / 0** ★★ 🥇 | **0 / 0 / 0** ★★ 🥇 | **0 / 0 / 0** ★★ 🥇 | **0 / 0 / 0** ★★ 🥇 | 2 / 0 / 1 | 0 / 1 / 7 | 越少越好 |
| [FA-1](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#代表方案性能) 逻辑审计 | **98.999608** ★★ | **98.298315** ★ | **98.298315** ★ | **98.298315** ★ | 97.708694 | 99.763391 🥇 | 越高越一致 |
| [LU-v1r](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#代表方案性能) 逻辑均匀度 | **83.470667** ★★ 🥇 | 74.087239 | **81.043390** ★ | 73.529803 | 78.897555 | 83.107434 | 越高越统一 |
| [Common399](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#common399) 唯一码／唯一率 | **399 / 100.000%** ★★ 🥇 | 351 / 87.970% | **399 / 100.000%** ★★ 🥇 | 357 / 89.474% | 372 / 93.233% | 399 / 100.000% 🥇 | 越高越好 |
| [Common399](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#common399) 重码桶 | **0** ★★ 🥇 | 48 | **0** ★★ 🥇 | 42 | 27 | 0 🥇 | 越低越好 |
| [Common399](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#common399) 受影响音节 | **0** ★★ 🥇 | 96 | **0** ★★ 🥇 | 84 | 54 | 0 🥇 | 越低越好 |
| 频率加权 S2 miss | **0.000%** ★★ 🥇 | 1.894% | **0.000%** ★★ 🥇 | 3.270% | 0.929% | 0.000% 🥇 | 越低越好 |
| S2 补全平均码长 | **2.000000** ★★ 🥇 | 2.096813 | **2.000000** ★★ 🥇 | 2.147408 | 2.072546 | 2.000000 🥇 | 越低越好 |
| S2 补全中心时间（ms） | **69.031** ★★ 🥇 | 84.118 | **75.672** ★ | 89.917 | 90.257 | 79.890 | 越低越好 |
| S2 异键同指率 | 4.845% | **4.021%** ★★ 🥇 | 9.252% | **4.255%** ★ | 11.638% | 11.343% | 越低越好 |
| 综合补全 [CKT v3](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/docs/POST_R11_EXPLORATION.md) | **9.570690** ★★ | 9.668465 | **9.630039** ★ | 9.782135 | 10.000000 | 9.461105 🥇 | 越低越好 |
| 综合补全 [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/docs/CKT_v4_SPEC.md) | **9.062885** ★★ 🥇 | 9.564204 | **9.185254** ★ | 9.716421 | 10.000000 | 9.184607 | 越低越好 |
| 综合补全 CKT v5 | **9.072789** ★★ 🥇 | 9.562144 | **9.195026** ★ | 9.715587 | 10.000000 | 9.195422 | 越低越好 |
| 综合补全 CKT v5.1 | **9.082777** ★★ 🥇 | 9.565504 | **9.204752** ★ | 9.717167 | 9.999357 | 9.202834 | 越低越好 |
| [A7E-v3](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#代表方案性能) 系综当量 | **10.587565** ★★ | 10.730903 | **10.620559** ★ | 10.737188 | 10.740028 | 10.519452 🥇 | 越低越好 |
| [A7E-v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#代表方案性能) 系综当量 | **10.651302** ★★ | 10.795932 | **10.684702** ★ | 10.804598 | 10.805830 | 10.583290 🥇 | 越低越好 |
| [A7E-v5](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#代表方案性能) 系综当量 | **10.203925** ★★ 🥇 | 10.607833 | 10.821925 | **10.473306** ★ | 11.478960 | 11.091225 | 越低越好 |
| [A7E-v6-CW150](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#代表方案性能) | **9.252817** ★★ 🥇 | 9.647440 | 9.534119 | **9.512904** ★ | 10.000000 | 9.589632 | 越低越好 |
| 八轨综合选重率 | **0.622%** ★ | 1.227% | **0.609%** ★★ | 1.443% | 1.532% | 0.572% 🥇 | 越低越好 |
| 八轨第一辅键率 | **20.962%** ★ | 24.772% | **20.831%** ★★ | 26.150% | 26.413% | 19.746% 🥇 | 越低越好 |
| 八轨第二辅键率 | **4.489%** ★ | 6.303% | **4.459%** ★★ | 7.040% | 7.201% | 4.158% 🥇 | 越低越好 |
| 日常同手率 | **39.739%** ★★ 🥇 | 47.278% | **45.882%** ★ | 46.533% | **45.882%** ★ | 45.416% | 越低越好；非独立速度结论 |
| 日常平均有效距离 | **0.649234** ★★ 🥇 | 0.693857 | 0.711833 | **0.655492** ★ | 0.679555 | 0.701172 | 越低越好 |
| 20 合同 QAZ 左小指组峰值 | 16.967% | **16.717%** ★ | 18.895% | **16.312%** ★★ 🥇 | 17.160% | 16.661% | 越低越好 |
| 20 合同 P 区右小指组峰值 | **3.150%** ★ | 4.841% | 3.516% | 5.104% | **2.774%** ★★ | 1.888% 🥇 | 越低越好 |
| 20 合同最大单指峰值 | 35.359% | **26.952%** ★ | 27.671% | **25.215%** ★★ 🥇 | 29.531% | 29.271% | 越低越好 |
| 日常纯双拼移动手分数（含标点） | **145.320** ★★ 🥇 | 134.318 | 132.219 | **143.380** ★ | 138.672 | 135.310 | 越高越好 |
| S2 主键区占比 | 44.118% | **51.279%** ★ | 37.025% | **52.031%** ★★ 🥇 | 49.001% | 36.600% | 越高越好 |
| 20 合同 TYB 双食指组峰值 | **12.012%** ★★ 🥇 | 14.281% | **12.422%** ★ | 14.092% | 14.733% | 12.358% | 越低越好 |
| 20 合同主键区下限 | 32.563% | **36.536%** ★ | 24.733% | **37.620%** ★★ 🥇 | 30.815% | 24.243% | 越高越好 |

这里的全部总览值均直接取自同一份 `a7_CKT_R11.html` 冻结 payload；初代、[S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 与 [B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) 数值沿用上方历史快照。六个方案跨 21×21、21×26 与 26×26 键域，表中排名用于同语料复算，不把跨键域差异解释为同键域映射的单变量胜负。

### 六方案 [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/docs/CKT_v4_SPEC.md) 成本分解

| 方案 | 运动（ms） | 第一辅键（ms） | 第二辅键（ms） | 固定选重决策（ms） | 候选扫描（ms） | 翻页（ms） | 线性总计（ms） |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RC26-39a5bfdc045342cd 21×26 | **339.849** ★★ 🥇 | **62.885** ★ | **13.468** ★ | **3.733** ★ | **0.399** ★ | **0.0004** ★ | **420.333** ★★ 🥇 |
| UED-3158ce08b5bc 21×21 | 347.860 | 74.316 | 18.909 | 7.364 | 0.932 | 0.0086 | 449.389 |
| Overall-17·初代 21×26 | **345.236** ★ | **62.492** ★★ | **13.378** ★★ | **3.655** ★★ | **0.386** ★★ | **0.0002** ★★ 🥇 | **425.148** ★ |
| U357·初代 21×21 | 348.003 | 78.450 | 21.121 | 8.660 | 1.138 | 0.0167 | 457.389 |
| 原键道 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | 359.225 | 79.240 | 21.604 | 9.192 | 1.234 | 0.0165 | 470.511 |
| [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) | 345.472 | 59.239 🥇 | 12.474 🥇 | 3.429 🥇 | 0.364 🥇 | 0.0003 | 420.978 |

| [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/docs/CKT_v4_SPEC.md) 情景 | RC26-39a5bfdc045342cd 21×26 | UED-3158ce08b5bc 21×21 | Overall-17·初代 21×26 | U357·初代 21×21 | 原键道 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) |
| --- | --- | --- | --- | --- | --- | --- |
| 仅运动时间 | **9.415302** ★★ 🥇 | 9.617545 | **9.576826** ★ | 9.634568 | 10.000000 | 9.573778 |
| 运动＋两级辅键，不计选重／扫描／翻页 | **9.103882** ★★ 🥇 | 9.587543 | **9.227535** ★ | 9.718997 | 10.000000 | 9.219064 |
| 完整默认情景，但翻页为 0 ms | **9.062988** ★★ 🥇 | 9.564305 | **9.185356** ★ | 9.716408 | 10.000000 | 9.184685 |
| 完整默认 [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/docs/CKT_v4_SPEC.md) | **9.062885** ★★ 🥇 | 9.564204 | **9.185254** ★ | 9.716421 | 10.000000 | 9.184607 |

### 六方案冻结语料加权非首选率

| 编码轨 | 词长 | RC26-39a5bfdc045342cd 21×26 | UED-3158ce08b5bc 21×21 | Overall-17·初代 21×26 | U357·初代 21×21 | 原键道 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 冰雪兰道 | 单字 | **0.443%** ★★ 🥇 | 0.500% | **0.443%** ★★ 🥇 | 0.489% | 0.480% | 0.443% 🥇 |
| 冰雪兰道 | 二字词 | 0.416% | **0.371%** ★★ 🥇 | 0.412% | 0.440% | **0.374%** ★ | 0.413% |
| 冰雪兰道 | 三字词 | **0.858%** ★ | 4.198% | **0.809%** ★★ | 4.948% | 5.498% | 0.729% 🥇 |
| 冰雪兰道 | 四字词 | 0.455% | **0.242%** ★★ 🥇 | 0.421% | **0.366%** ★ | 0.499% | 0.383% |
| 冰雪兰拼 | 单字 | **0.702%** ★★ 🥇 | 0.746% | **0.702%** ★★ 🥇 | 0.786% | 0.774% | 0.702% 🥇 |
| 冰雪兰拼 | 二字词 | 0.589% | **0.557%** ★★ 🥇 | 0.582% | 0.632% | **0.564%** ★ | 0.587% |
| 冰雪兰拼 | 三字词 | **1.372%** ★ | 5.908% | **1.321%** ★★ | 6.948% | 7.610% | 1.090% 🥇 |
| 冰雪兰拼 | 四字词 | 0.619% | **0.348%** ★★ 🥇 | 0.631% | **0.565%** ★ | 0.708% | 0.512% |

### 六方案逐级辅键后的频率加权残余非首选率

“零辅后”是裸编码后仍需第一辅键的权重；“一辅后”是第一辅键后仍需第二辅键的权重；“二辅后”是第二辅键后仍需人工选重的权重。本节沿用 [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/docs/CKT_v4_SPEC.md) 的两级辅键观察面，CKT v5.1 的三字词第三辅另见稳健辅序报告。

| 编码轨 | 词长 | 阶段 | RC26-39a5bfdc045342cd 21×26 | UED-3158ce08b5bc 21×21 | Overall-17·初代 21×26 | U357·初代 21×21 | 原键道 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 冰雪兰道 | 单字 | 零辅后 | **20.851%** ★★ 🥇 | 21.728% | **20.851%** ★★ 🥇 | 21.960% | 22.061% | 20.851% 🥇 |
| 冰雪兰道 | 单字 | 一辅后 | **4.097%** ★★ 🥇 | 4.485% | **4.097%** ★★ 🥇 | 4.653% | 4.567% | 4.097% 🥇 |
| 冰雪兰道 | 单字 | 二辅后 | **0.443%** ★★ 🥇 | 0.500% | **0.443%** ★★ 🥇 | 0.489% | 0.480% | 0.443% 🥇 |
| 冰雪兰道 | 二字词 | 零辅后 | **18.536%** ★ | 18.988% | **18.490%** ★★ 🥇 | 20.066% | 18.927% | 18.533% |
| 冰雪兰道 | 二字词 | 一辅后 | 3.649% | **3.466%** ★★ 🥇 | 3.640% | 3.795% | **3.474%** ★ | 3.639% |
| 冰雪兰道 | 二字词 | 二辅后 | 0.416% | **0.371%** ★★ 🥇 | 0.412% | 0.440% | **0.374%** ★ | 0.413% |
| 冰雪兰道 | 三字词 | 零辅后 | **24.869%** ★ | 48.416% | **24.456%** ★★ | 50.365% | 51.729% | 21.566% 🥇 |
| 冰雪兰道 | 三字词 | 一辅后 | **6.275%** ★ | 17.911% | **6.167%** ★★ | 19.783% | 21.108% | 5.251% 🥇 |
| 冰雪兰道 | 三字词 | 二辅后 | **0.858%** ★ | 4.198% | **0.809%** ★★ | 4.948% | 5.498% | 0.729% 🥇 |
| 冰雪兰道 | 四字词 | 零辅后 | 24.366% | **21.450%** ★★ | **24.132%** ★ | 24.301% | 27.835% | 20.385% 🥇 |
| 冰雪兰道 | 四字词 | 一辅后 | 4.066% | **2.646%** ★★ 🥇 | 3.962% | **3.822%** ★ | 4.562% | 3.263% |
| 冰雪兰道 | 四字词 | 二辅后 | 0.455% | **0.242%** ★★ 🥇 | 0.421% | **0.366%** ★ | 0.499% | 0.383% |
| 冰雪兰拼 | 单字 | 零辅后 | **21.001%** ★★ 🥇 | 21.876% | **21.001%** ★★ 🥇 | 22.111% | 22.208% | 21.001% 🥇 |
| 冰雪兰拼 | 单字 | 一辅后 | **4.748%** ★★ 🥇 | 5.070% | **4.748%** ★★ 🥇 | 5.379% | 5.062% | 4.748% 🥇 |
| 冰雪兰拼 | 单字 | 二辅后 | **0.702%** ★★ 🥇 | 0.746% | **0.702%** ★★ 🥇 | 0.786% | 0.774% | 0.702% 🥇 |
| 冰雪兰拼 | 二字词 | 零辅后 | **18.536%** ★ | 18.988% | **18.490%** ★★ 🥇 | 20.066% | 18.927% | 18.533% |
| 冰雪兰拼 | 二字词 | 一辅后 | 3.977% | **3.892%** ★★ 🥇 | 3.960% | 4.275% | **3.916%** ★ | 3.961% |
| 冰雪兰拼 | 二字词 | 二辅后 | 0.589% | **0.557%** ★★ 🥇 | 0.582% | 0.632% | **0.564%** ★ | 0.587% |
| 冰雪兰拼 | 三字词 | 零辅后 | **24.869%** ★ | 48.416% | **24.456%** ★★ | 50.365% | 51.729% | 21.566% 🥇 |
| 冰雪兰拼 | 三字词 | 一辅后 | **7.185%** ★ | 20.076% | **7.044%** ★★ | 22.103% | 23.400% | 5.996% 🥇 |
| 冰雪兰拼 | 三字词 | 二辅后 | **1.372%** ★ | 5.908% | **1.321%** ★★ | 6.948% | 7.610% | 1.090% 🥇 |
| 冰雪兰拼 | 四字词 | 零辅后 | 24.366% | **21.450%** ★★ | **24.132%** ★ | 24.301% | 27.835% | 20.385% 🥇 |
| 冰雪兰拼 | 四字词 | 一辅后 | 4.622% | **3.372%** ★★ 🥇 | 4.692% | **4.535%** ★ | 5.545% | 3.739% |
| 冰雪兰拼 | 四字词 | 二辅后 | 0.619% | **0.348%** ★★ 🥇 | 0.631% | **0.565%** ★ | 0.708% | 0.512% |

### 六方案二／三／四字词终局碰撞桶

单元格依次为“碰撞桶数／残余条目数／跨词长桶数／最大桶成员数”。不同合同的共享池结构不同，复合单元格不标单一胜负。

| 编码轨 | 词长 | RC26-39a5bfdc045342cd 21×26 | UED-3158ce08b5bc 21×21 | Overall-17·初代 21×26 | U357·初代 21×21 | 原键道 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README.md#探索阶段) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 冰雪兰道 | 二字词 | 3377／4033／760／9 | 2992／3621／266／9 | 3352／4000／735／7 | 3499／4298／404／8 | 3063／3671／411／8 | 3314／3965／714／9 |
| 冰雪兰道 | 三字词 | 2227／2799／698／8 | 7383／11845／0／14 | 2157／2713／630／8 | 8070／13632／0／25 | 8806／15424／0／15 | 1873／2295／740／9 |
| 冰雪兰道 | 四字词 | 1260／1531／425／9 | 666／816／185／9 | 1200／1482／354／8 | 950／1159／320／13 | 1158／1473／340／8 | 962／1143／482／8 |
| 冰雪兰拼 | 二字词 | 4882／6271／1113／11 | 4439／5778／466／8 | 4806／6147／1036／9 | 5126／6741／712／9 | 4641／5968／746／9 | 4903／6278／1151／10 |
| 冰雪兰拼 | 三字词 | 3202／4395／1079／11 | 9075／16820／0／20 | 3060／4272／969／10 | 9642／18936／0／21 | 9925／20476／0／21 | 2640／3491／1095／11 |
| 冰雪兰拼 | 四字词 | 1692／2072／655／10 | 970／1169／327／10 | 1690／2083／586／9 | 1412／1721／545／9 | 1711／2096／547／10 | 1263／1466／683／11 |

<!-- current-layout-benchmark:b15fbc084bb4a83e9275c89bcb84c9e974bb8b9a609cc4032508204d58000366 -->

<a id="current-layout-d0d15d9969b5"></a>

## 2026-11-21 当前四布局／六生产方案追加比较（含 CKT v5.2）

以上各代报告及数值保留原样；本节重新读取当前页面，不把历史 QZ、D3/V1、Overall-17 或 U357 的分数改名后充当当前布局。当前四个无调方案归为 RC26、UED 两列，新增冰雪莲道、冰雪鹮道两列，另保留初代与外部参考。混合合同表列出实值和方向，不统一授予星标或奖牌。

来源为用户指定的 a7_CKT_R11.html，SHA-256：`d0d15d9969b504714a37c6c04a4e8ff0d21b0e8c82b20a963f0009205c00d36b`。机器可读记录追加在 [shenyun-comparison.json](shenyun-comparison.json) 的 `currentLayoutComparisons`，包括输入摘要、定义、参考轨、辅序与各轨原始测值。

### 布局与生产合同

| 属性 | RC26-39a5bfdc045342cd 21×26 | UED-3158ce08b5bc 21×21 | Overall-17·初代 21×26 | U357·初代 21×21 | 原键道 S005 | 首道 B04 | 冰雪莲道 CR-REF-7e650f7a4c 21×21 | 冰雪鹮道 T2126-V52-M4-ec60a3637a99 21×26 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 声调与后置辅码 | 无调主码＋形／调辅系综 | 无调主码＋形／调辅系综 | 无调主码＋形／调辅系综 | 无调主码＋形／调辅系综 | 无调主码＋形／调辅系综 | 无调主码＋形／调辅系综 | 主码带调＋纯形辅[^zh-benchmark-toned] | 主码带调＋纯形辅[^zh-benchmark-toned] |
| 二／三／四字辅序（形；调） | 12/12/24；12/21/13 | 12/231/23；12/213/23 | //；// | //；// | //；// | //；// | 21/231/14 | 21/12/23 |

### Benchmark 总览

| 指标 | RC26-39a5bfdc045342cd 21×26 | UED-3158ce08b5bc 21×21 | Overall-17·初代 21×26 | U357·初代 21×21 | 原键道 S005 | 首道 B04 | 冰雪莲道 CR-REF-7e650f7a4c 21×21 | 冰雪鹮道 T2126-V52-M4-ec60a3637a99 21×26 | 何为好 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M-R2 记忆项 | 40 | 41 | 36 | 40 | 44 | 51 | 21 / 24 (M-T1)[^zh-benchmark-toned] | 18 / 21 (M-T1)[^zh-benchmark-toned] | 越低越好 |
| 全声母／字母声母／传统声母／韵母乱序度 A/I/D/V | 8 / 5 / 3 / 1 | 5 / 2 / 2 / 5 | 5 / 2 / 1 / 1 | 4 / 1 / 0 / 5 | 3 / 0 / 0 / 4 | 1 / 0 / 0 / 0 | D=2 / V=5[^zh-benchmark-toned] | D=2 / V=5[^zh-benchmark-toned] | A、I 为诊断；仍按 D+V 越低越好 |
| 飞键成分（声母／零声母组／韵母） | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 2 / 0 / 1 | 0 / 1 / 7 | 0 / 0 / 0[^zh-benchmark-toned] | 0 / 0 / 0[^zh-benchmark-toned] | 越少越好 |
| FA-1 逻辑审计 | 98.999608 | 98.298315 | 98.298315 | 98.298315 | 97.708694 | 99.763391 | 100.000000[^zh-benchmark-toned] | 100.000000[^zh-benchmark-toned] | 越高越一致 |
| LU-v1r 逻辑均匀度 | 83.470667 | 74.087239 | 81.043390 | 73.529803 | 78.897555 | 83.107434 | 73.671261[^zh-benchmark-toned] | 76.196066[^zh-benchmark-toned] | 越高越统一 |
| Common399 唯一码／唯一率 | 399 / 100.000% | 351 / 87.970% | 399 / 100.000% | 357 / 89.474% | 372 / 93.233% | 399 / 100.000% | 433 / 30.775%[^zh-benchmark-toned] | 526 / 37.385%[^zh-benchmark-toned] | 越高越好 |
| Common399 重码桶 | 0 | 48 | 0 | 42 | 27 | 0 | 392[^zh-benchmark-toned] | 420[^zh-benchmark-toned] | 越低越好 |
| Common399 受影响音节／占比 | 0 / 0.000% | 96 / 24.060% | 0 / 0.000% | 84 / 21.053% | 54 / 13.534% | 0 / 0.000% | 1366 / 97.086%[^zh-benchmark-toned] | 1301 / 92.466%[^zh-benchmark-toned] | 越低越好 |
| 频率加权 S2 miss | 0.000% | 1.894% | 0.000% | 3.270% | 0.929% | 0.000% | 17.994%[^zh-benchmark-toned] | 15.596%[^zh-benchmark-toned] | 越低越好 |
| S2 补全平均码长 | 2.000000 | 2.096813 | 2.000000 | 2.147408 | 2.072546 | 2.000000 | 3.126652[^zh-benchmark-toned] | 2.944921[^zh-benchmark-toned] | 越低越好 |
| S2 补全中心时间（ms） | 69.031 | 84.118 | 75.672 | 89.917 | 90.257 | 79.890 | 218.245[^zh-benchmark-toned] | 191.629[^zh-benchmark-toned] | 越低越好 |
| S2 异键同指率 | 4.845% | 4.021% | 9.252% | 4.255% | 11.638% | 11.343% | 4.736%[^zh-benchmark-toned] | 7.459%[^zh-benchmark-toned] | 越低越好 |
| 综合补全 CKT v3 | 9.570690 | 9.668465 | 9.630039 | 9.782135 | 10.000000 | 9.461105 | 8.874945[^zh-benchmark-toned] | 8.602473[^zh-benchmark-toned] | 越低越好 |
| 综合补全 CKT v4 | 9.062885 | 9.564204 | 9.185254 | 9.716421 | 10.000000 | 9.184607 | 9.158204[^zh-benchmark-toned] | 8.679715[^zh-benchmark-toned] | 越低越好 |
| 综合补全 CKT v5 | 9.072789 | 9.562144 | 9.195026 | 9.715587 | 10.000000 | 9.195422 | 9.127910[^zh-benchmark-toned] | 8.619628[^zh-benchmark-toned] | 越低越好 |
| 综合补全 CKT v5.1 | 9.082777 | 9.565504 | 9.204752 | 9.717167 | 9.999357 | 9.202834 | 9.127012[^zh-benchmark-toned] | 8.628673[^zh-benchmark-toned] | 越低越好 |
| A7E-v3 系综当量 | 10.587565 | 10.730903 | 10.620559 | 10.737188 | 10.740028 | 10.519452 | 10.884939[^zh-benchmark-toned] | 10.777219[^zh-benchmark-toned] | 越低越好 |
| A7E-v4 系综当量 | 10.651302 | 10.795932 | 10.684702 | 10.804598 | 10.805830 | 10.583290 | 10.944558[^zh-benchmark-toned] | 10.823787[^zh-benchmark-toned] | 越低越好 |
| A7E-v5 系综当量 | 10.203925 | 10.607833 | 10.821925 | 10.473306 | 11.478960 | 11.091225 | 10.143940[^zh-benchmark-toned] | 10.163691[^zh-benchmark-toned] | 越低越好 |
| A7E-v6-CW150 | 9.252817 | 9.647440 | 9.534119 | 9.512904 | 10.000000 | 9.589632 | 8.646306[^zh-benchmark-toned] | 8.447277[^zh-benchmark-toned] | 越低越好 |
| 八轨综合选重率 | 0.622% | 1.227% | 0.609% | 1.443% | 1.532% | 0.572% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 越低越好 |
| 八轨第一辅键率 | 20.962% | 24.772% | 20.831% | 26.150% | 26.413% | 19.746% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 越低越好 |
| 八轨第二辅键率 | 4.489% | 6.303% | 4.459% | 7.040% | 7.201% | 4.158% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 越低越好 |
| 日常左右手负载／左手占比 | 997:1152 / 46.394% | 1200:949 / 55.840% | 1017:1132 / 47.324% | 1091:1058 / 50.768% | 1121:1028 / 52.164% | 1004:1145 / 46.719% | 1199:950 / 55.793%[^zh-benchmark-toned] | 1095:1054 / 50.954%[^zh-benchmark-toned] | 越接近 50% 越平衡 |
| 日常同手率 | 39.739% | 47.278% | 45.882% | 46.533% | 45.882% | 45.416% | 46.719%[^zh-benchmark-toned] | 42.531%[^zh-benchmark-toned] | 越低越好；非独立速度结论 |
| 日常平均有效距离 | 0.649234 | 0.693857 | 0.711833 | 0.655492 | 0.679555 | 0.701172 | 0.758448[^zh-benchmark-toned] | 0.667001[^zh-benchmark-toned] | 越低越好 |
| 20 合同 QAZ 左小指组峰值 | 16.967% | 16.717% | 18.895% | 16.312% | 17.160% | 16.661% | 10.923%[^zh-benchmark-toned] | 11.808%[^zh-benchmark-toned] | 越低越好 |
| 20 合同 P 区右小指组峰值 | 3.150% | 4.841% | 3.516% | 5.104% | 2.774% | 1.888% | 5.524%[^zh-benchmark-toned] | 7.125%[^zh-benchmark-toned] | 越低越好 |
| 20 合同最大单指峰值 | 35.359% | 26.952% | 27.671% | 25.215% | 29.531% | 29.271% | 27.929%[^zh-benchmark-toned] | 26.581%[^zh-benchmark-toned] | 越低越好 |
| 日常纯双拼移动手分数（含标点） | 145.320 | 134.318 | 132.219 | 143.380 | 138.672 | 135.310 | 121.658[^zh-benchmark-toned] | 138.089[^zh-benchmark-toned] | 越高越好 |
| S2 主键区占比 | 44.118% | 51.279% | 37.025% | 52.031% | 49.001% | 36.600% | 41.069%[^zh-benchmark-toned] | 40.048%[^zh-benchmark-toned] | 越高越好 |
| 20 合同 TYB 双食指组峰值 | 12.012% | 14.281% | 12.422% | 14.092% | 14.733% | 12.358% | 15.484%[^zh-benchmark-toned] | 10.828%[^zh-benchmark-toned] | 越低越好 |
| 20 合同主键区下限 | 32.563% | 36.536% | 24.733% | 37.620% | 30.815% | 24.243% | 28.399%[^zh-benchmark-toned] | 24.699%[^zh-benchmark-toned] | 越高越好 |
| 音节域大小（无调／带调） | 399 | 399 | 399 | 399 | 399 | 399 | 1407[^zh-benchmark-toned] | 1407[^zh-benchmark-toned] | 观察分布，不单独判优 |
| 静态空码（399／1407 音节域） | 147 | 90 | 147 | 84 | 69 | 277 | 8[^zh-benchmark-toned] | 20[^zh-benchmark-toned] | 越高越好 |
| 综合补全 CKT v5.2[^zh-benchmark-v52] | 9.086538 | 9.566359 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 10.000000 | —[^zh-benchmark-missing] | 9.132009[^zh-benchmark-toned] | 8.640932[^zh-benchmark-toned] | 越低越好 |
| CKT v5.2 认知成本 ×2 | 9.043952 | 9.543307 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 10.000000 | —[^zh-benchmark-missing] | 8.861456[^zh-benchmark-toned] | 8.234489[^zh-benchmark-toned] | 越低越好 |
| CKT v5.2 认知成本 ×3 | 9.039404 | 9.529308 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 10.000000 | —[^zh-benchmark-missing] | 8.666715[^zh-benchmark-toned] | 7.961052[^zh-benchmark-toned] | 越低越好 |
| CKT v5.2 认知成本 ×5 | 9.051557 | 9.513962 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 10.000000 | —[^zh-benchmark-missing] | 8.402959[^zh-benchmark-toned] | 7.598958[^zh-benchmark-toned] | 越低越好 |
| v5.2 加权运动耗时（ms） | 338.392 | 347.023 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 358.648 | —[^zh-benchmark-missing] | 343.661[^zh-benchmark-toned] | 340.196[^zh-benchmark-toned] | 越低越好 |
| v5.2 加权认知耗时（ms） | 80.377 | 98.621 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 107.694 | —[^zh-benchmark-missing] | 81.230[^zh-benchmark-toned] | 54.935[^zh-benchmark-toned] | 越低越好 |
| v5.2 加权有效耗时（ms） | 418.768 | 445.644 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 466.343 | —[^zh-benchmark-missing] | 424.891[^zh-benchmark-toned] | 395.130[^zh-benchmark-toned] | 越低越好 |
| v5.2 第一辅键率 | 20.962% | 24.772% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 26.413% | —[^zh-benchmark-missing] | 21.376%[^zh-benchmark-toned] | 15.652%[^zh-benchmark-toned] | 越低越好 |
| v5.2 第二辅键率 | 4.484% | 6.191% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 7.087% | —[^zh-benchmark-missing] | 4.608%[^zh-benchmark-toned] | 2.272%[^zh-benchmark-toned] | 越低越好 |
| v5.2 第三辅键率 | 0.000% | 0.806% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 1.060% | —[^zh-benchmark-missing] | 0.666%[^zh-benchmark-toned] | 0.000%[^zh-benchmark-toned] | 越低越好 |
| v5.2 终局选重率 | 0.607% | 0.500% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 0.604% | —[^zh-benchmark-missing] | 0.193%[^zh-benchmark-toned] | 0.176%[^zh-benchmark-toned] | 越低越好 |
| v5.2 平均扫描排除候选数 | 0.007806 | 0.006292 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 0.007673 | —[^zh-benchmark-missing] | 0.002364[^zh-benchmark-toned] | 0.002036[^zh-benchmark-toned] | 越低越好 |
| v5.2 平均翻页次数 | 0.000019 | 0.000007 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 0.000011 | —[^zh-benchmark-missing] | 0.000007[^zh-benchmark-toned] | 0.000000[^zh-benchmark-toned] | 越低越好 |
| v5.2 平均编码按键数 | 3.841567 | 3.817685 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 3.845605 | —[^zh-benchmark-missing] | 3.766503[^zh-benchmark-toned] | 3.761028[^zh-benchmark-toned] | 越低越好 |
| v5.2 单倍成本点最优（非生产辅序） | —[^zh-benchmark-missing] | 9.566342 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 越低越好 |
| v5.2 加倍成本点最优（非生产辅序） | —[^zh-benchmark-missing] | 9.543307 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 越低越好 |
| v5.2 终局主键区占比 | —[^zh-benchmark-missing] | 44.534% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 40.747%[^zh-benchmark-toned] | 39.923%[^zh-benchmark-toned] | 越高越好 |
| v5.2 终局上排占比 | —[^zh-benchmark-missing] | 33.333% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 35.711%[^zh-benchmark-toned] | 33.792%[^zh-benchmark-toned] | 观察分布，不单独判优 |
| v5.2 终局下排占比 | —[^zh-benchmark-missing] | 22.133% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 23.542%[^zh-benchmark-toned] | 26.285%[^zh-benchmark-toned] | 观察分布，不单独判优 |
| v5.2 终局左小指负载 | —[^zh-benchmark-missing] | 8.484% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 7.670%[^zh-benchmark-toned] | 8.758%[^zh-benchmark-toned] | 越低越好 |
| v5.2 终局右小指负载 | —[^zh-benchmark-missing] | 3.897% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 4.302%[^zh-benchmark-toned] | 4.485%[^zh-benchmark-toned] | 越低越好 |
| v5.2 终局最大单指负载 | —[^zh-benchmark-missing] | 25.783% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 25.575%[^zh-benchmark-toned] | 24.081%[^zh-benchmark-toned] | 越低越好 |
| v5.2 终局左手占比 | —[^zh-benchmark-missing] | 56.630% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 55.914%[^zh-benchmark-toned] | 54.962%[^zh-benchmark-toned] | 越接近 50% 越平衡 |
| v5.2 终局异键同指率 | —[^zh-benchmark-missing] | 8.796% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 9.305%[^zh-benchmark-toned] | 9.439%[^zh-benchmark-toned] | 越低越好 |
| v5.2 终局同指率 | —[^zh-benchmark-missing] | 12.914% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 13.643%[^zh-benchmark-toned] | 13.159%[^zh-benchmark-toned] | 越低越好 |
| v5.2 终局同手率 | —[^zh-benchmark-missing] | 47.893% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 48.524%[^zh-benchmark-toned] | 47.242%[^zh-benchmark-toned] | 越低越好 |
| v5.2 终局交替率 | —[^zh-benchmark-missing] | 52.107% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 51.476%[^zh-benchmark-toned] | 52.758%[^zh-benchmark-toned] | 越高越好 |
| 带调原生四轨主键区下限 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 38.229%[^zh-benchmark-toned] | 35.185%[^zh-benchmark-toned] | 越高越好 |
| 带调原生四轨左小指峰值 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 9.032%[^zh-benchmark-toned] | 10.080%[^zh-benchmark-toned] | 越低越好 |
| 带调原生四轨右小指峰值 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 5.331%[^zh-benchmark-toned] | 5.095%[^zh-benchmark-toned] | 越低越好 |
| 带调原生四轨最大单指峰值 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 27.830%[^zh-benchmark-toned] | 26.946%[^zh-benchmark-toned] | 越低越好 |
| 带调原生四轨 TYB 峰值 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 15.468%[^zh-benchmark-toned] | 13.414%[^zh-benchmark-toned] | 越低越好 |
| 四码五截面平均跨词长受影响率 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 6.399%[^zh-benchmark-toned] | 4.066%[^zh-benchmark-toned] | 越低越好 |
| 四码五截面平均跨词长首选损失率 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 2.002%[^zh-benchmark-toned] | 1.244%[^zh-benchmark-toned] | 越低越好 |

[^zh-benchmark-toned]: 带调列为页面原列公式的带调适配：声调在双拼主码内贡献，后置只有纯形笔辅；无调列是形辅／调辅两个成员的八轨系综，带调 v5～v5.2 是形辅四轨，词长权重均为 1:3:1:1。数值可以观察任务成本与取舍，不能作为相同编码合同下的布局或辅码消融排名。记忆项为 M-T1 下限／守门，与 M-R2 定义不同；D 可对照，带调 V 统计任一声调的普通元音偏移，A/I 未定义。Common399 对应列在带调方案中改用实际 1407 带调音节，『唯一码』指占用码位而非无碰撞音节数，分母与碰撞数不能直接横比。FA/LU、S2、A7E 与 20 合同负载均使用页面的带调适配；主码已包含的声调不重复击键，S2 补全使用各自五键枚举后缀，时间列的带调值为页面 sound.upperMs。CKT v3/v4 使用页面 τ=600、首辅=300、次辅=300 ms 的适配八轨，v5 以后使用原生纯形四轨；20 合同负载与原生四轨终局负载分别列示。

[^zh-benchmark-missing]: 『—』表示这份冻结页面没有该合同／版本的测值或未定义该属性，不等于 0；不以 v5.1 冒充 v5.2，也不把适配调轨冒充新增的生产方案。

[^zh-benchmark-v52]: CKT v5.2 保留 v5.1 的主码、辅序、候选池及词长权重，对长码采用分块成功／错误成本；认知成本 ×2／×3／×5 时同时缩放候选与同模式 S005 参考的全部认知项，保留运动项及生产辅序，再逐轨取四次幂均值。S005 v5.2 归一化为 10；不是实际用户输入速度或 5000 字实测码长。

### v5.2 逐轨模型耗时与辅键贡献[^zh-benchmark-v52]

同一行比较同词长和编码轨。带调方案没有生产调辅轨，其对应格明确标为不适用；不复制形辅轨来凑八轨。单元格为「运动 ms／有效 ms／平均编码按键」。

| 编码轨 | 词长 | RC26-39a5bfdc045342cd 21×26 | UED-3158ce08b5bc 21×21 | Overall-17·初代 21×26 | U357·初代 21×21 | 原键道 S005 | 首道 B04 | 冰雪莲道 CR-REF-7e650f7a4c 21×21 | 冰雪鹮道 T2126-V52-M4-ec60a3637a99 21×26 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 形辅 | character | 97.520 / 175.301 / 2.249483 | 102.066 / 184.023 / 2.262133 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 112.423 / 195.484 / 2.266274 | —[^zh-benchmark-missing] | 99.323 / 164.398 / 2.211661[^zh-benchmark-toned] | 98.643 / 160.048 / 2.199483[^zh-benchmark-toned] |
| 形辅 | word2 | 379.850 / 448.729 / 4.220869 | 402.313 / 472.035 / 4.224316 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 412.685 / 482.384 / 4.224026 | —[^zh-benchmark-missing] | 399.129 / 443.543 / 4.146303[^zh-benchmark-toned] | 391.450 / 431.926 / 4.133220[^zh-benchmark-toned] |
| 形辅 | word3 | 347.056 / 446.378 / 3.834270 | 331.314 / 544.145 / 3.698323 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 343.117 / 581.170 / 3.777280 | —[^zh-benchmark-missing] | 331.314 / 544.145 / 3.698323[^zh-benchmark-toned] | 338.495 / 412.876 / 3.729793[^zh-benchmark-toned] |
| 形辅 | word4 | 441.667 / 529.029 / 4.283394 | 432.713 / 506.049 / 4.240336 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 447.027 / 546.464 / 4.323045 | —[^zh-benchmark-missing] | 433.941 / 510.175 / 4.250127[^zh-benchmark-toned] | 429.686 / 502.081 / 4.237235[^zh-benchmark-toned] |
| 调辅 | character | 98.264 / 180.194 / 2.257494 | 104.575 / 190.388 / 2.269462 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 115.609 / 202.573 / 2.272698 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] |
| 调辅 | word2 | 381.100 / 452.357 / 4.224967 | 403.624 / 475.498 / 4.227984 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 413.679 / 485.566 / 4.227880 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] |
| 调辅 | word3 | 349.506 / 456.454 / 3.846888 | 340.716 / 569.432 / 3.738799 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 355.780 / 612.500 / 3.821899 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] |
| 调辅 | word4 | 443.839 / 534.611 / 4.289764 | 435.083 / 511.093 / 4.246266 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 450.733 / 554.069 / 4.330341 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] |

### v5.2 逐级辅键率与终局选重

单元格为「第一辅／第二辅／第三辅／终局选重」，均为频率加权百分比。第三辅为零表示合同不存在第三辅或该语料无需第三辅，与缺测不同；不把第一辅键率当作裸码非首选率（21×26 还存在三键至四键补主码阶段）。

| 编码轨 | 词长 | RC26-39a5bfdc045342cd 21×26 | UED-3158ce08b5bc 21×21 | Overall-17·初代 21×26 | U357·初代 21×21 | 原键道 S005 | 首道 B04 | 冰雪莲道 CR-REF-7e650f7a4c 21×21 | 冰雪鹮道 T2126-V52-M4-ec60a3637a99 21×26 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 形辅 | character | 20.851% / 4.097% / 0.000% / 0.443% | 21.728% / 4.485% / 0.000% / 0.500% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 22.061% / 4.567% / 0.000% / 0.480% | —[^zh-benchmark-missing] | 18.041% / 3.125% / 0.000% / 0.240% | 17.103% / 2.845% / 0.000% / 0.237% |
| 形辅 | word2 | 18.536% / 3.551% / 0.000% / 0.396% | 18.988% / 3.444% / 0.000% / 0.368% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 18.927% / 3.476% / 0.000% / 0.378% | —[^zh-benchmark-missing] | 13.108% / 1.522% / 0.000% / 0.080% | 11.916% / 1.406% / 0.000% / 0.078% |
| 形辅 | word3 | 24.869% / 6.294% / 0.000% / 0.878% | 48.416% / 17.419% / 3.998% / 0.504% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 51.729% / 20.701% / 5.298% / 0.735% | —[^zh-benchmark-missing] | 48.416% / 17.419% / 3.998% / 0.504% | 20.080% / 3.830% / 0.000% / 0.402% |
| 形辅 | word4 | 24.366% / 3.973% / 0.000% / 0.356% | 21.450% / 2.583% / 0.000% / 0.188% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 27.835% / 4.469% / 0.000% / 0.383% | —[^zh-benchmark-missing] | 22.473% / 2.539% / 0.000% / 0.176% | 20.983% / 2.740% / 0.000% / 0.186% |
| 调辅 | character | 21.001% / 4.748% / 0.000% / 0.702% | 21.876% / 5.070% / 0.000% / 0.746% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 22.208% / 5.062% / 0.000% / 0.774% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] |
| 调辅 | word2 | 18.536% / 3.960% / 0.000% / 0.567% | 18.988% / 3.811% / 0.000% / 0.525% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 18.927% / 3.861% / 0.000% / 0.532% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] |
| 调辅 | word3 | 24.869% / 7.556% / 0.000% / 1.439% | 48.416% / 19.790% / 5.674% / 1.059% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 51.729% / 23.041% / 7.420% / 1.512% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] |
| 调辅 | word4 | 24.366% / 4.610% / 0.000% / 0.577% | 21.450% / 3.176% / 0.000% / 0.323% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 27.835% / 5.199% / 0.000% / 0.638% | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] |

### CKT v4 成本分解（原列带调适配）

本表继续原报告的八轨观察面；带调的 sanpin 是页面移除已内含声调重复击键后的研究适配轨，不代表新增了带调调辅生产方案。单元格为「运动 ms／第一辅率／第二辅率／终局选重率」。

| 编码轨 | 词长 | RC26-39a5bfdc045342cd 21×26 | UED-3158ce08b5bc 21×21 | Overall-17·初代 21×26 | U357·初代 21×21 | 原键道 S005 | 首道 B04 | 冰雪莲道 CR-REF-7e650f7a4c 21×21 | 冰雪鹮道 T2126-V52-M4-ec60a3637a99 21×26 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| keytao | character | 97.520 / 20.851% / 4.097% / 0.443% | 102.066 / 21.728% / 4.485% / 0.500% | 101.294 / 20.851% / 4.097% / 0.443% | 103.381 / 21.960% / 4.653% / 0.489% | 112.423 / 22.061% / 4.567% / 0.480% | 103.095 / 20.851% / 4.097% / 0.443% | 99.323 / 18.041% / 3.125% / 0.240%[^zh-benchmark-toned] | 98.643 / 17.103% / 2.845% / 0.237%[^zh-benchmark-toned] |
| keytao | word2 | 381.485 / 18.536% / 3.649% / 0.416% | 403.968 / 18.988% / 3.466% / 0.371% | 388.936 / 18.490% / 3.640% / 0.412% | 403.646 / 20.066% / 3.795% / 0.440% | 414.429 / 18.927% / 3.474% / 0.374% | 397.156 / 18.533% / 3.639% / 0.413% | 400.321 / 13.108% / 1.522% / 0.080%[^zh-benchmark-toned] | 392.129 / 11.916% / 1.406% / 0.078%[^zh-benchmark-toned] |
| keytao | word3 | 348.864 / 24.869% / 6.275% / 0.858% | 328.150 / 48.416% / 17.911% / 4.198% | 351.867 / 24.456% / 6.167% / 0.809% | 330.791 / 50.365% / 19.783% / 4.948% | 339.067 / 51.729% / 21.108% / 5.498% | 336.483 / 21.566% / 5.251% / 0.729% | 326.540 / 48.416% / 17.419% / 3.998%[^zh-benchmark-toned] | 339.608 / 20.080% / 3.830% / 0.402%[^zh-benchmark-toned] |
| keytao | word4 | 442.604 / 24.366% / 4.066% / 0.455% | 434.616 / 21.450% / 2.646% / 0.242% | 444.841 / 24.132% / 3.962% / 0.421% | 434.774 / 24.301% / 3.822% / 0.366% | 449.331 / 27.835% / 4.562% / 0.499% | 436.115 / 20.385% / 3.263% / 0.383% | 435.579 / 22.473% / 2.539% / 0.176%[^zh-benchmark-toned] | 430.624 / 20.983% / 2.740% / 0.186%[^zh-benchmark-toned] |
| sanpin | character | 98.264 / 21.001% / 4.748% / 0.702% | 104.575 / 21.876% / 5.070% / 0.746% | 102.687 / 21.001% / 4.748% / 0.702% | 105.841 / 22.111% / 5.379% / 0.786% | 115.609 / 22.208% / 5.062% / 0.774% | 105.590 / 21.001% / 4.748% / 0.702% | 95.071 / 18.216% / 0.000% / 3.466%[^zh-benchmark-toned] | 94.900 / 17.268% / 0.000% / 2.915%[^zh-benchmark-toned] |
| sanpin | word2 | 382.969 / 18.536% / 3.977% / 0.589% | 406.857 / 18.988% / 3.892% / 0.557% | 390.537 / 18.490% / 3.960% / 0.582% | 404.446 / 20.066% / 4.275% / 0.632% | 416.540 / 18.927% / 3.916% / 0.564% | 398.366 / 18.533% / 3.961% / 0.587% | 379.163 / 0.000% / 0.000% / 13.108%[^zh-benchmark-toned] | 373.641 / 0.000% / 0.000% / 11.916%[^zh-benchmark-toned] |
| sanpin | word3 | 351.791 / 24.869% / 7.185% / 1.372% | 334.576 / 48.416% / 20.076% / 5.908% | 355.206 / 24.456% / 7.044% / 1.321% | 338.889 / 50.365% / 22.103% / 6.948% | 347.158 / 51.729% / 23.400% / 7.610% | 339.175 / 21.566% / 5.996% / 1.090% | 326.540 / 48.416% / 17.419% / 3.998%[^zh-benchmark-toned] | 338.702 / 20.080% / 3.153% / 0.326%[^zh-benchmark-toned] |
| sanpin | word4 | 445.784 / 24.366% / 4.622% / 0.619% | 437.864 / 21.450% / 3.372% / 0.348% | 448.515 / 24.132% / 4.692% / 0.631% | 438.084 / 24.301% / 4.535% / 0.565% | 454.202 / 27.835% / 5.545% / 0.708% | 438.636 / 20.385% / 3.739% / 0.512% | 434.574 / 22.473% / 1.805% / 0.134%[^zh-benchmark-toned] | 430.171 / 20.983% / 2.415% / 0.161%[^zh-benchmark-toned] |

### 冻结语料加权非首选率（v4 终局两辅观察面）

| 编码轨 | 词长 | RC26-39a5bfdc045342cd 21×26 | UED-3158ce08b5bc 21×21 | Overall-17·初代 21×26 | U357·初代 21×21 | 原键道 S005 | 首道 B04 | 冰雪莲道 CR-REF-7e650f7a4c 21×21 | 冰雪鹮道 T2126-V52-M4-ec60a3637a99 21×26 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| keytao | character | 0.443% | 0.500% | 0.443% | 0.489% | 0.480% | 0.443% | 0.240%[^zh-benchmark-toned] | 0.237%[^zh-benchmark-toned] |
| keytao | word2 | 0.416% | 0.371% | 0.412% | 0.440% | 0.374% | 0.413% | 0.080%[^zh-benchmark-toned] | 0.078%[^zh-benchmark-toned] |
| keytao | word3 | 0.858% | 4.198% | 0.809% | 4.948% | 5.498% | 0.729% | 3.998%[^zh-benchmark-toned] | 0.402%[^zh-benchmark-toned] |
| keytao | word4 | 0.455% | 0.242% | 0.421% | 0.366% | 0.499% | 0.383% | 0.176%[^zh-benchmark-toned] | 0.186%[^zh-benchmark-toned] |
| sanpin | character | 0.702% | 0.746% | 0.702% | 0.786% | 0.774% | 0.702% | 3.466%[^zh-benchmark-toned] | 2.915%[^zh-benchmark-toned] |
| sanpin | word2 | 0.589% | 0.557% | 0.582% | 0.632% | 0.564% | 0.587% | 13.108%[^zh-benchmark-toned] | 11.916%[^zh-benchmark-toned] |
| sanpin | word3 | 1.372% | 5.908% | 1.321% | 6.948% | 7.610% | 1.090% | 3.998%[^zh-benchmark-toned] | 0.326%[^zh-benchmark-toned] |
| sanpin | word4 | 0.619% | 0.348% | 0.631% | 0.565% | 0.708% | 0.512% | 0.134%[^zh-benchmark-toned] | 0.161%[^zh-benchmark-toned] |

### 逐级辅键后的加权残余非首选率（v4）

保持历史零／一／二辅观察面；带调列取页面适配轨的第一辅率、第二辅率和终局选重率，声调已在主码内的阶段不重复追加。v5.2 的三辅行为以上方原生逐轨表为准。

| 编码轨 | 词长 | 阶段 | RC26-39a5bfdc045342cd 21×26 | UED-3158ce08b5bc 21×21 | Overall-17·初代 21×26 | U357·初代 21×21 | 原键道 S005 | 首道 B04 | 冰雪莲道 CR-REF-7e650f7a4c 21×21 | 冰雪鹮道 T2126-V52-M4-ec60a3637a99 21×26 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| keytao | character | 零辅后 | 20.851% | 21.728% | 20.851% | 21.960% | 22.061% | 20.851% | 18.041%[^zh-benchmark-toned] | 17.103%[^zh-benchmark-toned] |
| keytao | character | 一辅后 | 4.097% | 4.485% | 4.097% | 4.653% | 4.567% | 4.097% | 3.125%[^zh-benchmark-toned] | 2.845%[^zh-benchmark-toned] |
| keytao | character | 二辅后 | 0.443% | 0.500% | 0.443% | 0.489% | 0.480% | 0.443% | 0.240%[^zh-benchmark-toned] | 0.237%[^zh-benchmark-toned] |
| keytao | word2 | 零辅后 | 18.536% | 18.988% | 18.490% | 20.066% | 18.927% | 18.533% | 13.108%[^zh-benchmark-toned] | 11.916%[^zh-benchmark-toned] |
| keytao | word2 | 一辅后 | 3.649% | 3.466% | 3.640% | 3.795% | 3.474% | 3.639% | 1.522%[^zh-benchmark-toned] | 1.406%[^zh-benchmark-toned] |
| keytao | word2 | 二辅后 | 0.416% | 0.371% | 0.412% | 0.440% | 0.374% | 0.413% | 0.080%[^zh-benchmark-toned] | 0.078%[^zh-benchmark-toned] |
| keytao | word3 | 零辅后 | 24.869% | 48.416% | 24.456% | 50.365% | 51.729% | 21.566% | 48.416%[^zh-benchmark-toned] | 20.080%[^zh-benchmark-toned] |
| keytao | word3 | 一辅后 | 6.275% | 17.911% | 6.167% | 19.783% | 21.108% | 5.251% | 17.419%[^zh-benchmark-toned] | 3.830%[^zh-benchmark-toned] |
| keytao | word3 | 二辅后 | 0.858% | 4.198% | 0.809% | 4.948% | 5.498% | 0.729% | 3.998%[^zh-benchmark-toned] | 0.402%[^zh-benchmark-toned] |
| keytao | word4 | 零辅后 | 24.366% | 21.450% | 24.132% | 24.301% | 27.835% | 20.385% | 22.473%[^zh-benchmark-toned] | 20.983%[^zh-benchmark-toned] |
| keytao | word4 | 一辅后 | 4.066% | 2.646% | 3.962% | 3.822% | 4.562% | 3.263% | 2.539%[^zh-benchmark-toned] | 2.740%[^zh-benchmark-toned] |
| keytao | word4 | 二辅后 | 0.455% | 0.242% | 0.421% | 0.366% | 0.499% | 0.383% | 0.176%[^zh-benchmark-toned] | 0.186%[^zh-benchmark-toned] |
| sanpin | character | 零辅后 | 21.001% | 21.876% | 21.001% | 22.111% | 22.208% | 21.001% | 18.216%[^zh-benchmark-toned] | 17.268%[^zh-benchmark-toned] |
| sanpin | character | 一辅后 | 4.748% | 5.070% | 4.748% | 5.379% | 5.062% | 4.748% | 0.000%[^zh-benchmark-toned] | 0.000%[^zh-benchmark-toned] |
| sanpin | character | 二辅后 | 0.702% | 0.746% | 0.702% | 0.786% | 0.774% | 0.702% | 3.466%[^zh-benchmark-toned] | 2.915%[^zh-benchmark-toned] |
| sanpin | word2 | 零辅后 | 18.536% | 18.988% | 18.490% | 20.066% | 18.927% | 18.533% | 0.000%[^zh-benchmark-toned] | 0.000%[^zh-benchmark-toned] |
| sanpin | word2 | 一辅后 | 3.977% | 3.892% | 3.960% | 4.275% | 3.916% | 3.961% | 0.000%[^zh-benchmark-toned] | 0.000%[^zh-benchmark-toned] |
| sanpin | word2 | 二辅后 | 0.589% | 0.557% | 0.582% | 0.632% | 0.564% | 0.587% | 13.108%[^zh-benchmark-toned] | 11.916%[^zh-benchmark-toned] |
| sanpin | word3 | 零辅后 | 24.869% | 48.416% | 24.456% | 50.365% | 51.729% | 21.566% | 48.416%[^zh-benchmark-toned] | 20.080%[^zh-benchmark-toned] |
| sanpin | word3 | 一辅后 | 7.185% | 20.076% | 7.044% | 22.103% | 23.400% | 5.996% | 17.419%[^zh-benchmark-toned] | 3.153%[^zh-benchmark-toned] |
| sanpin | word3 | 二辅后 | 1.372% | 5.908% | 1.321% | 6.948% | 7.610% | 1.090% | 3.998%[^zh-benchmark-toned] | 0.326%[^zh-benchmark-toned] |
| sanpin | word4 | 零辅后 | 24.366% | 21.450% | 24.132% | 24.301% | 27.835% | 20.385% | 22.473%[^zh-benchmark-toned] | 20.983%[^zh-benchmark-toned] |
| sanpin | word4 | 一辅后 | 4.622% | 3.372% | 4.692% | 4.535% | 5.545% | 3.739% | 1.805%[^zh-benchmark-toned] | 2.415%[^zh-benchmark-toned] |
| sanpin | word4 | 二辅后 | 0.619% | 0.348% | 0.631% | 0.565% | 0.708% | 0.512% | 0.134%[^zh-benchmark-toned] | 0.161%[^zh-benchmark-toned] |

### 二／三／四字词终局碰撞桶（v4）

单元格为「碰撞桶／残余条目／跨词长桶／最大桶」。带调适配包未发布该组终局桶计数，不能用四码截面的桶数代填；下面另列已发布的四码截面，继续尝试对照跨词长贡献。

| 编码轨 | 词长 | RC26-39a5bfdc045342cd 21×26 | UED-3158ce08b5bc 21×21 | Overall-17·初代 21×26 | U357·初代 21×21 | 原键道 S005 | 首道 B04 | 冰雪莲道 CR-REF-7e650f7a4c 21×21 | 冰雪鹮道 T2126-V52-M4-ec60a3637a99 21×26 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| keytao | word2 | 3377 / 4033 / 760 / 9 | 2992 / 3621 / 266 / 9 | 3352 / 4000 / 735 / 7 | 3499 / 4298 / 404 / 8 | 3063 / 3671 / 411 / 8 | 3314 / 3965 / 714 / 9 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] |
| keytao | word3 | 2227 / 2799 / 698 / 8 | 7383 / 11845 / 0 / 14 | 2157 / 2713 / 630 / 8 | 8070 / 13632 / 0 / 25 | 8806 / 15424 / 0 / 15 | 1873 / 2295 / 740 / 9 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] |
| keytao | word4 | 1260 / 1531 / 425 / 9 | 666 / 816 / 185 / 9 | 1200 / 1482 / 354 / 8 | 950 / 1159 / 320 / 13 | 1158 / 1473 / 340 / 8 | 962 / 1143 / 482 / 8 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] |
| sanpin | word2 | 4882 / 6271 / 1113 / 11 | 4439 / 5778 / 466 / 8 | 4806 / 6147 / 1036 / 9 | 5126 / 6741 / 712 / 9 | 4641 / 5968 / 746 / 9 | 4903 / 6278 / 1151 / 10 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] |
| sanpin | word3 | 3202 / 4395 / 1079 / 11 | 9075 / 16820 / 0 / 20 | 3060 / 4272 / 969 / 10 | 9642 / 18936 / 0 / 21 | 9925 / 20476 / 0 / 21 | 2640 / 3491 / 1095 / 11 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] |
| sanpin | word4 | 1692 / 2072 / 655 / 10 | 970 / 1169 / 327 / 10 | 1690 / 2083 / 586 / 9 | 1412 / 1721 / 545 / 9 | 1711 / 2096 / 547 / 10 | 1263 / 1466 / 683 / 11 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] |

### 四码五截面碰撞对照

按各词长 Top 500／1000／2000／5000／10000 的标准四码截面，单元格为「跨词长受影响率／首选损失率／碰撞桶／跨词长桶」。它衡量主码的跨词长贡献，不等于补辅后的终局选重率。

| 每类词条截面 | RC26-39a5bfdc045342cd 21×26 | UED-3158ce08b5bc 21×21 | Overall-17·初代 21×26 | U357·初代 21×21 | 原键道 S005 | 首道 B04 | 冰雪莲道 CR-REF-7e650f7a4c 21×21 | 冰雪鹮道 T2126-V52-M4-ec60a3637a99 21×26 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 500 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 1.140% / 0.451% / 43 / 10[^zh-benchmark-toned] | 0.380% / 0.180% / 38 / 3[^zh-benchmark-toned] |
| 1000 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 2.344% / 0.995% / 119 / 33[^zh-benchmark-toned] | 1.283% / 0.550% / 110 / 18[^zh-benchmark-toned] |
| 2000 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 4.297% / 1.513% / 336 / 114[^zh-benchmark-toned] | 2.738% / 0.924% / 314 / 78[^zh-benchmark-toned] |
| 5000 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 9.109% / 2.684% / 1463 / 572[^zh-benchmark-toned] | 5.760% / 1.706% / 1319 / 394[^zh-benchmark-toned] |
| 10000 | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | —[^zh-benchmark-missing] | 15.106% / 4.367% / 4034 / 1770[^zh-benchmark-toned] | 10.170% / 2.861% / 3662 / 1258[^zh-benchmark-toned] |

### 当前结果的读法

日常纯双拼移动手分数可按同一 2149 击键文稿对照：RC26 145.320、UED 134.318、冰雪莲道 121.658、冰雪鹮道 138.089。冰雪鹮道的 v5.2 任务分数低于 RC26，冰雪莲道低于 UED，但这种差异同时包含主码声调信息、形辅合同和候选池贡献，不能单独归因于双拼键位更优。

500／5000 字逐键实战报告仍是各自日期的历史结果；本次不把页面模型值当作重新部署后的候选实测值。当前布局的完整候选及性能验证仅由 GitHub Actions 完成。
