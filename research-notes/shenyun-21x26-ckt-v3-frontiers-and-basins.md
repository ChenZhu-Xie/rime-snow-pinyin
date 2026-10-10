# 冰雪神韵 21×26（AEUIO/IEUAO 锁定·399 无重码·纯 Y 零声母）CKT v3 前沿、新盆地与深沟壑探索报告

## 1. 探索背景、口径契约与目标

在 21×21 口径持续推进的同时，本轮在独立工作树（`feat/shenyun-21x26-ckt-v3`）中围绕 **Completion CKT v3**（$\tau = 600\text{ ms},\ \text{firstAux} = 300\text{ ms},\ \text{secondAux} = 300\text{ ms}$，以 `S005` 为基准的 8 轨道 `[1, 3, 1, 1, 1, 3, 1, 1]` 四次幂均值，其中单字:二字词:三字词:四字词权重为 `1:3:1:1`）展开高维空间探索。所有探索方案均严格锁定以下四项硬契约：

1. **键域容量**：`capacity = [21, 26]`，`actual = [21, 26]`（21 个声母键与 5 个元音辅码键 `AEIOU` 完全互斥，26 个字母键全覆盖韵母）；
2. **辅码顺序固定**：物理辅码键映射恒定为 `tone = "IEUAO"`（对应声调 1–5 声为 `I/E/U/A/O`，形码 `AEUIO` 原位不动，`defaultAuxOrder = True`）；
3. **裸二键 399 音节无重码**：Common399 全部 399 个基础音节具有唯一二键编码（`unique == 399`，裸二键重码对数 `pairs == 0`）；
4. **无声韵飞键（纯 Y 零声母）**：`zeroOnsetScope = "pure-y"`（即 `initialMap["Y"] == initialMap["YU"]`，且所有声母、韵母均为一对一确定性单键映射，无条件分支或声韵飞键）。

### 1.1 历史种子池全量普查与多极极端种子选取
通过 [`scripts/research/harvest_all_21x26_pools.py`](file:///d:/C2D/Documents/rime-snow-pinyin/scripts/research/harvest_all_21x26_pools.py) 对离线图谱 `a7_CKT_R11.html` 及全部历史搜索池（R2、R3、R5、R6、R7、R9、R10、NF4、SNF4、Six-Cases、Constrained Continuation 1–5）进行全量扫描，共提取出 **1,628 个满足上述四项硬契约的历史有效方案**（归档于 [`research-notes/data/shenyun-21x26-all-historical-pools-v3.json`](file:///d:/C2D/Documents/rime-snow-pinyin/research-notes/data/shenyun-21x26-all-historical-pools-v3.json)），包含 **196 种不同声母布局**与 **1,551 种不同韵母布局**。

从中提取各维度极端出色的代表方案作为高维连线与扫面的端点种子：
- **历史 CKT v3 极速与低裸 CKT 极点**：`NF4I-AE-Z-M40-09`（$M=40, D=6, V=0$，历史 HTML 最快 `ckt_v3 = 9.55058`，`S2ms = 66.71ms`，`E6 = 9.8818`）、`NF4I-AE-Z-M38-04`（$M=38, D=5, V=0$，`v3 = 9.57604`）；
- **三字词/四字词首选率极点**：`R2-21X26-M38-13`（$M=38, D=4, V=0$，`v3 = 9.56603`）、`R2-21X26-M38-15`（$M=38, D=4, V=0$，`v3 = 9.56762`，`w3_p0 = 41.75%, w4_p0 = 10.42%`）；
- **低右小指极点（$P_{\max} \le 3.39\%$）**：`R10-21X26-M39-08`（$M=39, D=5, V=0$，`v3 = 9.62159`，$P_{\max} = 3.39\%$）、`R10-21X26-M37-03`（$M=37, D=4, V=0$，`v3 = 9.63295`，$P_{\max} = 3.39\%$）；
- **极低记忆 / 极低位移极点（$D=1..3, M=35..37$）**：`SNF4-M35-AE-01`（$M=35, D=1, V=0$，理论最低记忆+最低位移，`v3 = 9.66669`）、`R3-21X26-M36-11`（$M=36, D=1, V=1$，`v3 = 9.65866`）、`SNF4-M36-AE-08`（$M=36, D=3, V=0$，`v3 = 9.66398`）、`R6-21X26-M37-C19`（$M=37, D=2, V=1$，`v3 = 9.67569`，$P_{\max} = 2.60\%$，Home = 44.05%）；
- **高主行占比极点（$\text{Home} \ge 50\%$）**：`R7-21X26-M40-11`（$M=40, D=1, V=4$，Home = 50.09%，`v3 = 9.69997`）、`R6-21X26-M42-13`（$M=42, D=1, V=5$，Home = 52.89%，`v3 = 9.72423`）；
- **四码跨族低碰撞峡谷极点**：`S21X26-CONT5-F06-M40-PURE-Y-CANYON-01`（$M=40, D=5, V=1$，五切分平均受碰撞影响率 `3.50%`，`v3 = 9.75836`）。

---

## 2. 数学结构定理与三大底层机理发现

### 2.1 正交声韵 100% 相容定理与八项 B 路径天然全绿性质
1. **八项 B 指标天然全部显著优于 S005（全绿 Pure 8B）**：由于 399 个基础音节映射到 399 个互异二键码（双射），且辅码固定为 `IEUAO`，任何满足契约的 21×26 方案在单字（`kc1, sc1`）与二字词（`kw2, sw2`）上的首选率及一辅/二辅重码率 `p1, p2` 均**完全恒定**，且 8 项原生 B 路径指标相对 `S005` 的比值恒为 `0.733 ~ 0.961`（最差项比值 `0.9612 < 1.0000`），天然满足 8 项 B 全部低于 `S005`。
2. **`A=E=O` 正交声韵相容定理**：在零声母统一 `A=E=O` 且纯 Y（`Y=YU`）条件下，3 个舌面音 $j, q, x$ 拥有完全相同的 14 个韵母集合 $F(j)=F(q)=F(x)$，且与 $F(f) \cup F(W) \cup F(A/E/O)$ 完全不相交。因此，**任意合法的 `A=E=O` 声母布局 `st[0:27]` 与任意合法的 `A=E=O` 韵母布局 `st[27:62]` 组合，100% 保持 399 音节无重码（`unique == 399`）**，且记忆量严格可加分解：
   $$M = 32 + D + (st_{24} \ne \text{W}) + (st_{25} \ne \text{Y}) + |\text{set}(st_{21:24})| + V + (st_{27+v} \ne \text{V})$$
   这意味着 29 个非单元音韵母在 85 对相容合并关系上的任意重排与换位**完全不消耗额外的 $M, D, V$ 预算**。

### 2.2 `(x, f) -> K, k -> X` 与 `(x, f) -> F` 主行声母突破
在历史全部 1,628 个方案中，高负载共享声母对 `(x, f)`（合计占声母总击键的 `5.6%`）几乎全部停留在左下无名指底行键 `X` 上。本轮通过穷举 $D=1, 2, 3$ 声母空间与高维双线性扫面，发现了两条极具威力的声母主行迁移通道：
- **右中指主行通道 `(x, f) -> K, k -> X`**：将高频 `(x, f)` 移至右手主行中指黄金键 `K`（低频 `k` 退至 `X`），不仅使主行占比直接跃升 `+3.0% ~ +4.5%`，更使二字词、三字词（`h1 h2 h3`）、四字词（`h1 h2 h3 h4`）的击键用时全面暴跌 `5 ~ 19 ms`，一举将 `ckt_v3` 推入 `9.403 ~ 9.462` 的全新盆地！
- **左食指主行极低位移通道 `(x, f) -> F`（仅需 $D=1$）**：让 `f -> F` 保持原位，仅将 `x -> F` 与之合并（仅消耗 1 个声母位移 $D=1$！），使得左食指 `F` 与右食指 `J`（`j, A, E, O`）两大主行食指键全部保留给高频声母，在 $D=1..3$ 低记忆区间实现高主行与超低右小指负载。

### 2.3 低位移下 `de`（`DE`）同指跨行瓶颈的精确破局
剖析为何历史 $D=1, V=0$ 方案（如 `SNF4-M35-AE-01`）的 `S2ms` 均高达 `73.27 ms`：当 `d -> D` 且 `e -> E` 原位不动时，汉语第一高频音节 `de`（占语料 `8.5%` 权重）对应左中指纵向跨行同指连击 `DE`（单音节惩罚高达 `+4.5 ms`）。本轮在 $D=1..4$ 低记忆沟壑中给出两条精确破局路径：
1. **元音微移路径（$V=1$，`e -> W` 或 `e -> S`）**：仅用 $V=1$ 将 `de` 转化为异指顺手组合 `DW` 或 `DS`，在 $D=1..3$ 下即将 `S2ms` 压回 `67.5 ~ 69.0 ms`（如 **`SY26-V3-M38-D3-V1-NO-DE-01`**，`v3 = 9.45467`，`S2ms = 67.82 ms`，Home = 42.72%，$P_{\max} = 2.84\%$）；
2. **零元音位移路径（$V=0$，`d -> F / H / P`）**：保持 5 个单元音 $V=0$ 原位不动，在 $D=2..4$ 下将 `d` 移至 `F` 或 `H`，令 `sh -> D` 接管 `D` 键（`she` 频率远低于 `de`），在 $M=36/D=2/V=0$（**`SY26-V3-M36-D2-V0-NO-DE-01`**，`S2ms = 68.44 ms`）与 $M=38/D=4/V=0$（**`SY26-V3-M38-D4-SPEED-01`**，`v3 = 9.49788`，`S2ms = 68.18 ms`，$P_{\max} = 3.38\%$）实现零元音位移下的高速手感。

---

## 3. 四阶段高维探索流水线与独立验证

1. **Stage 1（[`stage1_grid_and_d1_d2_exact.py`](file:///d:/C2D/Documents/rime-snow-pinyin/scripts/research/stage1_grid_and_d1_d2_exact.py)）**：穷举全部 61,211 种 $D=1/2/3$ 合法声母布局在三字词/四字词上的精确得分，并与 434 种跨盆地韵母布局构成 **385,088 个正交网格面方案**；
2. **Stage 2A（[`stage2_line_and_face_sweeps.py`](file:///d:/C2D/Documents/rime-snow-pinyin/scripts/research/stage2_line_and_face_sweeps.py)）**：连接 30 对极端种子，按声母置换环与韵母置换环进行二维测地线网格扫面（`连线成面`，共评估 5,860 个有效内部面网格点）；
3. **Stage 2B（[`stage2b_basin_descent.py`](file:///d:/C2D/Documents/rime-snow-pinyin/scripts/research/stage2b_basin_descent.py)）**：从 46 个扫面发现的盆地极小点出发，利用精确 Numba CKT v3 + 原生 20 轨增量评估器执行多目标模拟退火深潜；
4. **Stage 3（[`stage3_targeted_ravines_and_canyons.py`](file:///d:/C2D/Documents/rime-snow-pinyin/scripts/research/stage3_targeted_ravines_and_canyons.py)）**：针对低记忆 `de` 瓶颈沟壑、高主行低小指沟壑、以及四码跨族碰撞峡谷（联合优化 `ckt_v3` 与五切分碰撞率）开展定向深挖；
5. **独立验证与 R11 图谱集成（[`build_shenyun_21x26_ckt_v3_frontier.py`](file:///d:/C2D/Documents/rime-snow-pinyin/scripts/research/build_shenyun_21x26_ckt_v3_frontier.py) & [`integrate_shenyun_21x26_ckt_v3.py`](file:///d:/C2D/Documents/rime-snow-pinyin/scripts/research/integrate_shenyun_21x26_ckt_v3.py)）**：从全部 686 个跨阶段精选中提炼出 **40 个下一代高价值种子与帕累托前沿方案**，经 Node.js [`score_candidates_v3.js`](file:///d:/C2D/Documents/rime-snow-pinyin/scripts/research/score_candidates_v3.js) 独立复核（最大绝对误差 `1.119e-13`），并完整计算 20 轨 CKT、V5/V6、热力图负载、Macroxue、五切分四码碰撞、以及 CKT v1/v2/v3 全套指标写入 `a7_CKT_R11.html`（图谱总方案数由 715 扩充至 **755**）。

---

## 4. 核心突破总览（Before vs. After）

| 评价维度 / 约束区间 | 历史最优基线 (`a7_CKT_R11.html`) | 本轮新前沿方案 ID | 新 CKT v3 | 关键指标 ($M/D/V$, S2ms, E6, V6, Home, $P_{\max}$, 碰撞代理) | 净推进 ($\Delta\text{CKT}_{\text{v3}}$) |
| :--- | :--- | :--- | :---: | :--- | :---: |
| **全域极速巅峰（$V=0$）** | `NF4I-AE-Z-M40-09` (`9.55058`) | **`SY26-V3-M42-D8-ULTIMATE-01`** | **`9.40331`** | $M42/D8/V0$, S2=67.58, E6=9.8841, **V6=8.9775**, Home=42.08%, $P_{\max}=4.80\%$ | **`-0.14727`** |
| **$M \le 41$ 极速高主行冠** | `NF4I-AE-Z-M40-09` (`9.55058`) | **`SY26-V3-M41-D8-SPEED-HOME-01`** | **`9.40774`** | $M41/D8/V0$, S2=67.51, E6=9.8853, V6=8.9833, **Home=42.08%**, $P_{\max}=4.80\%$ | **`-0.14284`** |
| **$M \le 40$ 极速冠军** | `NF4I-AE-Z-M40-09` (`9.55058`) | **`SY26-V3-M40-D7-SPEED-01`** | **`9.42627`** | $M40/D7/V0$, S2=67.75, E6=9.9191, V6=9.0037, Home=38.99%, $P_{\max}=9.90\%$ | **`-0.12431`** |
| **$M \le 40$ 全能速度旗舰** | `NF4I-AE-Z-M40-09` (`9.55058`) | **`SY26-V3-M40-D7-ALLROUND-01`** | **`9.43925`** | $M40/D7/V0$, **S2=67.21**, **E6=9.8861**, **V6=8.9942**, Home=40.59%, $P_{\max}=4.80\%$ | **`-0.11133`** |
| **超低小指（$P_{\max} \le 2.84\%$）极速冠** | `R10-21X26-M39-08` (`9.62159`, 3.39%) | **`SY26-V3-M41-D7-ULTRALOW-PINKY-01`** | **`9.45704`** | $M41/D7/V0$, S2=68.13, E6=9.9207, **V6=8.9752**, Home=38.39%, **$P_{\max}=2.84\%$** | **`-0.16455`** |
| **$M \le 40$ 低小指（$P_{\max} \le 3.38\%$）冠** | `R10-21X26-M39-08` (`9.62159`, 3.39%) | **`SY26-V3-M40-D7-LOW-PINKY-01`** | **`9.46190`** | $M40/D7/V0$, S2=68.00, E6=9.9238, **V6=8.9845**, Home=37.80%, **$P_{\max}=3.38\%$** | **`-0.15969`** |
| **$M = 39$ 极速冠军** | `R10-21X26-M39-08` (`9.62159`) | **`SY26-V3-M39-D6-SPEED-01`** | **`9.45205`** | $M39/D6/V0$, S2=67.85, E6=9.9359, V6=9.0173, Home=38.05% | **`-0.16954`** |
| **$M = 38, D = 3$ 消 `DE` 极速冠** | `NF4I-AE-Z-M38-04` (`9.57604`, $D=5$) | **`SY26-V3-M38-D3-V1-NO-DE-01`** | **`9.45467`** | **$M38/D3/V1$**, **S2=67.82**, Home=**42.72%**, **$P_{\max}=2.84\%$** | **`-0.12137`** |
| **$M = 38, D = 4, V = 0$ 全优冠军** | `R2-21X26-M38-13` (`9.56603`, $P_{\max}=9.9\%$) | **`SY26-V3-M38-D4-SPEED-01`** | **`9.49788`** | **$M38/D4/V0$**, S2=68.18, E6=9.9662, **Home=40.78%**, **$P_{\max}=3.38\%$**, pAff=6.00% | **`-0.06815`** |
| **$M = 38, D = 5, V = 0$ 超低小指冠** | `NF4I-AE-Z-M38-04` (`9.57604`, $P_{\max}=5.2\%$) | **`SY26-V3-M38-D5-ULTRALOW-PINKY-01`** | **`9.50443`** | $M38/D5/V0$, S2=69.29, **Home=40.19%**, **$P_{\max}=2.84\%$**, pAff=6.00% | **`-0.07161`** |
| **$M = 37, D = 3, V = 0$ 极速冠** | `SNF4-M37-AE-12` (`9.57201`, $D=4$) | **`SY26-V3-M37-D3-V0-SPEED-01`** | **`9.47620`** | **$M37/D3/V0$**, Home=39.36%, **$P_{\max}=2.78\%$**, pAff=6.09% | **`-0.09581`** |
| **$M = 37, D = 3, V = 0$ 低小指消 `DE` 冠** | `R10-21X26-M37-03` (`9.63295`, $D=4$) | **`SY26-V3-M37-D3-V0-NO-DE-LP-01`** | **`9.61686`** | **$M37/D3/V0$**, **S2=69.07**, E6=10.0682, **Home=39.09%**, **$P_{\max}=3.38\%$** | **`-0.01609`** |
| **$M = 37, D = 2, V = 1$ 极致小指冠** | `R6-21X26-M37-C19` (`9.67569`, 2.60%) | **`SY26-V3-M37-D2-V1-ULTRALOW-PINKY-01`** | **`9.65439`** | $M37/D2/V1$, **S2=69.35**, **E6=10.1044**, **$P_{\max}=2.49\%$**（全指标严格占优 C19） | **`-0.02130`** |
| **$M = 36, D = 1, V = 1$ 极低位移冠** | `R3-21X26-M36-11` (`9.65866`, 3.39%) | **`SY26-V3-M36-D1-V1-SPEED-01`** | **`9.61723`** | $M36/D1/V1$, S2=69.62, Home=38.00%, **$P_{\max}=2.78\%$**, pAff=5.98% | **`-0.04143`** |
| **$M = 36, D = 2, V = 0$ 消 `DE` 冠军** | `SNF4-M36-AE-08` (`9.66398`, $D=3$) | **`SY26-V3-M36-D2-V0-NO-DE-01`** | **`9.66713`** | **$M36/D2/V0$**, **S2=68.44**, E6=10.0334, Home=37.89%, **$P_{\max}=3.38\%$** | 少移 1 声母 ($D=2$) |
| **$M = 35, D = 1, V = 0$ 理论最低记忆冠** | `SNF4-M35-AE-01` (`9.66669`) | **`SY26-V3-M35-D1-V0-MINMEM-01`** | **`9.64942`** | **$M35/D1/V0$**, **Home=38.25%**, **$P_{\max}=3.39\%$** | **`-0.01727`** |
| **高主行（$\ge 46.9\%$）+ 极速双优冠** | `R7-21X26-M40-11` (`9.69997`, 50.09%) | **`SY26-V3-M40-D3-V3-HIGH-HOME-47-01`** | **`9.46801`** | $M40/D3/V3$, **S2=67.76**, **Home=46.96%**, **$P_{\max}=2.84\%$** | **`-0.23196`** |
| **$M \le 42$ 超高主行（$\ge 54\%$）冠** | `R6-21X26-M42-13` (`9.72423`, 52.89%) | **`SY26-V3-M42-HIGH-HOME-52-01`** | **`9.55371`** | $M42/D3/V4$, **S2=69.93**, **Home=54.03%**, **$P_{\max}=3.39\%$** | **`-0.17052`** |
| **四码碰撞峡谷 + $M=38, V=0$ 冠军** | `S21X26-CONT5-F06-M40` (`9.75836`, 3.49%) | **`SY26-V3-M38-D5-V0-CANYON-38-01`** | **`9.61334`** | **$M38/D5/V0$**, Home=38.15%, $P_{\max}=3.38\%$, **pAff=3.75%** | **`-0.14502`** |
| **四码碰撞峡谷 + 极速平衡冠** | `S21X26-CONT5-F08-M40` (`9.71698`, 4.77%) | **`SY26-V3-M38-D5-V0-CANYON-45-01`** | **`9.54474`** | **$M38/D5/V0$**, Home=39.38%, $P_{\max}=3.38\%$, **pAff=4.53%** | **`-0.17224`** |

---

## 5. 写入 `a7_CKT_R11.html` 的 40 个高价值种子与前沿方案完整清单

全部 40 个方案已通过 [`scripts/research/integrate_shenyun_21x26_ckt_v3.py`](file:///d:/C2D/Documents/rime-snow-pinyin/scripts/research/integrate_shenyun_21x26_ckt_v3.py) 写入离线基准图谱 `a7_CKT_R11.html`，并经 [`scripts/research/verify_integration_r11.py`](file:///d:/C2D/Documents/rime-snow-pinyin/scripts/research/verify_integration_r11.py) 逐项核验通过：

### Track A：全域极速与低小指速度前沿（7 个）
1. **`SY26-V3-M42-D8-ULTIMATE-01`**（$M42/D8/V0$）：`ckt_v3 = 9.40331`，`S2ms = 67.58`，`E6 = 9.8841`，`V6 = 8.9775`，`Home = 42.08%`，$P_{\max} = 4.80\%$ —— **全域 CKT v3 极速新纪录**。
2. **`SY26-V3-M41-D8-SPEED-HOME-01`**（$M41/D8/V0$）：`ckt_v3 = 9.40774`，`S2ms = 67.51`，`E6 = 9.8853`，`V6 = 8.9833`，`Home = 42.08%`，$P_{\max} = 4.80\%$ —— **$M \le 41$ 极速与高主行双冠**。
3. **`SY26-V3-M40-D7-SPEED-01`**（$M40/D7/V0$）：`ckt_v3 = 9.42627`，`S2ms = 67.75`，`E6 = 9.9191`，`V6 = 9.0037`，`Home = 38.99%` —— **$M \le 40$ 极速新纪录**。
4. **`SY26-V3-M40-D7-ALLROUND-01`**（$M40/D7/V0$）：`ckt_v3 = 9.43925`，`S2ms = 67.21`，`E6 = 9.8861`，`V6 = 8.9942`，`Home = 40.59%`，$P_{\max} = 4.80\%$ —— **$M \le 40$ 全能旗舰（V6 破 9.00）**。
5. **`SY26-V3-M40-D6-LOW-S2-01`**（$M40/D6/V0$）：`ckt_v3 = 9.54140`，`S2ms = 66.95`，`E6 = 9.8914`，`V6 = 9.0166`，`Home = 37.78%`，$P_{\max} = 5.19\%$ —— **$D=6$ 超低裸单字用时均衡冠**。
6. **`SY26-V3-M41-D7-ULTRALOW-PINKY-01`**（$M41/D7/V0$）：`ckt_v3 = 9.45704`，`S2ms = 68.13`，`E6 = 9.9207`，`V6 = 8.9752`，`Home = 38.39%`，$P_{\max} = 2.84\%$ —— **超低右小指（$\le 2.84\%$）极速巅峰**。
7. **`SY26-V3-M40-D7-LOW-PINKY-01`**（$M40/D7/V0$）：`ckt_v3 = 9.46190`，`S2ms = 68.00`，`E6 = 9.9238`，`V6 = 8.9845`，`Home = 37.80%`，$P_{\max} = 3.38\%$ —— **$M \le 40$ 低右小指（$\le 3.38\%$）极速冠军**。

### Track B：同等 $(M, D)$ 低记忆与平衡帕累托前沿（23 个，$M=35..39$）
8. **`SY26-V3-M39-D6-SPEED-01`**（$M39/D6/V0$）：`ckt_v3 = 9.45205`，`S2ms = 67.85`，`E6 = 9.9359`，`Home = 38.05%`。
9. **`SY26-V3-M39-D5-LOW-PINKY-01`**（$M39/D5/V0$）：`ckt_v3 = 9.61899`，`S2ms = 67.30`，`E6 = 9.9193`，$P_{\max} = 3.38\%$。
10. **`SY26-V3-M39-D5-BALANCED-01`**（$M39/D5/V0$）：`ckt_v3 = 9.61952`，`S2ms = 67.34`，`E6 = 9.9184`，`Home = 36.14%`，$P_{\max} = 3.38\%$。
11. **`SY26-V3-M38-D5-ULTRALOW-PINKY-01`**（$M38/D5/V0$）：`ckt_v3 = 9.50443`，`S2ms = 69.29`，`Home = 40.19%`，$P_{\max} = 2.84\%$。
12. **`SY26-V3-M38-D4-SPEED-01`**（$M38/D4/V0$）：`ckt_v3 = 9.49788`，`S2ms = 68.18`，`E6 = 9.9662`，`V6 = 9.0177`，`Home = 40.78%`，$P_{\max} = 3.38\%$。
13. **`SY26-V3-M38-D4-BALANCED-01`**（$M38/D4/V0$）：`ckt_v3 = 9.56242`，`S2ms = 67.30`，`E6 = 9.9494`，`w3_p0 = 41.75%`。
14. **`SY26-V3-M38-D3-V1-NO-DE-01`**（$M38/D3/V1$）：`ckt_v3 = 9.45467`，`S2ms = 67.82`，`Home = 42.72%`，$P_{\max} = 2.84\%$。
15. **`SY26-V3-M38-D3-V1-LOW-PINKY-01`**（$M38/D3/V1$）：`ckt_v3 = 9.45824`，`S2ms = 67.52`，`Home = 42.05%`，$P_{\max} = 2.84\%$。
16. **`SY26-V3-M37-D4-V0-NO-DE-01`**（$M37/D4/V0$）：`ckt_v3 = 9.56623`，`S2ms = 68.12`，`E6 = 10.0026`。
17. **`SY26-V3-M37-D4-V0-NO-DE-LP-01`**（$M37/D4/V0$）：`ckt_v3 = 9.61578`，`S2ms = 68.94`，`Home = 37.98%`，$P_{\max} = 3.38\%$。
18. **`SY26-V3-M37-D3-V0-SPEED-01`**（$M37/D3/V0$）：`ckt_v3 = 9.47620`，`Home = 39.36%`，$P_{\max} = 2.78\%$。
19. **`SY26-V3-M37-D3-V0-NO-DE-LP-01`**（$M37/D3/V0$）：`ckt_v3 = 9.61686`，`S2ms = 69.07`，`Home = 39.09%`，$P_{\max} = 3.38\%$。
20. **`SY26-V3-M37-D2-V1-ULTRALOW-PINKY-01`**（$M37/D2/V1$）：`ckt_v3 = 9.65439`，`S2ms = 69.35`，`E6 = 10.1044`，$P_{\max} = 2.49\%$。
21. **`SY26-V3-M37-D2-V1-SPEED-01`**（$M37/D2/V1$）：`ckt_v3 = 9.58694`，`S2ms = 69.76`，`Home = 38.77%`。
22. **`SY26-V3-M36-D3-V0-SPEED-01`**（$M36/D3/V0$）：`ckt_v3 = 9.59865`，`Home = 36.96%`。
23. **`SY26-V3-M36-D3-V0-NO-DE-LP-01`**（$M36/D3/V0$）：`ckt_v3 = 9.66299`，`S2ms = 68.58`，`E6 = 10.0219`，`Home = 37.88%`，$P_{\max} = 3.38\%$。
24. **`SY26-V3-M36-D2-V0-SPEED-01`**（$M36/D2/V0$）：`ckt_v3 = 9.59315`，`Home = 38.25%`。
25. **`SY26-V3-M36-D2-V0-NO-DE-01`**（$M36/D2/V0$）：`ckt_v3 = 9.66713`，`S2ms = 68.44`，`E6 = 10.0334`，`Home = 37.89%`，$P_{\max} = 3.38\%$。
26. **`SY26-V3-M36-D2-V1-NO-DE-01`**（$M36/D2/V1$）：`ckt_v3 = 9.64271`，`S2ms = 69.63`，`Home = 38.77%`，$P_{\max} = 3.39\%$。
27. **`SY26-V3-M36-D1-V1-SPEED-01`**（$M36/D1/V1$）：`ckt_v3 = 9.61723`，`S2ms = 69.62`，`Home = 38.00%`，$P_{\max} = 2.78\%$。
28. **`SY26-V3-M36-D1-V1-BALANCED-01`**（$M36/D1/V1$）：`ckt_v3 = 9.64850`，`S2ms = 69.02`，$P_{\max} = 2.84\%$。
29. **`SY26-V3-M35-D2-V0-MINMEM-01`**（$M35/D2/V0$）：`ckt_v3 = 9.64754`，`Home = 37.59%`，$P_{\max} = 3.39\%$。
30. **`SY26-V3-M35-D1-V0-MINMEM-01`**（$M35/D1/V0$）：`ckt_v3 = 9.64942`，`Home = 38.25%`，$P_{\max} = 3.39\%$。

### Track C：高主行与超低小指人体工学沟壑（7 个，$\text{Home} = 45.3\%..54.7\%$）
31. **`SY26-V3-M38-D1-V3-HIGH-HOME-45-01`**（$M38/D1/V3$）：`ckt_v3 = 9.65684`，`S2ms = 69.66`，`Home = 45.29%`，$P_{\max} = 2.84\%$。
32. **`SY26-V3-M38-D2-V1-HIGH-HOME-46-01`**（$M38/D2/V1$）：`ckt_v3 = 9.62960`，`Home = 46.36%`，$P_{\max} = 2.60\%$。
33. **`SY26-V3-M40-D3-V3-HIGH-HOME-47-01`**（$M40/D3/V3$）：`ckt_v3 = 9.46801`，`S2ms = 67.76`，`Home = 46.96%`，$P_{\max} = 2.84\%$。
34. **`SY26-V3-M39-D2-V1-HIGH-HOME-48-01`**（$M39/D2/V1$）：`ckt_v3 = 9.63369`，`Home = 47.82%`，$P_{\max} = 2.60\%$。
35. **`SY26-V3-M40-D2-V4-HIGH-HOME-51-01`**（$M40/D2/V4$）：`ckt_v3 = 9.65564`，`Home = 50.73%`。
36. **`SY26-V3-M42-HIGH-HOME-52-01`**（$M42/D3/V4$）：`ckt_v3 = 9.55371`，`S2ms = 69.93`，`Home = 54.03%`，$P_{\max} = 3.39\%$。
37. **`SY26-V3-M46-D8-V4-HIGH-HOME-55-01`**（$M46/D8/V4$）：`ckt_v3 = 9.48619`，`S2ms = 68.66`，`Home = 54.66%`，$P_{\max} = 5.19\%$。

### Track D：四码跨族低碰撞深峡谷（3 个）
38. **`SY26-V3-M40-D5-V1-CANYON-34-01`**（$M40/D5/V1$）：`ckt_v3 = 9.76326`，碰撞代理 `3.37%`（五切分精确受碰撞影响率 `3.43%`，$P_{\max} = 3.10\%$）。
39. **`SY26-V3-M38-D5-V0-CANYON-38-01`**（$M38/D5/V0$）：`ckt_v3 = 9.61334`，`Home = 38.15%`，$P_{\max} = 3.38\%$，碰撞代理 `3.75%`。
40. **`SY26-V3-M38-D5-V0-CANYON-45-01`**（$M38/D5/V0$）：`ckt_v3 = 9.54474`，`Home = 39.38%`，$P_{\max} = 3.38\%$，碰撞代理 `4.53%`。

---

## 6. 产物归档清单

- **探索脚本**：
  - [`scripts/research/fast_ckt_v3_21x26.py`](file:///d:/C2D/Documents/rime-snow-pinyin/scripts/research/fast_ckt_v3_21x26.py)（Numba 8 轨 CKT v3 精确加速评估器，与 JS 误差 `< 1.2e-13`）
  - [`scripts/research/harvest_all_21x26_pools.py`](file:///d:/C2D/Documents/rime-snow-pinyin/scripts/research/harvest_all_21x26_pools.py)（1,628 个历史 21×26 有效方案全量收割与评估）
  - [`scripts/research/stage1_grid_and_d1_d2_exact.py`](file:///d:/C2D/Documents/rime-snow-pinyin/scripts/research/stage1_grid_and_d1_d2_exact.py)（Stage 1 穷举 $D=1/2/3$ 声母与 38.5 万正交网格扫面）
  - [`scripts/research/stage2_line_and_face_sweeps.py`](file:///d:/C2D/Documents/rime-snow-pinyin/scripts/research/stage2_line_and_face_sweeps.py)（Stage 2A 30 对极端种子置换环测地线连线成面）
  - [`scripts/research/stage2b_basin_descent.py`](file:///d:/C2D/Documents/rime-snow-pinyin/scripts/research/stage2b_basin_descent.py)（Stage 2B 46 盆地多目标退火深潜）
  - [`scripts/research/stage3_targeted_ravines_and_canyons.py`](file:///d:/C2D/Documents/rime-snow-pinyin/scripts/research/stage3_targeted_ravines_and_canyons.py)（Stage 3 低记忆 `de` 破局、高主行沟壑与四码碰撞峡谷挖掘）
  - [`scripts/research/build_shenyun_21x26_ckt_v3_frontier.py`](file:///d:/C2D/Documents/rime-snow-pinyin/scripts/research/build_shenyun_21x26_ckt_v3_frontier.py)（40 个下一代前沿方案汇总与 Node.js 独立校验）
  - [`scripts/research/integrate_shenyun_21x26_ckt_v3.py`](file:///d:/C2D/Documents/rime-snow-pinyin/scripts/research/integrate_shenyun_21x26_ckt_v3.py)（R11 离线基准图谱全指标计算与无损写入）
- **数据归档**：
  - [`research-notes/data/shenyun-21x26-all-historical-pools-v3.json`](file:///d:/C2D/Documents/rime-snow-pinyin/research-notes/data/shenyun-21x26-all-historical-pools-v3.json)
  - [`research-notes/data/shenyun-21x26-stage1-bilinear-sweep.json`](file:///d:/C2D/Documents/rime-snow-pinyin/research-notes/data/shenyun-21x26-stage1-bilinear-sweep.json)
  - [`research-notes/data/shenyun-21x26-stage2a-face-sweeps.json`](file:///d:/C2D/Documents/rime-snow-pinyin/research-notes/data/shenyun-21x26-stage2a-face-sweeps.json)
  - [`research-notes/data/shenyun-21x26-stage2b-basin-descent.json`](file:///d:/C2D/Documents/rime-snow-pinyin/research-notes/data/shenyun-21x26-stage2b-basin-descent.json)
  - [`research-notes/data/shenyun-21x26-stage3-ravines-and-canyons.json`](file:///d:/C2D/Documents/rime-snow-pinyin/research-notes/data/shenyun-21x26-stage3-ravines-and-canyons.json)
  - [`research-notes/data/shenyun-21x26-ckt-v3-nextgen-frontier.json`](file:///d:/C2D/Documents/rime-snow-pinyin/research-notes/data/shenyun-21x26-ckt-v3-nextgen-frontier.json)
