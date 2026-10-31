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

冰雪神韵·形（\`snow_shenyun_shape\`）与冰雪神韵·调（\`snow_shenyun_tone\`）共用 **神韵(Overall-17) 21×26 双拼**。其底层方案 ID 是 \`SNOW-SHENYUN-21X26-PRODUCTION\`；\`a7_CKT_R11.html\` 只是保存该方案及绘图、复算函数的 benchmark 页面版本，不是方案名称。

**声韵辅-键 映射**

![神韵(Overall-17) 21×26 双拼声韵键盘图](docs/shenyun-overall17-keyboard.svg)

**日常八场景文稿纯双拼键频图（含标点）**

![神韵(Overall-17) 21×26 双拼键频图](docs/shenyun-overall17-keyboard-heat.svg)

两图均直接从 benchmark HTML 中的目标方案导出：声韵图调用页面内置 \`keyboardSVG\` 后裁出 26 个字母键；键频图调用页面内置 \`r9MacroHeat\`，使用同一篇 2149 击键日常八场景文稿。键频图不含五辅键、空格和选重。

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
- 小写输入遵循飞花式四码顶：单字为 \`A_ / AU_ / AUB / AUBB\`，二字词为 \`A₁U₁A₂U₂[B₂B₁]\`，三字词为 \`A₁A₂A₃U₃[B₁B₂]\`，四字词为 \`A₁A₂A₃A₄[B₁B₂]\`。完整码之后输入下一字声码才顶屏，未完成主码直接续写。

`;

const enOverall = `### Shenyun(Overall-17) 21×26 double pinyin

Snow Shenyun Shape (\`snow_shenyun_shape\`) and Snow Shenyun Tone (\`snow_shenyun_tone\`) share **Shenyun(Overall-17) 21×26 double pinyin**. Its stable scheme ID is \`SNOW-SHENYUN-21X26-PRODUCTION\`; \`a7_CKT_R11.html\` is only the benchmark page carrying the scheme and rendering/replay functions, not the layout's name.

**Initial/final/auxiliary-key mapping**

![Shenyun(Overall-17) 21×26 initial/final keyboard map](docs/shenyun-overall17-keyboard.svg)

**Pure-double-pinyin key-frequency map over the daily eight-scenario corpus (punctuation included)**

![Shenyun(Overall-17) 21×26 key-frequency map](docs/shenyun-overall17-keyboard-heat.svg)

Both SVGs are exported directly from the target entry in the benchmark HTML: the first uses its built-in \`keyboardSVG\`, while the second uses \`r9MacroHeat\` over the same 2,149-keystroke daily corpus. The heat map excludes auxiliaries, spaces, and candidate selection.

#### Coding rules

Ordinary initials use their own letter except \`f→J\` and \`zh/ch/sh→F/V/W\`; zero-onset carriers are \`AOE→X\`, \`W→Q\`, and \`Y/YU→Y\`. The final keys are \`a:A, ai:H, an:O, ang:Y, ao:S, e:E, ei:W, en:J, eng:N, er/u:U, i:I, ia/ong:K, ian/uang:P, iang/ui:L, iao:D, ie:Z, in:C, ing/uai:R, iong/uan:Q, iu/ua:X, o/uo:M, ou:F, un/van:T, v:V, ve:G, vn:B\`.

Common399 has 399 distinct two-key codes, leaving 147 vacancies in the 21×26 domain; M-R2 is 36. Shape auxiliaries are \`A/E/U/I/O\`, and tone auxiliaries are \`I/E/U/A/O → 1/2/3/4/neutral\`. Lowercase input follows the Feihua four-code-top contract: characters use \`A_ / AU_ / AUB / AUBB\`; two-character words use \`A₁U₁A₂U₂[B₂B₁]\`; three-character words use \`A₁A₂A₃U₃[B₁B₂]\`; four-character words use \`A₁A₂A₃A₄[B₁B₂]\`.

`;

const zhtOverall = `### 神韻(Overall-17) 21×26 雙拼

冰雪神韻·形（\`snow_shenyun_shape\`）與冰雪神韻·調（\`snow_shenyun_tone\`）共用 **神韻(Overall-17) 21×26 雙拼**。底層方案 ID 為 \`SNOW-SHENYUN-21X26-PRODUCTION\`；\`a7_CKT_R11.html\` 只是承載方案與繪圖、複算函式的 benchmark 頁面版本，不是方案名稱。

**聲韻輔-鍵 映射**

![神韻(Overall-17) 21×26 雙拼聲韻鍵盤圖](docs/shenyun-overall17-keyboard.svg)

**日常八場景文稿純雙拼鍵頻圖（含標點）**

![神韻(Overall-17) 21×26 雙拼鍵頻圖](docs/shenyun-overall17-keyboard-heat.svg)

兩圖均直接從 benchmark HTML 的目標方案匯出：聲韻圖使用頁面內建 \`keyboardSVG\`，鍵頻圖使用 \`r9MacroHeat\` 與同一篇 2149 擊鍵日常文稿；鍵頻圖不含五輔鍵、空格及選重。

#### 聲韻規則

普通聲母除 \`f→J\`、\`zh/ch/sh→F/V/W\` 外使用本字母；零聲母載體為 \`AOE→X\`、\`W→Q\`、\`Y/YU→Y\`。韻母鍵為 \`a:A, ai:H, an:O, ang:Y, ao:S, e:E, ei:W, en:J, eng:N, er/u:U, i:I, ia/ong:K, ian/uang:P, iang/ui:L, iao:D, ie:Z, in:C, ing/uai:R, iong/uan:Q, iu/ua:X, o/uo:M, ou:F, un/van:T, v:V, ve:G, vn:B\`。

Common399 形成 399 個唯一二鍵碼，21×26 鍵域保留 147 個空碼；M-R2 為 36。形輔鍵為 \`A/E/U/I/O\`，聲調鍵為 \`I/E/U/A/O → 一/二/三/四/輕\`。小寫輸入遵循飛花式四碼頂：單字 \`A_ / AU_ / AUB / AUBB\`；二字詞 \`A₁U₁A₂U₂[B₂B₁]\`；三字詞 \`A₁A₂A₃U₃[B₁B₂]\`；四字詞 \`A₁A₂A₃A₄[B₁B₂]\`。

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
	markdown = markdown
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
			"神韵(Overall-17)与 B04 按四码顶合同，无飞键道(U357)与 S005 按传统 21×21 合同",
		)
		.replaceAll(
			"B04 按 26×26 四码顶合同计分，U357、S005 按 21×21 合同计分",
			"神韵(Overall-17)与 B04 按四码顶合同计分，无飞键道(U357)与 S005 按传统 21×21 合同计分",
		)
		.replaceAll(
			"B04 按 26×26 四碼頂合同，U357、S005 按 21×21 合同",
			"神韻(Overall-17)與 B04 按四碼頂合同，無飛鍵道(U357)與 S005 按傳統 21×21 合同",
		)
		.replaceAll(
			"B04 按 26×26 四碼頂合同計分，U357、S005 按 21×21 合同計分",
			"神韻(Overall-17)與 B04 按四碼頂合同計分，無飛鍵道(U357)與 S005 按傳統 21×21 合同計分",
		)
		.replaceAll(
			"B04 uses the 26×26 four-code-top contract, whereas U357 and S005 use 21×21",
			"Shenyun(Overall-17) and B04 use four-code-top contracts, whereas Wufei KeyTao(U357) and S005 use the traditional 21×21 contract",
		)
		.replaceAll(
			"B04 uses a 26×26 four-code-top contract, while U357 and S005 use 21×21",
			"Shenyun(Overall-17) and B04 use four-code-top contracts, while Wufei KeyTao(U357) and S005 use the traditional 21×21 contract",
		)
		.replaceAll(
			"B04 is nevertheless scored under the 26×26 four-code-top contract, while U357 and S005 use the 21×21 contract",
			"Shenyun(Overall-17) and B04 are scored under four-code-top contracts, while Wufei KeyTao(U357) and S005 use the traditional 21×21 contract",
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
	return markdown;
}

const readmeDirections = [
	"min",
	"triple-sum",
	"max",
	"max",
	"max",
	"min",
	"min",
	"min",
	"min",
	"min",
	"min",
	"min",
	"min",
	"min",
	"min",
	"min",
	"min",
	"min",
	"min",
	"closest-to-half",
	"min",
	"min",
	"min",
	"min",
	"min",
	"max",
	"max",
	"min",
	"max",
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
				!line.includes("**粗体** ★") &&
				!line.includes("**Bold** ★") &&
				!line.includes("**粗體** ★") &&
				!["表中", "In the tables,"].includes(line.trim()),
		);
	for (let index = 0; index < lines.length; index++) {
		const match = lines[index].match(/^\| (指标|Metric|指標) \|/u);
		if (!match) continue;
		const legend =
			match[1] === "Metric"
				? "In the tables, **Bold** ★ compares only the two traditional 21×21 layouts, Wufei KeyTao(U357) and the original KeyTao S005; **Bold** ★★ compares Shenyun(Overall-17), Wufei KeyTao(U357), and the original KeyTao S005, excluding Shoudao B04; 🥇 compares all four layouts. Every tied best cell keeps the same marker."
				: match[1] === "指標"
					? "表中 **粗體** ★ 只比較同為傳統 21×21 合同的無飛鍵道(U357)與原鍵道 S005；**粗體** ★★ 比較神韻(Overall-17)、無飛鍵道(U357)與原鍵道 S005，首道 B04 不參與；🥇 比較全部四方案；並列最優均保留標記。"
					: "表中 **粗体** ★ 只比较同为传统 21×21 合同的无飞键道(U357)与原键道 S005；**粗体** ★★ 比较神韵(Overall-17)、无飞键道(U357)与原键道 S005，首道 B04 不参与；🥇 比较全部四方案；并列最优均保留标记。";
		while (index > 0 && lines[index - 1] === "") {
			lines.splice(index - 1, 1);
			index--;
		}
		lines.splice(index, 0, "", legend, "");
		index += 3;
	}
	return lines.join("\n");
}

function finalizeReadme(markdown: string, host: "github" | "gitee") {
	let output = decorateReadmeTables(markdown);
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
			/(## 简体中文[\s\S]*?)(### 无\[飞键\])/u,
			(_match, prefix: string, heading: string) =>
				`${prefix}${zhOverall}${heading}`,
		)
		.replace(
			/(## English[\s\S]*?)(### Wufei KeyTao)/u,
			(_match, prefix: string, heading: string) =>
				`${prefix}${enOverall}${heading}`,
		)
		.replace(
			/(## 繁體中文[\s\S]*?)(### 無\[飛鍵\])/u,
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
			"四方案共用 Common399、冻结 20 合同、字词／形码数据、CKT v4 模型和日常八场景文稿；无飞键道(U357)与 S005 采用传统 21×21 合同，神韵(Overall-17)与 B04 采用四码顶合同。",
		)
		.replace(
			/All three layouts use Common399[^\n]*/gu,
			"All four layouts use Common399, the frozen 20 contracts, the same word/shape data, CKT v4, and the daily corpus. Wufei KeyTao(U357) and S005 use the traditional 21×21 contract; Shenyun(Overall-17) and B04 use the four-code-top contract.",
		)
		.replace(
			/三方案共用 Common399、凍結 20 合同[^\n]*/gu,
			"四方案共用 Common399、凍結 20 合同、字詞／形碼資料、CKT v4 模型及日常八場景文稿；無飛鍵道(U357)與 S005 採傳統 21×21 合同，神韻(Overall-17)與 B04 採四碼頂合同。",
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
