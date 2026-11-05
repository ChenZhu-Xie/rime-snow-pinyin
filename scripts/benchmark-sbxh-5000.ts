import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { exact500Articles } from "./exact_500_articles";
import {
	type BenchmarkAlternative,
	type BenchmarkPathResult,
	type BenchmarkToken,
	optimizeBenchmarkLine,
	preferredRankedCodes,
} from "./lib/benchmark-paths";
import type { RankedBenchmarkCode } from "./lib/benchmark-ranking";
import {
	benchmarkReplay,
	writeBenchmarkReplayCache,
} from "./lib/benchmark-replay";
import { ROOT } from "./lib/paths";
import { RimeCandidateOracle } from "./lib/rime-candidate-oracle";
import { sbxhIsPoppable, sbxhSupplementalStrokes } from "./lib/sbxh-benchmark";

type SourceKind = "一简" | "二简单字" | "二简词" | "630" | "普通码" | "次选";
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
	tokenRatios: Record<"c1" | "c2" | "c3" | "c4" | "c5plus", number>;
	charRatios: Record<"c1" | "c2" | "c3" | "c4" | "c5plus", number>;
	sources: Record<SourceKind, number>;
}

interface Proposal {
	word: string;
	code: string;
	source: SourceKind;
}

const sourceArgument = process.argv.indexOf("--source-dir");
const sourceDirectory = resolve(
	sourceArgument >= 0
		? (process.argv[sourceArgument + 1] ?? "")
		: join(process.env.APPDATA ?? "", "Rime"),
);
const sourceLabel = sourceArgument >= 0 ? "--source-dir" : "%APPDATA%/Rime";
if (!existsSync(join(sourceDirectory, "sbxh.schema.yaml")))
	throw new Error(`找不到声笔小鹤方案：${sourceDirectory}`);

const allLines = exact500Articles.flatMap((article) => article.lines);
const targetWords = new Set<string>();
for (const text of allLines) {
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

const reverseWords = [...targetWords].sort();
const reverseCodes = new Map<string, string[]>();
const reverseBinary = join(
	sourceDirectory,
	"build",
	"sbxh.extended.reverse.bin",
);
if (!existsSync(reverseBinary))
	throw new Error(`找不到声笔小鹤扩展反查词典：${reverseBinary}`);
const reverseCacheHash = new Bun.CryptoHasher("sha256")
	.update("sbxh-word-code-cache-v1\0")
	.update(readFileSync(reverseBinary))
	.update("\0")
	.update(reverseWords.join("\n"))
	.digest("hex");
const portableReverseCacheDirectory = join(
	ROOT,
	"output",
	"benchmark-sbxh-reverse-cache",
);
const portableReverseCache = join(
	portableReverseCacheDirectory,
	`${reverseCacheHash}.json`,
);

function loadPortableReverseCache(): boolean {
	if (!existsSync(portableReverseCache)) return false;
	const records = JSON.parse(
		readFileSync(portableReverseCache, "utf8"),
	) as Record<string, unknown>;
	for (const word of reverseWords) {
		const codes = records[word];
		if (
			Array.isArray(codes) &&
			codes.length > 0 &&
			codes.every(
				(code) => typeof code === "string" && /^[a-z]{4}$/u.test(code),
			)
		)
			reverseCodes.set(word, codes);
	}
	return reverseCodes.size > 0;
}

if (loadPortableReverseCache()) {
	console.log(`复用声笔小鹤词码缓存：外部反查词 ${reverseCodes.size} 个。`);
} else {
	const reverseOracle = new RimeCandidateOracle(["sbxh_reverse_benchmark"], {
		externalSbxhDirectory: sourceDirectory,
		externalSbxhReverseWords: reverseWords,
	});
	try {
		reverseOracle.selectSchema("sbxh_reverse_benchmark");
		for (const [index, word] of reverseWords.entries()) {
			const codes = reverseOracle.candidates(`w${index.toString(36)}`);
			if (codes.length > 0) reverseCodes.set(word, codes);
			const completed = index + 1;
			if (completed % 1000 === 0 || completed === reverseWords.length) {
				const cache = reverseOracle.cacheStats();
				console.log(
					`外部词典反查 ${completed}/${reverseWords.length}；缓存命中 ${cache.hits}，实际查询 ${cache.misses}。`,
				);
			}
		}
	} finally {
		reverseOracle.close();
	}
	if (reverseCodes.size === 0)
		throw new Error("声笔小鹤扩展反查部署没有返回任何标准码");
	mkdirSync(portableReverseCacheDirectory, { recursive: true });
	writeFileSync(
		portableReverseCache,
		`${JSON.stringify(Object.fromEntries(reverseCodes), null, 2)}\n`,
		"utf8",
	);
}

const strokes = new Map<string, string>();
for (const line of readFileSync(
	join(sourceDirectory, "lua", "sbxlm", "strokes.txt"),
	"utf8",
).split(/\r?\n/u)) {
	const [character, code] = line.split("\t");
	if (character && code) strokes.set(character, code);
}

function staticSource(word: string, code: string): SourceKind {
	const wordLength = [...word].length;
	if (wordLength === 1 && code.length === 1) return "一简";
	if (wordLength === 1 && code.length === 2) return "二简单字";
	if (wordLength === 2 && code.length === 2) return "二简词";
	if (wordLength === 2 && code.length === 3) return "630";
	return "普通码";
}

const proposals = new Map<string, Map<string, SourceKind>>();
function propose({ word, code, source }: Proposal): void {
	if (!targetWords.has(word) || !code) return;
	const words = proposals.get(code) ?? new Map<string, SourceKind>();
	const previous = words.get(word);
	const priority: Record<SourceKind, number> = {
		一简: 0,
		二简单字: 1,
		二简词: 2,
		"630": 3,
		普通码: 4,
		次选: 5,
	};
	if (!previous || priority[source] < priority[previous])
		words.set(word, source);
	proposals.set(code, words);
}

let staticRows = 0;
for (const line of readFileSync(
	join(sourceDirectory, "sbxh.dict.yaml"),
	"utf8",
).split(/\r?\n/u)) {
	if (!line.includes("\t") || line.startsWith("#")) continue;
	const [word, code] = line.split("\t");
	if (!word || !code || !targetWords.has(word)) continue;
	staticRows += 1;
	const source = staticSource(word, code);
	propose({ word, code, source });
	if (code.includes("'"))
		propose({ word, code: code.replaceAll("'", ""), source });
}

let reverseCodeHits = 0;
const standardChains = new Map<string, string[][]>();
for (const [word, codes] of reverseCodes) {
	const characterStrokes = [...word].map(
		(character) => strokes.get(character) ?? "",
	);
	for (const code of codes) {
		if (!/^[a-z]{4}$/u.test(code)) continue;
		reverseCodeHits += 1;
		const chain = [code];
		let extended = code;
		for (const stroke of sbxhSupplementalStrokes(characterStrokes)) {
			extended += stroke;
			chain.push(extended);
		}
		const chains = standardChains.get(word) ?? [];
		if (!chains.some((value) => value.join("\t") === chain.join("\t")))
			chains.push(chain);
		standardChains.set(word, chains);
	}
}

console.log(
	`声笔小鹤候选探针：赛文子串 ${targetWords.size}，外部反查词 ${reverseCodes.size}，反查四码 ${reverseCodeHits}，外部静态命中 ${staticRows}。`,
);

const ranked: RankedBenchmarkCode[] = [];
const sourceByWordCode = new Map<string, SourceKind>();
const queriedCodes = new Map<string, string[]>();
const firstLengthByWord = new Map<string, number>();
const oracle = new RimeCandidateOracle(["sbxh"], {
	externalSbxhDirectory: sourceDirectory,
});
try {
	oracle.selectSchema("sbxh");
	const candidates = (code: string): string[] => {
		const cached = queriedCodes.get(code);
		if (cached) return cached;
		const result = oracle.candidates(code);
		queriedCodes.set(code, result);
		if (queriedCodes.size % 500 === 0) {
			const cache = oracle.cacheStats();
			console.log(
				`候选查询 ${queriedCodes.size}；缓存命中 ${cache.hits}，实际查询 ${cache.misses}。`,
			);
		}
		return result;
	};
	for (const [code, words] of proposals) {
		const values = candidates(code);
		for (const [word, source] of words) {
			const rank = values.indexOf(word) + 1;
			if (rank < 1 || rank > 6) continue;
			ranked.push({ word, code, rank });
			sourceByWordCode.set(`${word}\t${code}`, source);
			if (rank === 1)
				firstLengthByWord.set(
					word,
					Math.min(firstLengthByWord.get(word) ?? Infinity, code.length),
				);
		}
	}
	for (const [word, chains] of standardChains) {
		const maximumLength = Math.max(...chains.map((chain) => chain.length + 3));
		for (let length = 4; length <= maximumLength; length += 1) {
			if (length > (firstLengthByWord.get(word) ?? Infinity)) break;
			let firstAtLength = false;
			const codesAtLength = new Set(
				chains
					.map((chain) => chain[length - 4])
					.filter((code): code is string => code !== undefined),
			);
			for (const code of codesAtLength) {
				const rank = candidates(code).indexOf(word) + 1;
				if (rank < 1 || rank > 6) continue;
				ranked.push({ word, code, rank });
				sourceByWordCode.set(`${word}\t${code}`, "普通码");
				if (rank === 1) firstAtLength = true;
			}
			if (firstAtLength) {
				firstLengthByWord.set(word, length);
				break;
			}
		}
	}
	const cache = oracle.cacheStats();
	console.log(
		`候选查询完成：去重编码 ${queriedCodes.size}；缓存命中 ${cache.hits}，实际查询 ${cache.misses}。`,
	);
} finally {
	oracle.close();
}

const alternatives = new Map<string, Alternative[]>();
const selectionKeys = ["", "", "2", "3", "7", "8", "9"];
for (const item of preferredRankedCodes(ranked, 6)) {
	const originalSource =
		sourceByWordCode.get(`${item.word}\t${item.code}`) ?? "普通码";
	const source = item.rank === 1 ? originalSource : "次选";
	const values = alternatives.get(item.word) ?? [];
	values.push({
		word: item.word,
		displayCode:
			item.code + (item.rank > 1 ? `[${selectionKeys[item.rank]}]` : ""),
		rawCode: item.code,
		keyCost: item.code.length + Number(item.rank > 1),
		instant: false,
		popppable: sbxhIsPoppable(item.code),
		source,
		shift: 0,
		selectionCount: Number(item.rank > 1),
	});
	values.sort(
		(a, b) =>
			a.selectionCount - b.selectionCount ||
			a.keyCost - b.keyCost ||
			a.rawCode.localeCompare(b.rawCode),
	);
	alternatives.set(item.word, values);
}

const missingCharacters = [...targetWords]
	.filter((word) => [...word].length === 1 && !alternatives.has(word))
	.sort();
if (missingCharacters.length > 0)
	throw new Error(
		`声笔小鹤没有可用打法的赛文单字：${missingCharacters.join("")}`,
	);

function analyzePaths(
	article: (typeof exact500Articles)[0],
	paths: PathResult[],
): ArticleStat {
	const allTokens = paths.flatMap((path) => path.tokens);
	const hanTokens = allTokens.filter((token) =>
		/^\p{Script=Han}+$/u.test(token.word),
	);
	const punctTokens = allTokens.filter(
		(token) => !/^\p{Script=Han}+$/u.test(token.word),
	);
	const tokenCounts = { c1: 0, c2: 0, c3: 0, c4: 0, c5plus: 0, total: 0 };
	const charCounts = { c1: 0, c2: 0, c3: 0, c4: 0, c5plus: 0, total: 0 };
	const sources: Record<SourceKind, number> = {
		一简: 0,
		二简单字: 0,
		二简词: 0,
		"630": 0,
		普通码: 0,
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
	charCounts.total = Object.entries(charCounts)
		.filter(([field]) => field !== "total")
		.reduce((sum, [, count]) => sum + count, 0);
	const keys = paths.reduce((sum, path) => sum + path.keys, 0);
	const ratios = (counts: typeof tokenCounts) => ({
		c1: (counts.c1 / counts.total) * 100,
		c2: (counts.c2 / counts.total) * 100,
		c3: (counts.c3 / counts.total) * 100,
		c4: (counts.c4 / counts.total) * 100,
		c5plus: (counts.c5plus / counts.total) * 100,
	});
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
		tokenRatios: ratios(tokenCounts),
		charRatios: ratios(charCounts),
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

function replayTokens(path: PathResult) {
	return path.tokens.map((token) => ({
		start: token.start,
		end: token.end,
		word: token.word,
		code: token.displayCode + (token.separator ? "_" : ""),
	}));
}

function renderAligned(
	text: string,
	tokens: ReturnType<typeof replayTokens>,
): string {
	const characters = [...text];
	const positions = new Array<number>(characters.length + 1).fill(0);
	for (let index = 0; index < characters.length; index += 1)
		positions[index + 1] = positions[index] + width(characters[index]) + 1;
	for (let index = 0; index + 1 < tokens.length; index += 1) {
		const left = tokens[index];
		const right = tokens[index + 1];
		const required = positions[left.start] + width(left.code) + 1;
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
		`声笔小鹤　 ${place(tokens.map((token) => ({ start: token.start, text: token.code })))}`,
	].join("\n");
}

const articleResults = exact500Articles.map((article) => {
	const paths = article.lines.map((line) =>
		optimizeBenchmarkLine(line, alternatives),
	);
	return { article, paths, stat: analyzePaths(article, paths) };
});
const selectionAudit = articleResults.flatMap(({ article, paths }) =>
	paths.flatMap((path) =>
		path.tokens
			.filter((token) => token.selectionCount > 0)
			.map((token) => ({
				article: article.id,
				word: token.word,
				code: token.displayCode,
			})),
	),
);

const replayDirectory = join(
	ROOT,
	"reports",
	"十篇五百字_声笔小鹤逐键对齐回放",
);
mkdirSync(replayDirectory, { recursive: true });
for (const result of articleResults) {
	const lines = [
		`# 篇 ${String(result.article.id).padStart(2, "0")}：${result.article.title}（${result.article.genre}·500 字）声笔小鹤实战回放`,
		"",
		`- 总按键：**${result.stat.keys}**；平均码长：**${result.stat.avgLength.toFixed(4)}**；Space：${result.stat.spaces}；选重：${result.stat.selectionCount}。`,
		"- `_` 表示 Space；候选来自声笔小鹤自己的空白 user dict 部署。",
		"",
		"```text",
	];
	result.article.lines.forEach((text, index) => {
		lines.push(`[${String(index + 1).padStart(2, "0")}]`);
		lines.push(renderAligned(text, replayTokens(result.paths[index])));
		lines.push("");
	});
	lines.push("```");
	writeFileSync(
		join(
			replayDirectory,
			`篇${String(result.article.id).padStart(2, "0")}_${result.article.genre}_500字_声笔小鹤逐键对齐.md`,
		),
		lines.join("\n"),
		"utf8",
	);
}

const aggregate = {
	keys: articleResults.reduce((sum, result) => sum + result.stat.keys, 0),
	spaces: articleResults.reduce((sum, result) => sum + result.stat.spaces, 0),
	shifts: articleResults.reduce((sum, result) => sum + result.stat.shifts, 0),
	selections: articleResults.reduce(
		(sum, result) => sum + result.stat.selectionCount,
		0,
	),
	tokens: Object.fromEntries(
		["c1", "c2", "c3", "c4", "c5plus"].map((field) => [
			field,
			articleResults.reduce(
				(sum, result) =>
					sum +
					result.stat.tokenCounts[
						field as keyof typeof result.stat.tokenCounts
					],
				0,
			),
		]),
	),
	characters: Object.fromEntries(
		["c1", "c2", "c3", "c4", "c5plus"].map((field) => [
			field,
			articleResults.reduce(
				(sum, result) =>
					sum +
					result.stat.charCounts[field as keyof typeof result.stat.charCounts],
				0,
			),
		]),
	),
	sources: Object.fromEntries(
		["一简", "二简单字", "二简词", "630", "普通码", "次选"].map((source) => [
			source,
			articleResults.reduce(
				(sum, result) => sum + result.stat.sources[source as SourceKind],
				0,
			),
		]),
	),
};

const eightPath = join(ROOT, "reports", "5000字_八方案最优切分实测结果.json");
const eight = JSON.parse(readFileSync(eightPath, "utf8")) as {
	contract: string;
	schemes: Record<
		string,
		{
			name: string;
			total: { keys: number };
			articles: Array<{ keys: number }>;
		}
	>;
};
const sbxhResult = {
	name: "声笔小鹤",
	capacity: "声笔小鹤双拼＋笔画",
	auxiliaryMode: "笔画",
	auxiliaryOrder:
		"单字第三笔起；二字首字前二笔+末字前四笔；三字以上前三字各前二笔",
	externalSource: sourceLabel,
	staticRows,
	reverseWords: reverseWords.length,
	reverseWordHits: reverseCodes.size,
	reverseCodeHits,
	proposalCodes: queriedCodes.size,
	total: aggregate,
	articles: articleResults.map((result) => result.stat),
};
const resultContract =
	"current-nine-scheme-benchmark-v5-external-sbxh-rime-oracle";
writeBenchmarkReplayCache(
	join(ROOT, "output", "benchmark-replays", "sbxh.json"),
	{
		contract: resultContract,
		schemes: {
			sbxh: articleResults.map((result) => result.paths.map(benchmarkReplay)),
		},
	},
);
writeFileSync(
	join(ROOT, "reports", "5000字_九方案最优切分实测结果.json"),
	`${JSON.stringify(
		{
			contract: resultContract,
			baseline: eight.contract,
			schemes: { ...eight.schemes, sbxh: sbxhResult },
		},
		null,
		2,
	)}\n`,
	"utf8",
);

const ranking = [
	...Object.entries(eight.schemes).map(([id, value]) => ({
		id,
		name: value.name,
		keys: value.total.keys,
	})),
	{ id: "sbxh", name: "声笔小鹤", keys: aggregate.keys },
].sort((a, b) => a.keys - b.keys);

const report = [
	"# 十篇五百字（5000 字全语料）：九方案最优切分实战测评",
	"",
	"> 本报告在原八方案同一赛文、同一按键计数和同一“先最少选重、再最少按键”基线上加入外部声笔小鹤。声笔小鹤的可用词、标准码、静态简码、笔画补码和候选排名均来自其自己的发布文件及空白 user dict 真实部署。",
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
	"## 声笔小鹤合同与结果",
	"",
	`- 总按键 **${aggregate.keys}**，平均码长 **${(aggregate.keys / 5000).toFixed(4)}**，Space ${aggregate.spaces}，Shift ${aggregate.shifts}，选重 ${aggregate.selections}。`,
	`- 共枚举赛文连续汉字子串 ${reverseWords.length} 个；外部词典反查命中 ${reverseCodes.size} 个词、${reverseCodeHits} 个四码；外部静态简码命中 ${staticRows} 条；按“到达首选即截断”逐级查询 ${queriedCodes.size} 个去重编码。`,
	"- 单字四码基码为双拼加前两笔，之后可继续补其余全部笔画；二字词四码主码为 `AaAbBaBb`，随后补首字前两笔与末字前四笔；三字词为 `AaBaCaCb`、四字及以上为 `AaBaCaZa`，随后补前三字各前两笔。Lua 自动码长翻译器允许这些标准码超过六码。",
	"- 一码、二码以及二字三码简词均只读取外部 `sbxh.dict.yaml`。其中单字三码是双拼加首笔的标准声笔码；二字三码按本报告归入“630 类”，但仍是方案发布的有理静态简词。",
	"- 大写辅码与小写辅码候选等价却多一个 Shift，受按键目标支配；大写声母用于跨码顶屏时与 `Space + 小写声母` 同为两键，不能减少选重或总按键，因此最优路径中 Shift 为 0。",
	"- 任何候选只有在真实空白部署中成为首选才可免选重；只有完全不存在首选打法时，才保留首页第 2～6 候选的一键 `2/3/7/8/9` 选重兜底。未引入无理码。",
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
	"### 简码与来源使用量",
	"",
	"| 来源 | 使用段数 |",
	"| --- | ---: |",
	...Object.entries(aggregate.sources).map(
		([source, count]) => `| ${source} | ${count} |`,
	),
	"",
	"## 分文体结果",
	"",
	"| 篇号 | 文体 | 声笔小鹤按键 | 均码 | Space | 选重 | 回放 |",
	"| ---: | --- | ---: | ---: | ---: | ---: | --- |",
	...articleResults.map(
		({ article, stat }) =>
			`| P${article.id} | ${article.genre} | ${stat.keys} | ${stat.avgLength.toFixed(4)} | ${stat.spaces} | ${stat.selectionCount} | [查看](./十篇五百字_声笔小鹤逐键对齐回放/篇${String(article.id).padStart(2, "0")}_${article.genre}_500字_声笔小鹤逐键对齐.md) |`,
	),
	"",
	"## 字词切分",
	"",
	"| 维度 | 单字 | 二字 | 三字 | 四字 | 五字及以上 |",
	"| --- | ---: | ---: | ---: | ---: | ---: |",
	`| 词次 | ${aggregate.tokens.c1} | ${aggregate.tokens.c2} | ${aggregate.tokens.c3} | ${aggregate.tokens.c4} | ${aggregate.tokens.c5plus} |`,
	`| 汉字覆盖 | ${aggregate.characters.c1} | ${aggregate.characters.c2} | ${aggregate.characters.c3} | ${aggregate.characters.c4} | ${aggregate.characters.c5plus} |`,
	"",
	"## 可复现性",
	"",
	`- 外部来源：\`${sourceLabel}\`；只复制方案发布文件、Lua 与必需编译词典到一次性目录，明确排除 \`*.userdb\`、\`user.yaml\`、\`installation.yaml\` 和 \`*.custom.yaml\`。`,
	"- 赛文子串先通过声笔小鹤自己的 `sbxh.extended.reverse.bin` 枚举标准四码，再按其 Lua 合同逐级追加全部合法笔画补码，直至首选即截断；没有借用冰雪词典的词条或读音。",
	"- 每个编码由内容指纹缓存；外部方案文件、必需编译词典或 Rime DLL 任一变化都会自动切换缓存目录。",
	"- 逐键回放中的 `_` 表示 Space；标点计一键。",
];
writeFileSync(
	join(ROOT, "reports", "十篇五百字_九方案最优切分及字词比率报告.md"),
	report.join("\n"),
	"utf8",
);

console.log(
	`声笔小鹤 5000 字完成：${aggregate.keys} 键，均码 ${(aggregate.keys / 5000).toFixed(4)}，选重 ${aggregate.selections}。`,
);
