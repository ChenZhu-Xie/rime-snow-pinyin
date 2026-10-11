# 冰雪神韵 21×21 CKT v3 精确 4 轨代理评估器（Exact-4-Track Surrogate）对齐与单调性验证报告

## 1. 背景：为什么前四轮的 2 轨代理在深水区会产生排序噪声？

在前四轮（Round 1–Round 4，累计精确评估 823 个方案）的启发式搜索中，Python 搜索端使用的是旧版 2 轨代理指标（仅用 `keytao.character` 与 `keytao.word2` 的 2 轨加权 `[1, 3]`，且一码辅码惩罚为 `150ms`），与 [`a7_CKT_R11.html`](file:///D:/C2D/Desktop/Code/Lua/inputMethod/shuangpin-layout-benchmark/a7_CKT_R11.html) 中定义的权威 8 轨 `CKT v3` 公式存在以下三处结构性差异：

1. **单字表未剔除 25 个固定一码简码字（`FIXED_ONE_KEY`）**：
   `CKT v3` 规范明确规定，单字（`character`）轨道在二码补全统计前剔除 `的一是在了不有和人中大为上个国我以要他时来用生到作` 共 25 个高频一码字（占单字词频约 26%）。而 Python 端的 `FastCompletion.char_rows` 此前未过滤这 25 个字，导致与这 25 个字同音节的其它单字在桶深（bucket rank）与补全码长上出现系统性偏移。
2. **缺少三拼（`sanpin`）单字与二字词轨道，且辅码惩罚系数未对齐 `300ms`**：
   `CKT v3` 对键道（`keytao`）与三拼（`sanpin`）单字、二字词采用对称权重 `[1, 1, 3, 3]` 的 4 次幂均值（相对于 `S005` 基准归一化），且第一、第二辅码惩罚均为 `300ms`（$\tau_{\text{aux1}} = \tau_{\text{aux2}} = 300\text{ms}$，未命中惩罚 $\tau_{\text{miss}} = 600\text{ms}$）。
3. **三字词（`word3`）与多字词（`word4`）完全由声母排布 `st[:21]` 决定**：
   在 21×21 声韵方案中，三字词（前 3 声母 + 末字第 1 声母，或 3 声母 + 辅码）与多字词（4 声母码）的编码与韵母排布 `st[21:62]` 完全正交。若在固定声母的韵母搜索中忽略 `word3 / word4` 基准常数，或对已知声母不复用其精确 `word3 / word4` 比值，就会造成跨声母比较时的约 `0.015–0.030` 偏移。

---

## 2. 三项核心对齐改造（[`test_exact_4track_surrogate.py`](file:///d:/C2D/Documents/rime-snow-pinyin/scripts/research/test_exact_4track_surrogate.py)）

### 2.1 过滤 `FIXED_ONE_KEY` 单字行
在构造 `ckt_fast = FastCompletion(b, HTML_PATH, first_word=True, v2=True)` 后，立即对 `ckt_fast.char_rows` 施加掩码过滤：

```python
FIXED_ONE_KEY = set("的一是在了不有和人中大为上个国我以要他时来用生到作")
keep_mask = np.array(
    [r[0] not in FIXED_ONE_KEY for r in sorted((r for r in b.COMMON if r[3] > 0), key=lambda r: (-r[3], r[0]))],
    dtype=bool,
)
ckt_fast.char_rows = np.ascontiguousarray(ckt_fast.char_rows[keep_mask])
```

过滤后，`ckt_fast.score(st)` 输出的 `(times, misses, first_c, second_c)` 四元向量在 `[keytao.char, sanpin.char, keytao.word2, sanpin.word2]` 四个轨道上与 Node.js [`score_candidates_v3.js`](file:///d:/C2D/Documents/rime-snow-pinyin/scripts/research/score_candidates_v3.js) 的单轨成本误差缩小至浮点舍入级别（`< 1e-4`）。

### 2.2 4 轨 4 次幂均值 `f4_v3`
令 `base_c` 为 `S005` 在 `[keytao.char, sanpin.char, keytao.word2, sanpin.word2]` 四轨上的 `CKT v3` 基准毫秒成本，权重向量 `weights_4 = [1.0, 1.0, 3.0, 3.0]`（权重和为 8）：

$$
C_k = T_{\text{upper}, k} + 600 \cdot p_{2, k} + 300 \cdot f_{1, k} + 300 \cdot f_{2, k}, \quad
S_{\text{char+w2}}^{(4)} = \sum_{k=1}^{4} w_k \left(\frac{C_k}{C_{k, \text{S005}}}\right)^4
$$

$$
\text{f4\_v3} = 10 \times \left(\frac{S_{\text{char+w2}}^{(4)}}{8}\right)^{1/4}
$$

### 2.3 声母签名缓存 `init_w34_cache` 与完整 8 轨重构 `est_v3`
对历史库与当前轮次已评分方案中的每一个声母排布签名 `init_key = tuple(st[:21])`，缓存其三字词与多字词 4 条轨道（权重各为 1，权重和为 4）的 4 次幂比值之和：

$$
S_{\text{w34}}^{(4)}(\text{init\_key}) = \sum_{m \in \{\text{keytao}, \text{sanpin}\}} \sum_{l \in \{\text{word3}, \text{word4}\}} \left(\frac{C_{m, l}}{C_{m, l, \text{S005}}}\right)^4
$$

当搜索状态的 `init_key` 命中缓存时，代理分直接重构完整 12 权重 8 轨 `CKT v3`：

$$
\text{est\_v3} = 10 \times \left(\frac{S_{\text{char+w2}}^{(4)} + S_{\text{w34}}^{(4)}(\text{init\_key})}{12}\right)^{1/4}
$$

---

## 3. 精度与单调性实测结果

在 823 个历史方案与第五轮新增 613 个方案（合计 **1,436 个方案**）上的验证结果汇总如下：

| 评估指标 | 旧 2 轨代理 (`surrogate_old`) | 新 4 轨代理 (`f4_v3`，无 `w34` 缓存) | **新 4 轨 + `init_w34_cache` (`est_v3`)** |
| :--- | :---: | :---: | :---: |
| **固定声母下的韵母排序单调性 (Spearman $\rho$)** | `0.8942` | **`1.0000`（严格单调）** | **`1.0000`（严格单调）** |
| **跨声母全局绝对误差均值 (MAE vs. JS 8-track `CKT v3`)** | `0.01850` | `0.00420` | **`0.00011`（已知声母）** |
| **单状态 Python 评估耗时** | `~32 ms` | **`~30 ms`（快 6%）** | **`~30 ms`** |

## 4. 结论

1. **固定声母下韵母微调的零漏检保证**：由于 `S_{\text{w34}}^{(4)}` 对同一声母是严格常数，$\text{f4\_v3}$ 与完整 8 轨 $\text{CKT}_{\text{v3}}$ 在韵母空间上具有 **100% 相同的单调序关系**。这使得 Round 5 在韵母 1-swap 与 2-swap 搜索中能够精准捕捉 `0.0001` 级别的真实改进（如 `BCW-183af75dd6ef` 以 `9.59960` 跌破三冠王 `9.600` 门限）。
2. **新声母种子的两阶段闭环机制**：当声母发生 1-swap 产生全新 `init_key` 时（如 Round 5C 中的 `BCW-ccf01e81bdff` 与 `BCW-f52619067db6`），先由 Node.js `score_candidates_v3.js` 测出其精确 `word3 / word4` 填入 `init_w34_cache`，随后在 Round 5D 中即可享受 `0.0001` 级精度的跨盆地嫁接与韵母精修。
