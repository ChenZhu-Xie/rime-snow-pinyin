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
