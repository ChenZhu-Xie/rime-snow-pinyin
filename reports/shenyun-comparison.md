# 神韵两代布局与 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts)、[B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 四方案比较

本文把两个现行专有名词置于同等地位：**[无飞键道(U357) 21×21 双拼](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code)**与**[神韵(Overall-17) 21×26 双拼](https://input.tansongchen.com/snow-feihua/basic.html)**。另以[星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts)、[首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 为参照。四方案共用 [Common399](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md)、冻结 20 合同、同一字词与形码数据、[CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 模型及日常八场景文稿。

必须同时注意合同边界：[无飞键道(U357)](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code)与 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 采用传统 21×21 合同；[神韵(Overall-17)](https://input.tansongchen.com/snow-feihua/basic.html)与 [B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 采用四码顶合同。21×26 相比 21×21 扩大了韵码域，不能把跨键域领先直接解释成同键域映射胜负。

表中 **粗体** ★ 只比较同为传统 21×21 合同的[无飞键道(U357)](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code)与原键道 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts)；**粗体** ★★ 比较[神韵(Overall-17)](https://input.tansongchen.com/snow-feihua/basic.html)、[无飞键道(U357)](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code)与原键道 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts)，[首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 不参与；🥇 比较全部四方案。遇到并列最优时，所有并列单元格均保留相同标记。

## 总览

| 指标 | [神韵(Overall-17) 21×26 双拼](https://input.tansongchen.com/snow-feihua/basic.html) | [无飞键道(U357) 21×21 双拼](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code) | [星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) | 何为好 |
| --- | --- | --- | --- | --- | --- |
| [M-R2](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 记忆项 | **36.000000** ★★ 🥇 | **40.000000** ★ | 44.000000 | 51.000000 | 越低越好 |
| [FA-1](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 逻辑审计 | **98.298315** ★★ | **98.298315** ★ ★★ | 97.708694 | 99.763391 🥇 | 越高越一致 |
| [LU-v1r](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 逻辑均匀度 | **81.043390** ★★ | 73.529803 | **78.897555** ★ | 83.107434 🥇 | 越高越统一 |
| [Common399](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 唯一码 | **399** ★★ 🥇 | 357 | **372** ★ | 399 🥇 | 越高越少重码 |
| 频率加权 S2 miss | **0.000%** ★★ 🥇 | 3.270% | **0.929%** ★ | 0.000% 🥇 | 越低越好 |
| S2 补全平均码长 | **2.0000** ★★ 🥇 | 2.1474 | **2.0725** ★ | 2.0000 🥇 | 越低越好 |
| S2 补全中心时间（ms） | **75.672** ★★ 🥇 | **89.917** ★ | 90.257 | 79.890 | 越低越好 |
| 综合补全 [CKT v3](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) | **9.630039** ★★ | **9.782135** ★ | 10.000000 | 9.461105 🥇 | 越低越好；历史情景 |
| 综合补全 [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) | **9.185254** ★★ | **9.716421** ★ | 10.000000 | 9.184607 🥇 | 越低越好；现行主指标 |
| [A7E-v3](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 系综当量 | **10.620559** ★★ | **10.737188** ★ | 10.740028 | 10.519452 🥇 | 越低越好；冻结历史轴 |
| [A7E-v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 系综当量 | **10.684702** ★★ | **10.804598** ★ | 10.805830 | 10.583290 🥇 | 越低越好；冻结历史轴 |
| [A7E-v5](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 系综当量 | 10.821925 | **10.473306** ★ ★★ 🥇 | 11.478960 | 11.091225 | 越低越好；CKT-only |
| [A7E-v6-CW150](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) | 9.534119 | **9.512904** ★ ★★ 🥇 | 10.000000 | 9.589632 | 越低越好；情景指标 |
| 八轨综合选重率 | **0.609%** ★★ | **1.443%** ★ | 1.532% | 0.572% 🥇 | 越低越好 |
| 八轨第一辅键率 | **20.831%** ★★ | **26.150%** ★ | 26.413% | 19.746% 🥇 | 越低越好 |
| 八轨第二辅键率 | **4.459%** ★★ | **7.040%** ★ | 7.201% | 4.158% 🥇 | 越低越好 |
| 日常同手率 | **45.882%** ★★ | 46.533% | **45.882%** ★ ★★ | 45.416% 🥇 | 越低越好；非独立速度结论 |
| 日常平均有效距离 | 0.7118 | **0.6555** ★ ★★ 🥇 | 0.6796 | 0.7012 | 越低越好 |
| 20 合同 QAZ 左小指组峰值 | 18.895% | **16.312%** ★ ★★ 🥇 | 17.160% | 16.661% | 越低越好 |
| 20 合同 P 区右小指组峰值 | 3.516% | 5.104% | **2.774%** ★ ★★ | 1.888% 🥇 | 越低越好 |
| 20 合同最大单指峰值 | 27.671% | **25.215%** ★ ★★ 🥇 | 29.531% | 29.271% | 越低越好 |
| S2 主键区占比 | 37.025% | **52.031%** ★ ★★ 🥇 | 49.001% | 36.600% | 越高越好 |
| 20 合同 TYB 双食指组峰值 | **12.422%** ★★ | **14.092%** ★ | 14.733% | 12.358% 🥇 | 越低越好 |
| 20 合同主键区下限 | 24.733% | **37.620%** ★ ★★ 🥇 | 30.815% | 24.243% | 越高越好 |
| 日常纯双拼移动手分数（含标点） | 132.219 | **143.380** ★ ★★ 🥇 | 138.672 | 135.310 | 越高越好 |

四方案的飞键成分（声母／零声母组／韵母）依次为：[神韵(Overall-17) 21×26 双拼](https://input.tansongchen.com/snow-feihua/basic.html) **0 / 0 / 0** ★★ 🥇、[无飞键道(U357) 21×21 双拼](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code) **0 / 0 / 0** ★ ★★ 🥇、[星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 2 / 0 / 1、[首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 0 / 1 / 7。飞键按 [Common399](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 实际二键码统计；不同成分共用一键或成分整体移位不计飞键。

## [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 成本分解

[CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 按单字、二字、三字、四字词权重 `1:3:1:1`，冰雪键道与冰雪三拼等权，以 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts)＝10 做四次幂聚合。第一／第二辅键各按 300 ms；非首选固定决策 600 ms，每排除一个更高候选 50 ms，每跨 9 个候选翻页 300 ms。

| 方案 | 运动（ms） | 第一辅键（ms） | 第二辅键（ms） | 固定选重决策（ms） | 候选扫描（ms） | 翻页（ms） | 线性总计（ms） |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [神韵(Overall-17) 21×26 双拼](https://input.tansongchen.com/snow-feihua/basic.html) | **345.236** ★★ 🥇 | **62.492** ★★ | **13.378** ★★ | **3.655** ★★ | **0.386** ★★ | **0.0002** ★★ 🥇 | **425.148** ★★ |
| [无飞键道(U357) 21×21 双拼](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code) | **348.003** ★ | **78.450** ★ | **21.121** ★ | **8.660** ★ | **1.138** ★ | 0.0167 | **457.389** ★ |
| [星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | 359.225 | 79.240 | 21.604 | 9.192 | 1.234 | **0.0165** ★ | 470.511 |
| [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) | 345.472 | 59.239 🥇 | 12.474 🥇 | 3.429 🥇 | 0.364 🥇 | 0.0003 | 420.978 🥇 |

线性总计只用于解释成本来源，正式 [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 仍按八条轨的四次幂聚合。

| [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 情景 | [神韵(Overall-17) 21×26 双拼](https://input.tansongchen.com/snow-feihua/basic.html) | [无飞键道(U357) 21×21 双拼](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code) | [星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) |
| --- | --- | --- | --- | --- |
| 仅运动时间 | **9.576826** ★★ | **9.634568** ★ | 10.000000 | 9.573778 🥇 |
| 运动＋两级辅键，不计选重／扫描／翻页 | **9.227535** ★★ | **9.718997** ★ | 10.000000 | 9.219064 🥇 |
| 完整默认情景，但翻页为 0 ms | **9.185356** ★★ | **9.716408** ★ | 10.000000 | 9.184685 🥇 |
| 完整默认 [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) | **9.185254** ★★ | **9.716421** ★ | 10.000000 | 9.184607 🥇 |

## 冻结语料加权非首选率

| 编码轨 | 词长 | [神韵(Overall-17) 21×26 双拼](https://input.tansongchen.com/snow-feihua/basic.html) | [无飞键道(U357) 21×21 双拼](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code) | [星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) |
| --- | --- | --- | --- | --- | --- |
| 冰雪键道 | 单字 | **0.443%** ★★ 🥇 | 0.489% | **0.480%** ★ | 0.443% 🥇 |
| 冰雪键道 | 二字词 | 0.412% | 0.440% | **0.374%** ★ ★★ 🥇 | 0.413% |
| 冰雪键道 | 三字词 | **0.809%** ★★ | **4.948%** ★ | 5.498% | 0.729% 🥇 |
| 冰雪键道 | 四字词 | 0.421% | **0.366%** ★ ★★ 🥇 | 0.499% | 0.383% |
| 冰雪三拼 | 单字 | **0.702%** ★★ 🥇 | 0.786% | **0.774%** ★ | 0.702% 🥇 |
| 冰雪三拼 | 二字词 | 0.582% | 0.632% | **0.564%** ★ ★★ 🥇 | 0.587% |
| 冰雪三拼 | 三字词 | **1.321%** ★★ | **6.948%** ★ | 7.610% | 1.090% 🥇 |
| 冰雪三拼 | 四字词 | 0.631% | **0.565%** ★ ★★ | 0.708% | 0.512% 🥇 |

## 逐级辅键后的频率加权残余非首选率

“零辅后”是裸编码后仍需第一辅键的权重；“一辅后”是第一辅键后仍需第二辅键的权重；“二辅后”是第二辅键后仍需人工选重的权重。

| 编码轨 | 词长 | 阶段 | [神韵(Overall-17) 21×26 双拼](https://input.tansongchen.com/snow-feihua/basic.html) | [无飞键道(U357) 21×21 双拼](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code) | [星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) |
| --- | --- | --- | --- | --- | --- | --- |
| 冰雪键道 | 单字 | 零辅后 | **20.851%** ★★ 🥇 | **21.960%** ★ | 22.061% | 20.851% 🥇 |
| 冰雪键道 | 单字 | 一辅后 | **4.097%** ★★ 🥇 | 4.653% | **4.567%** ★ | 4.097% 🥇 |
| 冰雪键道 | 单字 | 二辅后 | **0.443%** ★★ 🥇 | 0.489% | **0.480%** ★ | 0.443% 🥇 |
| 冰雪键道 | 二字词 | 零辅后 | **18.490%** ★★ 🥇 | 20.066% | **18.927%** ★ | 18.533% |
| 冰雪键道 | 二字词 | 一辅后 | 3.640% | 3.795% | **3.474%** ★ ★★ 🥇 | 3.639% |
| 冰雪键道 | 二字词 | 二辅后 | 0.412% | 0.440% | **0.374%** ★ ★★ 🥇 | 0.413% |
| 冰雪键道 | 三字词 | 零辅后 | **24.456%** ★★ | **50.365%** ★ | 51.729% | 21.566% 🥇 |
| 冰雪键道 | 三字词 | 一辅后 | **6.167%** ★★ | **19.783%** ★ | 21.108% | 5.251% 🥇 |
| 冰雪键道 | 三字词 | 二辅后 | **0.809%** ★★ | **4.948%** ★ | 5.498% | 0.729% 🥇 |
| 冰雪键道 | 四字词 | 零辅后 | **24.132%** ★★ | **24.301%** ★ | 27.835% | 20.385% 🥇 |
| 冰雪键道 | 四字词 | 一辅后 | 3.962% | **3.822%** ★ ★★ | 4.562% | 3.263% 🥇 |
| 冰雪键道 | 四字词 | 二辅后 | 0.421% | **0.366%** ★ ★★ 🥇 | 0.499% | 0.383% |
| 冰雪三拼 | 单字 | 零辅后 | **21.001%** ★★ 🥇 | **22.111%** ★ | 22.208% | 21.001% 🥇 |
| 冰雪三拼 | 单字 | 一辅后 | **4.748%** ★★ 🥇 | 5.379% | **5.062%** ★ | 4.748% 🥇 |
| 冰雪三拼 | 单字 | 二辅后 | **0.702%** ★★ 🥇 | 0.786% | **0.774%** ★ | 0.702% 🥇 |
| 冰雪三拼 | 二字词 | 零辅后 | **18.490%** ★★ 🥇 | 20.066% | **18.927%** ★ | 18.533% |
| 冰雪三拼 | 二字词 | 一辅后 | 3.960% | 4.275% | **3.916%** ★ ★★ 🥇 | 3.961% |
| 冰雪三拼 | 二字词 | 二辅后 | 0.582% | 0.632% | **0.564%** ★ ★★ 🥇 | 0.587% |
| 冰雪三拼 | 三字词 | 零辅后 | **24.456%** ★★ | **50.365%** ★ | 51.729% | 21.566% 🥇 |
| 冰雪三拼 | 三字词 | 一辅后 | **7.044%** ★★ | **22.103%** ★ | 23.400% | 5.996% 🥇 |
| 冰雪三拼 | 三字词 | 二辅后 | **1.321%** ★★ | **6.948%** ★ | 7.610% | 1.090% 🥇 |
| 冰雪三拼 | 四字词 | 零辅后 | **24.132%** ★★ | **24.301%** ★ | 27.835% | 20.385% 🥇 |
| 冰雪三拼 | 四字词 | 一辅后 | 4.692% | **4.535%** ★ ★★ | 5.545% | 3.739% 🥇 |
| 冰雪三拼 | 四字词 | 二辅后 | 0.631% | **0.565%** ★ ★★ | 0.708% | 0.512% 🥇 |

## 二／三／四字词的终局碰撞桶

单元格依次为“碰撞桶数／残余条目数／跨词长桶数／最大桶成员数”。不同合同的共享池结构不同，复合单元格不标单一胜负。

| 编码轨 | 词长 | [神韵(Overall-17) 21×26 双拼](https://input.tansongchen.com/snow-feihua/basic.html) | [无飞键道(U357) 21×21 双拼](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code) | [星空键道 S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) | [首道 B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) |
| --- | --- | --- | --- | --- | --- |
| 冰雪键道 | 二字词 | 3352／4000／735／7 | 3499／4298／404／8 | 3063／3671／411／8 | 3314／3965／714／9 |
| 冰雪键道 | 三字词 | 2157／2713／630／8 | 8070／13632／0／25 | 8806／15424／0／15 | 1873／2295／740／9 |
| 冰雪键道 | 四字词 | 1200／1482／354／8 | 950／1159／320／13 | 1158／1473／340／8 | 962／1143／482／8 |
| 冰雪三拼 | 二字词 | 4806／6147／1036／9 | 5126／6741／712／9 | 4641／5968／746／9 | 4903／6278／1151／10 |
| 冰雪三拼 | 三字词 | 3060／4272／969／10 | 9642／18936／0／21 | 9925／20476／0／21 | 2640／3491／1095／11 |
| 冰雪三拼 | 四字词 | 1690／2083／586／9 | 1412／1721／545／9 | 1711／2096／547／10 | 1263／1466／683／11 |

## 边界与结论

- [神韵(Overall-17)](https://input.tansongchen.com/snow-feihua/basic.html)以 21×26 声韵域实现 [Common399](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 399 个唯一码、[M-R2](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md)＝36，并采用[飞花式四码顶](https://input.tansongchen.com/snow-feihua/basic.html)；它在现行 [CKT v4](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 中与 [B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 接近，同时保持零飞键，但日常文稿移动手分数及主键区指标不如[无飞键道(U357)](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code)。
- [无飞键道(U357)](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code)在 21×21 键域中保留 42 个音节重码桶，换来更高的日常纯双拼移动手分数、较高主键区占比和较低最大单指峰值；它与 [S005](https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts) 才是直接的同键域比较。
- [B04](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 的 26×26 大码域和四码顶合同带来零音节重码及较低补全成本，但其飞键、记忆项和日常路径指标采用另一种取舍。
- 所有模型分数都用于同语料、同模型横向复算，不等同真人输入速度。

机器可复核数据见 [`shenyun-comparison.json`](shenyun-comparison.json)。[神韵(Overall-17)](https://input.tansongchen.com/snow-feihua/basic.html)的底层方案 ID 为 `SNOW-SHENYUN-21X26-PRODUCTION`；R11 仅是承载该条目与复算函数的 benchmark 页面版本，不是方案名称。
