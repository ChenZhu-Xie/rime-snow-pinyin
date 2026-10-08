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

## 八项 B、主行和小指的联合前沿

主搜索还产生了同时满足以下条件的新区域：

- 八条 B 路径相对冻结 S005 的非首选率全部严格小于 1；
- 主行占比至少 50%；
- Pmax 不超过冻结 R9 的 5.1045%。

原目录同条件最快点为 `BCW-704c0014546c`，9.534130。新种子 `BCW-a2fe89ed3312` 为 9.459750；在每一步和每次越谷都保持三项门槛的条件下，先后经过 14 个下降步和 2 次二步越谷，最终得到 **`BCW-2e945b60f4cb`：9.342404、M48/D7、八项最差比 0.996383、Pmax 3.3192%、主行 50.1362%**。

该点是当前同时通过八项 B、主行和小指三项门槛的最快点，比第二轮全局最低点慢 0.015173。最终局部极小值的最小单步障碍为 0.000334；最便宜 12 个首步产生的二步扫描中，2,212 个状态通过全部门槛，没有更优出口。单独优化八项 B 得到的 9.344052 被它支配，未重复入表。

## 精确复核与产物

两轮共十三个非支配代表均由页面实际使用的 JS 评分器重新计算 native、fixed 和 v2 三套映射；fast/exact v2、编码和八项 B 逐项一致。HTML 目录由 629 增至 **642**，静态档案同步更新。

- 完整指标与最终代表：[`attribute-reviewed.json`](data/shenyun-21x21-completion-v2-attribute-reviewed.json)、[`attribute-gated-reviewed.json`](data/shenyun-21x21-completion-v2-attribute-gated-reviewed.json)。
- 第二轮复搜与规范复核：[`attribute-face-b.json`](data/shenyun-21x21-completion-v2-attribute-face-b.json)、[`attribute-face-b-reviewed.json`](data/shenyun-21x21-completion-v2-attribute-face-b-reviewed.json)。
- 各边界下降：[`attribute-descent-seeds.json`](data/shenyun-21x21-completion-v2-attribute-descent-seeds.json)。
- 自动越谷链：[`attribute-chain-m39.json`](data/shenyun-21x21-completion-v2-attribute-chain-m39.json)、[`attribute-chain-m38.json`](data/shenyun-21x21-completion-v2-attribute-chain-m38.json)、[`attribute-eight-load-chain-2.json`](data/shenyun-21x21-completion-v2-attribute-eight-load-chain-2.json)。
- 第二轮局部链：[`attribute-face-b-global-chain.json`](data/shenyun-21x21-completion-v2-attribute-face-b-global-chain.json)、[`attribute-face-b-d3-gated-chain.json`](data/shenyun-21x21-completion-v2-attribute-face-b-d3-gated-chain.json)、[`attribute-face-b-tight-eight-chain.json`](data/shenyun-21x21-completion-v2-attribute-face-b-tight-eight-chain.json)。
- 可复算工具：[`search_shenyun_21x21_completion_v2.py`](../scripts/research/search_shenyun_21x21_completion_v2.py)、[`descend_completion_fixed_neighborhood.py`](../scripts/research/descend_completion_fixed_neighborhood.py)、[`integrate_shenyun_completion_v2_frontier.py`](../scripts/research/integrate_shenyun_completion_v2_frontier.py)。

模型分数仍不是人体实测连续输入速度。选重、候选阅读、上屏动作和训练域外键序列沿用既有冻结假设；本轮只扩展了离散编码空间的可复算证据。
