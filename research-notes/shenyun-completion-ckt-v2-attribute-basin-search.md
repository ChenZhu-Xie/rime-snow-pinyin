# 固定 IVUAO CKT v2：跨属性盆地与受约束越谷

日期：2026-10-08。目标沿用固定 IVUAO 21×21 的补全 CKT v2：选重 600 ms，第一个、第二个辅键在模型 CKT 之外各加 300 ms，字词权重 1:2。分数越低越好，S005 在同参数下恒为 10。

## 跨属性主搜索

在既有 v2 前沿、局部下降点和 fixed 目标探索所得候选上重新计算 v2 指标。属性极点按主行、右小指、八项 B、M、v4、v5、S2、无选重 v2 及八条 B 路径选取；选点只使用 `ckt12`，不再误用旧 `fixed12` 列。线段、面片和局部变异中约 80% 明确包含属性极点。

五阶段提出 25,000／20,000／20,000／15,000／20,000，共 **100,000** 个状态；其中 **80,027** 次使用属性极点。连同 474 个起始状态，共 **75,560** 个不同合法状态得到评分。主搜索保存在 [`shenyun-21x21-completion-v2-attribute-face-a.json`](data/shenyun-21x21-completion-v2-attribute-face-a.json)。

随后对各 M/D 边界使用三类合法单步操作做最陡下降：交换两个韵母码位、交换两个韵母物理键、重映射一个声母。M39/D0、M38/D0 又在最便宜的 20 个首步上穷举二步邻居并连续跟随出口。表中“此前”包含本轮开始前已经保存的局部下降结果；“本轮”是最终精确复核值：

| M≤/D≤ | 此前 | 本轮 | 新方案 | 改善 |
| ---: | ---: | ---: | --- | ---: |
| 48/7 | 9.333126 | **9.331550** | `BCW-c55c43d4afaa`（M46/D3） | 0.001576 |
| 45/3 | 9.345809 | **9.345370** | `BCW-cd9ed4c2c0f6`（M45/D3） | 0.000438 |
| 43/2 | 9.358342 | **9.356414** | `BCW-18389e333036`（M43/D2） | 0.001929 |
| 42/1 | 9.439647 | **9.427179** | `BCW-0e456b88a08e`（M42/D1） | 0.012468 |
| 41/0 | 9.492161 | **9.486833** | `BCW-51fa682ff08c`（M41/D0） | 0.005328 |
| 40/0 | 9.499847 | **9.499092** | `BCW-792c54834c66`（M40/D0） | 0.000755 |
| 39/0 | 9.668988 | **9.574938** | `BCW-1ece499ded01`（M39/D0） | 0.094050 |
| 38/0 | 9.896549 | **9.833685** | `BCW-afaecb1b3bef`（M38/D0） | 0.062864 |

M39 链从 9.608208 开始又经过 11 个下降步和 2 次二步越谷，降到 9.574938；最后一次扫描覆盖 15,443 个合 M39/D0 的二步状态，没有找到更优出口。M38 链从 9.834102 经 1 次越谷、1 个下降步到 9.833685；最后覆盖 14,934 个合 M38/D0 的二步状态，也没有找到出口。这里的“局部极小值”只对上述单步操作及有限宽度的二步扫描成立，不表示全局最优或深沟壑。

为检查结果是否已经饱和，又以不同随机种子和排除首轮属性极点的方式独立提出 **100,000** 个状态，得到 **75,204** 个不同合法评分；两轮合计提出 200,000 个状态。第二轮保存在 [`shenyun-21x21-completion-v2-attribute-face-b.json`](data/shenyun-21x21-completion-v2-attribute-face-b.json)。M44/D3 至 M38/D0 的无诊断门槛速度边界均未再改善，但宽边界发现了新的全局最低点 **`BCW-dcfeac16a87b`：9.327231、M48/D7、八项最差比 0.996383**。它在八项 B 门槛内已是一阶局部极小值；最小单步障碍为 0.000328，最便宜 12 个首步生成的 15,624 个二步状态中没有更优出口。

第二轮也补出了保留八项 B 属性的紧 M/D 前沿：

| 门槛 | 方案 | CKT v2 | M/D | 八项最差比 | 下降与越谷 |
| --- | --- | ---: | ---: | ---: | --- |
| 八项 B + 主行/小指 | `BCW-cc1700493eff` | 9.481009 | 44/3 | 0.997933 | 12 步；无二步出口 |
| 八项 B | `BCW-e4f22b522dab` | 9.543560 | 42/2 | 0.997258 | 5 步、2 次越谷；无后续出口 |
| 八项 B | `BCW-59cfeceb4a1a` | 9.569188 | 42/1 | 0.999976 | 6 步；无二步出口 |

其中 D3 点的 Pmax 为 3.1622%，主行占比 52.7525%，同时满足联合门槛。D2、D1 点只要求八项 B，分别用更高小指负载换取更紧的 M/D，不应视为联合门槛候选。

## 定向高维端点搜索

第三轮不再把新方案只作为普通 seed，而将前两轮加入图谱的十三个代表与排除旧极点后重新选择的十六个属性极点组成端点池。90% 的提案显式经过极点策略；其中线段和面片强制包含高维端点，线段有 75% 直接连接当前阶段的低 M/D 父代。预算向紧边界倾斜为 10,000／30,000／35,000／35,000／40,000，共 **150,000** 个提案；其中 135,040 个经过极点策略，91,927 个是显式定向线段或面片，109,525 个新状态得到合法评分。三轮累计提出 **350,000** 个状态。

宽边界和 D3 纯速度前沿没有变化，但定向端点在更紧边界找到了三个新盆地：

| 约束 | 上一轮 | 本轮下降后 | 新方案 | 改善 |
| --- | ---: | ---: | --- | ---: |
| M38/D0 | 9.833685 | **9.797237** | `BCW-6cb12649c8bb` | 0.036448 |
| M≤43/D≤2、八项 B | 9.543560 | **9.540116** | `BCW-d3abc4976719` | 0.003444 |
| M≤42/D≤1、八项 B | 9.569188 | **9.557776** | `BCW-0c02d8019468` | 0.011412 |

M38/D0 随机种子为 9.812093，经 3 个下降步和 1 次双步越谷降到 9.797237；最终最小单步障碍为 0.000272，最便宜 20 个首步生成的 25,656 个二步状态中，14,736 个保持 M38/D0，没有更优出口。D2 八项 B 点通过 1 次双步越谷收敛，最终 5,136 个二步状态通过八项 B 门槛；D1 点经 2 个下降步和 1 次越谷收敛，最终有 4,868 个合门槛二步状态。三条链都只证明指定邻域内的局部极小值。

## 八项 B、主行和小指的联合前沿

主搜索还产生了同时满足以下条件的新区域：

- 八条 B 路径相对冻结 S005 的非首选率全部严格小于 1；
- 主行占比至少 50%；
- Pmax 不超过冻结 R9 的 5.1045%。

原目录同条件最快点为 `BCW-704c0014546c`，9.534130。新种子 `BCW-a2fe89ed3312` 为 9.459750；在每一步和每次越谷都保持三项门槛的条件下，先后经过 14 个下降步和 2 次二步越谷，最终得到 **`BCW-2e945b60f4cb`：9.342404、M48/D7、八项最差比 0.996383、Pmax 3.3192%、主行 50.1362%**。

该点是当前同时通过八项 B、主行和小指三项门槛的最快点，比第二轮全局最低点慢 0.015173。最终局部极小值的最小单步障碍为 0.000334；最便宜 12 个首步产生的二步扫描中，2,212 个状态通过全部门槛，没有更优出口。单独优化八项 B 得到的 9.344052 被它支配，未重复入表。

## 精确复核与产物

三轮共十六个非支配代表均由页面实际使用的 JS 评分器重新计算 native、fixed 和 v2 三套映射；fast/exact v2、编码和八项 B 逐项一致。HTML 目录由 629 增至 **645**，静态档案同步更新。

- 完整指标与最终代表：[`attribute-reviewed.json`](data/shenyun-21x21-completion-v2-attribute-reviewed.json)、[`attribute-gated-reviewed.json`](data/shenyun-21x21-completion-v2-attribute-gated-reviewed.json)。
- 第二轮复搜与规范复核：[`attribute-face-b.json`](data/shenyun-21x21-completion-v2-attribute-face-b.json)、[`attribute-face-b-reviewed.json`](data/shenyun-21x21-completion-v2-attribute-face-b-reviewed.json)。
- 各边界下降：[`attribute-descent-seeds.json`](data/shenyun-21x21-completion-v2-attribute-descent-seeds.json)。
- 自动越谷链：[`attribute-chain-m39.json`](data/shenyun-21x21-completion-v2-attribute-chain-m39.json)、[`attribute-chain-m38.json`](data/shenyun-21x21-completion-v2-attribute-chain-m38.json)、[`attribute-eight-load-chain-2.json`](data/shenyun-21x21-completion-v2-attribute-eight-load-chain-2.json)。
- 第二轮局部链：[`attribute-face-b-global-chain.json`](data/shenyun-21x21-completion-v2-attribute-face-b-global-chain.json)、[`attribute-face-b-d3-gated-chain.json`](data/shenyun-21x21-completion-v2-attribute-face-b-d3-gated-chain.json)、[`attribute-face-b-tight-eight-chain.json`](data/shenyun-21x21-completion-v2-attribute-face-b-tight-eight-chain.json)。
- 定向端点搜索与复核：[`attribute-anchored-face-c.json`](data/shenyun-21x21-completion-v2-attribute-anchored-face-c.json)、[`attribute-anchored-reviewed.json`](data/shenyun-21x21-completion-v2-attribute-anchored-reviewed.json)。
- 定向端点局部链：[`attribute-anchored-m38-chain.json`](data/shenyun-21x21-completion-v2-attribute-anchored-m38-chain.json)、[`attribute-anchored-tight-eight-chain.json`](data/shenyun-21x21-completion-v2-attribute-anchored-tight-eight-chain.json)。
- 可复算工具：[`search_shenyun_21x21_completion_v2.py`](../scripts/research/search_shenyun_21x21_completion_v2.py)、[`descend_completion_fixed_neighborhood.py`](../scripts/research/descend_completion_fixed_neighborhood.py)、[`integrate_shenyun_completion_v2_frontier.py`](../scripts/research/integrate_shenyun_completion_v2_frontier.py)。

## 结构归因与 pattern 定向搜索

保存下来的前沿点有强烈的幸存者偏差，因此先用它们提出假说，再让新搜索器对**全部新评分状态**写出紧凑结构统计。本轮连接三类端点：`i→P` 快速盆地、`i→K/L` 高主行／低小指盆地，以及 D3／D2／D1／M38-D0 紧边界盆地；同时加入主行、Pmax、八项 B、M、S2、v4、v5 和八条分项 B 的反极点。五阶段提出 15,000／30,000／35,000／35,000／45,000，共 **160,000** 次，得到 **114,761** 个不含旧种子的不同新评分状态；前三轮加本轮累计提出 **510,000** 次状态。原始结果和总体统计保存在 [`attribute-pattern-face-d.json`](data/shenyun-21x21-completion-v2-attribute-pattern-face-d.json)。

### `i` 的速度捷径及其代价

在相同 M、D、是否过八项 B 的 37 个可比层内，以各层中位数差再按两组较小样本数加权，`i→P` 相对 `i` 不在 P 上与下列变化共现：

| 指标 | `i→P` 减 `i≠P` | 方向 |
| --- | ---: | --- |
| CKT v2 | **−0.221912** | 更快 |
| S2 | **−2.270451 ms** | 更快 |
| v5 | **−0.209143** | 更好 |
| 八项最差比 | **−0.060414** | 本轮样本中更好 |
| Pmax | **+6.707210 pct** | 明显更差 |
| 主行占比 | **−8.024602 pct** | 明显更差 |
| v4 | +0.013462 | 略差 |

这支持用户观察到的结构：`i→P` 不是偶然标签，而是非常强的速度捷径；但它几乎把高频 `i` 的代价直接变成右小指负担，并拉低主行占比。上述仍是定向提案分布内的条件共现，不是把其余 66 个坐标全部随机化后的因果效应。

### 常见韵母落键 pattern

以下为本轮全部新状态中，相应前 25% 相对其余 75% 的出现率增量；只列信号最清楚者：

| 目标属性 | 富集 pattern（出现率增量） | 大致解释／代价 |
| --- | --- | --- |
| 低 CKT | `e→W` +25.4、`iong→N` +24.2、`ei→X` +23.5、`er→J` +23.5、`ang→M` +22.4 pct | 速度盆地的常见骨架；不保证低 M/D 或低负担 |
| 高主行 | `i→K` +42.3、`e→J/S` +27.9/+27.7、`er→M` +27.0、`i→L` +22.3、`ing→D` +20.7 pct | 把高频韵母放到主行；通常牺牲部分 CKT |
| 低 Pmax | `i→L` +46.1、`ei→C` +25.8、`iong→P` +22.1、`ia→S` +20.1、`ing→D` +17.3、`i→K` +17.2 pct | 把 `i` 移离 P，再用较低频韵母占 P |
| 八项 B 好 | `er→J` +16.3、`un→B` +14.4、`ang→M` +14.2、`ua→D` +13.3、`ui→G` +12.7 pct | 对消歧有帮助，但单项效应比 `i` 的负担效应弱 |
| 紧 M/D + 8B 内低 CKT | `i→P` +57.6、`ia→W` +55.1、`er→J` +52.2、`v→T` +51.9、`in→G` +51.1、`ou→F` +50.7、`ai→H` +50.0、`iang→F` +48.9 pct | 新 D3/D2/D1 快盆地最稳定的联合骨架 |

总体 Spearman 相关中，CKT 与八项最差比为 **+0.871**、v5 为 **+0.637**、S2 为 **+0.580**；进入八项 B 门槛后，CKT 与 v5／S2／v4 的相关进一步升到 **+0.974／+0.903／+0.797**。也就是说，未过门槛时消歧失败主导坏分；一旦锁住八项 B，v5、S2 和 v4 所描述的路径速度重新成为主要梯度。Pmax 与 CKT 为 −0.195、主行与 CKT 为 +0.269，反映“把高频项推向边缘换速度”和“提高主行但牺牲部分模型速度”的总体张力。

### 沿 pattern 找到的新沟壑

随机搜索先得到三个 8B 种子和一个联合门槛种子；再在每一步保持相应门槛，做三类合法单步最陡下降及宽度 20 的二步越谷。最终结果：

| 约束 | 此前 | 新局部底部 | 改善 | `i` 键 | 8B 最差 | Pmax | 主行 |
| --- | ---: | --- | ---: | --- | ---: | ---: | ---: |
| M≤44/D≤3、8B | 9.440387 | **`BCW-27ccf7edd435` · 9.406835** | **0.033551** | P | 0.997869 | 9.9872% | 41.3819% |
| M≤43/D≤2、8B | 9.540116 | **`BCW-ad3d5675952a` · 9.534770** | 0.005346 | P | 0.998605 | 11.5989% | 42.6492% |
| M≤42/D≤1、8B | 9.557776 | **`BCW-88bdd1d4edb9` · 9.556549** | 0.001227 | P | 0.999215 | 9.9872% | 42.2026% |
| M≤43/D≤2、8B+负担+主行 | 9.623532 | **`BCW-ebdbf38c9a07` · 9.581854**（M42/D2） | **0.041679** | K | 0.998573 | 4.6757% | 50.0942% |

D3 点经过 9 个下降步和 2 次二步越谷，最终 5,210 个二步状态保持 M/D 与 8B 门槛而无更优出口；D2 纯 8B 点经过 1 步和 1 次越谷；D1 种子本身即为局部极小值。联合 D2 点经过 8 步和 5 次二步越谷，最终扫描无出口。D0 的 45,000 次提案没有刷新纯速度边界，汇总池中仍没有 M≤41/D0 且八项全胜的状态。

四个终点均由页面 JS 对 native、fixed、v2 映射独立重算，fast/exact CKT、编码和八项 B 一致，已加入本机 R11 图谱；目录由 645 增至 **649**。局部链分别保存在 [`pattern-eight-chains.json`](data/shenyun-21x21-completion-v2-attribute-pattern-eight-chains.json)、[`pattern-load-chain.json`](data/shenyun-21x21-completion-v2-attribute-pattern-load-chain.json) 和 [`pattern-load-chain-2.json`](data/shenyun-21x21-completion-v2-attribute-pattern-load-chain-2.json)，完整复算行在 [`pattern-reviewed.json`](data/shenyun-21x21-completion-v2-attribute-pattern-reviewed.json)。结构统计脚本为 [`analyze_completion_v2_patterns.py`](../scripts/research/analyze_completion_v2_patterns.py)。

模型分数仍不是人体实测连续输入速度。选重、候选阅读、上屏动作和训练域外键序列沿用既有冻结假设；本轮只扩展了离散编码空间的可复算证据。
### Motif 软约束与低维联合前沿（2026-10-08）

本轮把上一轮前沿和属性极点作为线段/多面端点，加入三类实验：motif 软钉扎、扩大到已知 motif 韵母的双向三循环邻域，以及严格门槛下的二步/三步越谷。搜索器现在支持阶段检查点和 `eight` / `load-buffer` 父代保留，避免长实验中断后丢失前沿。

| 口径 | 上轮前沿 | 本轮前沿 | 改善 | 8B 最坏比 | Pmax | 主行 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| M≤43/D≤2、8B+Pmax+主行 | 9.581854 (`BCW-ebdbf38c9a07`) | **9.576130 (`BCW-d6f3dd3a4c89`)** | **0.005723** | 0.998212 | 4.6757% | 50.0942% |
| M≤42/D≤1、8B+Pmax+主行 | 9.623532 | **9.590853 (`BCW-8467ad5c0fc2`)** | **0.032679** | 0.998212 | 3.3877% | 50.0942% |

D3 的 fast motif 软引导共做 50,000 次提案，得到 41,161 个合法状态和 974 次 8B 命中，没有低于 `BCW-27ccf7edd435` 的 9.406835；强锁定 pilot 的 8B 命中率约 1.36%，改成 45% 提案只锁 3–5 位后约为 2.37%，但仍未形成新 D3 沟壑。当前 D3 纪录进一步扫描了 1,350 个合法一步邻居、27,215 个两步候选和 13,640 个三步候选，无出口。

D2 `load-buffer` 搜索的 25,000 次提案产生 20,934 个合法状态、984 次 8B 和 365 次严格联合命中；新点来自 `BCW-bba4e6d85cee` 与旧联合点的线段。其后 1,382 个合法一步邻居、27,658 个两步候选、13,911 个三步候选均无更优出口，最薄一步势垒为 +0.000130。

D1 新端点先由高维 D3 搜索的切片偶然产生，再经两步直接下降从 9.594497 到 9.590853；随后 1,382 个合法一步邻居、27,646 个两步候选和 13,913 个三步候选无出口。弱 mixed motif 的前 10,000 次提案有 8,476 个合法状态、472 次 8B 命中，未刷新；消融后构造的 joint motif 又做 10,000 次提案，8,404 个合法状态、310 次 8B 命中，也未刷新。

单换消融显示：纯 8B 高速点完整携带 fast motif，但同时有 Pmax 9.9872%、主行 42.2026%；D1 联合点只稳定保留 `er→J, in→G, ai→H, e→S, ing→D`。对联合点补 `i→P` 会令 CKT +0.082083、8B 最坏比 +0.053197、Pmax +7.3095 pct、主行 −6.7316 pct；`iang→F` 和 `ia→Z` 也会破坏 8B。由此可见 motif 更适合作为群体分层和端点筛选信号，而不是跨盆地之后的硬修复模板。

两个新前沿都通过 exact/native/fixed/v2 独立复算并加入本机 R11 图谱，目录由 649 增至 **651**。本轮主要证据见 [`motif-fast-loose-d3-search.json`](data/shenyun-21x21-completion-v2-motif-fast-loose-d3-search.json)、[`motif-mixed-buffer-d2-search.json`](data/shenyun-21x21-completion-v2-motif-mixed-buffer-d2-search.json)、[`motif-reviewed.json`](data/shenyun-21x21-completion-v2-motif-reviewed.json) 和 [`motif-d1-ablation.json`](data/shenyun-21x21-completion-v2-motif-d1-ablation.json)。
