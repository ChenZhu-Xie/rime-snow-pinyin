# [冰雪拼音](https://input.tansongchen.com)

> 优雅、高效、个性化的中文输入体验

[简体中文](#简体中文) · [English](#english) · [繁體中文](#繁體中文) · [下载 Release](https://github.com/ChenZhu-Xie/rime-snow-pinyin/releases/latest)

<a id="简体中文"></a>
## 简体中文

配方： ℞ **snow-pinyin**

开发脚本的用途、参数和旧名称对照见 [scripts/README.md](scripts/README.md)。

[冰雪拼音](https://input.tansongchen.com)是一系列以普通话拼音为基础的中文输入方案。它们充分利用汉字的字音信息来实现自然优雅的编码；它们使用先进的离散优化技术和顶功技术来设计，使得编码十分高效；它们配备了智能算法，通过学习用户的语言习惯来个性化输入体验。

[冰雪拼音](https://input.tansongchen.com)包括[冰雪四拼](https://input.tansongchen.com/snow4/)、[冰雪三拼](https://input.tansongchen.com/snow3/)、[冰雪一拼](https://input.tansongchen.com/snow1/)、[冰雪键道](https://input.tansongchen.com/snow-jiandao/)和[冰雪清韵](https://input.tansongchen.com/snow-qingyun/)输入方案。您可以阅读[冰雪奇缘](https://input.tansongchen.com/snow.html)来概览各个方案，了解它们的设计理念及优缺点。您还可以点击上述各个方案的链接以进一步了解并选择适合您的输入方案。

### 无[飞键](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code)道·神韵 U357 综合人体工学前沿（编码方案）

[冰雪键道](https://input.tansongchen.com/snow-jiandao/)和[冰雪三拼](https://input.tansongchen.com/snow3/)现共用 **无[飞键](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code)道·神韵 U357 综合人体工学前沿**，使用 21×21 声韵键域和 5 个互斥辅键 `IVUAO`。

> [!NOTE]
> 由于作者也是[冰雪四拼](https://input.tansongchen.com/snow4/)用户，因此[冰雪三拼](https://input.tansongchen.com/snow3/)的五调辅键按照与[冰雪四拼](https://input.tansongchen.com/snow4/)相近的顺序排列。

“无飞键道·神韵 U357 综合人体工学前沿”是方案全称，`U357` 是候选代号，`U357-21X21-M40-D0` 是实现标识；完整 Benchmark 候选 ID 为 `gen0107-p5-f1h-11_13-d2-f25_26-d3-f4_22-d4-f11_13`。

另有两套飞花式 `AUBB` 原型：[冰雪神韵·形](snow_shenyun_shape.schema.yaml)与[冰雪神韵·调](snow_shenyun_tone.schema.yaml)，共用 [R10 21×26 声韵映射](config/shenyun-21x26-mapping.json)，不占用逗号、句号。两者的 B 辅码分别为形码与声调；调方案单字首 B 筛声调，后续 B 筛笔画，数字 `1` 独立进入部首筛选。这不改变下文冰雪键道、冰雪三拼使用的 U357 21×21 布局。

**声韵映射**

机器可复核的候选源配置见 [`config/shenyun-21x21-mapping.json`](config/shenyun-21x21-mapping.json)，421 音节生成快照见 [`docs/shenyun-u357-mapping.json`](docs/shenyun-u357-mapping.json)。旧 R9 映射、键盘图、热力图与公平对比报告继续保留，作为历史基线，不再代表当前实装。

#### 声韵编码规则

普通声母均使用固定首键：

| 声母 | 首键 | 声母 | 首键 | 声母 | 首键 |
| --- | :---: | --- | :---: | --- | :---: |
| b | B | p | P | m | M |
| f | F | d | D | t | T |
| n | N | l | L | g | G |
| k | K | h | H | j | J |
| q | Q | x | X | zh | K |
| ch | W | sh | E | r | R |
| z | Z | c | C | s | S |

零声母完整码如下：

| 前导组 | 首键 | 完整音节编码 |
| --- | :---: | --- |
| ØA | R | a=RW · ai=RK · an=RJ · ang=RN · ao=RF |
| ØE | R | e=RS · ei=RE · en=RM · eng=RR · er=RE |
| ØO | R | o=RD · ou=RQ |
| ØY | Y | ya=YW · yan=YJ · yang=YN · yao=YF · ye=YS · yi=YL · yin=YB · ying=YT · yo=YD · yong=YP · you=YQ · yu=YG · yuan=YR · yue=YK · yun=YE |
| ØW | S | wa=SW · wai=SK · wan=SJ · wang=SN · wei=SE · wen=SM · weng=SR · wo=SD · wu=SH |

韵母使用第二键；`v` 表示 `ü`，`ve` 表示 `üe`：

| 第二键 | 韵母 | 第二键 | 韵母 | 第二键 | 韵母 |
| :---: | --- | :---: | --- | :---: | --- |
| W | a | K | ai / ve（üe） | J | an / iang |
| N | ang / iong | F | ao / ia | S | e |
| E | ei / er / vn | M | en | R | eng / van |
| L | i | P | ian / ong | C | iao / ua |
| Z | ie | B | in / un | T | ing / uang |
| D | iu / o / uai | Q | ou | H | u |
| X | uan | G | ui / v（ü） | Y | uo |

- `zh/ch/sh → K/W/E`；零声母载体 `AOE/Y/W → R/Y/S`。
- `j/q/x` 的 `u/uan/ue/un` 与零声母 YU 系列统一按 `v/van/ve/vn` 编码。
- 三拼声调 `I/V/U/A/O → 一/二/三/四/轻`；键道形码 `A/V/U/I/O → 折/横/撇/竖/点`。
- 神韵 U357 的 [Common399](https://wwwhomes.uni-bielefeld.de/gibbon/Syllables/Mandarin) 全覆盖，形成 357 个唯一音节码与 42 个二元重码桶；实现另按同一规则推导 17 个扩展音节，扩展域共有 366 个唯一音码与 75 个空码。`hng、m、n、ng、ê` 不编码。

#### 现行 U357 生产指标

下表来自[双拼布局 Benchmark](https://github.com/more-14-different/shuangpin-layout-benchmark)中 U357 所在的严格 ProdGate 搜索报告，以 `S005 = 10` 的 CPU exact scoring 为参照。这里的 **CKT v4** 是现行候选评分，不是旧 R9 表里的“系综当量 v4”。

| 指标 | U357 | 门槛或参照 | 判定 |
| --- | ---: | ---: | --- |
| 声韵容量／辅键 | 21×21／`IVUAO` | 严格锁定 | 通过 |
| 记忆代价 M | 40 | ≤ 40 | 通过 |
| 普通声母位移 D | 0 | = 0 | 通过 |
| 元音位移 V | 5 | ≤ 5 | 通过 |
| Common399 唯一音节码 U | 357 | 生产基线 352；越高越好 | +5 |
| 重码桶／受影响音节 | 42／84 | 越少越好 | — |
| CKT v4 | 9.716421 | Tier-A ≤ 9.720；越低越好 | 通过 |
| 右小指 S2 负载 `rp_s2` | 4.1808% | ≤ 4.1808% | 通过 |
| 右小指峰值 `rp_max` | 5.1045% | ≤ 5.1045% | 通过 |
| 主键区下限 `homeFloor` | 37.6204% | ≥ 35.0756% | 通过 |
| W 键峰值 `w_max` | 3.6232% | ≤ 3.6232% | 通过 |
| Y 键峰值 `y_max` | 6.3924% | ≤ 6.8685% | 通过 |
| 移动手得分 `mxScore` | 143.380 | ≥ 140.842；越高越好 | 通过 |

U357 在冻结语料上的八轨加权选重率如下；它们用于检查冰雪键道与冰雪三拼的真实编码路径，不等同真人测速。

| 方案 | 单字 | 二字词 | 三字词 | 四字词 |
| --- | ---: | ---: | ---: | ---: |
| 冰雪键道 | 0.489% | 0.440% | 4.948% | 0.366% |
| 冰雪三拼 | 0.786% | 0.632% | 6.948% | 0.565% |

旧 R9 的“系综当量 v4/v5/v6-CW150”、裸 S2 与 MX34 属于冻结 R11 历史口径，已经从现行 README 指标表移除，不能与上面的 CKT v4 混用。需要追溯时请查看[神韵 R9 公平对比](reports/shenyun-r9-comparison.md)及其[原始 JSON](reports/shenyun-r9-comparison.json)。现行 U357 的来源、完整候选和迁移边界见[实装迁移记录](research-notes/2026-10-30-shenyun-u357-migration.md)。

#### 神韵固顶与二字词简码

固顶表与简码概况：

- `AA` 的 441 个位置由 366 个二码单字和 75 个二简完整覆盖；75 个二简全部使用 U357 扩展域的天然空码，不再让音码下沉。
- 三拼 630 当前为 105 个二码位＋505 个三码位；键道 630 为 105＋525。低质量槽位允许留空，每码只固定一个候选，父子码不重复固定同一词。
- 三拼二字词二、三码候选清单见 [`snow_sanpin.fixed.630.txt`](snow_sanpin.fixed.630.txt)：630 个理论码位中 550 个有合法候选，每码最多列 10 项，供逐级选词复核，不直接替代一码一候选的固顶表。
- [二字词逐级排序结果](reports/sipin-bigram-ranking-research.md)覆盖 133,205 条可编码读音。
- 多字轻声 `de/le` 尾词改走 `;`/`/` 尾字键；已有结构略码、完整码首选或日常收益不足的词不强占固顶位。

```powershell
bun scripts/生成神韵固顶词.ts
bun scripts/生成神韵固顶词.ts --check
bun scripts/生成神韵映射.ts --check
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

[Snow Pinyin](https://input.tansongchen.com) is a family of Mandarin-based Chinese input methods. It combines phonetic information, discrete optimization, top-up coding, and adaptive learning for natural, efficient, and personalized input. The family includes [Snow Four-Code](https://input.tansongchen.com/snow4/), [Snow Three-Code](https://input.tansongchen.com/snow3/), [Snow One-Code](https://input.tansongchen.com/snow1/), [Snow KeyTao](https://input.tansongchen.com/snow-jiandao/), and [Snow Qingyun](https://input.tansongchen.com/snow-qingyun/).

### Wufei KeyTao·Shenyun U357 ergonomic frontier (coding scheme)

[Snow KeyTao](https://input.tansongchen.com/snow-jiandao/) and [Snow Three-Code](https://input.tansongchen.com/snow3/) now share **Wufei KeyTao·Shenyun U357 ergonomic frontier**, using a 21×21 sound-code domain and five disjoint auxiliary keys, `IVUAO`.

> [!NOTE]
> Because the author also uses [Snow Four-Code](https://input.tansongchen.com/snow4/), [Snow Three-Code](https://input.tansongchen.com/snow3/)'s five tone auxiliary keys are arranged in an order similar to [Snow Four-Code](https://input.tansongchen.com/snow4/)'s.

“Wufei KeyTao·Shenyun U357 ergonomic frontier” is the full scheme name; `U357` is the candidate label and `U357-21X21-M40-D0` is the implementation ID. The full Benchmark candidate ID is `gen0107-p5-f1h-11_13-d2-f25_26-d3-f4_22-d4-f11_13`.

Two separate AUBB prototypes, [Shenyun Shape](snow_shenyun_shape.schema.yaml) and [Shenyun Tone](snow_shenyun_tone.schema.yaml), share the [R10 21×26 mapping](config/shenyun-21x26-mapping.json); comma and period remain punctuation. In the tone prototype, the first single-character auxiliary key filters tone, later ones filter strokes, and `1` independently opens radical filtering. KeyTao and Three-Code use the U357 21×21 layout described below.

**Initial/final mapping**

The machine-reviewable candidate configuration is [`config/shenyun-21x21-mapping.json`](config/shenyun-21x21-mapping.json), and the generated 421-syllable snapshot is [`docs/shenyun-u357-mapping.json`](docs/shenyun-u357-mapping.json). The R9 keyboard and heat-map graphics remain as historical baselines and no longer describe the deployed layout.

#### Coding rules

All ordinary initials have a fixed first key; the exceptions to the letter itself are `zh/ch/sh → K/W/E`. Zero-onset carriers are `AOE/Y/W → R/Y/S`. Finals are mapped as follows (`v` means `ü`):

| Key | Finals | Key | Finals | Key | Finals |
| :---: | --- | :---: | --- | :---: | --- |
| W | a | K | ai / ve | J | an / iang |
| N | ang / iong | F | ao / ia | S | e |
| E | ei / er / vn | M | en | R | eng / van |
| L | i | P | ian / ong | C | iao / ua |
| Z | ie | B | in / un | T | ing / uang |
| D | iu / o / uai | Q | ou | H | u |
| X | uan | G | ui / v | Y | uo |

The `j/q/x` u-series and the zero-onset YU series normalize to `v/van/ve/vn`. [Three-Code](https://input.tansongchen.com/snow3/) tone keys are `I/V/U/A/O → 1/2/3/4/neutral`; [KeyTao](https://input.tansongchen.com/snow-jiandao/) shape keys are `A/V/U/I/O → bend/horizontal/left-falling/vertical/dot`. [Common399](https://wwwhomes.uni-bielefeld.de/gibbon/Syllables/Mandarin) is fully covered with 357 unique codes and 42 collision buckets. The 17 derived extension syllables bring the implementation domain to 366 unique sound codes and 75 vacant codes; `hng/m/n/ng/ê` remain unencoded.

#### Current U357 production metrics

These values come from the strict ProdGate search in [Shuangpin Layout Benchmark](https://github.com/more-14-different/shuangpin-layout-benchmark) that produced U357, using CPU exact scoring with `S005 = 10`. **CKT v4** here is the current candidate score, not the legacy R9 “ensemble equivalent v4.”

| Metric | U357 | Gate or reference | Result |
| --- | ---: | ---: | --- |
| Sound-code capacity / auxiliary keys | 21×21 / `IVUAO` | Strictly locked | Pass |
| Memory cost M | 40 | ≤ 40 | Pass |
| Ordinary-initial displacement D | 0 | = 0 | Pass |
| Vowel displacement V | 5 | ≤ 5 | Pass |
| Unique Common399 codes U | 357 | Production baseline 352; higher is better | +5 |
| Collision buckets / affected syllables | 42 / 84 | Lower is better | — |
| CKT v4 | 9.716421 | Tier-A ≤ 9.720; lower is better | Pass |
| Right-pinky S2 load `rp_s2` | 4.1808% | ≤ 4.1808% | Pass |
| Right-pinky peak `rp_max` | 5.1045% | ≤ 5.1045% | Pass |
| Home-area floor `homeFloor` | 37.6204% | ≥ 35.0756% | Pass |
| W-key peak `w_max` | 3.6232% | ≤ 3.6232% | Pass |
| Y-key peak `y_max` | 6.3924% | ≤ 6.8685% | Pass |
| Moving-hand score `mxScore` | 143.380 | ≥ 140.842; higher is better | Pass |

Weighted selection rates over the frozen eight-track corpus are shown below. They validate Snow KeyTao and Snow Three-Code coding paths; they are not human typing-speed measurements.

| Scheme | Single characters | Bigrams | Trigrams | Four-character words |
| --- | ---: | ---: | ---: | ---: |
| Snow KeyTao | 0.489% | 0.440% | 4.948% | 0.366% |
| Snow Three-Code | 0.786% | 0.632% | 6.948% | 0.565% |

The legacy R9 ensemble equivalents v4/v5/v6-CW150, bare S2, and MX34 belong to a frozen R11 methodology. They have been removed from the current README table and must not be compared with the CKT v4 value above. See the archived [R9 comparison](reports/shenyun-r9-comparison.md), its [raw JSON](reports/shenyun-r9-comparison.json), and the [U357 deployment note](research-notes/2026-10-30-shenyun-u357-migration.md) for provenance.

#### Fixed candidates and staged two-character abbreviations

The current layout fills all 441 AA positions with 366 two-key characters and 75 two-key abbreviations; all abbreviations use naturally vacant U357 extension-domain codes. Three-Code has 105+505 candidates in its 630 space, while KeyTao has 105+525. [`snow_sanpin.fixed.630.txt`](snow_sanpin.fixed.630.txt) separately records up to ten two-character candidates for each populated two- and three-key Three-Code slot: 550 of 630 theoretical slots are populated. This audit list does not replace the one-candidate-per-code fixed tables.

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

[冰雪拼音](https://input.tansongchen.com)是一系列以普通話拼音為基礎的中文輸入方案，結合字音資訊、離散最佳化、頂功技術與使用習慣學習，提供自然、高效且個人化的輸入體驗。系列包含[冰雪四拼](https://input.tansongchen.com/snow4/)、[冰雪三拼](https://input.tansongchen.com/snow3/)、[冰雪一拼](https://input.tansongchen.com/snow1/)、[冰雪鍵道](https://input.tansongchen.com/snow-jiandao/)及[冰雪清韻](https://input.tansongchen.com/snow-qingyun/)。

### 無[飛鍵](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code)道·神韻 U357 綜合人體工學前沿（編碼方案）

[冰雪鍵道](https://input.tansongchen.com/snow-jiandao/)與[冰雪三拼](https://input.tansongchen.com/snow3/)現共用 **無[飛鍵](https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code)道·神韻 U357 綜合人體工學前沿**，使用 21×21 聲韻鍵域與 5 個互斥輔鍵 `IVUAO`。

> [!NOTE]
> 由於作者也是[冰雪四拼](https://input.tansongchen.com/snow4/)使用者，因此[冰雪三拼](https://input.tansongchen.com/snow3/)的五調輔鍵按照與[冰雪四拼](https://input.tansongchen.com/snow4/)相近的順序排列。

「無飛鍵道·神韻 U357 綜合人體工學前沿」是方案全稱，`U357` 是候選代號，`U357-21X21-M40-D0` 是實作標識；完整 Benchmark 候選 ID 為 `gen0107-p5-f1h-11_13-d2-f25_26-d3-f4_22-d4-f11_13`。

另有兩套飛花式 `AUBB` 原型：[冰雪神韻·形](snow_shenyun_shape.schema.yaml)與[冰雪神韻·調](snow_shenyun_tone.schema.yaml)，共用 [R10 21×26 聲韻映射](config/shenyun-21x26-mapping.json)，不佔用逗號、句號。兩者的 B 輔碼分別為形碼與聲調；調方案單字首 B 篩聲調，後續 B 篩筆畫，數字 `1` 獨立進入部首篩選。這不改變下文鍵道、三拼使用的 U357 21×21 布局。

**聲韻映射**

可由機器複核的候選設定見 [`config/shenyun-21x21-mapping.json`](config/shenyun-21x21-mapping.json)，421 音節生成快照見 [`docs/shenyun-u357-mapping.json`](docs/shenyun-u357-mapping.json)。舊 R9 鍵盤圖與熱力圖繼續保留為歷史基線，不再代表目前實裝。

#### 聲韻規則

普通聲母均使用固定首鍵，`zh/ch/sh → K/W/E`；零聲母載體為 `AOE/Y/W → R/Y/S`。韻母映射如下（`v` 表示 `ü`）：

| 第二鍵 | 韻母 | 第二鍵 | 韻母 | 第二鍵 | 韻母 |
| :---: | --- | :---: | --- | :---: | --- |
| W | a | K | ai / ve | J | an / iang |
| N | ang / iong | F | ao / ia | S | e |
| E | ei / er / vn | M | en | R | eng / van |
| L | i | P | ian / ong | C | iao / ua |
| Z | ie | B | in / un | T | ing / uang |
| D | iu / o / uai | Q | ou | H | u |
| X | uan | G | ui / v | Y | uo |

`j/q/x` 的 u 系列與零聲母 YU 系列統一成 `v/van/ve/vn`。[三拼](https://input.tansongchen.com/snow3/)聲調鍵為 `I/V/U/A/O → 一/二/三/四/輕`，[鍵道](https://input.tansongchen.com/snow-jiandao/)形碼鍵為 `A/V/U/I/O → 折/橫/撇/豎/點`。Common399 全覆蓋並形成 357 個唯一碼、42 個重碼桶；加上 17 個擴充音節後共有 366 個唯一音碼與 75 個空碼。`hng、m、n、ng、ê` 不編碼。

#### 現行 U357 生產指標

下表來自[雙拼佈局 Benchmark](https://github.com/more-14-different/shuangpin-layout-benchmark)中 U357 所在的嚴格 ProdGate 搜尋報告，以 `S005 = 10` 的 CPU exact scoring 為參照。這裡的 **CKT v4** 是現行候選評分，不是舊 R9 表中的「系綜當量 v4」。

| 指標 | U357 | 門檻或參照 | 判定 |
| --- | ---: | ---: | --- |
| 聲韻容量／輔鍵 | 21×21／`IVUAO` | 嚴格鎖定 | 通過 |
| 記憶代價 M | 40 | ≤ 40 | 通過 |
| 普通聲母位移 D | 0 | = 0 | 通過 |
| 元音位移 V | 5 | ≤ 5 | 通過 |
| Common399 唯一音節碼 U | 357 | 生產基線 352；越高越好 | +5 |
| 重碼桶／受影響音節 | 42／84 | 越少越好 | — |
| CKT v4 | 9.716421 | Tier-A ≤ 9.720；越低越好 | 通過 |
| 右小指 S2 負載 `rp_s2` | 4.1808% | ≤ 4.1808% | 通過 |
| 右小指峰值 `rp_max` | 5.1045% | ≤ 5.1045% | 通過 |
| 主鍵區下限 `homeFloor` | 37.6204% | ≥ 35.0756% | 通過 |
| W 鍵峰值 `w_max` | 3.6232% | ≤ 3.6232% | 通過 |
| Y 鍵峰值 `y_max` | 6.3924% | ≤ 6.8685% | 通過 |
| 移動手分數 `mxScore` | 143.380 | ≥ 140.842；越高越好 | 通過 |

U357 在凍結語料上的八軌加權選重率如下；它們用於檢查冰雪鍵道與冰雪三拼的實際編碼路徑，不等同真人測速。

| 方案 | 單字 | 二字詞 | 三字詞 | 四字詞 |
| --- | ---: | ---: | ---: | ---: |
| 冰雪鍵道 | 0.489% | 0.440% | 4.948% | 0.366% |
| 冰雪三拼 | 0.786% | 0.632% | 6.948% | 0.565% |

舊 R9 的「系綜當量 v4/v5/v6-CW150」、裸 S2 與 MX34 屬於凍結 R11 歷史口徑，已從現行 README 指標表移除，不能與上面的 CKT v4 混用。需要追溯時請查看[神韻 R9 公平對比](reports/shenyun-r9-comparison.md)、[原始 JSON](reports/shenyun-r9-comparison.json)及[U357 實裝遷移記錄](research-notes/2026-10-30-shenyun-u357-migration.md)。

#### 固頂與二字詞逐級簡碼

目前方案以 366 個二碼單字與 75 個二簡完整覆蓋 441 個 AA 位置，二簡全部使用 U357 擴充域的自然空碼；三拼 630 為 105＋505，鍵道 630 為 105＋525。[`snow_sanpin.fixed.630.txt`](snow_sanpin.fixed.630.txt)另列三拼二字詞二、三碼候選：630 個理論碼位中 550 個有候選，每碼最多 10 項，供逐級複核，不取代「一碼一候選」固頂表。

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
