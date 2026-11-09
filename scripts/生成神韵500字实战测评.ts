import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exact500Articles } from "./exact_500_articles";
import {
	type BenchmarkAlternative,
	type BenchmarkPathResult,
	optimizeBenchmarkLine,
	preferredRankedCodes,
} from "./lib/benchmark-paths";
import {
	type BenchmarkDictionaryEntry,
	rankBenchmarkCodes,
} from "./lib/benchmark-ranking";
import {
	ALL_BENCHMARK_SCHEMES,
	type BenchmarkSchemeId,
	directOutputCodes,
	isPoppableFixedCode,
	suffixOutputCodes,
	supportsStructuralAbbreviations,
} from "./lib/benchmark-schemes";
import { RimeCandidateOracle } from "./lib/rime-candidate-oracle";
import { generateAbbreviations } from "./固顶替代";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(
	process.argv[2] ??
		join(root, "reports", "冰雪十二方案_500字_最短键码实战测评.txt"),
);
type SchemeId = BenchmarkSchemeId;
type SourceKind =
	| "一简"
	| "二简单字"
	| "二简词"
	| "630"
	| "普通码"
	| "次选"
	| "结构略码"
	| "尾字键";

type Alternative = BenchmarkAlternative<SourceKind>;
type PathResult = BenchmarkPathResult<SourceKind>;

interface ReplayToken {
	start: number;
	end: number;
	word: string;
	code: string;
}

interface ReplayLine {
	text: string;
	schemes: Map<string, ReplayToken[]>;
}

interface BenchmarkCorpus {
	targetWords: Set<string>;
	targetEntries: Map<string, BenchmarkDictionaryEntry>;
	singleCharacterEntries: BenchmarkDictionaryEntry[];
}

function width(text: string) {
	let result = 0;
	for (const character of text) {
		if (/\p{Script=Han}|[，。；：！？、“”‘’（）《》【】]/u.test(character))
			result += 2;
		else result += 1;
	}
	return result;
}

function readFixed(file: string) {
	const result = new Map<string, { word: string; source: SourceKind }>();
	let section = "";
	for (const line of readFileSync(join(root, file), "utf8").split(/\r?\n/)) {
		if (!line) continue;
		if (line.startsWith("#")) {
			section = line;
			continue;
		}
		const [code, words] = line.split("\t");
		const word = words?.split(" ")[0];
		if (!code || !word || section === "# 字母") continue;
		let source: SourceKind;
		if (section === "# 二简词") source = "二简词";
		else if (section === "# 630") source = "630";
		else if (code.length === 1) source = "一简";
		else source = "二简单字";
		result.set(code, { word, source });
	}
	return result;
}

function countUpper(str: string): number {
	return [...str].filter((c) => /[A-Z]/u.test(c)).length;
}

function parseDictionaryLine(line: string) {
	if (!line.includes("\t") || line.startsWith("#")) return null;
	const [word, reading, weightText] = line.split("\t");
	if (!word || !reading || reading.startsWith("~")) return null;
	return {
		word,
		syllables: reading.split(" "),
		weight: Number(weightText) || 0,
	};
}

function buildBenchmarkCorpus(replay: ReplayLine[]): BenchmarkCorpus {
	const targetWords = new Set<string>();
	for (const line of replay) {
		const characters = [...line.text];
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

	const dictionaries = [
		"snow_pinyin.dict.yaml",
		"snow_pinyin.base.dict.yaml",
		"snow_pinyin.ext.dict.yaml",
		"snow_pinyin.tencent.dict.yaml",
		"snow_pinyin.user.dict.yaml",
	];
	const targetEntries = new Map<string, BenchmarkDictionaryEntry>();
	const singleCharacterEntries: BenchmarkDictionaryEntry[] = [];
	for (const dictionary of dictionaries) {
		for (const line of readFileSync(join(root, dictionary), "utf8").split(
			/\r?\n/u,
		)) {
			const entry = parseDictionaryLine(line);
			if (!entry) continue;
			if ([...entry.word].length === 1) singleCharacterEntries.push(entry);
			if (!targetWords.has(entry.word)) continue;
			const key = `${entry.word}\t${entry.syllables.join(" ")}`;
			const previous = targetEntries.get(key);
			if (!previous || entry.weight > previous.weight)
				targetEntries.set(key, entry);
		}
	}
	return { targetWords, targetEntries, singleCharacterEntries };
}

function compareAlternative(a: Alternative, b: Alternative) {
	const priority: Readonly<Record<SourceKind, number>> = {
		一简: 0,
		二简单字: 1,
		二简词: 2,
		"630": 3,
		结构略码: 4,
		尾字键: 5,
		普通码: 6,
		次选: 7,
	};
	return (
		a.keyCost - b.keyCost ||
		priority[a.source] - priority[b.source] ||
		Number(a.instant) - Number(b.instant) ||
		a.rawCode.localeCompare(b.rawCode)
	);
}

function buildAlternatives(
	corpus: BenchmarkCorpus,
	scheme: SchemeId,
	candidateOracle: (code: string) => readonly string[],
) {
	const { targetWords, targetEntries, singleCharacterEntries } = corpus;

	const schemeConfig = ALL_BENCHMARK_SCHEMES.find((item) => item.id === scheme);
	if (!schemeConfig) throw new Error(`未知实测方案：${scheme}`);
	const fixed = readFixed(schemeConfig.fixedFile);
	const alternatives = new Map<string, Alternative[]>();
	const add = (alternative: Alternative) => {
		if (!targetWords.has(alternative.word)) return;
		const normalized =
			scheme === "qingyun"
				? { ...alternative, punctuationNeedsSeparator: true }
				: alternative;
		const values = alternatives.get(alternative.word) ?? [];
		if (!values.some((value) => value.displayCode === normalized.displayCode)) {
			values.push(normalized);
			values.sort(compareAlternative);
			alternatives.set(alternative.word, values);
		}
	};
	for (const [word, code] of directOutputCodes(scheme)) {
		add({
			word,
			displayCode: code,
			rawCode: code,
			keyCost: 1,
			instant: true,
			popppable: false,
			source: "尾字键",
			shift: 0,
			selectionCount: 0,
		});
	}
	for (const [code, value] of fixed) {
		const upper = countUpper(code);
		add({
			word: value.word,
			displayCode: code,
			rawCode: code,
			keyCost: code.length + upper,
			instant: upper > 0,
			popppable: upper === 0 && isPoppableFixedCode(scheme, code),
			source: value.source,
			shift: upper,
			selectionCount: 0,
		});
	}

	for (const ranked of preferredRankedCodes(
		rankBenchmarkCodes(
			scheme,
			targetEntries.values(),
			singleCharacterEntries,
			fixed,
			candidateOracle,
		),
	)) {
		const first = ranked.rank === 1;
		const upper = countUpper(ranked.code);
		add({
			word: ranked.word,
			displayCode: first ? ranked.code : `${ranked.code}[${ranked.rank}]`,
			rawCode: ranked.code,
			keyCost: ranked.code.length + upper + (first ? 0 : 1),
			instant: !first,
			popppable: first && ranked.popppable,
			source: first ? "普通码" : "次选",
			shift: upper,
			selectionCount: first ? 0 : 1,
		});
	}

	// 大写结构略码会立即提交当前候选；Shift 和字母各计一键。
	const directSnapshot = new Map(
		[...alternatives].map(([word, values]) => [word, [...values]]),
	);
	if (supportsStructuralAbbreviations(scheme)) {
		for (const [base, baseAlternatives] of directSnapshot) {
			if ([...base].length > 3) continue;
			for (const generated of generateAbbreviations(base)) {
				if (!targetWords.has(generated.word)) continue;
				for (const alternative of baseAlternatives) {
					const shifted = /^[A-Z]$/u.test(generated.trigger);
					const trigger = shifted ? `⇧${generated.trigger}` : generated.trigger;
					add({
						word: generated.word,
						displayCode: alternative.displayCode + trigger,
						rawCode: alternative.rawCode + generated.trigger,
						keyCost: alternative.keyCost + (shifted ? 2 : 1),
						instant: true,
						popppable: false,
						source: "结构略码",
						shift: alternative.shift + (shifted ? 1 : 0),
						selectionCount: alternative.selectionCount,
					});
				}
			}
		}
	}

	// “的/了”尾字键既可接普通候选，也可接已立即提交的结构略码。
	const tailSnapshot = new Map(
		[...alternatives].map(([word, values]) => [word, [...values]]),
	);
	for (const [base, baseAlternatives] of tailSnapshot) {
		for (const [tail, trigger] of suffixOutputCodes(scheme)) {
			const word = base + tail;
			if (!targetWords.has(word)) continue;
			for (const alternative of baseAlternatives) {
				add({
					word,
					displayCode: alternative.displayCode + trigger,
					rawCode: alternative.rawCode + trigger,
					keyCost: alternative.keyCost + 1,
					instant: true,
					popppable: false,
					source: "尾字键",
					shift: alternative.shift,
					selectionCount: alternative.selectionCount,
				});
			}
		}
	}

	return alternatives;
}

function optimizeLine(text: string, alternatives: Map<string, Alternative[]>) {
	return optimizeBenchmarkLine(text, alternatives);
}

function replayTokens(path: PathResult) {
	return path.tokens.map((token) => ({
		start: token.start,
		end: token.end,
		word: token.word,
		code: token.displayCode + (token.separator ? "_" : ""),
	}));
}

function renderAligned(line: ReplayLine, order: string[]) {
	const characters = [...line.text];
	const positions = new Array(characters.length + 1).fill(0);
	for (let index = 0; index < characters.length; index += 1)
		positions[index + 1] = positions[index] + width(characters[index]) + 1;
	let changed = true;
	while (changed) {
		changed = false;
		for (const scheme of order) {
			const tokens = line.schemes.get(scheme) ?? [];
			for (let index = 0; index + 1 < tokens.length; index += 1) {
				const left = tokens[index];
				const right = tokens[index + 1];
				const required = positions[left.start] + width(left.code) + 1;
				if (positions[right.start] < required) {
					const delta = required - positions[right.start];
					for (let offset = right.start; offset < positions.length; offset += 1)
						positions[offset] += delta;
					changed = true;
				}
			}
		}
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
	const lines = [
		`原文       ${place(characters.map((text, start) => ({ start, text })))}`,
	];
	for (const scheme of order) {
		const label = scheme.padEnd(6, "　");
		const tokens = line.schemes.get(scheme) ?? [];
		lines.push(
			`${label} ${place(tokens.map((token) => ({ start: token.start, text: token.code })))}`,
		);
	}
	return lines.join("\n");
}

const benchmarkArticle = exact500Articles.find(({ id }) => id === 10);
if (!benchmarkArticle) throw new Error("找不到第 10 篇 500 字输入法赛文。");
const replay: ReplayLine[] = benchmarkArticle.lines.map((text) => ({
	text,
	schemes: new Map(),
}));
const hanCount = replay.reduce(
	(sum, line) =>
		sum +
		[...line.text].filter((value) => /\p{Script=Han}/u.test(value)).length,
	0,
);
const punctuationCount = replay.reduce(
	(sum, line) =>
		sum + [...line.text].filter((value) => /[，。]/u.test(value)).length,
	0,
);
if (hanCount !== 500 || punctuationCount !== 43)
	throw new Error(
		`赛文应为 500 汉字、43 标点，实际 ${hanCount}/${punctuationCount}。`,
	);

const generated = new Map<string, { paths: PathResult[]; total: PathResult }>();
console.log("正在建立一次性赛文词典索引...");
const benchmarkCorpus = buildBenchmarkCorpus(replay);
console.log(
	`词典索引完成：目标读音 ${benchmarkCorpus.targetEntries.size} 条，单字读音 ${benchmarkCorpus.singleCharacterEntries.length} 条。`,
);

const oracle = new RimeCandidateOracle(
	ALL_BENCHMARK_SCHEMES.map(({ schemaId }) => schemaId),
);
try {
	for (const scheme of ALL_BENCHMARK_SCHEMES) {
		console.log(`正在重算 ${scheme.name}（空白 Rime 实际候选）...`);
		oracle.selectSchema(scheme.schemaId);
		const before = oracle.cacheStats();
		const alternatives = buildAlternatives(benchmarkCorpus, scheme.id, (code) =>
			oracle.candidates(code),
		);
		const after = oracle.cacheStats();
		console.log(
			`${scheme.name} 候选查询：持久缓存命中 ${after.hits - before.hits}，实际查询 ${after.misses - before.misses}。`,
		);
		const paths = replay.map(({ text }) => optimizeLine(text, alternatives));
		const total = paths.reduce<PathResult>(
			(summary, path) => ({
				tokens: [...summary.tokens, ...path.tokens],
				keys: summary.keys + path.keys,
				spaces: summary.spaces + path.spaces,
				shifts: summary.shifts + path.shifts,
				fixedCount: summary.fixedCount + path.fixedCount,
				selectionCount: summary.selectionCount + path.selectionCount,
				codeLength: summary.codeLength + path.codeLength,
			}),
			{
				tokens: [],
				keys: 0,
				spaces: 0,
				shifts: 0,
				fixedCount: 0,
				selectionCount: 0,
				codeLength: 0,
			},
		);
		generated.set(scheme.name, { paths, total });
		for (const [index, path] of paths.entries())
			replay[index].schemes.set(scheme.name, replayTokens(path));
	}
} finally {
	oracle.close();
}

const generatedStats = [...generated].map(([scheme, value]) => ({
	scheme,
	keys: value.total.keys,
	spaces: value.total.spaces,
	shifts: value.total.shifts,
	segments: value.total.tokens.filter((token) =>
		/^\p{Script=Han}+$/u.test(token.word),
	).length,
}));
const stats = [...generatedStats].sort(
	(a, b) => a.keys - b.keys || a.scheme.localeCompare(b.scheme, "zh-CN"),
);
const detail = generatedStats.map((stat) => {
	const total = generated.get(stat.scheme)?.total;
	const counts = new Map<SourceKind, number>();
	const lengths = new Map<number, number>();
	for (const token of total?.tokens ?? []) {
		if (!/^\p{Script=Han}+$/u.test(token.word)) continue;
		counts.set(token.source, (counts.get(token.source) ?? 0) + 1);
		const length = Math.min(5, [...token.word].length);
		lengths.set(length, (lengths.get(length) ?? 0) + 1);
	}
	return `${stat.scheme}：总实际按键 ${stat.keys}；平均码长 ${(stat.keys / 500).toFixed(4)}；Space ${stat.spaces}；Shift ${stat.shifts}；标点 ${punctuationCount}；非标点编码动作 ${stat.segments}（1字 ${lengths.get(1) ?? 0}；2字 ${lengths.get(2) ?? 0}；3字 ${lengths.get(3) ?? 0}；4字 ${lengths.get(4) ?? 0}；5字以上 ${lengths.get(5) ?? 0}）。\n  简码命中：一简 ${counts.get("一简") ?? 0}；二简单字 ${counts.get("二简单字") ?? 0}；二简词 ${counts.get("二简词") ?? 0}；630 ${counts.get("630") ?? 0}；结构略码 ${counts.get("结构略码") ?? 0}；尾字键 ${counts.get("尾字键") ?? 0}；普通码 ${counts.get("普通码") ?? 0}；次选 ${counts.get("次选") ?? 0}。`;
});

const order = [...ALL_BENCHMARK_SCHEMES.map((scheme) => scheme.name)];
const schemeList = ALL_BENCHMARK_SCHEMES.map((scheme) => scheme.name).join(
	"、",
);
const auxiliaryOrders = ALL_BENCHMARK_SCHEMES.map(
	(scheme) => `${scheme.name} ${scheme.auxiliaryOrder}`,
).join("；");
const output = `冰雪十二方案：500 字赛文最短键码实战测评
====================================================================================================
口径：500 个汉字；中文逗号/句号 43 个；标点计键；均码 = 总实际按键 / 500。
重算轨：${schemeList}；十二条轨均按各自冻结或现行布局、现行功能与同一最短路径模型复算。
编码结构／辅序：${auxiliaryOrders}。
优化目标：先最少选重次数，再最少实际按键；同为首选时优先最短标准码，不为节省一个 Space 多补辅助码。某字词存在首选编码时不保留其二、三选短码，只有完全没有首选打法时才允许前三候选选重兜底。
结构略码：冰雪四拼、冰雪简道、冰雪散拼及其两个“·初代”方案使用；六条 21×21 轨只使用大写补韵机制。冰雪清韵的词语走九键韵音码，单字同时枚举形码。
记号：_ = Space（1 键）；⇧X = Shift+X（2 键）；排版空白不计键。每个词首与对应编码首位纵向对齐。

Benchmark 排名表
----------------------------------------------------------------------------------------------------
排名  方案                 总按键   平均码长   Space  Shift  非标点分词段   相对第一名
${stats
	.map(
		(stat, index) =>
			`${String(index + 1).padStart(2)}    ${stat.scheme.padEnd(18)} ${String(stat.keys).padStart(6)}   ${(stat.keys / 500).toFixed(4).padStart(8)}   ${String(stat.spaces).padStart(5)}  ${String(stat.shifts).padStart(5)}  ${String(stat.segments).padStart(12)}   +${String(stat.keys - stats[0].keys).padStart(3)}`,
	)
	.join("\n")}

十二条仓库内可复算轨最短路径使用统计
----------------------------------------------------------------------------------------------------
${detail.join("\n")}

完整方案-specific 分词 / 键码对齐回放
====================================================================================================
${replay.map((line, index) => `[${String(index + 1).padStart(2, "0")}]\n${renderAligned(line, order)}`).join("\n\n")}

核验说明
====================================================================================================
1. 十二条本地轨均读取各自独立 fixed 表与运行时合同；活动方案使用 D3/V1 或 QZ-e8f37a，四个“·初代”方案使用冻结的 Overall-17 或 U357，冰雪键道、冰雪三拼保留更早的经典声韵代数。十二轨共用当前五部拼音词典和受版本控制的字形／笔画源；冰雪清韵另读取当前形码词典。
2. 单字与二／三／四字词均枚举合法标准码、空桶短码和逐级扩展码；每个编码都在独立空白 user dict、无提交、无调频的 librime 部署中查询实际候选，交由全文动态规划先最少化选重次数、再最少化总按键。
3. 只有不能由下一词首键或标点顶屏的候选才补 Space；结构略码的大写触发键按 Shift+字母两键计。
4. 四个“·初代”方案与冰雪键道／冰雪三拼均不采用外部冻结统计；只冻结其对应声韵布局与方案专属 fixed，AA/AAB、630、动态首选后置与辅序仍按各自发布合同复算。
5. 冰雪四拼与冰雪清韵现已由本仓库直接复算，不再采用历史外部冻结回放；声笔小鹤、小鹤音形的旧冻结回放仍含已知错误且未满足 snow-benchmark-frozen-v2 契约，因此不导入、不排名。
`;

writeFileSync(outputPath, output, "utf8");
console.log(`已生成 ${outputPath}`);
for (const stat of stats)
	console.log(`${stat.scheme}\t${stat.keys}\t${(stat.keys / 500).toFixed(4)}`);
