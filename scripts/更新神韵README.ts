import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	type ComparisonDirection,
	decorateMarkdownTable,
	linkReadmeFiles,
	linkShenyunTerms,
} from "./lib/shenyun-markdown";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = [join(root, "README.md"), join(root, "README_CN.md")];

const zhOverall = `### 神韵(Overall-17) 21×26 双拼

冰雪简道二／三／四字词当前运行的前两辅字位顺序为 \`12/21/42\`，冰雪散拼为 \`12/21/13\`；二／三／四字词均在四键主码后最多追加两辅。CKT v5.1 保留四码顶的两辅合同，第二辅后按选重计费；其宽网格稳健第一为形 \`12/21/14\`、调 \`12/21/13\`。

冰雪简道（\`snow_shenyun_shape\`）与冰雪散拼（\`snow_shenyun_tone\`）共用 **神韵(Overall-17) 21×26 双拼**。该方案出自双拼布局 Benchmark 的 \`production/ckt-v4-2126-strict-d0-20261030\` 分支，定稿于提交 \`7a7e154\`；\`2026-10-30-strict-d0-production-closure-report.md\` 记录了搜索约束、得来过程和冠军声韵映射。本仓库将其固化为 \`SNOW-SHENYUN-21X26-PRODUCTION\`，本节映射与键盘图均以该定稿方案为准。

#### 英数入口

两个 21×26 方案已经启用同一套占用桶字母方案。它按当前五部系统词典计算，不使用任何运行时空桶：每码保留现有汉字首选，大写固定为第 2、小写固定为第 3。21 个辅音字母优先共用尾键 \`y\`；为避免把高价值自然候选后移，\`D/Q/V\` 改用各自行最低影响的 \`dj/qq/vm\`，\`X\` 保留 \`xy\`，五个元音从 \`x\` 行其余占用桶中选出。完整审计见[机器可读字母映射](config/shenyun-21x26-letter-buckets.json)。

| 字母 | 输入码 | 汉字首选 | 字母 | 输入码 | 汉字首选 |
| --- | :---: | :---: | --- | :---: | :---: |
| A | \`xw\` | 欸 | N | \`ny\` | 囊 |
| B | \`by\` | 帮 | O | \`xf\` | 偶 |
| C | \`cy\` | 藏 | P | \`py\` | 胖 |
| D | \`dj\` | 扽 | Q | \`qq\` | 穷 |
| E | \`xj\` | 恩 | R | \`ry\` | 让 |
| F | \`fy\` | 张 | S | \`sy\` | 桑 |
| G | \`gy\` | 刚 | T | \`ty\` | 躺 |
| H | \`hy\` | 行 | U | \`xx\` | 秀 |
| I | \`xb\` | 寻 | V | \`vm\` | 戳 |
| J | \`jy\` | 放 | W | \`wy\` | 上 |
| K | \`ky\` | 扛 | X | \`xy\` | 昂 |
| L | \`ly\` | 狼 | Y | \`yy\` | 养 |
| M | \`my\` | 忙 | Z | \`zy\` | 脏 |

数字码已按四个 21×21 方案的现行合同计算，但尚未写入两份 fixed 表：阿拉伯数字跟随对应汉字数字当前最短的既有合法码；\`1/2/3\` 因而沿用 \`一/二/三\` 的 \`y/xu/s\`，其余数字使用该汉字的首个形辅／调辅消歧码，不占无关空桶。机器可读结果见[数字码映射](config/shenyun-21x26-number-codes.json)。

| 数字 | 冰雪简道 | 冰雪散拼 |
| --- | :---: | :---: |
| 零／0 | \`lre\` | \`lre\` |
| 一／1 | \`y\` | \`y\` |
| 二／2 | \`xu\` | \`xu\` |
| 三／3 | \`s\` | \`s\` |
| 四／4 | \`sii\` | \`sia\` |
| 五／5 | \`que\` | \`quu\` |
| 六／6 | \`lxo\` | \`lxa\` |
| 七／7 | \`qie\` | \`qii\` |
| 八／8 | \`bau\` | \`bai\` |
| 九／9 | \`jxu\` | \`jxu\` |
| 十／10 | \`wiu\` | \`wie\` |

恰好三码的 \`ABA\`（\`U=A⊔B\`、\`|A|=21\`、\`|B|=5\`）共 \`21×5×21=2205\` 个状态，暂时完整保留，等有足以利用其五类结构的功能再启用；\`AAB\` 与 \`AAAB\` 的既定路由同样不改。

> [!NOTE]
> 由于作者也是[冰雪四拼](https://input.tansongchen.com/snow4/)用户，因此[冰雪散拼](snow_shenyun_tone.schema.yaml)的五调辅键，直接按[冰雪四拼](https://input.tansongchen.com/snow4/)的顺序排列。

**声韵辅-键 映射**

![神韵(Overall-17) 21×26 双拼声韵键盘图](docs/shenyun-overall17-keyboard.svg)

**日常八场景文稿纯双拼键频图（含标点）**

![神韵(Overall-17) 21×26 双拼键频图](docs/shenyun-overall17-keyboard-heat.svg)

两图由 benchmark 页面中的定稿方案导出：声韵图调用页面内置 \`keyboardSVG\` 后裁出 26 个字母键；键频图调用页面内置 \`r9MacroHeat\`，使用同一篇 2149 击键日常八场景文稿。键频图不含五辅键、空格和选重。

**十一场景 5500 字最优路径全按键键频图**

![神韵(Overall-17) 21×26 5500 字最优路径全按键键频图](docs/shenyun-overall17-5500-keyboard-heat.svg)

新图直接复算十方案最优切分逐键回放，共 11 个 benchmark 场景、5500 汉字和 392 个标点；独立赛文与第 10 篇相同，按两个场景计两遍。冰雪简道共 9964 次实际按键，其中 Space 401、Shift 3、选重 0；短码、五辅键、空格、定字键、标点及其他所有非 0 按键均已纳入，计数为 0 的数字选重键不绘制。[原始键频数据](reports/神韵十一场景_5500字_最优路径全按键键频.json)可供复核。

#### 声韵编码规则

普通声母首键为：

| 声母 | 首键 | 声母 | 首键 | 声母 | 首键 |
| --- | :---: | --- | :---: | --- | :---: |
| b | B | p | P | m | M |
| f | J | d | D | t | T |
| n | N | l | L | g | G |
| k | K | h | H | j | J |
| q | Q | x | X | zh | F |
| ch | V | sh | W | r | R |
| z | Z | c | C | s | S |

零声母载体为 \`AOE→X\`、\`W→Q\`、\`Y/YU→Y\`。韵母使用全部 26 个字母键：

| 第二键 | 韵母 | 第二键 | 韵母 | 第二键 | 韵母 |
| :---: | --- | :---: | --- | :---: | --- |
| A | a | H | ai | O | an |
| Y | ang | S | ao | E | e |
| W | ei | J | en | N | eng |
| U | er / u | I | i | K | ia / ong |
| P | ian / uang | L | iang / ui | D | iao |
| Z | ie | C | in | R | ing / uai |
| Q | iong / uan | X | iu / ua | M | o / uo |
| F | ou | T | un / van | V | v（ü） |
| G | ve（üe） | B | vn |  |  |

- Common399 全覆盖且 399 个二键码全部唯一，21×26 共保留 147 个空码；M-R2 为 36，普通声母仅 \`f→J\` 偏移，基础元音仅 \`o→M\` 偏移。
- 冰雪简道辅键为 \`A/E/U/I/O\`，冰雪散拼声调键为 \`I/E/U/A/O → 一/二/三/四/轻\`。
- 小写输入遵循飞花式顶功：单字为 \`A_ / AU_ / AUB / AUBB / AUBBB / AUBBBB\`，即双拼主码后最多追加四辅；二／三／四字词的四键主码分别为 \`A₁U₁A₂U₂\`、\`A₁A₂A₃U₃\`、\`A₁A₂A₃A₄\`，主码后最多追加两辅，具体辅码字位顺序见本节首段。完整码之后输入下一字声码才顶屏，未完成主码直接续写；若第三音节的 \`AU\` 为运行时空桶，三字词还可在三个声码后直接追加辅码。
- 完成编码后按 \`;\` 或 \`/\` 会先顶出当前候选，再分别追加“的”或“了”，与 21×21 方案的强制上屏尾字键一致。
- 两组 21×26 方案的空桶均在运行时查询系统词典：完整单字词频大于 1 才占桶，个人词频不参与。当前词典实际得到 143 个空 \`AU\`，其中 134 个为空 \`AA\`、9 个为空 \`AB\`；单键只固顶一个一简字，其余候选先按词典权重排序，编码逐级延长时会将此前出现过的首选后置，因此字词可停在目标首次升为首选的最短合法编码，不必默认补满最长码。

`;

const enOverall = `### Shenyun(Overall-17) 21×26 double pinyin

冰雪简道 currently uses first-two auxiliary-source orders \`12/21/42\` for two-/three-/four-character words, while 冰雪散拼 uses \`12/21/13\`; all three word lengths append at most two auxiliaries after their four-key main code. CKT v5.1 retains this two-auxiliary four-code-top contract and charges selection after the second auxiliary; its wide-grid robust policies are \`12/21/14\` for Shape and \`12/21/13\` for Tone.

冰雪简道 (\`snow_shenyun_shape\`) and 冰雪散拼 (\`snow_shenyun_tone\`) share **Shenyun(Overall-17) 21×26 double pinyin**. The layout comes from the Shuangpin Layout Benchmark branch \`production/ckt-v4-2126-strict-d0-20261030\` and was finalized in commit \`7a7e154\`; \`2026-10-30-strict-d0-production-closure-report.md\` records the search constraints, derivation, and winning mapping. This repository freezes it as \`SNOW-SHENYUN-21X26-PRODUCTION\`, and this section's mapping and keyboard figures use that finalized layout.

#### Letter and number entry

Both 21×26 schemes have enabled the same occupied-bucket letter mapping. It is calculated against the current five system dictionaries and consumes no runtime-vacant bucket: each code preserves its existing Han first choice, with uppercase second and lowercase third. Twenty-one consonant letters preferentially share final key \`y\`; to avoid displacing high-value natural candidates, \`D/Q/V\` use their lowest-impact row codes \`dj/qq/vm\`, \`X\` keeps \`xy\`, and the five vowels use the least-impact remaining occupied buckets in the \`x\` row. See the [machine-readable letter mapping](config/shenyun-21x26-letter-buckets.json) for the full audit.

| Letter | Input | Han first choice | Letter | Input | Han first choice |
| --- | :---: | :---: | --- | :---: | :---: |
| A | \`xw\` | 欸 | N | \`ny\` | 囊 |
| B | \`by\` | 帮 | O | \`xf\` | 偶 |
| C | \`cy\` | 藏 | P | \`py\` | 胖 |
| D | \`dj\` | 扽 | Q | \`qq\` | 穷 |
| E | \`xj\` | 恩 | R | \`ry\` | 让 |
| F | \`fy\` | 张 | S | \`sy\` | 桑 |
| G | \`gy\` | 刚 | T | \`ty\` | 躺 |
| H | \`hy\` | 行 | U | \`xx\` | 秀 |
| I | \`xb\` | 寻 | V | \`vm\` | 戳 |
| J | \`jy\` | 放 | W | \`wy\` | 上 |
| K | \`ky\` | 扛 | X | \`xy\` | 昂 |
| L | \`ly\` | 狼 | Y | \`yy\` | 养 |
| M | \`my\` | 忙 | Z | \`zy\` | 脏 |

The number mapping has been calculated under the same contract as the four 21×21 schemes but has not yet been written to the two fixed tables. Each Arabic numeral follows the shortest current legal code of its corresponding Han numeral; \`1/2/3\` therefore keep \`y/xu/s\` from \`一/二/三\`, while every other numeral uses that Han character's first shape or tone auxiliary for disambiguation. No unrelated vacant bucket is consumed. See the [machine-readable number mapping](config/shenyun-21x26-number-codes.json).

| Number | 冰雪简道 | 冰雪散拼 |
| --- | :---: | :---: |
| 零／0 | \`lre\` | \`lre\` |
| 一／1 | \`y\` | \`y\` |
| 二／2 | \`xu\` | \`xu\` |
| 三／3 | \`s\` | \`s\` |
| 四／4 | \`sii\` | \`sia\` |
| 五／5 | \`que\` | \`quu\` |
| 六／6 | \`lxo\` | \`lxa\` |
| 七／7 | \`qie\` | \`qii\` |
| 八／8 | \`bau\` | \`bai\` |
| 九／9 | \`jxu\` | \`jxu\` |
| 十／10 | \`wiu\` | \`wie\` |

All \`21×5×21=2205\` exact three-key \`ABA\` states (\`U=A⊔B\`, \`|A|=21\`, \`|B|=5\`) remain reserved until a feature can make meaningful use of all five structural classes. Existing \`AAB\` and \`AAAB\` routes are unchanged as well.

> [!NOTE]
> Because the author also uses [Snow Four-Code](https://input.tansongchen.com/snow4/), [冰雪散拼](snow_shenyun_tone.schema.yaml)'s five tone auxiliary keys are arranged directly in the order of [Snow Four-Code](https://input.tansongchen.com/snow4/).

**Initial/final/auxiliary-key mapping**

![Shenyun(Overall-17) 21×26 initial/final keyboard map](docs/shenyun-overall17-keyboard.svg)

**Pure-double-pinyin key-frequency map over the daily eight-scenario corpus (punctuation included)**

![Shenyun(Overall-17) 21×26 key-frequency map](docs/shenyun-overall17-keyboard-heat.svg)

Both SVGs are exported from the finalized entry in the benchmark page: the first uses its built-in \`keyboardSVG\`, while the second uses \`r9MacroHeat\` over the same 2,149-keystroke daily corpus. The heat map excludes auxiliaries, spaces, and candidate selection.

**All-key frequency map for optimal paths over eleven benchmark scenarios and 5,500 Chinese characters**

![Shenyun(Overall-17) 21×26 optimal-path all-key frequency map over 5,500 Chinese characters](docs/shenyun-overall17-5500-keyboard-heat.svg)

The map is recomputed directly from the ten-scheme optimal-path replays over eleven benchmark scenarios, 5,500 Chinese characters, and 392 punctuation marks; the standalone article duplicates article 10 as a separate scenario. Snow Simple-Tao uses 9,964 actual keystrokes, including 401 Spaces, 3 Shifts, and zero candidate selections. Short codes, all five auxiliary keys, spaces, character-selection keys, punctuation, and every other nonzero key are included; zero-count numeric candidate-selection keys are not drawn. The [raw frequency data](reports/神韵十一场景_5500字_最优路径全按键键频.json) is available for verification.

#### Coding rules

Ordinary initials use their own letter except \`f→J\` and \`zh/ch/sh→F/V/W\`; zero-onset carriers are \`AOE→X\`, \`W→Q\`, and \`Y/YU→Y\`. The final keys are \`a:A, ai:H, an:O, ang:Y, ao:S, e:E, ei:W, en:J, eng:N, er/u:U, i:I, ia/ong:K, ian/uang:P, iang/ui:L, iao:D, ie:Z, in:C, ing/uai:R, iong/uan:Q, iu/ua:X, o/uo:M, ou:F, un/van:T, v:V, ve:G, vn:B\`.

Common399 has 399 distinct two-key codes, leaving 147 vacancies in the 21×26 domain; M-R2 is 36. Shape auxiliaries are \`A/E/U/I/O\`, and tone auxiliaries are \`I/E/U/A/O → 1/2/3/4/neutral\`. Lowercase input follows the Feihua popping contract: characters use \`A_ / AU_ / AUB / AUBB / AUBBB / AUBBBB\`, with at most four auxiliaries after the double-pinyin main code; the four-key main codes for two-, three-, and four-character words are \`A₁U₁A₂U₂\`, \`A₁A₂A₃U₃\`, and \`A₁A₂A₃A₄\`, followed by at most two auxiliaries in the source orders stated in this section's opening paragraph. A following initial commits only after a complete code, while an incomplete main code continues directly; if the third syllable's \`AU\` is a runtime-vacant bucket, a three-character word may append auxiliaries immediately after its three initials. After a completed code, \`;\` or \`/\` first commits the current candidate and then appends “的” or “了”, matching the forced tail-character keys in the 21×21 schemes. System-dictionary single-character entries with frequency above 1 occupy a bucket; user frequency does not, so the current dictionary yields 143 runtime \`AU\` vacancies: 134 vacant \`AA\` codes and 9 vacant \`AB\` codes. Only one one-key character is pinned per initial. Other candidates start in dictionary-weight order; as a legal code grows, previous first choices are postponed, so a character or word can stop at the shortest prefix that first promotes it instead of filling its maximum code.

`;

const zhtOverall = `### 神韻(Overall-17) 21×26 雙拼

冰雪簡道二／三／四字詞當前運行的前兩輔字位順序為 \`12/21/42\`，冰雪散拼為 \`12/21/13\`；二／三／四字詞均在四鍵主碼後最多追加兩輔。CKT v5.1 保留四碼頂的兩輔合同，第二輔後按選重計費；其寬網格穩健第一為形 \`12/21/14\`、調 \`12/21/13\`。

冰雪簡道（\`snow_shenyun_shape\`）與冰雪散拼（\`snow_shenyun_tone\`）共用 **神韻(Overall-17) 21×26 雙拼**。該方案出自雙拼布局 Benchmark 的 \`production/ckt-v4-2126-strict-d0-20261030\` 分支，定稿於提交 \`7a7e154\`；\`2026-10-30-strict-d0-production-closure-report.md\` 記錄了搜尋約束、得來過程及冠軍聲韻映射。本倉庫將其固化為 \`SNOW-SHENYUN-21X26-PRODUCTION\`，本節映射與鍵盤圖均以該定稿方案為準。

#### 英數入口

兩個 21×26 方案已啟用同一套占用桶字母方案。它按目前五部系統詞典計算，不使用任何運行時空桶：每碼保留既有漢字首選，大寫固定為第 2、小寫固定為第 3。21 個輔音字母優先共用尾鍵 \`y\`；為避免把高價值自然候選後移，\`D/Q/V\` 改用各自行最低影響的 \`dj/qq/vm\`，\`X\` 保留 \`xy\`，五個母音從 \`x\` 行其餘占用桶中選出。完整稽核見[機器可讀字母映射](config/shenyun-21x26-letter-buckets.json)。

| 字母 | 輸入碼 | 漢字首選 | 字母 | 輸入碼 | 漢字首選 |
| --- | :---: | :---: | --- | :---: | :---: |
| A | \`xw\` | 欸 | N | \`ny\` | 囊 |
| B | \`by\` | 幫 | O | \`xf\` | 偶 |
| C | \`cy\` | 藏 | P | \`py\` | 胖 |
| D | \`dj\` | 扽 | Q | \`qq\` | 窮 |
| E | \`xj\` | 恩 | R | \`ry\` | 讓 |
| F | \`fy\` | 張 | S | \`sy\` | 桑 |
| G | \`gy\` | 剛 | T | \`ty\` | 躺 |
| H | \`hy\` | 行 | U | \`xx\` | 秀 |
| I | \`xb\` | 尋 | V | \`vm\` | 戳 |
| J | \`jy\` | 放 | W | \`wy\` | 上 |
| K | \`ky\` | 扛 | X | \`xy\` | 昂 |
| L | \`ly\` | 狼 | Y | \`yy\` | 養 |
| M | \`my\` | 忙 | Z | \`zy\` | 髒 |

數字碼已按四個 21×21 方案的現行合同計算，但尚未寫入兩份 fixed 表：阿拉伯數字跟隨對應漢字數字目前最短的既有合法碼；\`1/2/3\` 因而沿用 \`一/二/三\` 的 \`y/xu/s\`，其餘數字使用該漢字的首個形輔／調輔消歧碼，不占無關空桶。機器可讀結果見[數字碼映射](config/shenyun-21x26-number-codes.json)。

| 數字 | 冰雪簡道 | 冰雪散拼 |
| --- | :---: | :---: |
| 零／0 | \`lre\` | \`lre\` |
| 一／1 | \`y\` | \`y\` |
| 二／2 | \`xu\` | \`xu\` |
| 三／3 | \`s\` | \`s\` |
| 四／4 | \`sii\` | \`sia\` |
| 五／5 | \`que\` | \`quu\` |
| 六／6 | \`lxo\` | \`lxa\` |
| 七／7 | \`qie\` | \`qii\` |
| 八／8 | \`bau\` | \`bai\` |
| 九／9 | \`jxu\` | \`jxu\` |
| 十／10 | \`wiu\` | \`wie\` |

恰好三碼的 \`ABA\`（\`U=A⊔B\`、\`|A|=21\`、\`|B|=5\`）共 \`21×5×21=2205\` 個狀態，暫時完整保留，等有足以利用其五類結構的功能再啟用；\`AAB\` 與 \`AAAB\` 的既定路由同樣不改。

> [!NOTE]
> 由於作者也是[冰雪四拼](https://input.tansongchen.com/snow4/)使用者，因此[冰雪散拼](snow_shenyun_tone.schema.yaml)的五調輔鍵，直接按[冰雪四拼](https://input.tansongchen.com/snow4/)的順序排列。

**聲韻輔-鍵 映射**

![神韻(Overall-17) 21×26 雙拼聲韻鍵盤圖](docs/shenyun-overall17-keyboard.svg)

**日常八場景文稿純雙拼鍵頻圖（含標點）**

![神韻(Overall-17) 21×26 雙拼鍵頻圖](docs/shenyun-overall17-keyboard-heat.svg)

兩圖由 benchmark 頁面中的定稿方案匯出：聲韻圖使用頁面內建 \`keyboardSVG\`，鍵頻圖使用 \`r9MacroHeat\` 與同一篇 2149 擊鍵日常文稿；鍵頻圖不含五輔鍵、空格及選重。

**十一場景 5500 字最優路徑全按鍵鍵頻圖**

![神韻(Overall-17) 21×26 5500 字最優路徑全按鍵鍵頻圖](docs/shenyun-overall17-5500-keyboard-heat.svg)

新圖直接復算十方案最優切分逐鍵回放，共 11 個 benchmark 場景、5500 漢字和 392 個標點；獨立賽文與第 10 篇相同，按兩個場景計兩遍。冰雪簡道共 9964 次實際按鍵，其中 Space 401、Shift 3、選重 0；短碼、五輔鍵、空格、定字鍵、標點及其他所有非 0 按鍵均已納入，計數為 0 的數字選重鍵不繪製。[原始鍵頻資料](reports/神韵十一场景_5500字_最优路径全按键键频.json)可供複核。

#### 聲韻規則

普通聲母除 \`f→J\`、\`zh/ch/sh→F/V/W\` 外使用本字母；零聲母載體為 \`AOE→X\`、\`W→Q\`、\`Y/YU→Y\`。韻母鍵為 \`a:A, ai:H, an:O, ang:Y, ao:S, e:E, ei:W, en:J, eng:N, er/u:U, i:I, ia/ong:K, ian/uang:P, iang/ui:L, iao:D, ie:Z, in:C, ing/uai:R, iong/uan:Q, iu/ua:X, o/uo:M, ou:F, un/van:T, v:V, ve:G, vn:B\`。

Common399 形成 399 個唯一二鍵碼，21×26 鍵域保留 147 個空碼；M-R2 為 36。形輔鍵為 \`A/E/U/I/O\`，聲調鍵為 \`I/E/U/A/O → 一/二/三/四/輕\`。小寫輸入遵循飛花式頂功：單字為 \`A_ / AU_ / AUB / AUBB / AUBBB / AUBBBB\`，即雙拼主碼後最多追加四輔；二／三／四字詞的四鍵主碼分別為 \`A₁U₁A₂U₂\`、\`A₁A₂A₃U₃\`、\`A₁A₂A₃A₄\`，主碼後最多追加兩輔，具體輔碼字位順序見本節首段。完整碼之後輸入下一字聲碼才頂屏，未完成主碼直接續寫；若第三音節的 \`AU\` 為運行時空桶，三字詞還可在三個聲碼後直接追加輔碼。完成編碼後按 \`;\` 或 \`/\` 會先頂出當前候選，再分別追加「的」或「了」，與 21×21 方案的強制上屏尾字鍵一致。空桶只查系統詞典，完整單字詞頻大於 1 才占桶，當前詞典有 143 個運行時空 \`AU\`，其中 134 個為空 \`AA\`、9 個為空 \`AB\`；每個聲鍵只固頂一個一簡字。其餘候選先按詞典權重排序，編碼逐級延長時會將此前出現過的首選後置，因此字詞可停在目標首次升為首選的最短合法編碼，不必預設補滿最長碼。

`;

const zhU357EnglishNumbers = `#### 英数入口

本节同时列出采用 U357 的冰雪健道、冰雪弎拼及其经典声韵对应方案冰雪键道、冰雪三拼。四个 21×21 方案已经启用同一套字母结构：冰雪健道与冰雪键道使用二键基码；冰雪弎拼与冰雪三拼都在基码后追加轻声键 \`o\`。除 \`A/I/O/U/V\` 外的 21 个字母使用“字母小写＋\`c\`”，五个例外使用 \`A=xw、I=xl、O=xd、U=xh、V=xg\`。键道类保留原汉字首选，大写、小写固定为第 2、3 候选；三拼类的完整字母码固定大写第 1、小写第 2，即使与真实轻声音节重合也保持字母固顶。

阿拉伯数字与对应汉字数字同码，不另占空桶；原码已有更重要首选时继续保留，例如冰雪健道 \`qlv → 妻、七、7\`、冰雪键道 \`qkv → 其、七、7\`。

| 数字 | 冰雪健道 | 冰雪弎拼 | 冰雪键道 | 冰雪三拼 |
| --- | :---: | :---: | :---: | :---: |
| 零／0 | \`ltv\` | \`ltv\` | \`lgv\` | \`lgv\` |
| 一／1 | \`y\` | \`y\` | \`y\` | \`y\` |
| 二／2 | \`re\` | \`re\` | \`xj\` | \`xj\` |
| 三／3 | \`sj\` | \`sj\` | \`s\` | \`s\` |
| 四／4 | \`sli\` | \`sla\` | \`sk\` | \`sk\` |
| 五／5 | \`shv\` | \`shu\` | \`wjv\` | \`wju\` |
| 六／6 | \`ldo\` | \`lda\` | \`lqo\` | \`lqa\` |
| 七／7 | \`qlv\` | \`qli\` | \`qkv\` | \`qki\` |
| 八／8 | \`bwu\` | \`bwi\` | \`bsu\` | \`bsi\` |
| 九／9 | \`jdu\` | \`jdu\` | \`jqu\` | \`jqu\` |
| 十／10 | \`elu\` | \`elv\` | \`eku\` | \`ekv\` |`;

const enU357EnglishNumbers = `#### Letter and number entry

This subsection also lists the classic sound-layout counterparts of the U357 schemes: 冰雪键道 and 冰雪三拼. All four 21×21 schemes have enabled the same letter structure. 冰雪健道 and 冰雪键道 use the two-key base; both 冰雪弎拼 and 冰雪三拼 append neutral-tone key \`o\`. The 21 consonant letters other than \`A/I/O/U/V\` use “lowercase letter + \`c\`”; the five exceptions are \`A=xw, I=xl, O=xd, U=xh, V=xg\`. KeyTao schemes preserve the existing Han first choice and pin uppercase/lowercase to positions 2/3. Three-Code schemes pin uppercase/lowercase to positions 1/2 at the full letter code, even where it overlaps a real neutral-tone syllable.

Arabic numerals share the code of the corresponding Han numeral and consume no separate vacant bucket. An existing higher-priority first choice is preserved, for example \`qlv → 妻、七、7\` in 冰雪健道 and \`qkv → 其、七、7\` in 冰雪键道.

| Number | 冰雪健道 | 冰雪弎拼 | 冰雪键道 | 冰雪三拼 |
| --- | :---: | :---: | :---: | :---: |
| 零／0 | \`ltv\` | \`ltv\` | \`lgv\` | \`lgv\` |
| 一／1 | \`y\` | \`y\` | \`y\` | \`y\` |
| 二／2 | \`re\` | \`re\` | \`xj\` | \`xj\` |
| 三／3 | \`sj\` | \`sj\` | \`s\` | \`s\` |
| 四／4 | \`sli\` | \`sla\` | \`sk\` | \`sk\` |
| 五／5 | \`shv\` | \`shu\` | \`wjv\` | \`wju\` |
| 六／6 | \`ldo\` | \`lda\` | \`lqo\` | \`lqa\` |
| 七／7 | \`qlv\` | \`qli\` | \`qkv\` | \`qki\` |
| 八／8 | \`bwu\` | \`bwi\` | \`bsu\` | \`bsi\` |
| 九／9 | \`jdu\` | \`jdu\` | \`jqu\` | \`jqu\` |
| 十／10 | \`elu\` | \`elv\` | \`eku\` | \`ekv\` |`;

const zhtU357EnglishNumbers = `#### 英數入口

本節同時列出採用 U357 的冰雪健道、冰雪弎拼及其經典聲韻對應方案冰雪鍵道、冰雪三拼。四個 21×21 方案已啟用同一套字母結構：冰雪健道與冰雪鍵道使用二鍵基碼；冰雪弎拼與冰雪三拼都在基碼後追加輕聲鍵 \`o\`。除 \`A/I/O/U/V\` 外的 21 個字母使用「字母小寫＋\`c\`」，五個例外使用 \`A=xw、I=xl、O=xd、U=xh、V=xg\`。鍵道類保留原漢字首選，大寫、小寫固定為第 2、3 候選；三拼類的完整字母碼固定大寫第 1、小寫第 2，即使與真實輕聲音節重合也保持字母固頂。

阿拉伯數字與對應漢字數字同碼，不另占空桶；原碼已有更重要首選時繼續保留，例如冰雪健道 \`qlv → 妻、七、7\`、冰雪鍵道 \`qkv → 其、七、7\`。

| 數字 | 冰雪健道 | 冰雪弎拼 | 冰雪鍵道 | 冰雪三拼 |
| --- | :---: | :---: | :---: | :---: |
| 零／0 | \`ltv\` | \`ltv\` | \`lgv\` | \`lgv\` |
| 一／1 | \`y\` | \`y\` | \`y\` | \`y\` |
| 二／2 | \`re\` | \`re\` | \`xj\` | \`xj\` |
| 三／3 | \`sj\` | \`sj\` | \`s\` | \`s\` |
| 四／4 | \`sli\` | \`sla\` | \`sk\` | \`sk\` |
| 五／5 | \`shv\` | \`shu\` | \`wjv\` | \`wju\` |
| 六／6 | \`ldo\` | \`lda\` | \`lqo\` | \`lqa\` |
| 七／7 | \`qlv\` | \`qli\` | \`qkv\` | \`qki\` |
| 八／8 | \`bwu\` | \`bwi\` | \`bsu\` | \`bsi\` |
| 九／9 | \`jdu\` | \`jdu\` | \`jqu\` | \`jqu\` |
| 十／10 | \`elu\` | \`elv\` | \`eku\` | \`ekv\` |`;

const overallValues = [
	"36",
	"1 / 1",
	"0 / 0 / 0",
	"98.298315",
	"81.043390",
	"399 / 100%",
	"0 / 0%",
	"0 / 0（0%）",
	"0%",
	"2.0000",
	"75.672",
	"9.252%",
	"9.630039",
	"9.185254",
	"9.195026",
	"9.204752",
	"10.620559",
	"10.684702",
	"10.821925",
	"9.534119",
	"0.609%",
	"20.831%",
	"4.459%",
	"1017:1132 / 47.324%",
	"45.882%",
	"0.7118",
	"18.8952%",
	"3.5164%",
	"27.6709%",
	"37.0249%",
	"24.7331%",
	"12.4215%",
	"132.219",
];

function normalizeSourceProvenance(markdown: string) {
	let language: "zh" | "en" | "zht" = "zh";
	return markdown
		.split("\n")
		.map((line) => {
			if (line === "## 简体中文") language = "zh";
			else if (line === "## English") language = "en";
			else if (line === "## 繁體中文") language = "zht";
			if (line.startsWith("冰雪简道（"))
				return "冰雪简道（`snow_shenyun_shape`）与冰雪散拼（`snow_shenyun_tone`）共用 **神韵(Overall-17) 21×26 双拼**。该方案出自双拼布局 Benchmark 的 `production/ckt-v4-2126-strict-d0-20261030` 分支，定稿于提交 `7a7e154`；`2026-10-30-strict-d0-production-closure-report.md` 记录了搜索约束、得来过程和冠军声韵映射。本仓库将其固化为 `SNOW-SHENYUN-21X26-PRODUCTION`，本节映射与键盘图均以该定稿方案为准。";
			if (line.startsWith("冰雪简道 ("))
				return "冰雪简道 (`snow_shenyun_shape`) and 冰雪散拼 (`snow_shenyun_tone`) share **Shenyun(Overall-17) 21×26 double pinyin**. The layout comes from the Shuangpin Layout Benchmark branch `production/ckt-v4-2126-strict-d0-20261030` and was finalized in commit `7a7e154`; `2026-10-30-strict-d0-production-closure-report.md` records the search constraints, derivation, and winning mapping. This repository freezes it as `SNOW-SHENYUN-21X26-PRODUCTION`, and this section's mapping and keyboard figures use that finalized layout.";
			if (line.startsWith("冰雪簡道（"))
				return "冰雪簡道（`snow_shenyun_shape`）與冰雪散拼（`snow_shenyun_tone`）共用 **神韻(Overall-17) 21×26 雙拼**。該方案出自雙拼布局 Benchmark 的 `production/ckt-v4-2126-strict-d0-20261030` 分支，定稿於提交 `7a7e154`；`2026-10-30-strict-d0-production-closure-report.md` 記錄了搜尋約束、得來過程及冠軍聲韻映射。本倉庫將其固化為 `SNOW-SHENYUN-21X26-PRODUCTION`，本節映射與鍵盤圖均以該定稿方案為準。";
			if (line.startsWith("[冰雪健道]") && language === "zh")
				return "[冰雪健道](https://input.tansongchen.com/snow-jiandao/)和[冰雪弎拼](https://input.tansongchen.com/snow3/)现共用 **无飞键道(U357) 21×21 双拼**，使用 21×21 声韵键域和 5 个互斥辅键 `IVUAO`。该方案出自双拼布局 Benchmark 的 `production/ckt-v4-2121-strict-avuio-20261024` 分支，定稿于提交 `11713b6`；`2026-10-29-prodgate-directed-repair-final-report.md` 给出了 U=357 候选的搜索过程、完整映射、指标和投产推荐。本仓库采用并实现该候选，本节映射与键盘图均以报告中的 U=357 方案为准。";
			if (line.startsWith("[冰雪健道]") && language === "en")
				return "[冰雪健道](https://input.tansongchen.com/snow-jiandao/) and [冰雪弎拼](https://input.tansongchen.com/snow3/) now share **Wufei KeyTao(U357) 21×21 double pinyin**, using a 21×21 sound-code domain and five disjoint auxiliary keys, `IVUAO`. The layout comes from the Shuangpin Layout Benchmark branch `production/ckt-v4-2121-strict-avuio-20261024` and was finalized in commit `11713b6`; `2026-10-29-prodgate-directed-repair-final-report.md` records the U=357 candidate's search, full mapping, metrics, and production recommendation. This repository implements that candidate, and this section's mapping and keyboard figures use the reported U=357 layout.";
			if (line.startsWith("[冰雪健道]") && language === "zht")
				return "[冰雪健道](https://input.tansongchen.com/snow-jiandao/)與[冰雪弎拼](https://input.tansongchen.com/snow3/)現共用 **無飛鍵道(U357) 21×21 雙拼**，使用 21×21 聲韻鍵域與 5 個互斥輔鍵 `IVUAO`。該方案出自雙拼布局 Benchmark 的 `production/ckt-v4-2121-strict-avuio-20261024` 分支，定稿於提交 `11713b6`；`2026-10-29-prodgate-directed-repair-final-report.md` 給出了 U=357 候選的搜尋過程、完整映射、指標及投產建議。本倉庫採用並實作該候選，本節映射與鍵盤圖均以報告中的 U=357 方案為準。";
			return line
				.replace(
					"两图均直接从 benchmark HTML 中的目标方案导出",
					"两图由 benchmark 页面中的定稿方案导出",
				)
				.replace(
					"Both SVGs are exported directly from the target entry in the benchmark HTML",
					"Both SVGs are exported from the finalized entry in the benchmark page",
				)
				.replace(
					"兩圖均直接從 benchmark HTML 的目標方案匯出",
					"兩圖由 benchmark 頁面中的定稿方案匯出",
				);
		})
		.join("\n");
}

function normalizeContractClaims(markdown: string) {
	const lines = markdown.split("\n").map((line) => {
		if (line.startsWith("四方案共用 ") && line.includes("冻结 20 合同"))
			return "四方案共用 Common399、冻结 20 合同、字词／形码数据、CKT v4 模型和日常八场景文稿；无飞键道(U357)与 S005 按传统 21×21 合同计分；神韵(Overall-17)原生遵循飞花式四码顶；B04 采用原资料记录的 `AEUIO` 形辅与 `IEUAO` 调辅，本比较为其套用同一飞花式四码顶路由和统一字形／笔画源。";
		if (line.startsWith("All four layouts use "))
			return "All four layouts use Common399, the frozen 20 contracts, the same word/shape data, CKT v4, and the daily corpus. Wufei KeyTao(U357) and S005 are scored under the traditional 21×21 contract. Shenyun(Overall-17) natively follows the Feihua four-code-top contract; B04 uses its documented `AEUIO` shape and `IEUAO` tone keys, while this comparison supplies the same Feihua four-code-top routing and shared shape/stroke sources.";
		if (line.startsWith("四方案共用 ") && line.includes("凍結 20 合同"))
			return "四方案共用 Common399、凍結 20 合同、字詞／形碼資料、CKT v4 模型及日常八場景文稿；無飛鍵道(U357)與 S005 按傳統 21×21 合同計分；神韻(Overall-17)原生遵循飛花式四碼頂；B04 採用原資料記錄的 `AEUIO` 形輔與 `IEUAO` 調輔，本比較為其套用同一飛花式四碼頂路由和統一字形／筆畫源。";
		return line;
	});
	return lines
		.join("\n")
		.replace(
			/(\[神韵\(Overall-17\)\]\([^)]+\))与 (\[B04\]\([^)]+\)) 按四码顶合同(?:计分)?，(\[无飞键道\(U357\)\]\([^)]+\))与 (\[S005\]\([^)]+\)) 按传统 21×21 合同(?:计分)?/gu,
			"$1按原生飞花式四码顶合同、$2按本比较套用的同一合同计分，$3与 $4按传统 21×21 合同计分",
		)
		.replace(
			/(\[神韻\(Overall-17\)\]\([^)]+\))與 (\[B04\]\([^)]+\)) 按四碼頂合同(?:計分)?，(\[無飛鍵道\(U357\)\]\([^)]+\))與 (\[S005\]\([^)]+\)) 按傳統 21×21 合同(?:計分)?/gu,
			"$1按原生飛花式四碼頂合同、$2按本比較套用的同一合同計分，$3與 $4按傳統 21×21 合同計分",
		)
		.replace(
			/(\[Shenyun\(Overall-17\)\]\([^)]+\)) and (\[B04\]\([^)]+\)) (?:use|are scored under) four-code-top contracts, while (\[Wufei KeyTao\(U357\)\]\([^)]+\)) and (\[S005\]\([^)]+\)) use the traditional 21×21 contract/gu,
			"$1 uses its native Feihua four-code-top contract and $2 is scored under the same contract for this comparison, while $3 and $4 use the traditional 21×21 contract",
		);
}

function addOverallColumn(markdown: string) {
	const lines = markdown.split("\n");
	for (let index = 0; index < lines.length; index++) {
		if (!/^\| (?:指标|Metric|指標) \|/u.test(lines[index])) continue;
		if (!lines[index].includes("Overall-17")) continue;
		if (!lines[index].includes("U357") || lines[index].includes("Overall-17"))
			continue;
		const headerLabel = lines[index].startsWith("| Metric")
			? "Shenyun(Overall-17) 21×26 double pinyin"
			: lines[index].startsWith("| 指標")
				? "神韻(Overall-17) 21×26 雙拼"
				: "神韵(Overall-17) 21×26 双拼";
		lines[index] = lines[index].replace(
			/^(\| [^|]+ \|)/u,
			`$1 ${headerLabel} |`,
		);
		lines[index + 1] = lines[index + 1].replace(/^(\| [^|]+ \|)/u, "$1 ---: |");
		let row = 0;
		for (
			let cursor = index + 2;
			cursor < lines.length && lines[cursor].startsWith("|");
			cursor++
		) {
			if (row >= overallValues.length)
				throw new Error("Benchmark 表格行数过多。");
			const clean = lines[cursor]
				.replaceAll("**", "")
				.replaceAll(" ★", "")
				.replaceAll("🥇", "");
			lines[cursor] = clean.replace(
				/^(\| [^|]+ \|)/u,
				`$1 ${overallValues[row]} |`,
			);
			row++;
		}
		if (row !== overallValues.length)
			throw new Error(`Benchmark 表格只有 ${row} 行。`);
	}
	return lines.join("\n");
}

function ensureAfter(
	markdown: string,
	anchor: string,
	addition: string,
	marker: string,
) {
	if (markdown.includes(marker)) return markdown;
	if (!markdown.includes(anchor))
		throw new Error(`README 中找不到插入锚点：${anchor}`);
	return markdown.replace(anchor, `${anchor}\n\n${addition}`);
}

function removeStandaloneEnglishNumbers(markdown: string) {
	const lines = markdown.split("\n");
	const start = lines.findIndex((line) => line === "### 双拼方案英数字入口");
	if (start < 0) return markdown;
	const end = lines.findIndex(
		(line, index) => index > start && line.startsWith("### "),
	);
	if (end < 0) throw new Error("README 中找不到英数字入口后的下一个章节。");
	lines.splice(start, end - start);
	while (start < lines.length && lines[start] === "" && lines[start - 1] === "")
		lines.splice(start, 1);
	return lines.join("\n");
}

function ensureMobileSkinsParagraph(markdown: string) {
	const paragraph =
		"发布页面同时提供同文（Android）的 `.trime.yaml` 皮肤包和元书（iOS、Android）的 `.cskin` 皮肤包；皮肤需与输入方案分别安装，布局预览、选择与导入说明见[手机皮肤](https://input.tansongchen.com/#手机皮肤)。触屏布局暂不提供冰雪一拼专用的并击键盘。";
	if (markdown.includes(paragraph) || !markdown.includes("### 反查入口"))
		return markdown;
	return markdown.replace("### 反查入口", `${paragraph}\n\n### 反查入口`);
}

function ensureSubsection(
	markdown: string,
	sectionNeedle: string,
	block: string,
) {
	const lines = markdown.split("\n");
	const start = lines.findIndex(
		(line) => line.startsWith("### ") && line.includes(sectionNeedle),
	);
	if (start < 0) throw new Error(`README 中找不到章节：${sectionNeedle}`);
	let end = lines.findIndex(
		(line, index) => index > start && line.startsWith("### "),
	);
	if (end < 0) end = lines.length;
	const heading = block.split("\n", 1)[0];
	if (lines.slice(start, end).includes(heading)) return markdown;
	const marker = lines.findIndex(
		(line, index) => index > start && index < end && line === "> [!NOTE]",
	);
	if (marker < 0)
		throw new Error(`${sectionNeedle} 中找不到英数入口的插入位置。`);
	lines.splice(marker, 0, ...block.split("\n"), "");
	return lines.join("\n");
}

function normalizeTerms(markdown: string) {
	markdown = normalizeSourceProvenance(markdown)
		.replaceAll(
			"冰雪健道的二／三／四字前两位形辅字位顺序为 `12/23/24`，冰雪弎拼的前两位调码字位顺序为 `12/21/23`；运行时三字词按剩余字位补第三辅，四字词最多两辅。CKT v5 只优化并计分前两辅，第二辅后直接按选重计费。",
			"冰雪健道的二／三／四字前两位形辅字位顺序为 `12/23/24`，冰雪弎拼的前两位调码字位顺序为 `12/21/23`；运行时三字词按剩余字位补第三辅，四字词最多两辅。CKT v5.1 将三字词第三辅纳入优化和计分，完整辅序为冰雪健道 `12/231/24`、冰雪弎拼 `12/213/23`；三字词第三辅后、四字词第二辅后按选重计费。",
		)
		.replaceAll(
			"冰雪健道 uses first-two shape-source orders `12/23/24` for two-/three-/four-character words; 冰雪弎拼 uses first-two tone-source orders `12/21/23`. At runtime, three-character words append the remaining third auxiliary, while four-character words use at most two auxiliaries. CKT v5 optimizes and scores only the first two auxiliaries, then switches directly to selection.",
			"冰雪健道 uses first-two shape-source orders `12/23/24` for two-/three-/four-character words; 冰雪弎拼 uses first-two tone-source orders `12/21/23`. At runtime, three-character words append the remaining third auxiliary, while four-character words use at most two auxiliaries. CKT v5.1 includes the third auxiliary in three-character-word optimization and scoring, giving full policies `12/231/24` for 冰雪健道 and `12/213/23` for 冰雪弎拼; selection is charged after the third auxiliary for three-character words and after the second for four-character words.",
		)
		.replaceAll(
			"冰雪健道的二／三／四字前兩位形輔字位順序為 `12/23/24`，冰雪弎拼的前兩位調碼字位順序為 `12/21/23`；執行時三字詞按剩餘字位補第三輔，四字詞最多兩輔。CKT v5 只優化並計分前兩輔，第二輔後直接按選重計費。",
			"冰雪健道的二／三／四字前兩位形輔字位順序為 `12/23/24`，冰雪弎拼的前兩位調碼字位順序為 `12/21/23`；運行時三字詞按剩餘字位補第三輔，四字詞最多兩輔。CKT v5.1 將三字詞第三輔納入優化和計分，完整輔序為冰雪健道 `12/231/24`、冰雪弎拼 `12/213/23`；三字詞第三輔後、四字詞第二輔後按選重計費。",
		)
		.replaceAll("**声韵键盘图**", "**声韵辅-键 映射**")
		.replaceAll("**声韵映射**", "**声韵辅-键 映射**")
		.replaceAll(
			"**Initial/final keyboard map**",
			"**Initial/final/auxiliary-key mapping**",
		)
		.replaceAll(
			"**Initial/final mapping**",
			"**Initial/final/auxiliary-key mapping**",
		)
		.replaceAll("**聲韻鍵盤圖**", "**聲韻輔-鍵 映射**")
		.replaceAll("**聲韻映射**", "**聲韻輔-鍵 映射**")
		.replaceAll(
			"**无飞键道(U357) 21×21 双拼 日常八场景文稿 纯双拼键频图（含标点）**",
			"**日常八场景文稿纯双拼键频图（含标点）**",
		)
		.replaceAll(
			"**Wufei KeyTao(U357) 21×21 double pinyin pure-double-pinyin key-frequency map over the daily eight-scenario prose corpus (punctuation included)**",
			"**Pure-double-pinyin key-frequency map over the daily eight-scenario corpus (punctuation included)**",
		)
		.replaceAll(
			"**無飛鍵道(U357) 21×21 雙拼 日常八場景文稿 純雙拼鍵頻圖（含標點）**",
			"**日常八場景文稿純雙拼鍵頻圖（含標點）**",
		)
		.replace(
			/\*\*无\[飞键\]\([^)]+\)道·神韵 U357 综合人体工学前沿\*\*/gu,
			"**无飞键道(U357) 21×21 双拼**",
		)
		.replace(
			/\*\*Wufei KeyTao·Shenyun U357 ergonomic frontier\*\*/gu,
			"**Wufei KeyTao(U357) 21×21 double pinyin**",
		)
		.replace(
			/\*\*無\[飛鍵\]\([^)]+\)道·神韻 U357 綜合人體工學前沿\*\*/gu,
			"**無飛鍵道(U357) 21×21 雙拼**",
		)
		.replaceAll("神韵 U357", "无飞键道(U357) 21×21 双拼")
		.replaceAll("Shenyun U357", "Wufei KeyTao(U357) 21×21 double pinyin")
		.replaceAll("神韻 U357", "無飛鍵道(U357) 21×21 雙拼")
		.replaceAll(
			"无飞键道·无飞键道(U357) 21×21 双拼",
			"无飞键道(U357) 21×21 双拼",
		)
		.replaceAll(
			"Wufei KeyTao·Wufei KeyTao(U357) 21×21 double pinyin",
			"Wufei KeyTao(U357) 21×21 double pinyin",
		)
		.replaceAll(
			"無飛鍵道·無飛鍵道(U357) 21×21 雙拼",
			"無飛鍵道(U357) 21×21 雙拼",
		)
		.replaceAll("无飞键道(U357) 21×21 双拼 的", "无飞键道(U357) 21×21 双拼的")
		.replaceAll("無飛鍵道(U357) 21×21 雙拼 的", "無飛鍵道(U357) 21×21 雙拼的")
		.replaceAll(
			"无飞键道(U357) 21×21 双拼 无飞键",
			"无飞键道(U357) 21×21 双拼无飞键",
		)
		.replaceAll(
			"無飛鍵道(U357) 21×21 雙拼 無飛鍵",
			"無飛鍵道(U357) 21×21 雙拼無飛鍵",
		)
		.replaceAll(
			"| 指标 | 神韵(Overall-17) 21×26 | 无飞键道(U357) 21×21 双拼 |",
			"| 指标 | 神韵(Overall-17) 21×26 双拼 | 无飞键道(U357) 21×21 双拼 |",
		)
		.replaceAll(
			"| Metric | Shenyun(Overall-17) 21×26 | Wufei KeyTao(U357) 21×21 double pinyin |",
			"| Metric | Shenyun(Overall-17) 21×26 double pinyin | Wufei KeyTao(U357) 21×21 double pinyin |",
		)
		.replaceAll(
			"| 指標 | 神韵(Overall-17) 21×26 | 無飛鍵道(U357) 21×21 雙拼 |",
			"| 指標 | 神韻(Overall-17) 21×26 雙拼 | 無飛鍵道(U357) 21×21 雙拼 |",
		)
		.replaceAll("越低越好；三者均在 W6-Snow", "越低越好")
		.replaceAll("Lower is better; all three peak in W6-Snow", "Lower is better")
		.replaceAll(
			"三方案的重码桶均为二元桶。",
			"无飞键道(U357) 21×21 双拼与 S005 的重码桶均为二元桶；神韵(Overall-17) 21×26 双拼与 B04 没有 Common399 重码桶。",
		)
		.replaceAll(
			"三方案的重碼桶均為二元桶。",
			"無飛鍵道(U357) 21×21 雙拼與 S005 的重碼桶均為二元桶；神韻(Overall-17) 21×26 雙拼與 B04 沒有 Common399 重碼桶。",
		)
		.replaceAll(
			"All three layouts have only binary collision buckets.",
			"Wufei KeyTao(U357) 21×21 double pinyin and S005 have only binary collision buckets; Shenyun(Overall-17) 21×26 double pinyin and B04 have no Common399 collision bucket.",
		)
		.replaceAll(
			"B04 按 26×26 四码顶合同，U357、S005 按 21×21 合同",
			"神韵(Overall-17)按原生飞花式四码顶合同、B04 按本比较套用的同一合同计分，无飞键道(U357)与 S005 按传统 21×21 合同",
		)
		.replaceAll(
			"B04 按 26×26 四码顶合同计分，U357、S005 按 21×21 合同计分",
			"神韵(Overall-17)按原生飞花式四码顶合同、B04 按本比较套用的同一合同计分，无飞键道(U357)与 S005 按传统 21×21 合同计分",
		)
		.replaceAll(
			"B04 按 26×26 四碼頂合同，U357、S005 按 21×21 合同",
			"神韻(Overall-17)按原生飛花式四碼頂合同、B04 按本比較套用的同一合同計分，無飛鍵道(U357)與 S005 按傳統 21×21 合同",
		)
		.replaceAll(
			"B04 按 26×26 四碼頂合同計分，U357、S005 按 21×21 合同計分",
			"神韻(Overall-17)按原生飛花式四碼頂合同、B04 按本比較套用的同一合同計分，無飛鍵道(U357)與 S005 按傳統 21×21 合同計分",
		)
		.replaceAll(
			"B04 uses the 26×26 four-code-top contract, whereas U357 and S005 use 21×21",
			"Shenyun(Overall-17) uses its native Feihua four-code-top contract and B04 is scored under the same contract for this comparison, whereas Wufei KeyTao(U357) and S005 use the traditional 21×21 contract",
		)
		.replaceAll(
			"B04 uses a 26×26 four-code-top contract, while U357 and S005 use 21×21",
			"Shenyun(Overall-17) uses its native Feihua four-code-top contract and B04 is scored under the same contract for this comparison, while Wufei KeyTao(U357) and S005 use the traditional 21×21 contract",
		)
		.replaceAll(
			"B04 is nevertheless scored under the 26×26 four-code-top contract, while U357 and S005 use the 21×21 contract",
			"Shenyun(Overall-17) natively follows the Feihua four-code-top contract; B04 uses its documented `AEUIO` shape and `IEUAO` tone keys, while this comparison supplies the same Feihua four-code-top routing and shared shape/stroke sources; Wufei KeyTao(U357) and S005 are scored under the traditional 21×21 contract",
		)
		.replaceAll(
			"无飞键道(U357)与 S005 采用传统 21×21 合同，神韵(Overall-17)与 B04 采用四码顶合同。",
			"无飞键道(U357)与 S005 按传统 21×21 合同计分；神韵(Overall-17)原生遵循飞花式四码顶；B04 采用原资料记录的 `AEUIO` 形辅与 `IEUAO` 调辅，本比较为其套用同一飞花式四码顶路由和统一字形／笔画源。",
		)
		.replaceAll(
			"無飛鍵道(U357)與 S005 採傳統 21×21 合同，神韻(Overall-17)與 B04 採四碼頂合同。",
			"無飛鍵道(U357)與 S005 按傳統 21×21 合同計分；神韻(Overall-17)原生遵循飛花式四碼頂；B04 採用原資料記錄的 `AEUIO` 形輔與 `IEUAO` 調輔，本比較為其套用同一飛花式四碼頂路由和統一字形／筆畫源。",
		)
		.replaceAll(
			"Wufei KeyTao(U357) and S005 use the traditional 21×21 contract; Shenyun(Overall-17) and B04 use the four-code-top contract.",
			"Wufei KeyTao(U357) and S005 are scored under the traditional 21×21 contract. Shenyun(Overall-17) natively follows the Feihua four-code-top contract; B04 uses its documented `AEUIO` shape and `IEUAO` tone keys, while this comparison supplies the same Feihua four-code-top routing and shared shape/stroke sources.",
		)
		.replaceAll(
			"神韵(Overall-17)与 B04 按四码顶合同，无飞键道(U357)与 S005 按传统 21×21 合同",
			"神韵(Overall-17)按原生飞花式四码顶合同、B04 按本比较套用的同一合同计分，无飞键道(U357)与 S005 按传统 21×21 合同",
		)
		.replaceAll(
			"神韵(Overall-17)与 B04 按四码顶合同计分，无飞键道(U357)与 S005 按传统 21×21 合同计分",
			"神韵(Overall-17)按原生飞花式四码顶合同、B04 按本比较套用的同一合同计分，无飞键道(U357)与 S005 按传统 21×21 合同计分",
		)
		.replaceAll(
			"神韻(Overall-17)與 B04 按四碼頂合同，無飛鍵道(U357)與 S005 按傳統 21×21 合同",
			"神韻(Overall-17)按原生飛花式四碼頂合同、B04 按本比較套用的同一合同計分，無飛鍵道(U357)與 S005 按傳統 21×21 合同",
		)
		.replaceAll(
			"神韻(Overall-17)與 B04 按四碼頂合同計分，無飛鍵道(U357)與 S005 按傳統 21×21 合同計分",
			"神韻(Overall-17)按原生飛花式四碼頂合同、B04 按本比較套用的同一合同計分，無飛鍵道(U357)與 S005 按傳統 21×21 合同計分",
		)
		.replaceAll(
			"Shenyun(Overall-17) and B04 use four-code-top contracts, while Wufei KeyTao(U357) and S005 use the traditional 21×21 contract",
			"Shenyun(Overall-17) uses its native Feihua four-code-top contract and B04 is scored under the same contract for this comparison, while Wufei KeyTao(U357) and S005 use the traditional 21×21 contract",
		)
		.replaceAll(
			"Shenyun(Overall-17) and B04 are scored under four-code-top contracts, while Wufei KeyTao(U357) and S005 use the traditional 21×21 contract",
			"Shenyun(Overall-17) uses its native Feihua four-code-top contract and B04 is scored under the same contract for this comparison, while Wufei KeyTao(U357) and S005 use the traditional 21×21 contract",
		)
		.replaceAll(
			"reports/shenyun-comparison.md#ckt-v4-的权重与额外时间如何进入主分",
			"reports/shenyun-comparison.md#ckt-v4-成本分解",
		)
		.replace(
			/bun scripts\/生成神韵键盘图\.ts "([^"]+)"\r?\nbun scripts\/导出神韵热力图\.ts "[^"]+"/gu,
			'bun scripts/生成神韵键盘图.ts "$1"\nbun scripts/生成神韵键盘图.ts "$1" --21x26\nbun scripts/导出神韵热力图.ts "$1"\nbun scripts/导出神韵热力图.ts "$1" --21x26',
		)
		.replace(
			/(### 兩代神韻與 S005、B04 的四方案公平比較\r?\n\r?\n)四方案共用 Common399、冻结 20 合同、字词／形码数据、CKT v4 模型和日常八场景文稿；无飞键道\(U357\)与 S005 采用传统 21×21 合同，神韵\(Overall-17\)与 B04 采用四码顶合同。/gu,
			"$1四方案共用 Common399、凍結 20 合同、字詞／形碼資料、CKT v4 模型及日常八場景文稿；無飛鍵道(U357)與 S005 採傳統 21×21 合同，神韻(Overall-17)與 B04 採四碼頂合同。",
		);
	markdown = ensureAfter(
		markdown,
		"> [!NOTE]\n> 注意：只包含双拼部分，5 辅键未参与评估。",
		`**十一场景 5500 字最优路径全按键键频图**

![无飞键道(U357) 21×21 5500 字最优路径全按键键频图](docs/shenyun-u357-5500-keyboard-heat.svg)

新图直接复算十方案最优切分逐键回放，共 11 个 benchmark 场景、5500 汉字和 392 个标点；独立赛文与第 10 篇相同，按两个场景计两遍。冰雪健道共 9492 次实际按键，其中 Space 359、Shift 289、选重 0；短码、五辅键、空格、标点及其他所有非 0 按键均已纳入，计数为 0 的数字选重键不绘制。[原始键频数据](reports/神韵十一场景_5500字_最优路径全按键键频.json)可供复核。`,
		"![无飞键道(U357) 21×21 5500 字最优路径全按键键频图](docs/shenyun-u357-5500-keyboard-heat.svg)",
	);
	markdown = ensureAfter(
		markdown,
		"> [!NOTE]\n> Only the double-pinyin layer is included; the five auxiliary keys are excluded.",
		`**All-key frequency map for optimal paths over eleven benchmark scenarios and 5,500 Chinese characters**

![Wufei KeyTao(U357) 21×21 optimal-path all-key frequency map over 5,500 Chinese characters](docs/shenyun-u357-5500-keyboard-heat.svg)

The map is recomputed directly from the ten-scheme optimal-path replays over eleven benchmark scenarios, 5,500 Chinese characters, and 392 punctuation marks; the standalone article duplicates article 10 as a separate scenario. Snow KeyTao uses 9,492 actual keystrokes, including 359 Spaces, 289 Shifts, and zero candidate selections. Short codes, all five auxiliary keys, spaces, punctuation, and every other nonzero key are included; zero-count numeric candidate-selection keys are not drawn. The [raw frequency data](reports/神韵十一场景_5500字_最优路径全按键键频.json) is available for verification.`,
		"![Wufei KeyTao(U357) 21×21 optimal-path all-key frequency map over 5,500 Chinese characters](docs/shenyun-u357-5500-keyboard-heat.svg)",
	);
	markdown = ensureAfter(
		markdown,
		"> [!NOTE]\n> 注意：只包含雙拼部分，5 輔鍵未參與評估。",
		`**十一場景 5500 字最優路徑全按鍵鍵頻圖**

![無飛鍵道(U357) 21×21 5500 字最優路徑全按鍵鍵頻圖](docs/shenyun-u357-5500-keyboard-heat.svg)

新圖直接復算十方案最優切分逐鍵回放，共 11 個 benchmark 場景、5500 漢字和 392 個標點；獨立賽文與第 10 篇相同，按兩個場景計兩遍。冰雪健道共 9492 次實際按鍵，其中 Space 359、Shift 289、選重 0；短碼、五輔鍵、空格、標點及其他所有非 0 按鍵均已納入，計數為 0 的數字選重鍵不繪製。[原始鍵頻資料](reports/神韵十一场景_5500字_最优路径全按键键频.json)可供複核。`,
		"![無飛鍵道(U357) 21×21 5500 字最優路徑全按鍵鍵頻圖](docs/shenyun-u357-5500-keyboard-heat.svg)",
	);
	return normalizeContractClaims(markdown);
}

const readmeDirections = [
	"min", // M-R2
	"traditional-final-sum", // 全声母／字母声母／传统声母／韵母乱序度 A/I/D/V，仍按 D+V
	"triple-sum", // 飞键成分
	"max", // FA-1
	"max", // LU-v1r
	"max", // Common399 唯一码
	"min", // 重码盈余
	"min", // 重码桶
	"min", // S2 miss
	"min", // S2 平均码长
	"min", // S2 中心时间
	"min", // S2 异键同指率
	"min", // CKT v3
	"min", // CKT v4
	"min", // CKT v5
	"min", // CKT v5.1
	"min", // A7E-v3
	"min", // A7E-v4
	"min", // A7E-v5
	"min", // A7E-v6-CW150
	"min", // 选重率
	"min", // 第一辅键率
	"min", // 第二辅键率
	"closest-to-half", // 左手占比
	"min", // 同手率
	"min", // 平均有效距离
	"min", // QAZ 左小指组峰值
	"min", // P 区右小指组峰值
	"min", // 最大单指峰值
	"max", // S2 主键区占比
	"max", // TYB 双食指组峰值
	"min", // 20 合同主键区下限
	"max", // 日常移动手分数
] as const satisfies readonly ComparisonDirection[];

function decorateReadmeTables(markdown: string) {
	const lines = markdown.split("\n");
	for (let index = 0; index < lines.length; index++) {
		if (!/^\| (?:指标|Metric|指標) \|/u.test(lines[index])) continue;
		let end = index + 1;
		while (end < lines.length && lines[end].startsWith("|")) end++;
		const decorated = decorateMarkdownTable(
			lines.slice(index, end).join("\n"),
			readmeDirections,
		).split("\n");
		lines.splice(index, end - index, ...decorated);
		index += decorated.length - 1;
	}
	return lines.join("\n");
}

function addComparisonLegends(markdown: string) {
	const lines = markdown
		.split("\n")
		.filter(
			(line) =>
				!(line.startsWith("表中") && line.includes("★")) &&
				!line.startsWith("In the tables, **Bold** ★") &&
				!line.startsWith("The tables rank ") &&
				!["表中", "In the tables,"].includes(line.trim()),
		);
	for (let index = 0; index < lines.length; index++) {
		const match = lines[index].match(/^\| (指标|Metric|指標) \|/u);
		if (!match) continue;
		if (!lines[index].includes("Overall-17")) continue;
		const legend =
			match[1] === "Metric"
				? "The tables rank Shenyun(Overall-17), Wufei KeyTao(U357), and the original KeyTao S005 together: first place is bold with ★★, second place is bold with ★, and third place is unbolded and unstarred. Shoudao B04 is excluded from this three-layout ranking. 🥇 independently compares all four layouts and may appear in the same cell as stars. Ties use competition ranking, so the next place after a tie for first is third; tied cells use the same format."
				: match[1] === "指標"
					? "表中在神韻(Overall-17)、無飛鍵道(U357)與原鍵道 S005 三個方案間拉通排名：第 1 名數值加粗並標 ★★，第 2 名數值加粗並標 ★，第 3 名不加粗、不標星；首道 B04 不參與三方案名次。🥇 獨立比較全部四方案，可以與星標同時出現在同一單元格。並列採用競賽排名，例如並列第 1 名後的下一名為第 3 名；並列單元格使用相同格式。"
					: "表中在神韵(Overall-17)、无飞键道(U357)与原键道 S005 三个方案间拉通排名：第 1 名数值加粗并标 ★★，第 2 名数值加粗并标 ★，第 3 名不加粗、不标星；首道 B04 不参与三方案名次。🥇 独立比较全部四方案，可以与星标同时出现在同一单元格。并列采用竞赛排名，例如并列第 1 名后的下一名为第 3 名；并列单元格使用相同格式。";
		while (index > 0 && lines[index - 1] === "") {
			lines.splice(index - 1, 1);
			index--;
		}
		lines.splice(index, 0, "", legend, "");
		index += 3;
	}
	return lines.join("\n");
}

function ensureCktV51Documentation(markdown: string) {
	const definitionRows = [
		"[^zh-ckt51]: [CKT v5.1](research-notes/2026-11-02-ckt-v5.1-six-code.md)保留各布局原生主码路由并统一最长六码：传统 21×21 三字词补足第三辅，四码顶仍为 `AAAU+BB`；六项参数在 0%～500% 的 `11⁶` 网格中选最低平均名次辅序。",
		"[^en-ckt51]: [CKT v5.1](research-notes/2026-11-02-ckt-v5.1-six-code.md) preserves each layout family's native main-code route while making six the maximum length: traditional 21×21 three-character words gain a third auxiliary, whereas four-code-top remains `AAAU+BB`; source orders are selected by mean rank over the six-parameter `11⁶` grid from 0% to 500%.",
		"[^zht-ckt51]: [CKT v5.1](research-notes/2026-11-02-ckt-v5.1-six-code.md)保留各布局原生主碼路由並統一最長六碼：傳統 21×21 三字詞補足第三輔，四碼頂仍為 `AAAU+BB`；六項參數在 0%～500% 的 `11⁶` 網格中選最低平均名次輔序。",
	];
	if (!markdown.includes("[^zh-ckt51]:")) {
		markdown = markdown.replace(
			/^(\[\^zht-ckt5\]:.*)$/mu,
			`$1\n${definitionRows.join("\n")}`,
		);
	} else {
		markdown = markdown
			.split("\n")
			.map((line) => {
				const index = definitionRows.findIndex((row) =>
					line.startsWith(row.slice(0, row.indexOf(":") + 1)),
				);
				return index >= 0 ? definitionRows[index] : line;
			})
			.join("\n");
	}
	for (const [marker, prior, row] of [
		[
			"| 综合补全 [CKT v5.1]",
			/^(\| 综合补全 \[CKT v5\].*)$/mu,
			"| 综合补全 [CKT v5.1](research-notes/2026-11-02-ckt-v5.1-six-code.md)[^zh-ckt51] | 9.204752 | 9.717167 | 9.999357 | 9.202834 | 越低越好；原生路由最长六码 |",
		],
		[
			"| Completion [CKT v5.1]",
			/^(\| Completion \[CKT v5\].*)$/mu,
			"| Completion [CKT v5.1](research-notes/2026-11-02-ckt-v5.1-six-code.md)[^en-ckt51] | 9.204752 | 9.717167 | 9.999357 | 9.202834 | Lower; native routes with a six-code maximum |",
		],
		[
			"| 綜合補全 [CKT v5.1]",
			/^(\| 綜合補全 \[CKT v5\].*)$/mu,
			"| 綜合補全 [CKT v5.1](research-notes/2026-11-02-ckt-v5.1-six-code.md)[^zht-ckt51] | 9.204752 | 9.717167 | 9.999357 | 9.202834 | 越低越好；原生路由最長六碼 |",
		],
	] as const) {
		if (!markdown.includes(marker)) {
			markdown = markdown.replace(prior, `$1\n${row}`);
		} else {
			markdown = markdown
				.split("\n")
				.map((line) => (line.startsWith(marker) ? row : line))
				.join("\n");
		}
	}
	return markdown;
}

function ensureSfbDocumentation(markdown: string) {
	const definitionRows = [
		"[^zh-dv]: A/I/D/V 保留 benchmark 的 D/V 原义并追加两个诊断量：D 只统计 18 个传统单字母声母；I 在 D 外计入 W/Y；A 再计入 A/E/O；V 统计基础韵母 `a/e/i/o/u`。可用键集不再恰好等于同名原键即计乱序，所以保留原键同时增加飞键也计入（如 B04 的 E→E/U 使 A 增加 1）。M 已包含这些非直映映射与路由成本，故不修正；历史排名仍按 D+V，A/I 不参与排名。",
		"[^en-dv]: A/I/D/V preserves the benchmark's D/V contract and adds two diagnostics: D counts only the 18 traditional single-letter initials; I additionally counts W/Y; A additionally counts A/E/O; V covers the base finals `a/e/i/o/u`. A component is disordered whenever its key set is not exactly its same-letter home key, so an added flying route still counts (for example, B04 E→E/U adds 1 to A). M already includes these non-identity mapping and routing costs. Existing rankings remain based on D+V; A/I are diagnostic only.",
		"[^zht-dv]: A/I/D/V 保留 benchmark 的 D/V 原義並追加兩個診斷量：D 只統計 18 個傳統單字母聲母；I 在 D 外計入 W/Y；A 再計入 A/E/O；V 統計基礎韻母 `a/e/i/o/u`。可用鍵集不再恰好等於同名原鍵即計亂序，所以保留原鍵同時增加飛鍵也計入（如 B04 的 E→E/U 使 A 增加 1）。M 已包含這些非直映映射與路由成本，故不修正；歷史排名仍按 D+V，A/I 不參與排名。",
		"[^zh-sfb]: S2 异键同指率按相邻键对的频率权重统计：两键不同、但由同一物理手指负责的码内与边界键对权重，除以全部键对权重；同键重复不计入此项。",
		"[^en-sfb]: The S2 different-key same-finger rate is the frequency-weighted share of within-code and boundary key pairs that use different keys assigned to the same physical finger, divided by all key-pair mass; exact-key repeats are excluded.",
		"[^zht-sfb]: S2 異鍵同指率按相鄰鍵對的頻率權重統計：兩鍵不同、但由同一物理手指負責的碼內與邊界鍵對權重，除以全部鍵對權重；同鍵重複不計入此項。",
	];
	for (const definition of definitionRows) {
		const marker = definition.slice(0, definition.indexOf(":") + 1);
		if (!markdown.includes(marker)) {
			const language = marker.slice(2, marker.indexOf("-"));
			const anchor = new RegExp(`^(\\[\\^${language}-s2\\]:.*)$`, "mu");
			markdown = markdown.replace(anchor, `$1\n${definition}`);
		} else {
			markdown = markdown
				.split("\n")
				.map((line) => (line.startsWith(marker) ? definition : line))
				.join("\n");
		}
	}
	for (const [marker, prior, row] of [
		[
			"| 声母／韵母乱序度 D/V",
			/^(\| \[M-R2\].*\[\^zh-mr2\].*)$/mu,
			"| 声母／韵母乱序度 D/V[^zh-dv] | 1 / 1 | 0 / 5 | 0 / 4 | 0 / 0 | 越低越接近字母原键 |",
		],
		[
			"| Initial/final disorder D/V",
			/^(\| \[M-R2\].*\[\^en-mr2\].*)$/mu,
			"| Initial/final disorder D/V[^en-dv] | 1 / 1 | 0 / 5 | 0 / 4 | 0 / 0 | Lower; closer to alphabetic home keys |",
		],
		[
			"| 聲母／韻母亂序度 D/V",
			/^(\| \[M-R2\].*\[\^zht-mr2\].*)$/mu,
			"| 聲母／韻母亂序度 D/V[^zht-dv] | 1 / 1 | 0 / 5 | 0 / 4 | 0 / 0 | 越低越接近字母原鍵 |",
		],
		[
			"| S2 异键同指率",
			/^(\| S2 补全中心时间.*)$/mu,
			"| S2 异键同指率[^zh-sfb] | 9.252% | 4.255% | 11.638% | 11.343% | 越低越好 |",
		],
		[
			"| S2 different-key same-finger rate",
			/^(\| S2-completion center time.*)$/mu,
			"| S2 different-key same-finger rate[^en-sfb] | 9.252% | 4.255% | 11.638% | 11.343% | Lower |",
		],
		[
			"| S2 異鍵同指率",
			/^(\| S2 補全中心時間.*)$/mu,
			"| S2 異鍵同指率[^zht-sfb] | 9.252% | 4.255% | 11.638% | 11.343% | 越低越好 |",
		],
	] as const) {
		if (!markdown.includes(marker)) {
			markdown = markdown.replace(prior, `$1\n${row}`);
		} else {
			markdown = markdown
				.split("\n")
				.map((line) => (line.startsWith(marker) ? row : line))
				.join("\n");
		}
	}
	return markdown;
}

function finalizeReadme(markdown: string, host: "github" | "gitee") {
	const documented = markdown.includes("### D3/V1 21×26 双拼")
		? markdown
		: ensureSfbDocumentation(ensureCktV51Documentation(markdown));
	let output = markdown.includes("### D3/V1 21×26 双拼")
		? documented
		: addComparisonLegends(decorateReadmeTables(documented));
	const overallSource =
		host === "gitee"
			? "https://gitee.com/xie-chenzhu/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md"
			: "https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md";
	output = output.replace(
		/^### (神韵\(Overall-17\) 21×26 双拼|Shenyun\(Overall-17\) 21×26 double pinyin|神韻\(Overall-17\) 21×26 雙拼)$/gmu,
		`### [$1](${overallSource})`,
	);
	output = linkReadmeFiles(output, host);
	output = linkShenyunTerms(output, "zh", host);
	output = linkShenyunTerms(output, "en", host);
	output = linkShenyunTerms(output, "zht", host);
	return output;
}

type ReadmeBenchmarkLanguage = "zh" | "en" | "zht";

type ReadmeBenchmarkMetric = {
	D3V1: unknown;
	QZ: unknown;
	S005: unknown;
	B04: unknown;
};

type ReadmeBenchmarkFormat =
	| "integer"
	| "six"
	| "three"
	| "percent"
	| "disorder"
	| "flying"
	| "unique"
	| "affected"
	| "left-right";

const readmeBenchmarkRows: readonly [
	string,
	Record<ReadmeBenchmarkLanguage, string>,
	Record<ReadmeBenchmarkLanguage, string>,
	ReadmeBenchmarkFormat,
][] = [
	[
		"M-R2",
		{ zh: "M-R2 记忆项", en: "M-R2 memory items", zht: "M-R2 記憶項" },
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"integer",
	],
	[
		"initialDisorderAIDV",
		{
			zh: "全声母／字母声母／传统声母／韵母乱序度 A/I/D/V",
			en: "All/written/traditional-initial/final disorder A/I/D/V",
			zht: "全聲母／字母聲母／傳統聲母／韻母亂序度 A/I/D/V",
		},
		{
			zh: "A、I 为诊断；仍按 D+V 越低越好",
			en: "A/I diagnostic; ranking remains lower D+V",
			zht: "A、I 為診斷；仍按 D+V 越低越好",
		},
		"disorder",
	],
	[
		"flyingKeyComponents",
		{
			zh: "飞键成分（声母／零声母组／韵母）",
			en: "Flying-key components (initials/zero-initial groups/finals)",
			zht: "飛鍵成分（聲母／零聲母組／韻母）",
		},
		{ zh: "越少越好", en: "Lower", zht: "越少越好" },
		"flying",
	],
	[
		"logicAuditFA1",
		{ zh: "FA-1 逻辑审计", en: "FA-1 logic audit", zht: "FA-1 邏輯稽核" },
		{ zh: "越高越一致", en: "Higher", zht: "越高越一致" },
		"six",
	],
	[
		"logicUniformityLUv1r",
		{
			zh: "LU-v1r 逻辑均匀度",
			en: "LU-v1r logic uniformity",
			zht: "LU-v1r 邏輯均勻度",
		},
		{ zh: "越高越统一", en: "Higher", zht: "越高越統一" },
		"six",
	],
	[
		"common399UniqueCodes",
		{
			zh: "Common399 唯一码／唯一率",
			en: "Common399 unique codes/rate",
			zht: "Common399 唯一碼／唯一率",
		},
		{ zh: "越高越好", en: "Higher", zht: "越高越好" },
		"unique",
	],
	[
		"common399CollisionBuckets",
		{
			zh: "Common399 重码桶",
			en: "Common399 collision buckets",
			zht: "Common399 重碼桶",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"integer",
	],
	[
		"common399AffectedSyllables",
		{
			zh: "Common399 受影响音节／占比",
			en: "Common399 affected syllables/rate",
			zht: "Common399 受影響音節／占比",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"affected",
	],
	[
		"s2FrequencyWeightedMiss",
		{
			zh: "频率加权 S2 miss",
			en: "Frequency-weighted S2 miss",
			zht: "頻率加權 S2 miss",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"percent",
	],
	[
		"s2CompletionMeanKeys",
		{
			zh: "S2 补全平均码长",
			en: "S2 completion mean code length",
			zht: "S2 補全平均碼長",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"six",
	],
	[
		"s2CompletionCenterMs",
		{
			zh: "S2 补全中心时间（ms）",
			en: "S2 completion center time (ms)",
			zht: "S2 補全中心時間（ms）",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"three",
	],
	[
		"s2DifferentKeySameFingerRate",
		{
			zh: "S2 异键同指率",
			en: "S2 different-key same-finger rate",
			zht: "S2 異鍵同指率",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"percent",
	],
	[
		"cktV3",
		{ zh: "综合补全 CKT v3", en: "CKT v3 completion", zht: "綜合補全 CKT v3" },
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"six",
	],
	[
		"cktV4",
		{ zh: "综合补全 CKT v4", en: "CKT v4 completion", zht: "綜合補全 CKT v4" },
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"six",
	],
	[
		"cktV5",
		{ zh: "综合补全 CKT v5", en: "CKT v5 completion", zht: "綜合補全 CKT v5" },
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"six",
	],
	[
		"cktV51",
		{
			zh: "综合补全 CKT v5.1",
			en: "CKT v5.1 completion",
			zht: "綜合補全 CKT v5.1",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"six",
	],
	[
		"ensembleV3",
		{
			zh: "A7E-v3 系综当量",
			en: "A7E-v3 ensemble equivalent",
			zht: "A7E-v3 系綜當量",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"six",
	],
	[
		"ensembleV4",
		{
			zh: "A7E-v4 系综当量",
			en: "A7E-v4 ensemble equivalent",
			zht: "A7E-v4 系綜當量",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"six",
	],
	[
		"ensembleV5",
		{
			zh: "A7E-v5 系综当量",
			en: "A7E-v5 ensemble equivalent",
			zht: "A7E-v5 系綜當量",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"six",
	],
	[
		"ensembleV6CW150",
		{ zh: "A7E-v6-CW150", en: "A7E-v6-CW150", zht: "A7E-v6-CW150" },
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"six",
	],
	[
		"aggregateSelectionRate",
		{
			zh: "八轨综合选重率",
			en: "Eight-track aggregate selection rate",
			zht: "八軌綜合選重率",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"percent",
	],
	[
		"aggregateFirstAuxRate",
		{
			zh: "八轨第一辅键率",
			en: "Eight-track first-auxiliary rate",
			zht: "八軌第一輔鍵率",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"percent",
	],
	[
		"aggregateSecondAuxRate",
		{
			zh: "八轨第二辅键率",
			en: "Eight-track second-auxiliary rate",
			zht: "八軌第二輔鍵率",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"percent",
	],
	[
		"dailyLeftRightLoad",
		{
			zh: "日常左右手负载／左手占比",
			en: "Daily left/right load and left share",
			zht: "日常左右手負載／左手占比",
		},
		{ zh: "越接近 50% 越平衡", en: "Closer to 50%", zht: "越接近 50% 越平衡" },
		"left-right",
	],
	[
		"dailySameHandRate",
		{ zh: "日常同手率", en: "Daily same-hand rate", zht: "日常同手率" },
		{
			zh: "越低越好；非独立速度结论",
			en: "Lower; not a standalone speed claim",
			zht: "越低越好；非獨立速度結論",
		},
		"percent",
	],
	[
		"dailyMeanEffectiveDistance",
		{
			zh: "日常平均有效距离",
			en: "Daily mean effective distance",
			zht: "日常平均有效距離",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"six",
	],
	[
		"leftPinkyQAZPeak20Contracts",
		{
			zh: "20 合同 QAZ 左小指组峰值",
			en: "20-contract QAZ left-pinky peak",
			zht: "20 合同 QAZ 左小指組峰值",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"percent",
	],
	[
		"rightPinkyPeak20Contracts",
		{
			zh: "20 合同 P 区右小指组峰值",
			en: "20-contract P-area right-pinky peak",
			zht: "20 合同 P 區右小指組峰值",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"percent",
	],
	[
		"maxFingerPeak20Contracts",
		{
			zh: "20 合同最大单指峰值",
			en: "20-contract maximum single-finger peak",
			zht: "20 合同最大單指峰值",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"percent",
	],
	[
		"dailyEightScenarioMovingHand",
		{
			zh: "日常纯双拼移动手分数（含标点）",
			en: "Daily pure-double-pinyin moving-hand score (punctuation included)",
			zht: "日常純雙拼移動手分數（含標點）",
		},
		{ zh: "越高越好", en: "Higher", zht: "越高越好" },
		"three",
	],
	[
		"homeShareS2",
		{ zh: "S2 主键区占比", en: "S2 home-zone share", zht: "S2 主鍵區占比" },
		{ zh: "越高越好", en: "Higher", zht: "越高越好" },
		"percent",
	],
	[
		"indexFingerTYBPeak20Contracts",
		{
			zh: "20 合同 TYB 双食指组峰值",
			en: "20-contract TYB index-finger peak",
			zht: "20 合同 TYB 雙食指組峰值",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"percent",
	],
	[
		"homeFloor20Contracts",
		{
			zh: "20 合同主键区下限",
			en: "20-contract home-zone floor",
			zht: "20 合同主鍵區下限",
		},
		{ zh: "越高越好", en: "Higher", zht: "越高越好" },
		"percent",
	],
];

function benchmarkNumber(value: unknown) {
	if (typeof value !== "number") throw new Error("benchmark 指标不是数值");
	return value;
}

function readmeBenchmarkDirection(key: string): ComparisonDirection {
	if (key === "initialDisorderAIDV") return "traditional-final-sum";
	if (key === "flyingKeyComponents") return "triple-sum";
	if (key === "dailyLeftRightLoad") return "closest-to-half";
	if (
		[
			"logicAuditFA1",
			"logicUniformityLUv1r",
			"common399UniqueCodes",
			"dailyEightScenarioMovingHand",
			"homeShareS2",
			"homeFloor20Contracts",
		].includes(key)
	)
		return "max";
	return "min";
}

function formatReadmeBenchmarkValue(
	metrics: Record<string, ReadmeBenchmarkMetric>,
	key: string,
	scheme: keyof ReadmeBenchmarkMetric,
	format: ReadmeBenchmarkFormat,
) {
	const value = metrics[key]?.[scheme];
	if (format === "integer") return benchmarkNumber(value).toFixed(0);
	if (format === "six") return benchmarkNumber(value).toFixed(6);
	if (format === "three") return benchmarkNumber(value).toFixed(3);
	if (format === "percent")
		return `${(benchmarkNumber(value) * 100).toFixed(3)}%`;
	if (format === "disorder") {
		if (!Array.isArray(value) || value.length !== 4)
			throw new Error("A/I/D/V 指标格式错误");
		return value.map((item) => benchmarkNumber(item).toFixed(0)).join(" / ");
	}
	if (format === "flying") {
		if (!Array.isArray(value) || value.length !== 3)
			throw new Error("飞键成分指标格式错误");
		return value.map((item) => benchmarkNumber(item).toFixed(0)).join(" / ");
	}
	if (format === "unique") {
		const rate = metrics.common399UniqueRate?.[scheme];
		return `${benchmarkNumber(value).toFixed(0)} / ${(benchmarkNumber(rate) * 100).toFixed(3)}%`;
	}
	if (format === "affected") {
		const rate = metrics.common399AffectedRate?.[scheme];
		return `${benchmarkNumber(value).toFixed(0)} / ${(benchmarkNumber(rate) * 100).toFixed(3)}%`;
	}
	if (
		typeof value !== "object" ||
		value === null ||
		!("left" in value) ||
		!("right" in value) ||
		!("leftShare" in value)
	)
		throw new Error("左右手负载指标格式错误");
	return `${benchmarkNumber(value.left).toFixed(0)}:${benchmarkNumber(value.right).toFixed(0)} / ${(benchmarkNumber(value.leftShare) * 100).toFixed(3)}%`;
}

function currentReadmeBenchmarkTable(language: ReadmeBenchmarkLanguage) {
	const report = JSON.parse(
		readFileSync(join(root, "reports", "shenyun-comparison.json"), "utf8"),
	) as {
		nextGenerationComparison: {
			metrics: Record<string, ReadmeBenchmarkMetric>;
		};
	};
	const metrics = report.nextGenerationComparison.metrics;
	const headers = {
		zh: ["指标", "原键道 S005", "首道 B04", "何为好"],
		en: ["Metric", "KeyTao S005", "Shoudao B04", "Better"],
		zht: ["指標", "原鍵道 S005", "首道 B04", "何者為佳"],
	} as const;
	const [metricHeader, s005Header, b04Header, betterHeader] = headers[language];
	const lines = [
		`| ${metricHeader} | D3/V1 21×26 | QZ-e8f37a 21×21 | ${s005Header} | ${b04Header} | ${betterHeader} |`,
		"| --- | ---: | ---: | ---: | ---: | --- |",
	];
	for (const [key, labels, better, format] of readmeBenchmarkRows) {
		lines.push(
			`| ${labels[language]} | ${formatReadmeBenchmarkValue(metrics, key, "D3V1", format)} | ${formatReadmeBenchmarkValue(metrics, key, "QZ", format)} | ${formatReadmeBenchmarkValue(metrics, key, "S005", format)} | ${formatReadmeBenchmarkValue(metrics, key, "B04", format)} | ${better[language]} |`,
		);
	}
	return decorateMarkdownTable(
		lines.join("\n"),
		readmeBenchmarkRows.map(([key]) => readmeBenchmarkDirection(key)),
		3,
	);
}

const readmeBenchmarkLegends: Record<ReadmeBenchmarkLanguage, string> = {
	zh: "表中在 D3/V1、QZ-e8f37a 与原键道 S005 三个方案间拉通排名：第 1 名数值加粗并标 ★★，第 2 名数值加粗并标 ★，第 3 名不加粗、不标星；首道 B04 不参与三方案名次。🥇 独立比较全部四方案，可以与星标同时出现在同一单元格。并列采用竞赛排名，例如并列第 1 名后的下一名为第 3 名；并列单元格使用相同格式。",
	en: "The table ranks D3/V1, QZ-e8f37a, and the original KeyTao S005 together: first place is bold with ★★, second place is bold with ★, and third place is unbolded and unstarred. Shoudao B04 is excluded from this three-layout ranking. 🥇 independently compares all four layouts and may appear in the same cell as stars. Ties use competition ranking, so the next place after a tie for first is third; tied cells use the same format.",
	zht: "表中在 D3/V1、QZ-e8f37a 與原鍵道 S005 三個方案間拉通排名：第 1 名數值加粗並標 ★★，第 2 名數值加粗並標 ★，第 3 名不加粗、不標星；首道 B04 不參與三方案名次。🥇 獨立比較全部四方案，可以與星標同時出現在同一單元格。並列採用競賽排名，例如並列第 1 名後的下一名為第 3 名；並列單元格使用相同格式。",
};

function replaceCurrentLayoutDocumentation(
	markdown: string,
	host: "github" | "gitee",
) {
	const benchmarkRoot =
		host === "gitee"
			? "https://gitee.com/xie-chenzhu/shuangpin-layout-benchmark/blob/main"
			: "https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main";
	const d3Source = `${benchmarkRoot}/research/notes/2026-11-09-d3v1-ckt-v51-soft-balance-aux-order-robustness.md`;
	const qzSource = `${benchmarkRoot}/research/notes/2026-11-09-e8f37a-ckt-v51-aux-order-robustness.md`;
	const zhBenchmark = currentReadmeBenchmarkTable("zh");
	const enBenchmark = currentReadmeBenchmarkTable("en");
	const zhtBenchmark = currentReadmeBenchmarkTable("zht");
	const zhBenchmarkLegend = readmeBenchmarkLegends.zh;
	const enBenchmarkLegend = readmeBenchmarkLegends.en;
	const zhtBenchmarkLegend = readmeBenchmarkLegends.zht;
	const zh = `### D3/V1 21×26 双拼

冰雪简道（\`snow_shenyun_shape\`）与冰雪散拼（\`snow_shenyun_tone\`）现共用 [D3/V1 21×26 布局](${d3Source})，仓库标识为 \`SNOW-SHENYUN-21X26-D3V1-BALANCED\`。布局在 Common399 上无音节重码，M-R2 \`40\`，全声母／字母声母／传统声母／韵母乱序度 A/I/D/V \`8/5/3/1\`；按 21×26 原生四码封顶、跨词长联合候选池与 \`soft-page-fill-v2\` 计分，方案专属稳健结果为 CKT v5.1 \`9.10299979136027\`。

五辅语义保持“折横撇竖点→\`AEUIO\`、一二三四轻→\`IEUAO\`”，按形义序观察声调仍为 \`42310\`。冰雪简道的二／三／四字词形辅序为 \`12/12/24\`，冰雪散拼的调辅序为 \`12/21/13\`；记号表示从各字位依次取辅码，运行规则以方案文件为准。

![D3/V1 21×26 双拼声韵键盘图](docs/shenyun-d3v1-keyboard.svg)

![D3/V1 21×26 双拼 5500 字最优路径全按键键频图](docs/shenyun-d3v1-5500-keyboard-heat.svg)

5500 字十一场景的实际最优路径共 9,895 键，其中空格 382、Shift 3；原始统计见 [JSON](reports/神韵十一场景_5500字_最优路径全按键键频.json)。

### QZ-e8f37a 21×21 双拼

冰雪健道（\`snow_jiandao\`）与冰雪弎拼（\`snow_sanpin\`）现共用 [QZ-e8f37a 21×21 布局](${qzSource})，仓库标识为 \`QZ-e8f37a0998f9\`。布局指标为 M-R2 \`42\`、全声母／字母声母／传统声母／韵母乱序度 A/I/D/V \`5/2/2/5\`；按传统 21×21 原生路由与方案专属稳健辅序计分，CKT v5.1 \`9.56789806405906\`。

五辅语义保持“折横撇竖点→\`AVUIO\`、一二三四轻→\`IVUAO\`”，按形义序观察声调同为 \`42310\`。冰雪健道的二／三／四字词形辅序为 \`12/213/24\`，冰雪弎拼的调辅序为 \`12/213/23\`；三字词保留完整三辅键路由，二字词与四字词共享四码主码候选竞争池。

![QZ-e8f37a 21×21 双拼声韵键盘图](docs/shenyun-qz-e8f37a-keyboard.svg)

![QZ-e8f37a 21×21 双拼 5500 字最优路径全按键键频图](docs/shenyun-qz-e8f37a-5500-keyboard-heat.svg)

5500 字十一场景的实际最优路径共 9,444 键，其中空格 376、Shift 307；原始统计见 [JSON](reports/神韵十一场景_5500字_最优路径全按键键频.json)。

### 现行双拼与原键道 S005、首道 B04 benchmark

下表用当前 D3/V1 与 QZ-e8f37a 直接替代 README 历史表中的 Overall-17 与 U357，并继续以同一冻结 payload 和原键道 S005、首道 B04 作参照；初代布局只保留在后面的全量追加报告中。

${zhBenchmarkLegend}

${zhBenchmark}

#### 初代兼容方案与完整报告

冰雪简道·初代、冰雪散拼·初代冻结 Overall-17·初代；冰雪健道·初代、冰雪弎拼·初代冻结 U357·初代。四份初代方案保留独立 schema、声韵映射、固顶数据库和输入统计，不跟随现行方案升级；标准学习词频与系统词典仍按冰雪系约定共享。新旧布局的可复算比较见 [五布局／六布局追加报告](reports/shenyun-comparison.md)。

- [500 字冰雪十二方案实战测评](reports/冰雪十二方案_500字_最短键码实战测评.txt)
- [5000 字冰雪十二方案全量报告](reports/十篇五百字_十二方案最优切分及字词比率报告.md)
- [5000 字十三方案报告（加入声笔小鹤）](reports/十篇五百字_十三方案最优切分及字词比率报告.md)
- [5000 字十四方案报告（再加入小鹤音形）](reports/十篇五百字_十四方案最优切分及字词比率报告.md)

`;
	const en = `### D3/V1 21×26 double pinyin

冰雪简道 (\`snow_shenyun_shape\`) and 冰雪散拼 (\`snow_shenyun_tone\`) now share the [D3/V1 21×26 layout](${d3Source}), identified in this repository as \`SNOW-SHENYUN-21X26-D3V1-BALANCED\`. It has no Common399 syllable collisions, M-R2 \`40\`, and all/written/traditional-initial/final disorder A/I/D/V \`8/5/3/1\`. Under the native 21×26 four-code-top contract, cross-length candidate pool, and \`soft-page-fill-v2\`, its scheme-specific robust score is CKT v5.1 \`9.10299979136027\`.

The five auxiliary semantics remain bend/horizontal/left-falling/vertical/dot→\`AEUIO\` and tones 1/2/3/4/neutral→\`IEUAO\`, yielding \`42310\` in shape-meaning order. 冰雪简道 uses shape order \`12/12/24\` and 冰雪散拼 uses tone order \`12/21/13\` for two-/three-/four-character words.

![D3/V1 21×26 initial/final keyboard map](docs/shenyun-d3v1-keyboard.svg)

![D3/V1 21×26 optimal-path all-key frequency map over 5,500 Chinese characters](docs/shenyun-d3v1-5500-keyboard-heat.svg)

The eleven-scenario 5,500-character replay uses 9,895 keys, including 382 spaces and 3 Shift presses; see the [raw JSON](reports/神韵十一场景_5500字_最优路径全按键键频.json).

### QZ-e8f37a 21×21 double pinyin

冰雪健道 (\`snow_jiandao\`) and 冰雪弎拼 (\`snow_sanpin\`) now share the [QZ-e8f37a 21×21 layout](${qzSource}), identified as \`QZ-e8f37a0998f9\`. Its layout metrics are M-R2 \`42\` and all/written/traditional-initial/final disorder A/I/D/V \`5/2/2/5\`; its traditional native 21×21 routing with scheme-specific robust auxiliary orders scores CKT v5.1 \`9.56789806405906\`.

The five auxiliary semantics remain bend/horizontal/left-falling/vertical/dot→\`AVUIO\` and tones 1/2/3/4/neutral→\`IVUAO\`, again yielding \`42310\`. 冰雪健道 uses shape order \`12/213/24\`, while 冰雪弎拼 uses tone order \`12/213/23\`; three-character words retain the complete three-auxiliary route.

![QZ-e8f37a 21×21 initial/final keyboard map](docs/shenyun-qz-e8f37a-keyboard.svg)

![QZ-e8f37a 21×21 optimal-path all-key frequency map over 5,500 Chinese characters](docs/shenyun-qz-e8f37a-5500-keyboard-heat.svg)

The eleven-scenario 5,500-character replay uses 9,444 keys, including 376 spaces and 307 Shift presses; see the [raw JSON](reports/神韵十一场景_5500字_最优路径全按键键频.json).

### Current double-pinyin layouts versus KeyTao S005 and Shoudao B04

This table directly replaces Overall-17 and U357 in the historical README comparison with the current D3/V1 and QZ-e8f37a results, using the same frozen payload and the original KeyTao S005 and Shoudao B04 references. The first-generation layouts remain in the appended full report only.

${enBenchmarkLegend}

${enBenchmark}

#### First-generation compatibility schemes and complete reports

冰雪简道·初代 and 冰雪散拼·初代 freeze Overall-17·初代; 冰雪健道·初代 and 冰雪弎拼·初代 freeze U357·初代. Each keeps an independent schema, mapping, fixed-candidate database, and statistics database, while the standard learned frequencies and system dictionaries remain shared across Snow schemes. Reproducible old/new layout comparisons are in the [appended five-/six-layout report](reports/shenyun-comparison.md).

- [500-character Snow twelve-scheme benchmark](reports/冰雪十二方案_500字_最短键码实战测评.txt)
- [5,000-character Snow twelve-scheme report](reports/十篇五百字_十二方案最优切分及字词比率报告.md)
- [5,000-character thirteen-scheme report with 声笔小鹤](reports/十篇五百字_十三方案最优切分及字词比率报告.md)
- [5,000-character fourteen-scheme report with 小鹤音形](reports/十篇五百字_十四方案最优切分及字词比率报告.md)

`;
	const zht = `### D3/V1 21×26 雙拼

冰雪簡道（\`snow_shenyun_shape\`）與冰雪散拼（\`snow_shenyun_tone\`）現共用 [D3/V1 21×26 布局](${d3Source})，倉庫標識為 \`SNOW-SHENYUN-21X26-D3V1-BALANCED\`。布局在 Common399 上無音節重碼，M-R2 \`40\`，全聲母／字母聲母／傳統聲母／韻母亂序度 A/I/D/V \`8/5/3/1\`；按 21×26 原生四碼封頂、跨詞長聯合候選池與 \`soft-page-fill-v2\` 計分，方案專屬穩健結果為 CKT v5.1 \`9.10299979136027\`。

五輔語義保持「折橫撇豎點→\`AEUIO\`、一二三四輕→\`IEUAO\`」，按形義序觀察聲調仍為 \`42310\`。冰雪簡道的二／三／四字詞形輔序為 \`12/12/24\`，冰雪散拼的調輔序為 \`12/21/13\`。

![D3/V1 21×26 雙拼聲韻鍵盤圖](docs/shenyun-d3v1-keyboard.svg)

![D3/V1 21×26 雙拼 5500 字最佳路徑全按鍵鍵頻圖](docs/shenyun-d3v1-5500-keyboard-heat.svg)

5500 字十一場景的實際最佳路徑共 9,895 鍵，其中空格 382、Shift 3；原始統計見 [JSON](reports/神韵十一场景_5500字_最优路径全按键键频.json)。

### QZ-e8f37a 21×21 雙拼

冰雪健道（\`snow_jiandao\`）與冰雪弎拼（\`snow_sanpin\`）現共用 [QZ-e8f37a 21×21 布局](${qzSource})，倉庫標識為 \`QZ-e8f37a0998f9\`。布局指標為 M-R2 \`42\`、全聲母／字母聲母／傳統聲母／韻母亂序度 A/I/D/V \`5/2/2/5\`；按傳統 21×21 原生路由與方案專屬穩健輔序計分，CKT v5.1 \`9.56789806405906\`。

五輔語義保持「折橫撇豎點→\`AVUIO\`、一二三四輕→\`IVUAO\`」，按形義序觀察聲調同為 \`42310\`。冰雪健道的二／三／四字詞形輔序為 \`12/213/24\`，冰雪弎拼的調輔序為 \`12/213/23\`；三字詞保留完整三輔鍵路由。

![QZ-e8f37a 21×21 雙拼聲韻鍵盤圖](docs/shenyun-qz-e8f37a-keyboard.svg)

![QZ-e8f37a 21×21 雙拼 5500 字最佳路徑全按鍵鍵頻圖](docs/shenyun-qz-e8f37a-5500-keyboard-heat.svg)

5500 字十一場景的實際最佳路徑共 9,444 鍵，其中空格 376、Shift 307；原始統計見 [JSON](reports/神韵十一场景_5500字_最优路径全按键键频.json)。

### 現行雙拼與原鍵道 S005、首道 B04 benchmark

下表以目前 D3/V1 與 QZ-e8f37a 直接替代 README 歷史表中的 Overall-17 與 U357，並繼續使用同一凍結 payload 和原鍵道 S005、首道 B04 作參照；初代布局只保留在後面的全量追加報告中。

${zhtBenchmarkLegend}

${zhtBenchmark}

#### 初代相容方案與完整報告

冰雪簡道·初代、冰雪散拼·初代凍結 Overall-17·初代；冰雪健道·初代、冰雪弎拼·初代凍結 U357·初代。四份初代方案保留獨立 schema、聲韻映射、固頂資料庫和輸入統計，不跟隨現行方案升級；標準學習詞頻與系統詞典仍按冰雪系約定共享。新舊布局的可復算比較見[五布局／六布局追加報告](reports/shenyun-comparison.md)。

- [500 字冰雪十二方案實戰測評](reports/冰雪十二方案_500字_最短键码实战测评.txt)
- [5000 字冰雪十二方案全量報告](reports/十篇五百字_十二方案最优切分及字词比率报告.md)
- [5000 字十三方案報告（加入聲筆小鶴）](reports/十篇五百字_十三方案最优切分及字词比率报告.md)
- [5000 字十四方案報告（再加入小鶴音形）](reports/十篇五百字_十四方案最优切分及字词比率报告.md)

`;
	return markdown
		.replace(
			/^### (?:(?:\[)?神韵\(Overall-17\)|D3\/V1 21×26 双拼)[^\n]*\n[\s\S]*?(?=^### 快捷键$)/mu,
			zh,
		)
		.replace(
			/^### (?:(?:\[)?Shenyun\(Overall-17\)|D3\/V1 21×26 double pinyin)[^\n]*\n[\s\S]*?(?=^### Reports and audits$)/mu,
			en,
		)
		.replace(
			/^### (?:(?:\[)?神韻\(Overall-17\)|D3\/V1 21×26 雙拼)[^\n]*\n[\s\S]*?(?=^### 研究報告與稽核資料$)/mu,
			zht,
		);
}

function deduplicateOverallSections(markdown: string) {
	const lines = markdown.split("\n");
	const seen = new Set<string>();
	for (let index = 0; index < lines.length; index++) {
		if (
			!lines[index].startsWith("### ") ||
			!lines[index].includes("Overall-17")
		)
			continue;
		const language = lines[index].includes("Shenyun")
			? "en"
			: lines[index].includes("神韻")
				? "zht"
				: "zh";
		if (!seen.has(language)) {
			seen.add(language);
			continue;
		}
		let end = index + 1;
		while (end < lines.length && !/^##(?:#)? /u.test(lines[end])) end++;
		lines.splice(index, end - index);
		index--;
	}
	return lines.join("\n");
}

function update(markdown: string, host: "github" | "gitee") {
	if (process.argv.includes("--tables-only"))
		return finalizeReadme(normalizeTerms(addOverallColumn(markdown)), host);
	if (process.argv.includes("--normalize-only"))
		return finalizeReadme(normalizeTerms(markdown), host);
	if (markdown.includes("### D3/V1 21×26 双拼"))
		return finalizeReadme(
			replaceCurrentLayoutDocumentation(markdown, host),
			host,
		);
	markdown = ensureMobileSkinsParagraph(
		removeStandaloneEnglishNumbers(markdown),
	);
	markdown = markdown
		.replace(
			/### \[神韵\(Overall-17\)[^\n]*\n[\s\S]*?(?=### \[无飞键道\(U357\))/u,
			zhOverall,
		)
		.replace(
			/### \[Shenyun\(Overall-17\)[^\n]*\n[\s\S]*?(?=### \[Wufei KeyTao\(U357\))/u,
			enOverall,
		)
		.replace(
			/### \[神韻\(Overall-17\)[^\n]*\n[\s\S]*?(?=### \[無飛鍵道\(U357\))/u,
			zhtOverall,
		)
		.replace(
			/(## 简体中文[\s\S]*?)(### (?:无\[飞键\]|\[无飞键道\(U357\)[^\n]*))/u,
			(_match, prefix: string, heading: string) =>
				`${prefix}${zhOverall}${heading}`,
		)
		.replace(
			/(## English[\s\S]*?)(### (?:Wufei KeyTao|\[Wufei KeyTao\(U357\)[^\n]*))/u,
			(_match, prefix: string, heading: string) =>
				`${prefix}${enOverall}${heading}`,
		)
		.replace(
			/(## 繁體中文[\s\S]*?)(### (?:無\[飛鍵\]|\[無飛鍵道\(U357\)[^\n]*))/u,
			(_match, prefix: string, heading: string) =>
				`${prefix}${zhtOverall}${heading}`,
		)
		.replace(/### 无\[飞键\][^\n]*/gu, "### 无飞键道(U357) 21×21 双拼")
		.replace(
			/### Wufei KeyTao·Shenyun U357[^\n]*/gu,
			"### Wufei KeyTao(U357) 21×21 double pinyin",
		)
		.replace(/### 無\[飛鍵\][^\n]*/gu, "### 無飛鍵道(U357) 21×21 雙拼")
		.replace(
			/#### 神韵 U357 与[^\n]*/gu,
			"### 两代神韵与 S005、B04 的四方案公平比较",
		)
		.replace(
			/#### Fair comparison with[^\n]*/gu,
			"### Four-scheme comparison of both Shenyun layouts, S005, and B04",
		)
		.replace(
			/#### 神韻 U357 與[^\n]*/gu,
			"### 兩代神韻與 S005、B04 的四方案公平比較",
		)
		.replace(
			/三方案共用 Common399[^\n]*/gu,
			"四方案共用 Common399、冻结 20 合同、字词／形码数据、CKT v4 模型和日常八场景文稿；无飞键道(U357)与 S005 按传统 21×21 合同计分；神韵(Overall-17)原生遵循飞花式四码顶；B04 采用原资料记录的 `AEUIO` 形辅与 `IEUAO` 调辅，本比较为其套用同一飞花式四码顶路由和统一字形／笔画源。",
		)
		.replace(
			/All three layouts use Common399[^\n]*/gu,
			"All four layouts use Common399, the frozen 20 contracts, the same word/shape data, CKT v4, and the daily corpus. Wufei KeyTao(U357) and S005 are scored under the traditional 21×21 contract. Shenyun(Overall-17) natively follows the Feihua four-code-top contract; B04 uses its documented `AEUIO` shape and `IEUAO` tone keys, while this comparison supplies the same Feihua four-code-top routing and shared shape/stroke sources.",
		)
		.replace(
			/三方案共用 Common399、凍結 20 合同[^\n]*/gu,
			"四方案共用 Common399、凍結 20 合同、字詞／形碼資料、CKT v4 模型及日常八場景文稿；無飛鍵道(U357)與 S005 按傳統 21×21 合同計分；神韻(Overall-17)原生遵循飛花式四碼頂；B04 採用原資料記錄的 `AEUIO` 形輔與 `IEUAO` 調輔，本比較為其套用同一飛花式四碼頂路由和統一字形／筆畫源。",
		)
		.replaceAll(
			"reports/shenyun-u357-comparison.md",
			"reports/shenyun-comparison.md",
		)
		.replaceAll(
			"reports/shenyun-u357-comparison.json",
			"reports/shenyun-comparison.json",
		)
		.replaceAll("神韵 U357 公平对比", "神韵四方案公平对比")
		.replaceAll(
			"Complete Shenyun U357 comparison",
			"Complete four-scheme Shenyun comparison",
		)
		.replaceAll(
			"Raw Shenyun U357 comparison JSON",
			"Raw four-scheme Shenyun comparison JSON",
		)
		.replaceAll("神韻 U357 公平比較", "神韻四方案公平比較")
		.replace(
			/bun scripts\/生成神韵键盘图\.ts "([^"]+)"\nbun scripts\/导出神韵热力图\.ts "\1"/gu,
			'bun scripts/生成神韵键盘图.ts "$1"\nbun scripts/生成神韵键盘图.ts "$1" --21x26\nbun scripts/导出神韵热力图.ts "$1"\nbun scripts/导出神韵热力图.ts "$1" --21x26',
		);
	if (markdown.includes("无飞键道(U357) 21×21 双拼"))
		markdown = ensureSubsection(
			markdown,
			"无飞键道(U357) 21×21 双拼",
			zhU357EnglishNumbers,
		);
	if (markdown.includes("Wufei KeyTao(U357) 21×21 double pinyin"))
		markdown = ensureSubsection(
			markdown,
			"Wufei KeyTao(U357) 21×21 double pinyin",
			enU357EnglishNumbers,
		);
	if (markdown.includes("無飛鍵道(U357) 21×21 雙拼"))
		markdown = ensureSubsection(
			markdown,
			"無飛鍵道(U357) 21×21 雙拼",
			zhtU357EnglishNumbers,
		);
	return finalizeReadme(
		replaceCurrentLayoutDocumentation(
			normalizeTerms(addOverallColumn(deduplicateOverallSections(markdown))),
			host,
		),
		host,
	);
}

for (const file of files) {
	const source = readFileSync(file, "utf8");
	const host = file.endsWith("README_CN.md") ? "gitee" : "github";
	const output = update(source, host);
	const normalized = output.replaceAll("\r\n", "\n");
	if (process.argv.includes("--check")) {
		if (normalized !== source) throw new Error(`${file} 需要重新生成。`);
		console.log(`README 校验通过：${file}`);
	} else if (normalized !== source) {
		writeFileSync(file, normalized, "utf8");
		console.log(`已更新：${file}`);
	} else {
		console.log(`无需更新：${file}`);
	}
}
