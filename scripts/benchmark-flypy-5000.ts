import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { exact500Articles } from "./exact_500_articles";
import {
	type BenchmarkAlternative,
	type BenchmarkPathResult,
	type BenchmarkToken,
	optimizeBenchmarkLine,
} from "./lib/benchmark-paths";
import {
	type FlypyRankedCode,
	parseFlypyCodetable,
	parseFlypyWdatDump,
	preferredFlypyCodes,
	rankFlypyEntries,
} from "./lib/flypy-benchmark";
import { ROOT } from "./lib/paths";

type SourceKind = "一简" | "二简" | "三简" | "全码" | "超四码" | "次选";
type Alternative = BenchmarkAlternative<SourceKind>;
type Token = BenchmarkToken<SourceKind>;
type PathResult = BenchmarkPathResult<SourceKind>;

interface ArticleStat {
	id: number;
	title: string;
	genre: string;
	hanCount: number;
	punctCount: number;
	keys: number;
	avgLength: number;
	spaces: number;
	shifts: number;
	selectionCount: number;
	tokenCounts: Record<"c1" | "c2" | "c3" | "c4" | "c5plus" | "total", number>;
	charCounts: Record<"c1" | "c2" | "c3" | "c4" | "c5plus" | "total", number>;
	sources: Record<SourceKind, number>;
}

function argument(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

const knownSourceDirectories = [
	"F:\\Input_method\\清风小鹤便携版v1.26.7a\\WindInput\\data_custom",
	join(process.env.LOCALAPPDATA ?? "", "WindInput", "data_custom"),
];
const sourceDirectory = resolve(
	argument("--source-dir") ??
		knownSourceDirectories.find((value) =>
			existsSync(join(value, "schemas", "flypy.schema.toml")),
		) ??
		"",
);
const wdatDump = resolve(
	argument("--wdat-dump") ??
		"D:\\C2D\\Temp\\WindInput-v0.130.1\\wind_input\\target\\release\\examples\\wdat_dump.exe",
);
const schemaPath = join(sourceDirectory, "schemas", "flypy.schema.toml");
const mainWdat = join(sourceDirectory, "schemas", "flypy", "00_xh.wdat");
if (!existsSync(schemaPath) || !existsSync(mainWdat))
	throw new Error(`找不到小鹤音形清风方案：${sourceDirectory}`);
if (!existsSync(wdatDump)) throw new Error(`找不到官方 wdat_dump：${wdatDump}`);

const corpusText = exact500Articles.flatMap(({ lines }) => lines).join("\n");
const targetWords = new Set<string>();
for (const text of exact500Articles.flatMap(({ lines }) => lines)) {
	const characters = [...text];
	for (let start = 0; start < characters.length; start += 1) {
		if (!/\p{Script=Han}/u.test(characters[start])) continue;
		for (
			let length = 1;
			length <= 12 && start + length <= characters.length;
			length += 1
		) {
			const word = characters.slice(start, start + length).join("");
			if (!/^\p{Script=Han}+$/u.test(word)) break;
			targetWords.add(word);
		}
	}
}

const extraLayers = [
	{ file: "11_fl.dict.yaml", id: "fl", baseOrder: 1, defaultWeight: 6500 },
	{ file: "21_yj.dict.yaml", id: "yj", baseOrder: 2, defaultWeight: 6000 },
	{ file: "31_vt.dict.yaml", id: "vt", baseOrder: 4, defaultWeight: 5500 },
	{ file: "32_yh.dict.yaml", id: "yh", baseOrder: 5, defaultWeight: 5000 },
	{ file: "41_fh.dict.yaml", id: "fh", baseOrder: 6, defaultWeight: 4500 },
	{ file: "61_ok.dict.yaml", id: "ok", baseOrder: 10 },
] as const;
const sourceFiles = [
	schemaPath,
	mainWdat,
	...extraLayers.map(({ file }) =>
		join(sourceDirectory, "schemas", "flypy", file),
	),
];
for (const path of sourceFiles) {
	if (!existsSync(path)) throw new Error(`小鹤音形发布文件缺失：${path}`);
}

const cacheContract = "flypy-windinput-benchmark-v1";
const sourceHash = new Bun.CryptoHasher("sha256")
	.update(cacheContract)
	.update("\0")
	.update(corpusText);
for (const path of sourceFiles)
	sourceHash.update("\0").update(basename(path)).update(readFileSync(path));
const cacheId = sourceHash.digest("hex");
const cacheDirectory = join(ROOT, "output", "benchmark-flypy-cache");
const cachePath = join(cacheDirectory, `${cacheId}.json`);
let ranked: FlypyRankedCode[];
let entryCount = 0;
if (existsSync(cachePath)) {
	const cache = JSON.parse(readFileSync(cachePath, "utf8")) as {
		contract: string;
		entryCount: number;
		ranked: FlypyRankedCode[];
	};
	if (cache.contract !== cacheContract)
		throw new Error(`小鹤音形缓存合同不匹配：${cache.contract}`);
	ranked = cache.ranked;
	entryCount = cache.entryCount;
	console.log(`复用小鹤音形缓存：${cachePath}`);
} else {
	const dumped = Bun.spawnSync({
		cmd: [wdatDump, mainWdat],
		stdout: "pipe",
		stderr: "pipe",
	});
	if (dumped.exitCode !== 0)
		throw new Error(
			`官方 wdat_dump 失败：${new TextDecoder().decode(dumped.stderr)}`,
		);
	const entries = parseFlypyWdatDump(new TextDecoder().decode(dumped.stdout), {
		id: "xh",
		baseOrder: 0,
		defaultWeight: 7000,
	});
	for (const layer of extraLayers) {
		entries.push(
			...parseFlypyCodetable(
				readFileSync(
					join(sourceDirectory, "schemas", "flypy", layer.file),
					"utf8",
				),
				layer,
			),
		);
	}
	entryCount = entries.length;
	ranked = rankFlypyEntries(entries, targetWords);
	mkdirSync(cacheDirectory, { recursive: true });
	writeFileSync(
		cachePath,
		`${JSON.stringify({ contract: cacheContract, entryCount, ranked })}\n`,
		"utf8",
	);
	console.log(`写入小鹤音形缓存：${cachePath}`);
}

function sourceKind(word: string, code: string): SourceKind {
	if (code.length === 1) return "一简";
	if (code.length === 2) return "二简";
	if (code.length === 3) return "三简";
	if (code.length === 4) return "全码";
	return "超四码";
}

const alternatives = new Map<string, Alternative[]>();
for (const item of preferredFlypyCodes(ranked)) {
	const values = alternatives.get(item.word) ?? [];
	values.push({
		word: item.word,
		displayCode: item.code + (item.rank > 1 ? `[候选${item.rank}]` : ""),
		rawCode: item.code,
		keyCost: item.code.length + Number(item.rank > 1),
		instant: item.rank > 1 || item.instant,
		popppable: item.rank === 1 && item.popppable,
		source: item.rank > 1 ? "次选" : sourceKind(item.word, item.code),
		shift: 0,
		selectionCount: Number(item.rank > 1),
	});
	values.sort(
		(left, right) =>
			left.selectionCount - right.selectionCount ||
			left.keyCost - right.keyCost ||
			left.rawCode.localeCompare(right.rawCode),
	);
	alternatives.set(item.word, values);
}

const missingCharacters = [...targetWords]
	.filter((word) => [...word].length === 1 && !alternatives.has(word))
	.sort();
if (missingCharacters.length > 0)
	throw new Error(
		`小鹤音形没有可用打法的赛文单字：${missingCharacters.join("")}`,
	);

function analyzePaths(
	article: (typeof exact500Articles)[0],
	paths: PathResult[],
): ArticleStat {
	const allTokens = paths.flatMap(({ tokens }) => tokens);
	const hanTokens = allTokens.filter(({ word }) =>
		/^\p{Script=Han}+$/u.test(word),
	);
	const punctTokens = allTokens.filter(
		({ word }) => !/^\p{Script=Han}+$/u.test(word),
	);
	const tokenCounts = { c1: 0, c2: 0, c3: 0, c4: 0, c5plus: 0, total: 0 };
	const charCounts = { c1: 0, c2: 0, c3: 0, c4: 0, c5plus: 0, total: 0 };
	const sources: Record<SourceKind, number> = {
		一简: 0,
		二简: 0,
		三简: 0,
		全码: 0,
		超四码: 0,
		次选: 0,
	};
	for (const token of hanTokens) {
		const length = [...token.word].length;
		const field =
			length === 1
				? "c1"
				: length === 2
					? "c2"
					: length === 3
						? "c3"
						: length === 4
							? "c4"
							: "c5plus";
		tokenCounts[field] += 1;
		charCounts[field] += length;
		sources[token.source] += 1;
	}
	tokenCounts.total = hanTokens.length;
	charCounts.total =
		charCounts.c1 +
		charCounts.c2 +
		charCounts.c3 +
		charCounts.c4 +
		charCounts.c5plus;
	const keys = paths.reduce((sum, path) => sum + path.keys, 0);
	return {
		id: article.id,
		title: article.title,
		genre: article.genre,
		hanCount: charCounts.total,
		punctCount: punctTokens.length,
		keys,
		avgLength: keys / charCounts.total,
		spaces: paths.reduce((sum, path) => sum + path.spaces, 0),
		shifts: paths.reduce((sum, path) => sum + path.shifts, 0),
		selectionCount: paths.reduce((sum, path) => sum + path.selectionCount, 0),
		tokenCounts,
		charCounts,
		sources,
	};
}

function width(text: string): number {
	return [...text].reduce(
		(sum, character) =>
			sum +
			Number(
				/\p{Script=Han}|[，。；：！？、“”‘’（）《》【】]/u.test(character),
			) +
			1,
		0,
	);
}

function renderAligned(text: string, tokens: Token[]): string {
	const characters = [...text];
	const positions = new Array<number>(characters.length + 1).fill(0);
	for (let index = 0; index < characters.length; index += 1)
		positions[index + 1] = positions[index] + width(characters[index]) + 1;
	const displayed = tokens.map((token) => ({
		start: token.start,
		text: token.displayCode + (token.separator ? "_" : ""),
	}));
	for (let index = 0; index + 1 < displayed.length; index += 1) {
		const left = displayed[index];
		const right = displayed[index + 1];
		const required = positions[left.start] + width(left.text) + 1;
		if (positions[right.start] >= required) continue;
		const delta = required - positions[right.start];
		for (let offset = right.start; offset < positions.length; offset += 1)
			positions[offset] += delta;
	}
	const place = (items: Array<{ start: number; text: string }>) => {
		let output = "";
		let cursor = 0;
		for (const item of items) {
			output += " ".repeat(Math.max(0, positions[item.start] - cursor));
			output += item.text;
			cursor = positions[item.start] + width(item.text);
		}
		return output;
	};
	return [
		`原文       ${place(characters.map((text, start) => ({ start, text })))}`,
		`小鹤音形　 ${place(displayed)}`,
	].join("\n");
}

const articleResults = exact500Articles.map((article) => {
	const paths = article.lines.map((line) =>
		optimizeBenchmarkLine(line, alternatives),
	);
	return { article, paths, stat: analyzePaths(article, paths) };
});
const selectionAudit = articleResults.flatMap(({ article, paths }) =>
	paths.flatMap(({ tokens }) =>
		tokens
			.filter(({ selectionCount }) => selectionCount > 0)
			.map(({ word, displayCode }) => ({
				article: article.id,
				word,
				code: displayCode,
			})),
	),
);

const replayDirectory = join(
	ROOT,
	"reports",
	"十篇五百字_小鹤音形逐键对齐回放",
);
mkdirSync(replayDirectory, { recursive: true });
for (const { article, paths, stat } of articleResults) {
	const lines = [
		`# 篇 ${String(article.id).padStart(2, "0")}：${article.title}（${article.genre}·500 字）小鹤音形实战回放`,
		"",
		`- 总按键：**${stat.keys}**；平均码长：**${stat.avgLength.toFixed(4)}**；Space：${stat.spaces}；选重：${stat.selectionCount}。`,
		"- `_` 表示 Space；候选来自小鹤音形 v1.26.11b 的默认静态词库与空白用户数据。",
		"",
		"```text",
	];
	article.lines.forEach((text, index) => {
		lines.push(`[${String(index + 1).padStart(2, "0")}]`);
		lines.push(renderAligned(text, paths[index].tokens));
		lines.push("");
	});
	lines.push("```");
	writeFileSync(
		join(
			replayDirectory,
			`篇${String(article.id).padStart(2, "0")}_${article.genre}_500字_小鹤音形逐键对齐.md`,
		),
		lines.join("\n"),
		"utf8",
	);
}

const sourceNames: SourceKind[] = [
	"一简",
	"二简",
	"三简",
	"全码",
	"超四码",
	"次选",
];
const aggregate = {
	keys: articleResults.reduce((sum, { stat }) => sum + stat.keys, 0),
	spaces: articleResults.reduce((sum, { stat }) => sum + stat.spaces, 0),
	shifts: articleResults.reduce((sum, { stat }) => sum + stat.shifts, 0),
	selections: articleResults.reduce(
		(sum, { stat }) => sum + stat.selectionCount,
		0,
	),
	tokens: Object.fromEntries(
		["c1", "c2", "c3", "c4", "c5plus"].map((field) => [
			field,
			articleResults.reduce(
				(sum, { stat }) =>
					sum + stat.tokenCounts[field as keyof typeof stat.tokenCounts],
				0,
			),
		]),
	),
	characters: Object.fromEntries(
		["c1", "c2", "c3", "c4", "c5plus"].map((field) => [
			field,
			articleResults.reduce(
				(sum, { stat }) =>
					sum + stat.charCounts[field as keyof typeof stat.charCounts],
				0,
			),
		]),
	),
	sources: Object.fromEntries(
		sourceNames.map((source) => [
			source,
			articleResults.reduce((sum, { stat }) => sum + stat.sources[source], 0),
		]),
	),
};

const ninePath = join(ROOT, "reports", "5000字_九方案最优切分实测结果.json");
const nine = JSON.parse(readFileSync(ninePath, "utf8")) as {
	contract: string;
	schemes: Record<
		string,
		{ name: string; total: { keys: number }; articles: Array<{ keys: number }> }
	>;
};
const flypyResult = {
	name: "小鹤音形",
	version: "v1.26.11b / WindInput 0.130.1",
	externalSource: sourceDirectory,
	sourceHash: cacheId,
	cache: cachePath,
	entryCount,
	targetWords: targetWords.size,
	rankedCodes: ranked.length,
	total: aggregate,
	articles: articleResults.map(({ stat }) => stat),
};
writeFileSync(
	join(ROOT, "reports", "5000字_十方案最优切分实测结果.json"),
	`${JSON.stringify(
		{
			contract: "current-ten-scheme-benchmark-v1-windinput-flypy",
			baseline: nine.contract,
			schemes: { ...nine.schemes, flypy: flypyResult },
		},
		null,
		2,
	)}\n`,
	"utf8",
);

const ranking = [
	...Object.entries(nine.schemes).map(([id, value]) => ({
		id,
		name: value.name,
		keys: value.total.keys,
	})),
	{ id: "flypy", name: "小鹤音形", keys: aggregate.keys },
].sort((left, right) => left.keys - right.keys);
const report = [
	"# 十篇五百字（5000 字全语料）：十方案最优切分实战测评",
	"",
	"> 本报告在九方案同一赛文、同一按键计数和同一“先最少选重、再最少总按键”基线上加入小鹤音形。小鹤音形完全使用清风便携版 v1.26.11b 的静态发布词库、空白用户数据与官方候选顺序。",
	"",
	"## 总排名",
	"",
	"| 排名 | 方案 | 总按键 | 平均码长 | 相对第一名 |",
	"| ---: | --- | ---: | ---: | ---: |",
	...ranking.map(
		(item, index) =>
			`| ${index + 1} | ${item.name} | ${item.keys} | ${(item.keys / 5000).toFixed(4)} | +${item.keys - ranking[0].keys} |`,
	),
	"",
	"## 小鹤音形合同与结果",
	"",
	`- 总按键 **${aggregate.keys}**，平均码长 **${(aggregate.keys / 5000).toFixed(4)}**，Space ${aggregate.spaces}，Shift ${aggregate.shifts}，选重 ${aggregate.selections}。`,
	`- 方案版本 **v1.26.11b**，清风版本 **0.130.1**；共读取默认启用静态码表 ${entryCount} 条，对 ${targetWords.size} 个赛文连续汉字子串得到 ${ranked.length} 条实际词码。`,
	"- 主库由同版本 WindInput 官方 `wdat_dump` 读取；候选按 `weight` 降序、`base_order` 升序、词库出现序升序合并。未使用个人 `userdata`、调频、自动造词、整句或第三方 Rime 小鹤词库。",
	"- 四码唯一候选且无更长后继时按清风满码规则自动上屏；其余四码可由下一词首键顶屏。一码、二码、三码按正常简码计 Space。超四码以发布词库中的真实编码为准。",
	"- 某字词只要存在首选打法，就排除其所有二至五选短码；仅完全没有首选打法时才允许首页一键选重兜底。",
	"",
	"### 选重兜底审计",
	"",
	...(selectionAudit.length > 0
		? [
				"| 篇号 | 字词 | 最短兜底打法 |",
				"| ---: | --- | --- |",
				...selectionAudit.map(
					(item) => `| P${item.article} | ${item.word} | \`${item.code}\` |`,
				),
			]
		: ["- 本轮所有采用的字词均存在首选有理打法，无选重兜底。"]),
	"",
	"### 编码来源使用量",
	"",
	"| 来源 | 使用段数 |",
	"| --- | ---: |",
	...Object.entries(aggregate.sources).map(
		([source, count]) => `| ${source} | ${count} |`,
	),
	"",
	"## 分文体结果",
	"",
	"| 篇号 | 文体 | 小鹤音形按键 | 均码 | Space | 选重 | 回放 |",
	"| ---: | --- | ---: | ---: | ---: | ---: | --- |",
	...articleResults.map(
		({ article, stat }) =>
			`| P${article.id} | ${article.genre} | ${stat.keys} | ${stat.avgLength.toFixed(4)} | ${stat.spaces} | ${stat.selectionCount} | [查看](./十篇五百字_小鹤音形逐键对齐回放/篇${String(article.id).padStart(2, "0")}_${article.genre}_500字_小鹤音形逐键对齐.md) |`,
	),
	"",
	"## 字词切分",
	"",
	"| 维度 | 单字 | 二字 | 三字 | 四字 | 五字及以上 |",
	"| --- | ---: | ---: | ---: | ---: | ---: |",
	`| 词次 | ${aggregate.tokens.c1} | ${aggregate.tokens.c2} | ${aggregate.tokens.c3} | ${aggregate.tokens.c4} | ${aggregate.tokens.c5plus} |`,
	`| 汉字覆盖 | ${aggregate.characters.c1} | ${aggregate.characters.c2} | ${aggregate.characters.c3} | ${aggregate.characters.c4} | ${aggregate.characters.c5plus} |`,
	"",
	"## 可复现性与缓存",
	"",
	`- 源目录：\`${sourceDirectory}\`；源文件与赛文联合 SHA-256：\`${cacheId}\`。`,
	`- 可复用缓存：\`${cachePath}\`。仅当十篇赛文、方案 TOML、主库 wdat、默认启用附加词库和解析合同全部不变时命中。`,
	"- 逐键回放中的 `_` 表示 Space；标点计一键。",
];
writeFileSync(
	join(ROOT, "reports", "十篇五百字_十方案最优切分及字词比率报告.md"),
	report.join("\n"),
	"utf8",
);

console.log(
	`小鹤音形 5000 字完成：${aggregate.keys} 键，均码 ${(aggregate.keys / 5000).toFixed(4)}，选重 ${aggregate.selections}。`,
);
