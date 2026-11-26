import { readFileSync, writeFileSync } from "node:fs";
import { updateGiteeReadme } from "./generate-gitee-readme";
import {
	latestCurrentBenchmark,
	renderCurrentOverview,
} from "./lib/current-layout-benchmark";
import { readmeBenchmarkRows } from "./lib/readme-benchmark-rows";
import { updateTonedReadmeDocumentation } from "./lib/toned-readme-documentation";
import {
	readHeatmapReport,
	updateBenchmarkHeatmapReadme,
} from "./lib/benchmark-heatmaps";
import { rootPath } from "./lib/paths";
import { linkReadmeFiles, linkShenyunTerms } from "./lib/shenyun-markdown";
import { join } from "node:path";

const root = rootPath();
type ReadmeBenchmarkLanguage = "zh" | "en" | "zht";
function currentReadmeBenchmarkTable(language: ReadmeBenchmarkLanguage) {
	const snapshot = latestCurrentBenchmark();
	if (!snapshot) throw new Error("缺少当前生产布局 benchmark");
	return renderCurrentOverview(snapshot, readmeBenchmarkRows, language);
}
function finalizeReadme(markdown: string) {
	let output = updateTonedReadmeDocumentation(markdown);
	output = updateBenchmarkHeatmapReadme(output, readHeatmapReport());
	output = linkReadmeFiles(output, "github");
	for (const language of ["zh", "en", "zht"] as const)
		output = linkShenyunTerms(output, language, "github");
	return output;
}
type ActiveLayoutDocumentation = {
	initialMap: Record<string, string>;
	finalMap: Record<string, string>;
};

type ActiveLetterDocumentation = {
	letters: Array<{
		letter: string;
		code: string;
		naturalTop3: Array<{ text: string }>;
	}>;
};

type ActiveNumberDocumentation = {
	status: string;
	numbers: Array<{
		digit: string;
		han: string;
		shapeCode: string;
		toneCode: string;
		tonedShapeCode: string;
	}>;
};

const activeD3Layout = JSON.parse(
	readFileSync(join(root, "config", "shenyun-21x26-mapping.json"), "utf8"),
) as ActiveLayoutDocumentation;
const activeQzLayout = JSON.parse(
	readFileSync(join(root, "config", "shenyun-21x21-mapping.json"), "utf8"),
) as ActiveLayoutDocumentation;
const activeD3Letters = JSON.parse(
	readFileSync(
		join(root, "config", "shenyun-21x26-letter-buckets.json"),
		"utf8",
	),
) as ActiveLetterDocumentation;
const activeD3Numbers = JSON.parse(
	readFileSync(join(root, "config", "shenyun-21x26-number-codes.json"), "utf8"),
) as ActiveNumberDocumentation;

const fixedAliases = (filename: string) =>
	new Map(
		readFileSync(join(root, filename), "utf8")
			.split(/\r?\n/u)
			.filter((line) => line.includes("\t"))
			.map((line) => {
				const [code, candidates = ""] = line.split("\t", 2);
				return [code, candidates.split(" ")] as const;
			}),
	);

const qzJiandaoAliases = fixedAliases("snow_landao.fixed.txt");
const qzSanpinAliases = fixedAliases("snow_lanpin.fixed.txt");

const fixedSectionCounts = (filename: string) => {
	const counts = new Map<string, number>();
	let section = "";
	for (const line of readFileSync(join(root, filename), "utf8").split(
		/\r?\n/u,
	)) {
		const heading = line.match(/^# (.+)$/u)?.[1];
		if (heading) {
			section = heading;
			continue;
		}
		const code = line.split("\t", 1)[0];
		if (!section || !line.includes("\t") || !code) continue;
		const key = `${section}/${code.length}`;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts;
};

const countFixedRows = (
	counts: Map<string, number>,
	section: string,
	length: number,
) => counts.get(`${section}/${length}`) ?? 0;

const d3FixedCounts = fixedSectionCounts("snow_hedao.fixed.txt");
const d3ToneFixedCounts = fixedSectionCounts("snow_hepin.fixed.txt");
const qzJiandaoFixedCounts = fixedSectionCounts("snow_landao.fixed.txt");
const qzSanpinFixedCounts = fixedSectionCounts("snow_lanpin.fixed.txt");
const d3FirstCodes = countFixedRows(d3FixedCounts, "一级简码", 1);
const d3TwoKeyCharacters = countFixedRows(d3FixedCounts, "单字", 2);
const d3TwoKeyWords = countFixedRows(d3FixedCounts, "二简词", 2);
const d3ThreeKeyCharacters = countFixedRows(d3FixedCounts, "单字", 3);
const zhudaoThreeKeyCharacters = countFixedRows(
	fixedSectionCounts("snow_huandao.fixed.txt"),
	"单字",
	3,
);
const qzTwoKeyCharacters = countFixedRows(qzJiandaoFixedCounts, "单字", 2);
const qzTwoKeyWords = countFixedRows(qzJiandaoFixedCounts, "二简词", 2);
const qzTwoKeySixThirty = countFixedRows(qzJiandaoFixedCounts, "630", 2);
const qzThreeKeySixThirty = countFixedRows(qzJiandaoFixedCounts, "630", 3);
if (
	d3FirstCodes !== countFixedRows(d3ToneFixedCounts, "一级简码", 1) ||
	d3TwoKeyCharacters !== countFixedRows(d3ToneFixedCounts, "单字", 2) ||
	d3TwoKeyWords !== countFixedRows(d3ToneFixedCounts, "二简词", 2) ||
	qzTwoKeyCharacters !== countFixedRows(qzSanpinFixedCounts, "单字", 2) ||
	qzTwoKeyWords !== countFixedRows(qzSanpinFixedCounts, "二简词", 2) ||
	qzTwoKeySixThirty !== countFixedRows(qzSanpinFixedCounts, "630", 2) ||
	qzThreeKeySixThirty !== countFixedRows(qzSanpinFixedCounts, "630", 3)
)
	throw new Error("同键域两方案的简码／固顶空间不一致。");

const findAliasCode = (aliases: Map<string, string[]>, wanted: string) => {
	const entry = [...aliases].find(([, candidates]) =>
		candidates.includes(wanted),
	);
	if (!entry) throw new Error(`fixed 表缺少候选：${wanted}`);
	return entry[0];
};

const d3LetterTable = (headers: [string, string, string]) => {
	const rows: string[][] = [];
	for (let index = 0; index < 13; index++) {
		const left = activeD3Letters.letters[index];
		const right = activeD3Letters.letters[index + 13];
		if (!left || !right) throw new Error("21×26 字母映射不是完整的 26 项。");
		rows.push([
			left.letter.toUpperCase(),
			`\`${left.code}\``,
			left.naturalTop3[0]?.text ?? "—",
			right.letter.toUpperCase(),
			`\`${right.code}\``,
			right.naturalTop3[0]?.text ?? "—",
		]);
	}
	return [
		`| ${headers.join(" | ")} | ${headers.join(" | ")} |`,
		"| --- | :---: | :---: | --- | :---: | :---: |",
		...rows.map((row) => `| ${row.join(" | ")} |`),
	].join("\n");
};

const d3NumberTable = (headers: [string, string, string]) =>
	[
		`| ${headers.join(" | ")} | 冰雪鹮道 |`,
		"| --- | :---: | :---: | :---: |",
		...activeD3Numbers.numbers.map(
			(number) =>
				`| ${number.han}／${number.digit} | \`${number.shapeCode}\` | \`${number.toneCode}\` | \`${number.tonedShapeCode}\` |`,
		),
	].join("\n");

const qzNumberTable = (headers: [string, string, string]) => {
	const han = [
		"零",
		"一",
		"二",
		"三",
		"四",
		"五",
		"六",
		"七",
		"八",
		"九",
		"十",
	];
	const digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
	return [
		`| ${headers.join(" | ")} |`,
		"| --- | :---: | :---: |",
		...digits.map(
			(digit, index) =>
				`| ${han[index]}／${digit} | \`${findAliasCode(qzJiandaoAliases, digit)}\` | \`${findAliasCode(qzSanpinAliases, digit)}\` |`,
		),
	].join("\n");
};

const mappingTable = (
	mapping: Record<string, string>,
	headers: [string, string],
) => {
	const entries = Object.entries(mapping);
	const rows: string[][] = [];
	for (let index = 0; index < entries.length; index += 3) {
		const row: string[] = [];
		for (const [source, key] of entries.slice(index, index + 3))
			row.push(`\`${source}\``, `\`${key}\``);
		while (row.length < 6) row.push("");
		rows.push(row);
	}
	return [
		`| ${headers.join(" | ")} | ${headers.join(" | ")} | ${headers.join(" | ")} |`,
		"| --- | :---: | --- | :---: | --- | :---: |",
		...rows.map((row) => `| ${row.join(" | ")} |`),
	].join("\n");
};

type LayoutDocumentationOrder = {
	letterHeading: string;
	rulesHeading: string;
	mappingHeading: string;
	pureHeatHeading: string;
	heatHeading: string;
};

function reorderLayoutDocumentation(
	markdown: string,
	layoutHeading: string,
	nextHeading: string,
	order: LayoutDocumentationOrder,
) {
	const start = markdown.indexOf(`${layoutHeading}\n`);
	const end = markdown.indexOf(
		`${nextHeading}\n`,
		start + layoutHeading.length,
	);
	if (start < 0 || end < 0)
		throw new Error(`README 缺少布局区间：${layoutHeading} → ${nextHeading}`);
	const section = markdown.slice(start, end);
	const letterStart = section.indexOf(order.letterHeading);
	const rulesStart = section.indexOf(order.rulesHeading);
	const mappingStart = section.indexOf(order.mappingHeading);
	const pureHeatStart = section.indexOf(order.pureHeatHeading);
	const heatStart = section.indexOf(order.heatHeading);
	if (
		letterStart < 0 ||
		rulesStart < 0 ||
		mappingStart < 0 ||
		pureHeatStart < 0 ||
		heatStart < 0 ||
		!(
			letterStart < rulesStart &&
			rulesStart < mappingStart &&
			mappingStart < pureHeatStart &&
			pureHeatStart < heatStart
		)
	)
		throw new Error(`README 布局子节结构异常：${layoutHeading}`);
	const prefix = section.slice(0, letterStart);
	const letter = section.slice(letterStart, rulesStart).trimEnd();
	const rules = section.slice(rulesStart, mappingStart).trimEnd();
	const mapping = section.slice(mappingStart, pureHeatStart).trimEnd();
	const pureHeat = section.slice(pureHeatStart, heatStart).trimEnd();
	const suffix = section.slice(heatStart);
	return `${markdown.slice(0, start)}${prefix}${mapping}\n\n${pureHeat}\n\n${rules}\n\n${letter}\n\n${markdown.slice(end)}`;
}

function replaceCurrentLayoutDocumentation(
	markdown: string,
	host: "github" | "gitee",
) {
	const benchmarkRoot =
		host === "gitee"
			? "https://gitee.com/xie-chenzhu/shuangpin-layout-benchmark/blob/main"
			: "https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main";
	const d3Source = `${benchmarkRoot}/research/notes/2026-11-09-rc26-ckt-v51-soft-balance-aux-order-robustness.md`;
	const qzSource = `${benchmarkRoot}/research/notes/2026-11-21-u7e-pinky-r11-scores-UED-3158ce08b5bc.json`;
	const zhBenchmark = currentReadmeBenchmarkTable("zh");
	const enBenchmark = currentReadmeBenchmarkTable("en");
	const zhtBenchmark = currentReadmeBenchmarkTable("zht");
	const zhBenchmarkLegend = latestCurrentBenchmark()
		? "无调除首道外评星；全部方案比较金牌；除首道外全部方案按排名标蓝色菱形（含无调与带调）。并列及可比性见表后图例和脚注。"
		: "";
	const enBenchmarkLegend = latestCurrentBenchmark()
		? "Stars rank untoned layouts except B04; gold medals compare all layouts. Blue diamonds mark first/second among all layouts except B04, both untoned and toned. See the legend and comparability footnotes."
		: "";
	const zhtBenchmarkLegend = latestCurrentBenchmark()
		? "無調除首道外評星，全部方案比較金牌；除首道外全部方案按排名標藍色菱形（含無調與帶調）。並列與可比性見圖例及腳註。"
		: "";
	const zh = `### RC26-39a5bfdc045342cd 21×26 双拼

冰雪鹤道（\`snow_hedao\`）与冰雪鹤拼（\`snow_hepin\`）现共用 [RC26-39a5bfdc045342cd 21×26 布局](${d3Source})，仓库标识为 \`RC26-39a5bfdc045342cd\`，来源冻结、迁移审计与验证步骤见 [RC26 布局说明](docs/hedao.md)。布局在 Common399 上无音节重码，M-R2 \`40\`，全声母／字母声母／传统声母／韵母乱序度 A/I/D/V \`8/5/3/1\`；按 21×26 原生四码封顶、跨词长联合候选池与 \`soft-page-fill-v2\` 计分，方案专属稳健结果为 CKT v5.1 \`9.082777229838413\`。

五辅语义保持“折横撇竖点→\`AEUIO\`、一二三四轻→\`IEUAO\`”，按形义序观察声调仍为 \`42310\`。冰雪鹤道的二／三／四字词形辅序为 \`12/12/24\`，冰雪鹤拼的调辅序为 \`12/21/13\`；记号表示从各字位依次取辅码，运行规则以方案文件为准。

#### 英数入口

两个 21×26 方案共用同一套字母入口。21 个辅音字母通常使用“字母原键 + \`n\`”，其中 \`D/J/X\` 分别使用 \`db/jm/xo\`；五个元音字母使用 \`x\` 载体。入口只借用已有汉字候选的占用桶，不消耗空码；原汉字保持首选，大写、小写字母固定为第 2、3 候选。下表的“原首选”由当前冻结词典与映射计算，完整审计数据见 [字母桶配置](config/shenyun-21x26-letter-buckets.json)。

${d3LetterTable(["字母", "输入码", "原首选"])}

三套 21×26 方案的 0～10 数字固顶别名均已启用。优先复用对应汉字数字已有的最短固顶码；没有三码以内固顶时，使用该字的主码加第一形辅／调辅。已有汉字首选与字母第 2、3 位保持不变，数字追加在其后；不占用声声空桶。

${d3NumberTable(["数字", "冰雪鹤道", "冰雪鹤拼"])}

字母和数字均不侵占 \`ABA\` 的 \`21×5×21=2205\` 个状态，既有 \`AAB\`、\`AAAB\` 路由也保持不变。

#### 声韵编码规则

声母及零声母载体使用下列首键：

${mappingTable(activeD3Layout.initialMap, ["声母／载体", "首键"])}

韵母使用下列次键；\`v/van/ve/vn\` 表示 ü 系：

${mappingTable(activeD3Layout.finalMap, ["韵母", "次键"])}

- Common399 的 399 个音节全部拥有唯一双拼码；静态 21×26 键域有 147 个空码。按当前系统词典的实际占用口径运行时有 142 个 \`AU\` 空码，其中 129 个为 \`AA\`、13 个为 \`AB\`。
- 单字主码为 \`AU\`。继续输入声母可进入 \`AUA/AAA\` 等词语路由，辅码只在相应阶段追加；二／三／四字词的方案专属辅序以上文 \`12/12/24\` 与 \`12/21/13\` 为准。
- 冰雪鹤道的形辅键为 \`A/E/U/I/O = 折/横/撇/竖/点\`；冰雪鹤拼的调辅键为 \`I/E/U/A/O = 一/二/三/四/轻\`。空码补字只查询系统词典，不受个人词频影响。

**声母—韵母映射**

![RC26-39a5bfdc045342cd 21×26 双拼声韵键盘图](docs/shenyun-rc26-keyboard.svg)

**日常八场景文稿纯双拼键频图（含标点）**

![RC26-39a5bfdc045342cd 21×26 双拼纯双拼键频图](docs/shenyun-rc26-keyboard-heat.svg)

键频图由 benchmark 页面内置的 \`r9MacroHeat\` 从现行布局直接导出，使用 2149 击键的日常八场景文稿，只统计纯双拼与文稿标点，不含五辅键、空格和选重。

**十一场景 5500 字最优路径全按键键频**



当前布局的实际按键与逐场景回放见下方 5500 字评测。

### UED-3158ce08b5bc 21×21 双拼

冰雪兰道（\`snow_landao\`）与冰雪兰拼（\`snow_lanpin\`）现共用 [UED-3158ce08b5bc 21×21 布局](${qzSource})，仓库标识为 \`UED-3158ce08b5bc\`。布局指标为 M-R2 \`41\`、全声母／字母声母／传统声母／韵母乱序度 A/I/D/V \`5/2/2/5\`；按传统 21×21 原生路由与方案专属稳健辅序计分，CKT v5.1 \`9.565504107623386\`。

五辅语义保持“折横撇竖点→\`AVUIO\`、一二三四轻→\`IVUAO\`”，按形义序观察声调同为 \`42310\`。冰雪兰道的二／三／四字词形辅序为 \`12/231/23\`，冰雪兰拼的调辅序为 \`12/213/23\`；三字词保留完整三辅键路由，二字词与四字词共享四码主码候选竞争池。

#### 英数入口

冰雪兰道与冰雪兰拼共用字母基码：21 个辅音字母使用“字母原键 + \`c\`”，五个元音使用 \`A=xw、I=xl、O=xd、U=xh、V=xg\`。冰雪兰道直接使用基码，原汉字保持首选，大写、小写字母为第 2、3 候选；冰雪兰拼在基码后追加轻声键 \`o\`，大写、小写字母为第 1、2 候选。即使字母码与真实音节重合，固定候选顺序也保持不变。

数字与对应汉字共用码位；存在汉字候选时数字追加在其后，不占用额外空码。

${qzNumberTable(["数字", "冰雪兰道", "冰雪兰拼"])}

#### 声韵编码规则

声母及零声母载体使用下列首键：

${mappingTable(activeQzLayout.initialMap, ["声母／载体", "首键"])}

韵母使用下列次键；\`v/van/ve/vn\` 表示 ü 系：

${mappingTable(activeQzLayout.finalMap, ["韵母", "次键"])}

- Common399 形成 351 个唯一码和 48 个双音节重码桶，静态键域有 90 个空码；按当前系统词典的实际占用口径运行时有 87 个 \`AA\` 空码，包含保留码 \`qz\`、\`zq\`。
- 冰雪兰道使用形辅键 \`A/V/U/I/O = 折/横/撇/竖/点\`，冰雪兰拼使用调辅键 \`I/V/U/A/O = 一/二/三/四/轻\`；\`j/q/x\` 后的 ü 系按 \`v/van/ve/vn\` 统一编码。
- 两个方案的 630 固顶区都完整覆盖 630 个码位且词项不重复；大写补韵、动态空桶和多字词辅码按各方案文件中的现行规则运行。

**声母—韵母映射**

![UED-3158ce08b5bc 21×21 双拼声韵键盘图](docs/shenyun-ued-3158ce08b5bc-keyboard.svg)

**日常八场景文稿纯双拼键频图（含标点）**

![UED-3158ce08b5bc 21×21 双拼纯双拼键频图](docs/shenyun-ued-3158ce08b5bc-keyboard-heat.svg)

键频图由 benchmark 页面内置的 \`r9MacroHeat\` 从现行布局直接导出，使用 2149 击键的日常八场景文稿，只统计纯双拼与文稿标点，不含五辅键、空格和选重。

**十一场景 5500 字最优路径全按键键频**



当前布局的实际按键与逐场景回放见下方 5500 字评测。

### 固顶、空桶与逐级简码

- 冰雪鹤道、冰雪鹤拼的现行 fixed 表各含 ${d3FirstCodes} 个一级简码、${d3TwoKeyCharacters} 个二码单字、${d3TwoKeyWords} 个二简词和 26 个字母入口；二简词只占不与单字音节冲突的码位，两个方案没有 630 区。
- 冰雪鹤道另有 ${d3ThreeKeyCharacters.toLocaleString("en-US")} 个三级单字固顶，冰雪鹮道另有 ${zhudaoThreeKeyCharacters.toLocaleString("en-US")} 个，均为两码主码加第一形辅，与短码固定单字不重复；参考四拼单字偏好，现有读音权重只作兜底，见[选字原则](docs/fixed-candidates.md)。
- 冰雪兰道、冰雪兰拼以 ${qzTwoKeyCharacters} 个二码单字和 ${qzTwoKeyWords} 个二简词完整覆盖 441 个 \`AA\` 位置。两方案的 630 区均由 ${qzTwoKeySixThirty} 个二码位与 ${qzThreeKeySixThirty} 个三码位组成，每码固定一个不重复词项。
- 冰雪兰道、冰雪兰拼及对应经典方案的大写字母用于三字及以上简拼补韵：前三字可写成 \`A[U]A[U]A[U]\`，第四字起只取声母；已有四个小写声母后，大写字母恢复为下一字声母。

### 现行双拼与原键道 S005、首道 B04 benchmark

下表使用当前四份生产布局的冻结数据，并以原键道 S005、首道 B04 作为外部参照。

${zhBenchmarkLegend}

${zhBenchmark}

#### 完整测评报告

当前生产布局与外部基线的可复算比较见 [当前布局比较报告](reports/shenyun-comparison.md)。

当前校正后的测评：[5500 字十二方案与 11 个场景回放](reports/十一场景_5500字_当前十二方案对比评测.md)、[原 5000 字十二方案](reports/十篇五百字_当前十二方案最优切分及字词比率报告.md)。


`;
	const en = `### RC26-39a5bfdc045342cd 21×26 double pinyin

冰雪鹤道 (\`snow_hedao\`) and 冰雪鹤拼 (\`snow_hepin\`) now share the [RC26-39a5bfdc045342cd 21×26 layout](${d3Source}), identified in this repository as \`RC26-39a5bfdc045342cd\`. It has no Common399 syllable collisions, M-R2 \`40\`, and all/written/traditional-initial/final disorder A/I/D/V \`8/5/3/1\`. Under the native 21×26 four-code-top contract, cross-length candidate pool, and \`soft-page-fill-v2\`, its scheme-specific robust score is CKT v5.1 \`9.082777229838413\`.

The five auxiliary semantics remain bend/horizontal/left-falling/vertical/dot→\`AEUIO\` and tones 1/2/3/4/neutral→\`IEUAO\`, yielding \`42310\` in shape-meaning order. 冰雪鹤道 uses shape order \`12/12/24\` and 冰雪鹤拼 uses tone order \`12/21/13\` for two-/three-/four-character words.

#### Letter and number entry

Both 21×26 schemes share one letter-entry map. The 21 consonant letters normally use their own key plus \`n\`; \`D/J/X\` instead use \`db/jm/xo\`. The five vowels use the \`x\` carrier. These entries reuse occupied Han-character buckets and consume no vacant codes: the existing Han candidate stays first, with uppercase and lowercase in positions 2 and 3. “Original first” below is calculated from the current frozen dictionaries and mapping; see the complete [letter-bucket configuration](config/shenyun-21x26-letter-buckets.json).

${d3LetterTable(["Letter", "Input", "Original first"])}

All three 21×26 schemes enable fixed numeral aliases from 0 through 10. They reuse the corresponding Han numeral’s shortest fixed code, or its main code plus the first shape or tone auxiliary when no fixed code of at most three keys exists. Existing Han first choices and letter positions 2 and 3 stay in place; digits follow them. No vacant initial-pair bucket is consumed.

${d3NumberTable(["Number", "冰雪鹤道", "冰雪鹤拼"])}

Neither the letters nor the numbers consume the \`21×5×21=2205\` \`ABA\` states; the existing \`AAB\` and \`AAAB\` routes are also preserved.

#### Initial and final coding rules

Initials and zero-initial carriers use these first keys:

${mappingTable(activeD3Layout.initialMap, ["Initial/carrier", "First key"])}

Finals use these second keys; \`v/van/ve/vn\` denote the ü series:

${mappingTable(activeD3Layout.finalMap, ["Final", "Second key"])}

- All 399 Common399 syllables have unique double-pinyin codes. The static 21×26 domain has 147 vacant codes; under the current system-dictionary occupancy rule, 142 \`AU\` codes are vacant at runtime, comprising 129 \`AA\` and 13 \`AB\` codes.
- A single-character main code is \`AU\`. Further initials enter word routes such as \`AUA/AAA\`, and auxiliaries are appended only at the applicable stage; the scheme-specific two-/three-/four-character orders are \`12/12/24\` and \`12/21/13\` above.
- 冰雪鹤道 maps shape auxiliaries as \`A/E/U/I/O = bend/horizontal/left-falling/vertical/dot\`; 冰雪鹤拼 maps tone auxiliaries as \`I/E/U/A/O = 1/2/3/4/neutral\`. Vacant-code fallback queries system dictionaries only and is unaffected by personal frequency.

**Initial–final mapping**

![RC26-39a5bfdc045342cd 21×26 initial/final keyboard map](docs/shenyun-rc26-keyboard.svg)

**Pure-double-pinyin key-frequency map over the daily eight-scenario corpus (punctuation included)**

![RC26-39a5bfdc045342cd 21×26 pure-double-pinyin key-frequency map](docs/shenyun-rc26-keyboard-heat.svg)

The map is exported directly from the current layout through the benchmark page's built-in \`r9MacroHeat\`. It uses the 2,149-keystroke daily eight-scenario corpus and includes only double-pinyin keys and corpus punctuation, excluding auxiliaries, spaces, and candidate selection.

**Eleven-scenario optimal-path all-key frequency over 5,500 characters**

![RC26-39a5bfdc045342cd 21×26 optimal-path all-key frequency map over 5,500 Chinese characters](docs/shenyun-rc26-5500-keyboard-heat.svg)

Current 5,500-character replays and all-key frequencies are linked below.

### UED-3158ce08b5bc 21×21 double pinyin

冰雪兰道 (\`snow_landao\`) and 冰雪兰拼 (\`snow_lanpin\`) now share the [UED-3158ce08b5bc 21×21 layout](${qzSource}), identified as \`UED-3158ce08b5bc\`. Its layout metrics are M-R2 \`41\` and all/written/traditional-initial/final disorder A/I/D/V \`5/2/2/5\`; its traditional native 21×21 routing with scheme-specific robust auxiliary orders scores CKT v5.1 \`9.565504107623386\`.

The five auxiliary semantics remain bend/horizontal/left-falling/vertical/dot→\`AVUIO\` and tones 1/2/3/4/neutral→\`IVUAO\`, again yielding \`42310\`. 冰雪兰道 uses shape order \`12/231/23\`, while 冰雪兰拼 uses tone order \`12/213/23\`; three-character words retain the complete three-auxiliary route.

#### Letter and number entry

冰雪兰道 and 冰雪兰拼 share the same letter base codes. The 21 consonants use their own key plus \`c\`; the five vowels use \`A=xw, I=xl, O=xd, U=xh, V=xg\`. 冰雪兰道 uses each base code directly, keeping the original Han candidate first and uppercase/lowercase in positions 2/3. 冰雪兰拼 appends neutral-tone key \`o\`, with uppercase/lowercase in positions 1/2. The fixed order remains intact even when a letter code overlaps a real syllable.

Numbers share the codes of their corresponding Han numerals. When Han candidates exist, the digit follows them instead of consuming a separate vacant code.

${qzNumberTable(["Number", "冰雪兰道", "冰雪兰拼"])}

#### Initial and final coding rules

Initials and zero-initial carriers use these first keys:

${mappingTable(activeQzLayout.initialMap, ["Initial/carrier", "First key"])}

Finals use these second keys; \`v/van/ve/vn\` denote the ü series:

${mappingTable(activeQzLayout.finalMap, ["Final", "Second key"])}

- Common399 forms 351 unique codes and 48 two-syllable collision buckets. The static domain has 90 vacant codes; the current system-dictionary occupancy rule leaves 94 runtime-vacant \`AA\` codes, including reserved \`qz\` and \`zq\`.
- 冰雪兰道 maps shape auxiliaries as \`A/V/U/I/O = bend/horizontal/left-falling/vertical/dot\`; 冰雪兰拼 maps tone auxiliaries as \`I/V/U/A/O = 1/2/3/4/neutral\`. The ü series after \`j/q/x\` is normalized to \`v/van/ve/vn\`.
- Both schemes fill all 630 fixed-candidate slots with no repeated entries. Uppercase final completion, dynamic vacant buckets, and multi-character auxiliary routes follow the current rules in each schema.

**Initial–final mapping**

![UED-3158ce08b5bc 21×21 initial/final keyboard map](docs/shenyun-ued-3158ce08b5bc-keyboard.svg)

**Pure-double-pinyin key-frequency map over the daily eight-scenario corpus (punctuation included)**

![UED-3158ce08b5bc 21×21 pure-double-pinyin key-frequency map](docs/shenyun-ued-3158ce08b5bc-keyboard-heat.svg)

The map is exported directly from the current layout through the benchmark page's built-in \`r9MacroHeat\`. It uses the 2,149-keystroke daily eight-scenario corpus and includes only double-pinyin keys and corpus punctuation, excluding auxiliaries, spaces, and candidate selection.

**Eleven-scenario optimal-path all-key frequency over 5,500 characters**

![UED-3158ce08b5bc 21×21 optimal-path all-key frequency map over 5,500 Chinese characters](docs/shenyun-ued-3158ce08b5bc-5500-keyboard-heat.svg)

Current 5,500-character replays and all-key frequencies are linked below.

### Fixed candidates, vacant buckets, and staged abbreviations

- Each current 冰雪鹤道/冰雪鹤拼 fixed table contains ${d3FirstCodes} one-key abbreviations, ${d3TwoKeyCharacters} two-key characters, ${d3TwoKeyWords} two-key word abbreviations, and 26 letter entries. Word abbreviations use only codes that do not collide with single-character syllables; neither scheme has a 630 section.
- 冰雪鹤道 additionally fixes ${d3ThreeKeyCharacters.toLocaleString("en-US")} characters at three keys, and 冰雪鹮道 fixes ${zhudaoThreeKeyCharacters.toLocaleString("en-US")}. Each uses the two-key main code plus the first shape auxiliary, without repeating shorter fixed characters. Selection follows 四拼 character preferences with reading weights as fallback; see the [selection policy](docs/fixed-candidates.md).
- 冰雪兰道 and 冰雪兰拼 cover all 441 \`AA\` positions with ${qzTwoKeyCharacters} two-key characters and ${qzTwoKeyWords} two-key word abbreviations. Each 630 section comprises ${qzTwoKeySixThirty} two-key and ${qzThreeKeySixThirty} three-key slots, with one non-repeated word fixed per code.
- In 冰雪兰道, 冰雪兰拼, and their classic counterparts, uppercase letters complete finals only in three-or-more-character jianpin: the first three characters may use \`A[U]A[U]A[U]\`, later characters use initials only, and uppercase reverts to a following initial after four lowercase initials.

### Current double-pinyin layouts versus KeyTao S005 and Shoudao B04

This table uses frozen data for the four current production layouts, with KeyTao S005 and Shoudao B04 as external controls.

${enBenchmarkLegend}

${enBenchmark}

#### Complete benchmark reports

Reproducible current production layout comparisons and external controls are in the [current layout report](reports/shenyun-comparison.md).


`;
	const zht = `### RC26-39a5bfdc045342cd 21×26 雙拼

冰雪鶴道（\`snow_hedao\`）與冰雪鹤拼（\`snow_hepin\`）現共用 [RC26-39a5bfdc045342cd 21×26 布局](${d3Source})，倉庫標識為 \`RC26-39a5bfdc045342cd\`。布局在 Common399 上無音節重碼，M-R2 \`40\`，全聲母／字母聲母／傳統聲母／韻母亂序度 A/I/D/V \`8/5/3/1\`；按 21×26 原生四碼封頂、跨詞長聯合候選池與 \`soft-page-fill-v2\` 計分，方案專屬穩健結果為 CKT v5.1 \`9.082777229838413\`。

五輔語義保持「折橫撇豎點→\`AEUIO\`、一二三四輕→\`IEUAO\`」，按形義序觀察聲調仍為 \`42310\`。冰雪鶴道的二／三／四字詞形輔序為 \`12/12/24\`，冰雪鹤拼的調輔序為 \`12/21/13\`。

#### 英數入口

兩個 21×26 方案共用同一套字母入口。21 個輔音字母通常使用「字母原鍵 + \`n\`」，其中 \`D/J/X\` 分別使用 \`db/jm/xo\`；五個母音字母使用 \`x\` 載體。入口只借用已有漢字候選的占用桶，不消耗空碼；原漢字保持首選，大寫、小寫字母固定為第 2、3 候選。下表的「原首選」由目前凍結詞典與映射計算，完整稽核資料見[字母桶設定](config/shenyun-21x26-letter-buckets.json)。

${d3LetterTable(["字母", "輸入碼", "原首選"])}

三套 21×26 方案的 0～10 數字固頂別名均已啟用。優先重用對應漢字數字已有的最短固頂碼；沒有三碼以內固頂時，使用該字的主碼加第一形輔／調輔。已有漢字首選與字母第 2、3 位保持不變，數字追加在其後；不占用聲聲空桶。

${d3NumberTable(["數字", "冰雪鶴道", "冰雪鹤拼"])}

字母和數字均不侵占 \`ABA\` 的 \`21×5×21=2205\` 個狀態，既有 \`AAB\`、\`AAAB\` 路由也保持不變。

#### 聲韻編碼規則

聲母及零聲母載體使用下列首鍵：

${mappingTable(activeD3Layout.initialMap, ["聲母／載體", "首鍵"])}

韻母使用下列次鍵；\`v/van/ve/vn\` 表示 ü 系：

${mappingTable(activeD3Layout.finalMap, ["韻母", "次鍵"])}

- Common399 的 399 個音節全部擁有唯一雙拼碼；靜態 21×26 鍵域有 147 個空碼。按目前系統詞典的實際占用口徑執行時有 142 個 \`AU\` 空碼，其中 129 個為 \`AA\`、13 個為 \`AB\`。
- 單字主碼為 \`AU\`。繼續輸入聲母可進入 \`AUA/AAA\` 等詞語路由，輔碼只在相應階段追加；二／三／四字詞的方案專屬輔序以上文 \`12/12/24\` 與 \`12/21/13\` 為準。
- 冰雪鶴道的形輔鍵為 \`A/E/U/I/O = 折/橫/撇/豎/點\`；冰雪鹤拼的調輔鍵為 \`I/E/U/A/O = 一/二/三/四/輕\`。空碼補字只查詢系統詞典，不受個人詞頻影響。

**聲母—韻母映射**

![RC26-39a5bfdc045342cd 21×26 雙拼聲韻鍵盤圖](docs/shenyun-rc26-keyboard.svg)

**日常八場景文稿純雙拼鍵頻圖（含標點）**

![RC26-39a5bfdc045342cd 21×26 雙拼純雙拼鍵頻圖](docs/shenyun-rc26-keyboard-heat.svg)

鍵頻圖由 benchmark 頁面內建的 \`r9MacroHeat\` 從現行布局直接匯出，使用 2149 擊鍵的日常八場景文稿，只統計純雙拼與文稿標點，不含五輔鍵、空格及選重。

**十一場景 5500 字最佳路徑全按鍵鍵頻**



目前布局的實際按鍵與逐場景回放見下方 5500 字評測。

### UED-3158ce08b5bc 21×21 雙拼

冰雪兰道（\`snow_landao\`）與冰雪兰拼（\`snow_lanpin\`）現共用 [UED-3158ce08b5bc 21×21 布局](${qzSource})，倉庫標識為 \`UED-3158ce08b5bc\`。布局指標為 M-R2 \`41\`、全聲母／字母聲母／傳統聲母／韻母亂序度 A/I/D/V \`5/2/2/5\`；按傳統 21×21 原生路由與方案專屬穩健輔序計分，CKT v5.1 \`9.565504107623386\`。

五輔語義保持「折橫撇豎點→\`AVUIO\`、一二三四輕→\`IVUAO\`」，按形義序觀察聲調同為 \`42310\`。冰雪兰道的二／三／四字詞形輔序為 \`12/231/23\`，冰雪兰拼的調輔序為 \`12/213/23\`；三字詞保留完整三輔鍵路由。

#### 英數入口

冰雪兰道與冰雪兰拼共用字母基碼：21 個輔音字母使用「字母原鍵 + \`c\`」，五個母音使用 \`A=xw、I=xl、O=xd、U=xh、V=xg\`。冰雪兰道直接使用基碼，原漢字保持首選，大寫、小寫字母為第 2、3 候選；冰雪兰拼在基碼後追加輕聲鍵 \`o\`，大寫、小寫字母為第 1、2 候選。即使字母碼與真實音節重合，固定候選順序也保持不變。

數字與對應漢字共用碼位；存在漢字候選時數字追加在其後，不占用額外空碼。

${qzNumberTable(["數字", "冰雪兰道", "冰雪兰拼"])}

#### 聲韻編碼規則

聲母及零聲母載體使用下列首鍵：

${mappingTable(activeQzLayout.initialMap, ["聲母／載體", "首鍵"])}

韻母使用下列次鍵；\`v/van/ve/vn\` 表示 ü 系：

${mappingTable(activeQzLayout.finalMap, ["韻母", "次鍵"])}

- Common399 形成 351 個唯一碼和 48 個雙音節重碼桶，靜態鍵域有 90 個空碼；按目前系統詞典的實際占用口徑執行時有 87 個 \`AA\` 空碼，包含保留碼 \`qz\`、\`zq\`。
- 冰雪兰道使用形輔鍵 \`A/V/U/I/O = 折/橫/撇/豎/點\`，冰雪兰拼使用調輔鍵 \`I/V/U/A/O = 一/二/三/四/輕\`；\`j/q/x\` 後的 ü 系按 \`v/van/ve/vn\` 統一編碼。
- 兩個方案的 630 固頂區都完整覆蓋 630 個碼位且詞項不重複；大寫補韻、動態空桶和多字詞輔碼按各方案檔案中的現行規則執行。

**聲母—韻母映射**

![UED-3158ce08b5bc 21×21 雙拼聲韻鍵盤圖](docs/shenyun-ued-3158ce08b5bc-keyboard.svg)

**日常八場景文稿純雙拼鍵頻圖（含標點）**

![UED-3158ce08b5bc 21×21 雙拼純雙拼鍵頻圖](docs/shenyun-ued-3158ce08b5bc-keyboard-heat.svg)

鍵頻圖由 benchmark 頁面內建的 \`r9MacroHeat\` 從現行布局直接匯出，使用 2149 擊鍵的日常八場景文稿，只統計純雙拼與文稿標點，不含五輔鍵、空格及選重。

**十一場景 5500 字最佳路徑全按鍵鍵頻**



目前布局的實際按鍵與逐場景回放見下方 5500 字評測。

### 固頂、空桶與逐級簡碼

- 冰雪鶴道、冰雪鹤拼的現行 fixed 表各含 ${d3FirstCodes} 個一級簡碼、${d3TwoKeyCharacters} 個二碼單字、${d3TwoKeyWords} 個二簡詞和 26 個字母入口；二簡詞只占不與單字音節衝突的碼位，兩個方案沒有 630 區。
- 冰雪鶴道另有 ${d3ThreeKeyCharacters.toLocaleString("en-US")} 個三級單字固頂，冰雪鹮道另有 ${zhudaoThreeKeyCharacters.toLocaleString("en-US")} 個，均為兩碼主碼加第一形輔，與短碼固定單字不重複；參考四拼單字偏好，現有讀音權重只作兜底，見[選字原則](docs/fixed-candidates.md)。
- 冰雪兰道、冰雪兰拼以 ${qzTwoKeyCharacters} 個二碼單字和 ${qzTwoKeyWords} 個二簡詞完整覆蓋 441 個 \`AA\` 位置。兩方案的 630 區均由 ${qzTwoKeySixThirty} 個二碼位與 ${qzThreeKeySixThirty} 個三碼位組成，每碼固定一個不重複詞項。
- 冰雪兰道、冰雪兰拼及對應經典方案的大寫字母用於三字及以上簡拼補韻：前三字可寫成 \`A[U]A[U]A[U]\`，第四字起只取聲母；已有四個小寫聲母後，大寫字母恢復為下一字聲母。

### 現行雙拼與原鍵道 S005、首道 B04 benchmark

下表使用目前四份生產布局的凍結資料，並以原鍵道 S005、首道 B04 作為外部參照。

${zhtBenchmarkLegend}

${zhtBenchmark}

#### 完整測評報告

目前生產布局與外部基線的可複算比較見[目前布局比較報告](reports/shenyun-comparison.md)。


`;
	let replaced = markdown
		.replace(
			/^### RC26-39a5bfdc045342cd 21×26 双拼\n[\s\S]*?(?=^### 快捷键$)/mu,
			zh,
		)
		.replace(
			/^### RC26-39a5bfdc045342cd 21×26 double pinyin\n[\s\S]*?(?=^### Reports and audits$)/mu,
			en,
		)
		.replace(
			/^### RC26-39a5bfdc045342cd 21×26 雙拼\n[\s\S]*?(?=^### 研究報告與稽核資料$)/mu,
			zht,
		);
	for (const [layoutHeading, nextHeading, order] of [
		[
			"### RC26-39a5bfdc045342cd 21×26 双拼",
			"### UED-3158ce08b5bc 21×21 双拼",
			{
				letterHeading: "#### 英数入口",
				rulesHeading: "#### 声韵编码规则",
				mappingHeading: "**声母—韵母映射**",
				pureHeatHeading: "**日常八场景文稿纯双拼键频图（含标点）**",
				heatHeading: "**十一场景 5500 字最优路径全按键键频**",
			},
		],
		[
			"### UED-3158ce08b5bc 21×21 双拼",
			"### 固顶、空桶与逐级简码",
			{
				letterHeading: "#### 英数入口",
				rulesHeading: "#### 声韵编码规则",
				mappingHeading: "**声母—韵母映射**",
				pureHeatHeading: "**日常八场景文稿纯双拼键频图（含标点）**",
				heatHeading: "**十一场景 5500 字最优路径全按键键频**",
			},
		],
		[
			"### RC26-39a5bfdc045342cd 21×26 double pinyin",
			"### UED-3158ce08b5bc 21×21 double pinyin",
			{
				letterHeading: "#### Letter and number entry",
				rulesHeading: "#### Initial and final coding rules",
				mappingHeading: "**Initial–final mapping**",
				pureHeatHeading:
					"**Pure-double-pinyin key-frequency map over the daily eight-scenario corpus (punctuation included)**",
				heatHeading:
					"**Eleven-scenario optimal-path all-key frequency over 5,500 characters**",
			},
		],
		[
			"### UED-3158ce08b5bc 21×21 double pinyin",
			"### Fixed candidates, vacant buckets, and staged abbreviations",
			{
				letterHeading: "#### Letter and number entry",
				rulesHeading: "#### Initial and final coding rules",
				mappingHeading: "**Initial–final mapping**",
				pureHeatHeading:
					"**Pure-double-pinyin key-frequency map over the daily eight-scenario corpus (punctuation included)**",
				heatHeading:
					"**Eleven-scenario optimal-path all-key frequency over 5,500 characters**",
			},
		],
		[
			"### RC26-39a5bfdc045342cd 21×26 雙拼",
			"### UED-3158ce08b5bc 21×21 雙拼",
			{
				letterHeading: "#### 英數入口",
				rulesHeading: "#### 聲韻編碼規則",
				mappingHeading: "**聲母—韻母映射**",
				pureHeatHeading: "**日常八場景文稿純雙拼鍵頻圖（含標點）**",
				heatHeading: "**十一場景 5500 字最佳路徑全按鍵鍵頻**",
			},
		],
		[
			"### UED-3158ce08b5bc 21×21 雙拼",
			"### 固頂、空桶與逐級簡碼",
			{
				letterHeading: "#### 英數入口",
				rulesHeading: "#### 聲韻編碼規則",
				mappingHeading: "**聲母—韻母映射**",
				pureHeatHeading: "**日常八場景文稿純雙拼鍵頻圖（含標點）**",
				heatHeading: "**十一場景 5500 字最佳路徑全按鍵鍵頻**",
			},
		],
	] as const)
		replaced = reorderLayoutDocumentation(
			replaced,
			layoutHeading,
			nextHeading,
			order,
		);
	return replaced;
}

const file = rootPath("README.md");
const source = readFileSync(file, "utf8");
const output = finalizeReadme(
	replaceCurrentLayoutDocumentation(source, "github"),
).replaceAll("\r\n", "\n");
if (process.argv.includes("--check")) {
	if (output !== source) throw new Error("README.md 需要重新生成");
	console.log("README 校验通过。");
} else if (output !== source) writeFileSync(file, output, "utf8");
updateGiteeReadme(process.argv.includes("--check"));
