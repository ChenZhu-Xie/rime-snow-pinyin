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

冰雪神韵·形（\`snow_shenyun_shape\`）与冰雪神韵·调（\`snow_shenyun_tone\`）共用 **神韵(Overall-17) 21×26 双拼**。该方案出自双拼布局 Benchmark 的 \`production/ckt-v4-2126-strict-d0-20261030\` 分支，定稿于提交 \`7a7e154\`；\`2026-10-30-strict-d0-production-closure-report.md\` 记录了搜索约束、得来过程和冠军声韵映射。本仓库将其固化为 \`SNOW-SHENYUN-21X26-PRODUCTION\`，本节映射与键盘图均以该定稿方案为准。

> [!NOTE]
> 由于作者也是[冰雪四拼](https://input.tansongchen.com/snow4/)用户，因此[冰雪神韵·调](snow_shenyun_tone.schema.yaml)的五调辅键，直接按[冰雪四拼](https://input.tansongchen.com/snow4/)的顺序排列。

**声韵辅-键 映射**

![神韵(Overall-17) 21×26 双拼声韵键盘图](docs/shenyun-overall17-keyboard.svg)

**日常八场景文稿纯双拼键频图（含标点）**

![神韵(Overall-17) 21×26 双拼键频图](docs/shenyun-overall17-keyboard-heat.svg)

两图由 benchmark 页面中的定稿方案导出：声韵图调用页面内置 \`keyboardSVG\` 后裁出 26 个字母键；键频图调用页面内置 \`r9MacroHeat\`，使用同一篇 2149 击键日常八场景文稿。键频图不含五辅键、空格和选重。

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
- 冰雪神韵·形辅键为 \`A/E/U/I/O\`，冰雪神韵·调声调键为 \`I/E/U/A/O → 一/二/三/四/轻\`。
- 冰雪神韵·形二／三／四字词的前两辅字位顺序为 \`12/21/42\`，冰雪神韵·调为 \`12/21/13\`。
- 小写输入遵循飞花式四码顶：单字为 \`A_ / AU_ / AUB / AUBB\`，二字词为 \`A₁U₁A₂U₂[B₁B₂]\`，三字词为 \`A₁A₂A₃U₃[B₂B₁]\`；四字词的冰雪神韵·形为 \`A₁A₂A₃A₄[B₄B₂]\`，冰雪神韵·调为 \`A₁A₂A₃A₄[B₁B₃]\`。完整码之后输入下一字声码才顶屏，未完成主码直接续写；若 \`A₃B₂\` 运行时为空桶，三字词还可用 \`A₁A₂A₃B₂[B₁]\`。
- 完成编码后按 \`;\` 或 \`/\` 会先顶出当前候选，再分别追加“的”或“了”，与 21×21 方案的强制上屏尾字键一致。
- 两组 21×26 方案的空桶均在运行时查询系统词典：完整单字词频大于 1 才占桶，个人词频不参与。当前词典实际得到 143 个空 \`AU\`，其中 134 个为空 \`AA\`、9 个为空 \`AB\`；单键只固顶一个一简字，其余候选自然排序。

`;

const enOverall = `### Shenyun(Overall-17) 21×26 double pinyin

Snow Shenyun Shape (\`snow_shenyun_shape\`) and Snow Shenyun Tone (\`snow_shenyun_tone\`) share **Shenyun(Overall-17) 21×26 double pinyin**. The layout comes from the Shuangpin Layout Benchmark branch \`production/ckt-v4-2126-strict-d0-20261030\` and was finalized in commit \`7a7e154\`; \`2026-10-30-strict-d0-production-closure-report.md\` records the search constraints, derivation, and winning mapping. This repository freezes it as \`SNOW-SHENYUN-21X26-PRODUCTION\`, and this section's mapping and keyboard figures use that finalized layout.

> [!NOTE]
> Because the author also uses [Snow Four-Code](https://input.tansongchen.com/snow4/), [Snow Shenyun Tone](snow_shenyun_tone.schema.yaml)'s five tone auxiliary keys are arranged directly in the order of [Snow Four-Code](https://input.tansongchen.com/snow4/).

**Initial/final/auxiliary-key mapping**

![Shenyun(Overall-17) 21×26 initial/final keyboard map](docs/shenyun-overall17-keyboard.svg)

**Pure-double-pinyin key-frequency map over the daily eight-scenario corpus (punctuation included)**

![Shenyun(Overall-17) 21×26 key-frequency map](docs/shenyun-overall17-keyboard-heat.svg)

Both SVGs are exported from the finalized entry in the benchmark page: the first uses its built-in \`keyboardSVG\`, while the second uses \`r9MacroHeat\` over the same 2,149-keystroke daily corpus. The heat map excludes auxiliaries, spaces, and candidate selection.

#### Coding rules

Ordinary initials use their own letter except \`f→J\` and \`zh/ch/sh→F/V/W\`; zero-onset carriers are \`AOE→X\`, \`W→Q\`, and \`Y/YU→Y\`. The final keys are \`a:A, ai:H, an:O, ang:Y, ao:S, e:E, ei:W, en:J, eng:N, er/u:U, i:I, ia/ong:K, ian/uang:P, iang/ui:L, iao:D, ie:Z, in:C, ing/uai:R, iong/uan:Q, iu/ua:X, o/uo:M, ou:F, un/van:T, v:V, ve:G, vn:B\`.

Common399 has 399 distinct two-key codes, leaving 147 vacancies in the 21×26 domain; M-R2 is 36. Shape auxiliaries are \`A/E/U/I/O\`, and tone auxiliaries are \`I/E/U/A/O → 1/2/3/4/neutral\`. The first-two auxiliary-source orders for two-/three-/four-character words are \`12/21/42\` in Snow Shenyun Shape and \`12/21/13\` in Snow Shenyun Tone. Lowercase input follows the Feihua four-code-top contract: characters use \`A_ / AU_ / AUB / AUBB\`; two-character words use \`A₁U₁A₂U₂[B₁B₂]\`; three-character words use \`A₁A₂A₃U₃[B₂B₁]\`; four-character words use \`A₁A₂A₃A₄[B₄B₂]\` in Snow Shenyun Shape and \`A₁A₂A₃A₄[B₁B₃]\` in Snow Shenyun Tone. When \`A₃B₂\` is vacant at runtime, a three-character word may also use \`A₁A₂A₃B₂[B₁]\`. After a completed code, \`;\` or \`/\` first commits the current candidate and then appends “的” or “了”, matching the forced tail-character keys in the 21×21 schemes. System-dictionary single-character entries with frequency above 1 occupy a bucket; user frequency does not, so the current dictionary yields 143 runtime \`AU\` vacancies: 134 vacant \`AA\` codes and 9 vacant \`AB\` codes. Only one one-key character is pinned per initial.

`;

const zhtOverall = `### 神韻(Overall-17) 21×26 雙拼

冰雪神韻·形（\`snow_shenyun_shape\`）與冰雪神韻·調（\`snow_shenyun_tone\`）共用 **神韻(Overall-17) 21×26 雙拼**。該方案出自雙拼布局 Benchmark 的 \`production/ckt-v4-2126-strict-d0-20261030\` 分支，定稿於提交 \`7a7e154\`；\`2026-10-30-strict-d0-production-closure-report.md\` 記錄了搜尋約束、得來過程及冠軍聲韻映射。本倉庫將其固化為 \`SNOW-SHENYUN-21X26-PRODUCTION\`，本節映射與鍵盤圖均以該定稿方案為準。

> [!NOTE]
> 由於作者也是[冰雪四拼](https://input.tansongchen.com/snow4/)使用者，因此[冰雪神韻·調](snow_shenyun_tone.schema.yaml)的五調輔鍵，直接按[冰雪四拼](https://input.tansongchen.com/snow4/)的順序排列。

**聲韻輔-鍵 映射**

![神韻(Overall-17) 21×26 雙拼聲韻鍵盤圖](docs/shenyun-overall17-keyboard.svg)

**日常八場景文稿純雙拼鍵頻圖（含標點）**

![神韻(Overall-17) 21×26 雙拼鍵頻圖](docs/shenyun-overall17-keyboard-heat.svg)

兩圖由 benchmark 頁面中的定稿方案匯出：聲韻圖使用頁面內建 \`keyboardSVG\`，鍵頻圖使用 \`r9MacroHeat\` 與同一篇 2149 擊鍵日常文稿；鍵頻圖不含五輔鍵、空格及選重。

#### 聲韻規則

普通聲母除 \`f→J\`、\`zh/ch/sh→F/V/W\` 外使用本字母；零聲母載體為 \`AOE→X\`、\`W→Q\`、\`Y/YU→Y\`。韻母鍵為 \`a:A, ai:H, an:O, ang:Y, ao:S, e:E, ei:W, en:J, eng:N, er/u:U, i:I, ia/ong:K, ian/uang:P, iang/ui:L, iao:D, ie:Z, in:C, ing/uai:R, iong/uan:Q, iu/ua:X, o/uo:M, ou:F, un/van:T, v:V, ve:G, vn:B\`。

Common399 形成 399 個唯一二鍵碼，21×26 鍵域保留 147 個空碼；M-R2 為 36。形輔鍵為 \`A/E/U/I/O\`，聲調鍵為 \`I/E/U/A/O → 一/二/三/四/輕\`。冰雪神韻·形二／三／四字詞的前兩輔字位順序為 \`12/21/42\`，冰雪神韻·調為 \`12/21/13\`。小寫輸入遵循飛花式四碼頂：單字 \`A_ / AU_ / AUB / AUBB\`；二字詞 \`A₁U₁A₂U₂[B₁B₂]\`；三字詞 \`A₁A₂A₃U₃[B₂B₁]\`；四字詞的冰雪神韻·形為 \`A₁A₂A₃A₄[B₄B₂]\`，冰雪神韻·調為 \`A₁A₂A₃A₄[B₁B₃]\`。若 \`A₃B₂\` 運行時為空桶，三字詞亦可使用 \`A₁A₂A₃B₂[B₁]\`。完成編碼後按 \`;\` 或 \`/\` 會先頂出當前候選，再分別追加「的」或「了」，與 21×21 方案的強制上屏尾字鍵一致。空桶只查系統詞典，完整單字詞頻大於 1 才占桶，當前詞典有 143 個運行時空 \`AU\`，其中 134 個為空 \`AA\`、9 個為空 \`AB\`；每個聲鍵只固頂一個一簡字。

`;

const overallValues = [
	"36",
	"0 / 0 / 0",
	"98.298315",
	"81.043390",
	"399 / 100%",
	"0 / 0%",
	"0 / 0（0%）",
	"0%",
	"2.0000",
	"75.672",
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
	return markdown
		.split("\n")
		.map((line) => {
			if (line.startsWith("冰雪神韵·形（"))
				return "冰雪神韵·形（`snow_shenyun_shape`）与冰雪神韵·调（`snow_shenyun_tone`）共用 **神韵(Overall-17) 21×26 双拼**。该方案出自双拼布局 Benchmark 的 `production/ckt-v4-2126-strict-d0-20261030` 分支，定稿于提交 `7a7e154`；`2026-10-30-strict-d0-production-closure-report.md` 记录了搜索约束、得来过程和冠军声韵映射。本仓库将其固化为 `SNOW-SHENYUN-21X26-PRODUCTION`，本节映射与键盘图均以该定稿方案为准。";
			if (line.startsWith("Snow Shenyun Shape ("))
				return "Snow Shenyun Shape (`snow_shenyun_shape`) and Snow Shenyun Tone (`snow_shenyun_tone`) share **Shenyun(Overall-17) 21×26 double pinyin**. The layout comes from the Shuangpin Layout Benchmark branch `production/ckt-v4-2126-strict-d0-20261030` and was finalized in commit `7a7e154`; `2026-10-30-strict-d0-production-closure-report.md` records the search constraints, derivation, and winning mapping. This repository freezes it as `SNOW-SHENYUN-21X26-PRODUCTION`, and this section's mapping and keyboard figures use that finalized layout.";
			if (line.startsWith("冰雪神韻·形（"))
				return "冰雪神韻·形（`snow_shenyun_shape`）與冰雪神韻·調（`snow_shenyun_tone`）共用 **神韻(Overall-17) 21×26 雙拼**。該方案出自雙拼布局 Benchmark 的 `production/ckt-v4-2126-strict-d0-20261030` 分支，定稿於提交 `7a7e154`；`2026-10-30-strict-d0-production-closure-report.md` 記錄了搜尋約束、得來過程及冠軍聲韻映射。本倉庫將其固化為 `SNOW-SHENYUN-21X26-PRODUCTION`，本節映射與鍵盤圖均以該定稿方案為準。";
			if (line.startsWith("[冰雪键道]"))
				return "[冰雪键道](https://input.tansongchen.com/snow-jiandao/)和[冰雪三拼](https://input.tansongchen.com/snow3/)现共用 **无飞键道(U357) 21×21 双拼**，使用 21×21 声韵键域和 5 个互斥辅键 `IVUAO`。该方案出自双拼布局 Benchmark 的 `production/ckt-v4-2121-strict-avuio-20261024` 分支，定稿于提交 `11713b6`；`2026-10-29-prodgate-directed-repair-final-report.md` 给出了 U=357 候选的搜索过程、完整映射、指标和投产推荐。本仓库采用并实现该候选，本节映射与键盘图均以报告中的 U=357 方案为准。";
			if (line.startsWith("[Snow KeyTao]"))
				return "[Snow KeyTao](https://input.tansongchen.com/snow-jiandao/) and [Snow Three-Code](https://input.tansongchen.com/snow3/) now share **Wufei KeyTao(U357) 21×21 double pinyin**, using a 21×21 sound-code domain and five disjoint auxiliary keys, `IVUAO`. The layout comes from the Shuangpin Layout Benchmark branch `production/ckt-v4-2121-strict-avuio-20261024` and was finalized in commit `11713b6`; `2026-10-29-prodgate-directed-repair-final-report.md` records the U=357 candidate's search, full mapping, metrics, and production recommendation. This repository implements that candidate, and this section's mapping and keyboard figures use the reported U=357 layout.";
			if (line.startsWith("[冰雪鍵道]"))
				return "[冰雪鍵道](https://input.tansongchen.com/snow-jiandao/)與[冰雪三拼](https://input.tansongchen.com/snow3/)現共用 **無飛鍵道(U357) 21×21 雙拼**，使用 21×21 聲韻鍵域與 5 個互斥輔鍵 `IVUAO`。該方案出自雙拼布局 Benchmark 的 `production/ckt-v4-2121-strict-avuio-20261024` 分支，定稿於提交 `11713b6`；`2026-10-29-prodgate-directed-repair-final-report.md` 給出了 U=357 候選的搜尋過程、完整映射、指標及投產建議。本倉庫採用並實作該候選，本節映射與鍵盤圖均以報告中的 U=357 方案為準。";
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

function normalizeTerms(markdown: string) {
	markdown = normalizeSourceProvenance(markdown)
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
	return normalizeContractClaims(markdown);
}

const readmeDirections = [
	"min", // M-R2
	"triple-sum", // 飞键成分
	"max", // FA-1
	"max", // LU-v1r
	"max", // Common399 唯一码
	"min", // 重码盈余
	"min", // 重码桶
	"min", // S2 miss
	"min", // S2 平均码长
	"min", // S2 中心时间
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

function finalizeReadme(markdown: string, host: "github" | "gitee") {
	let output = decorateReadmeTables(ensureCktV51Documentation(markdown));
	output = addComparisonLegends(output);
	output = linkReadmeFiles(output, host);
	output = linkShenyunTerms(output, "zh", host);
	output = linkShenyunTerms(output, "en", host);
	output = linkShenyunTerms(output, "zht", host);
	return output;
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
	return finalizeReadme(
		normalizeTerms(addOverallColumn(deduplicateOverallSections(markdown))),
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
