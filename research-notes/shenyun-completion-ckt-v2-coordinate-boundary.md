# CKT v2 坐标面与 D1→D0 边界探索

日期：2026-10-09

这一轮不再只做随机插值，而把若干前沿之间所有逐坐标组合完整枚举，并在 M/D 与 8B 预筛后才计算 CKT。

| 区域 | 完整组合数 | 合法/门内数 | 结果 |
| --- | ---: | ---: | --- |
| D1/D2 联合前沿坐标面 | 512 | 107 合法，11 个同时满足 8B 与负载门槛 | 未改善联合前沿 |
| D1/D2 纯 8B 坐标面 | 16,384 | 1,735 合法，49 个 8B | 得到新的 D2/D1 纯 8B 前沿 |
| D1 纯 8B ↔ D1 联合前沿 | 524,288 | 54,462 合法，114 个新增 8B，7 个满足负载/主行门槛 | 两端各自目标均未改善，显示两盆地间的结构墙 |
| D0 快速前沿之间 | 256 | 158 合法 | 未改善 D0 速度 |
| D0 两个近 8B 端点的 21 维韵母面 | **2,097,152** | **317,390 个合法 M≤41/D0；仅 6 个在 1.01 内；0 个 8B** | 完整否定该坐标面中的 D0 8B 通路 |

## 新纯 8B 前沿

- D2 `BCW-f78441d245f0`：CKT 9.533870，8B 最坏比 0.999215。
- D1 `BCW-885e3bf92834`：CKT 9.552096，8B 最坏比 0.999215。

两者通过 exact/native/fixed/v2 重算并加入 R11 图谱，目录由 651 增至 **653**。

## D0 的词路径墙

D0 韵母面的最好近门槛点为 `BCW-5d4b57eba3b0`（CKT 9.922072，8B 最坏比 1.009328507）。直接最小化最坏 8B 比值，经一次两步平坦逃逸只降到 `BCW-046bde7dd163` 的 1.009327292，同时 CKT 恶化到 10.041418；其后 1,252 个一阶、24,815 个二阶和 12,451 个三阶合法状态无出口。

该点的字符侧四项均已优于 S005，而词侧四项全部超线：`wj1` 1.009327、`ws2` 1.008953、`wj2` 1.008916、`ws1` 1.006733。因此 D0 的 8B 墙主要是词路径整体约束，不是单一字符指标。

## D1→D0 边界投影

从两个性质不同的 D1 8B 前沿投影到 M≤41/D0，出现了可复现的同一闸门：

| D1 起点 | 起点 8B | 唯一的一步 D0 落点 | 落点 8B | D0 局部底 | 完整 CKT |
| --- | ---: | --- | ---: | ---: | ---: |
| `BCW-885e3bf92834`（纯 8B） | 0.999215 | `onset:11→16` | 1.179715 | `BCW-731b2e669c8a`，1.022106 | 10.028299 |
| `BCW-8467ad5c0fc2`（8B+低 Pmax+高主行） | 0.998212 | `onset:11→16` | 1.194262 | `BCW-5e17bcba3eda`，1.020932 | 10.030744 |

两个起点的一阶邻域都只有这一个状态进入 D0；随后最佳第二步也同为 `onset:16→9`，再靠韵母交换下降。第一条路径在 20,231 个二步与 10,169 个三步候选中无出口；第二条路径在 9,896 个二步候选中无出口。这说明已知 D1 8B 盆地与 D0 近 8B 盆地之间不是平缓相连，而是被由声母结构触发的高断崖隔开。

## 证据文件

- [`coordinate-face-reviewed.json`](data/shenyun-21x21-completion-v2-coordinate-face-reviewed.json)
- [`coordinate-face-d1-eight-load.json`](data/shenyun-21x21-completion-v2-coordinate-face-d1-eight-load.json)
- [`coordinate-face-d0-near-eight-a.json`](data/shenyun-21x21-completion-v2-coordinate-face-d0-near-eight-a.json)
- [`coordinate-face-d0-near-eight-b.json`](data/shenyun-21x21-completion-v2-coordinate-face-d0-near-eight-b.json)
- [`d0-eight-descent.json`](data/shenyun-21x21-completion-v2-d0-eight-descent.json)
- [`d1-to-d0-reviewed.json`](data/shenyun-21x21-completion-v2-d1-to-d0-reviewed.json)

## M/D 解耦、声母分层与跨壁 beam（2026-10-09）

先从两个 M41/D1 端点分别投影到 M42/D0 与 M41/D0。两种上限均复现 `onset:11→16`、`onset:16→9` 闸门；M42/D0 最终为 1.020004，M41/D0 最终为 1.020225，额外一点 M 没有连接到原生 D0 的 1.009327 盆地。从原生 D0 点直接放宽到 M42 后，最坏 8B 与总词超线两个目标也都没有出口：各检查 1,290 个一阶、25,575 个二阶及 12,831 个三阶合法状态。

随后加入按 27 位声母签名保留代表、强制 1–3 位声母变异，以及 `wj1/wj2/ws1/ws2` 多目标极点保留。三批搜索结果如下：

| 搜索 | 提案 | 新目标 M≤42/D0 | 结果 |
| --- | ---: | ---: | --- |
| 声母签名分层 | 20,000 | 6,718 | 无 8B；发现 M42/D0 速度点 |
| 多词路径分层 | 20,000 | 5,206 | 无 8B；最坏比仍为 1.009327292 |
| 词路径极点定向交叉 | 20,000 | 8,723 | 13,560 次端点交叉，无 8B |

三批合计约 20,600 个新目标状态后，D0 最坏比仍精确停在 1.009327292。`wj2` 与 `ws1` 极点声母完全相同、仅 19 个韵母坐标不同，因此又完整穷举其 524,288 个坐标组合：84,222 个合法 M≤42/D0，300 个进入 8B≤1.03，没有任何点改善现有极值。

跨壁 beam 同时为 D0、D1 保留独立名额，并按最坏 8B、总词超线与四条词路径轮流选拔。四层共访问 92,378 个唯一状态，完整 B 评分 70,182 个；D0 四层均停在 1.009327292，但 D1 产生新的低比值平台 0.993104111。该平台经 1,244 个一阶、19,745 个二阶及 9,907 个三阶合法状态扫描确认无出口。

从这一属性富余种子出发，在 8B、Pmax、主行严格门内做 CKT 下降，经 11 个一阶下降和一次二步逃逸，得到新的 D1 综合前沿：

| 前沿 | CKT v2 | M/D | 8B 最坏比 | Pmax | 主行 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `BCW-0a4182c7a5a0` | **9.584424900** | 42/1 | **0.993814** | 4.3004% | **51.3922%** |

它相对旧 D1 综合点 `BCW-8467ad5c0fc2` 同时改善 CKT（9.590853→9.584425）、8B 裕量（0.998212→0.993814）与主行（50.0942%→51.3922%）。将该新点再次投影到 D0 时，仍第三次复现同一声母闸门，最终闭合于 1.022763。

声母分层还发现新的 M42/D0 速度盆地。局部下降后的盆底为 `BCW-0aaa5551675d`：CKT **9.482568239**、8B 1.013225；1,310 个一阶、20,797 个二阶和 10,424 个三阶合法状态无出口。两个新前沿均通过 exact/native/fixed/v2 集成验证，R11 图谱由 653 增至 **656**（包含 M42/D0 随机种子作为下降链前驱）。

新增主要证据为 [`onset-strata-m42d0-search.json`](data/shenyun-21x21-completion-v2-onset-strata-m42d0-search.json)、[`word-pareto-beam-m42d0-search.json`](data/shenyun-21x21-completion-v2-word-pareto-beam-m42d0-search.json)、[`word-pareto-coordinate-face.json`](data/shenyun-21x21-completion-v2-word-pareto-coordinate-face.json)、[`d1-d0-stratified-beam.json`](data/shenyun-21x21-completion-v2-d1-d0-stratified-beam.json)、[`d1-beam-combined-reviewed.json`](data/shenyun-21x21-completion-v2-d1-beam-combined-reviewed.json) 与 [`m42d0-speed-reviewed.json`](data/shenyun-21x21-completion-v2-m42d0-speed-reviewed.json)。
