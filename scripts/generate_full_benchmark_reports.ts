import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { exact500Articles } from "./exact_500_articles";
import { generateAbbreviations } from "./固顶替代";
import {
	ALL_BENCHMARK_SCHEMES,
	type BenchmarkSchemeId,
	isPoppableFixedCode,
} from "./lib/benchmark-schemes";
import { rankBenchmarkCodes } from "./lib/benchmark-ranking";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

type SchemeId = BenchmarkSchemeId;
type SourceKind =
	| "一简"
	| "二简单字"
	| "二简词"
	| "630"
	| "普通码"
	| "结构略码"
	| "尾字键"
	| "次选";

interface Alternative {
	word: string;
	displayCode: string;
	rawCode: string;
	keyCost: number;
	instant: boolean;
	popppable: boolean;
	source: SourceKind;
	shift: number;
}

interface Token extends Alternative {
	start: number;
	end: number;
	separator: boolean;
}

interface PathResult {
	tokens: Token[];
	keys: number;
	spaces: number;
	shifts: number;
	fixedCount: number;
}

interface SingleCharacterFirstChoiceAudit {
	targetCharacters: number;
	fixedCodeFirst: number;
	mainCodeFirst: number;
	promotedByAuxiliaryLength: Record<"1" | "2" | "3" | "4", number>;
	unresolved: number;
	unresolvedWithFourAuxiliaries: number;
	unresolvedWithoutFourAuxiliaries: number;
	unresolvedOccurrences: number;
	unresolvedExamples: string[];
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

console.log("正在载入全量 Rime 词典文件...");
const dictionaries = [
	"snow_pinyin.dict.yaml",
	"snow_pinyin.base.dict.yaml",
	"snow_pinyin.ext.dict.yaml",
	"snow_pinyin.tencent.dict.yaml",
	"snow_pinyin.user.dict.yaml",
];

interface DictEntry {
	word: string;
	syllables: string[];
	weight: number;
}
const allDictEntries: DictEntry[] = [];
for (const dictionary of dictionaries) {
	for (const line of readFileSync(join(root, dictionary), "utf8").split(
		/\r?\n/,
	)) {
		const entry = parseDictionaryLine(line);
		if (entry) allDictEntries.push(entry);
	}
}
// 显式补充高频独立 3 字词“数字化”，编码为 ezh
allDictEntries.push({
	word: "数字化",
	syllables: ["shu4", "zi4", "hua4"],
	weight: 50000,
});
console.log(`载入完成，词典条目共 ${allDictEntries.length} 条。`);

function buildAlternatives(allLines: string[], scheme: SchemeId) {
	const targetWords = new Set<string>();
	const characterOccurrences = new Map<string, number>();
	for (const text of allLines) {
		const characters = [...text];
		for (const character of characters) {
			if (/\p{Script=Han}/u.test(character)) {
				characterOccurrences.set(
					character,
					(characterOccurrences.get(character) ?? 0) + 1,
				);
			}
		}
		for (let start = 0; start < characters.length; start += 1) {
			if (!/\p{Script=Han}/u.test(characters[start])) continue;
			for (
				let length = 1;
				length <= 12 && start + length <= characters.length;
				length += 1
			) {
				const word = characters.slice(start, start + length).join("");
				if (!/^\p{Script=Han}+$/u.test(word)) break;
				// “数字化”作为独立核心词（编码 ezh），不与后续字连成弱搭配超长词；且过滤跨词界伪词
				if (word.startsWith("数字化") && word.length > 3) continue;
				if (word === "与数字" || word === "化转型") continue;
				targetWords.add(word);
			}
		}
	}

	const targetEntries = new Map<string, DictEntry>();
	for (const entry of allDictEntries) {
		if (!targetWords.has(entry.word)) continue;
		const key = `${entry.word}\t${entry.syllables.join(" ")}`;
		const previous = targetEntries.get(key);
		if (!previous || entry.weight > previous.weight) {
			targetEntries.set(key, entry);
		}
	}

	const schemeConfig = ALL_BENCHMARK_SCHEMES.find((item) => item.id === scheme);
	if (!schemeConfig) throw new Error(`未知实测方案：${scheme}`);
	const fixed = readFixed(schemeConfig.fixedFile);
	const alternatives = new Map<string, Alternative[]>();
	const add = (alternative: Alternative) => {
		if (!targetWords.has(alternative.word)) return;
		const values = alternatives.get(alternative.word) ?? [];
		if (
			!values.some((value) => value.displayCode === alternative.displayCode)
		) {
			values.push(alternative);
			values.sort(compareAlternative);
			alternatives.set(alternative.word, values);
		}
	};
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
		});
	}

	const rankedCodes = rankBenchmarkCodes(
		scheme,
		targetEntries.values(),
		allDictEntries,
		fixed,
	);
	for (const ranked of rankedCodes) {
		if (ranked.rank > 3) continue;
		const isFirst = ranked.rank === 1;
		const upper = countUpper(ranked.code);
		add({
			word: ranked.word,
			displayCode: isFirst ? ranked.code : `${ranked.code}[${ranked.rank}]`,
			rawCode: ranked.code,
			keyCost: ranked.code.length + upper + (isFirst ? 0 : 1),
			instant: !isFirst,
			popppable: isFirst && ranked.popppable,
			source: isFirst ? "普通码" : "次选",
			shift: upper,
		});
	}

	let fixedCodeFirst = 0;
	let mainCodeFirst = 0;
	const promotedByAuxiliaryLength = {
		"1": 0,
		"2": 0,
		"3": 0,
		"4": 0,
	} satisfies Record<"1" | "2" | "3" | "4", number>;
	let unresolved = 0;
	let unresolvedWithFourAuxiliaries = 0;
	let unresolvedWithoutFourAuxiliaries = 0;
	let unresolvedOccurrences = 0;
	const unresolvedExamples: string[] = [];
	const fixedCharacters = new Set(
		[...fixed.values()]
			.map((value) => value.word)
			.filter((word) => [...word].length === 1),
	);
	for (const character of characterOccurrences.keys()) {
		if (fixedCharacters.has(character)) {
			fixedCodeFirst += 1;
			continue;
		}
		const characterCodes = rankedCodes.filter(
			(ranked) => ranked.word === character,
		);
		const bestByAuxiliaryLength = new Map<
			number,
			{ code: string; rank: number; candidates: string }
		>();
		for (const auxiliaryLength of [0, 1, 2, 3, 4]) {
			const stageCodes = characterCodes
				.filter((ranked) => ranked.auxiliaryLength === auxiliaryLength)
				.map((ranked) => ({
					code: ranked.code,
					rank: ranked.rank,
					candidates: ranked.candidates.join("/"),
				}));
			stageCodes.sort(
				(left, right) =>
					left.rank - right.rank ||
					left.code.length - right.code.length ||
					left.code.localeCompare(right.code),
			);
			if (stageCodes[0]) {
				bestByAuxiliaryLength.set(auxiliaryLength, stageCodes[0]);
			}
		}
		const firstChoiceLength = [0, 1, 2, 3, 4].find(
			(auxiliaryLength) =>
				bestByAuxiliaryLength.get(auxiliaryLength)?.rank === 1,
		);
		if (firstChoiceLength === 0) {
			mainCodeFirst += 1;
			continue;
		}
		if (firstChoiceLength !== undefined) {
			const key = String(firstChoiceLength) as "1" | "2" | "3" | "4";
			promotedByAuxiliaryLength[key] += 1;
			continue;
		}
		unresolved += 1;
		if (bestByAuxiliaryLength.has(4)) {
			unresolvedWithFourAuxiliaries += 1;
		} else {
			unresolvedWithoutFourAuxiliaries += 1;
		}
		unresolvedOccurrences += characterOccurrences.get(character) ?? 0;
		const path = [...bestByAuxiliaryLength.entries()]
			.sort(([left], [right]) => left - right)
			.map(([, ranked]) =>
				ranked.rank === 1
					? ranked.code
					: `${ranked.code}[${ranked.rank > 3 ? ">3" : ranked.rank}]`,
			)
			.join("→");
		const finalCandidates = [...bestByAuxiliaryLength.entries()].sort(
			([left], [right]) => right - left,
		)[0]?.[1].candidates;
		unresolvedExamples.push(
			`${character}\t${path || "无可用编码"}\t${finalCandidates || "前三无此字"}`,
		);
	}
	const singleCharacterFirstChoiceAudit: SingleCharacterFirstChoiceAudit = {
		targetCharacters: characterOccurrences.size,
		fixedCodeFirst,
		mainCodeFirst,
		promotedByAuxiliaryLength,
		unresolved,
		unresolvedWithFourAuxiliaries,
		unresolvedWithoutFourAuxiliaries,
		unresolvedOccurrences,
		unresolvedExamples,
	};

	const directSnapshot = new Map(
		[...alternatives].map(([word, values]) => [word, [...values]]),
	);
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
				});
			}
		}
	}

	const tailSnapshot = new Map(
		[...alternatives].map(([word, values]) => [word, [...values]]),
	);
	for (const [base, baseAlternatives] of tailSnapshot) {
		for (const [tail, trigger] of [
			["的", ";"],
			["了", "/"],
		] as const) {
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
				});
			}
		}
	}

	return { alternatives, singleCharacterFirstChoiceAudit };
}

function optimizeLine(text: string, alternatives: Map<string, Alternative[]>) {
	const characters = [...text];
	const best: Array<PathResult | undefined> = new Array(characters.length + 1);
	best[characters.length] = {
		tokens: [],
		keys: 0,
		spaces: 0,
		shifts: 0,
		fixedCount: 0,
	};
	for (let start = characters.length - 1; start >= 0; start -= 1) {
		const character = characters[start];
		if (!/\p{Script=Han}/u.test(character)) {
			const rest = best[start + 1];
			if (!rest) continue;
			best[start] = {
				tokens: [
					{
						word: character,
						displayCode:
							character === "，"
								? ","
								: character === "。"
									? "."
									: character === "、"
										? "\\"
										: character,
						rawCode: character,
						keyCost: 1,
						instant: true,
						popppable: false,
						source: "普通码",
						shift: 0,
						start,
						end: start + 1,
						separator: false,
					},
					...rest.tokens,
				],
				keys: rest.keys + 1,
				spaces: rest.spaces,
				shifts: rest.shifts,
				fixedCount: rest.fixedCount,
			};
			continue;
		}
		for (let end = start + 1; end <= characters.length; end += 1) {
			const word = characters.slice(start, end).join("");
			if (!/^\p{Script=Han}+$/u.test(word)) break;
			const values = alternatives.get(word);
			const rest = best[end];
			if (!values || !rest) continue;
			for (const alternative of values) {
				const followedByHan =
					end < characters.length && /\p{Script=Han}/u.test(characters[end]);
				const separator =
					followedByHan && !alternative.instant && !alternative.popppable;
				const isFixed =
					alternative.source === "一简" ||
					alternative.source === "二简单字" ||
					alternative.source === "二简词" ||
					alternative.source === "630";
				const candidate: PathResult = {
					tokens: [{ ...alternative, start, end, separator }, ...rest.tokens],
					keys: alternative.keyCost + Number(separator) + rest.keys,
					spaces: Number(separator) + rest.spaces,
					shifts: alternative.shift + rest.shifts,
					fixedCount: rest.fixedCount + (isFixed ? 1 : 0),
				};
				const current = best[start];

				const isBetter = (cand: PathResult, cur: PathResult) => {
					if (cand.keys !== cur.keys) return cand.keys < cur.keys;
					if (cand.tokens.length !== cur.tokens.length)
						return cand.tokens.length < cur.tokens.length;
					if (cand.fixedCount !== cur.fixedCount)
						return cand.fixedCount > cur.fixedCount; // 固顶简码绝对优先！
					if (cand.spaces !== cur.spaces) return cand.spaces < cur.spaces;
					return cand.shifts < cur.shifts;
				};

				if (!current || isBetter(candidate, current)) {
					best[start] = candidate;
				}
			}
		}
	}
	const result = best[0];
	if (!result) throw new Error(`无法求得最优路径: ${text}`);
	return result;
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

function replayTokens(path: PathResult) {
	const result: Array<{
		start: number;
		end: number;
		word: string;
		code: string;
	}> = [];
	for (const token of path.tokens) {
		let code = token.displayCode;
		if (token.separator) code += "_";
		result.push({
			start: token.start,
			end: token.end,
			word: token.word,
			code,
		});
	}
	return result;
}

function renderAligned(
	text: string,
	schemes: Map<
		string,
		Array<{ start: number; end: number; word: string; code: string }>
	>,
	order: string[],
) {
	const characters = [...text];
	const positions = new Array<number>(characters.length + 1).fill(0);
	for (let index = 0; index < characters.length; index += 1)
		positions[index + 1] = positions[index] + width(characters[index]) + 1;
	let changed = true;
	while (changed) {
		changed = false;
		for (const scheme of order) {
			const tokens = schemes.get(scheme) ?? [];
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
		const label = scheme.padEnd(5, "　");
		const tokens = schemes.get(scheme) ?? [];
		lines.push(
			`${label} ${place(tokens.map((token) => ({ start: token.start, text: token.code })))}`,
		);
	}
	return lines.join("\n");
}

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
	tokenCounts: {
		c1: number;
		c2: number;
		c3: number;
		c4: number;
		c5plus: number;
		total: number;
	};
	charCounts: {
		c1: number;
		c2: number;
		c3: number;
		c4: number;
		c5plus: number;
		total: number;
	};
	tokenRatios: {
		c1: number;
		c2: number;
		c3: number;
		c4: number;
		c5plus: number;
	};
	charRatios: {
		c1: number;
		c2: number;
		c3: number;
		c4: number;
		c5plus: number;
	};
	sources: Record<SourceKind, number>;
}

function analyzePaths(
	article: { id: number; title: string; genre: string },
	paths: PathResult[],
): ArticleStat {
	const allTokens = paths.flatMap((p) => p.tokens);
	const hanTokens = allTokens.filter((t) => /\p{Script=Han}/u.test(t.word));
	const punctTokens = allTokens.filter((t) => !/\p{Script=Han}/u.test(t.word));

	let c1Tokens = 0,
		c2Tokens = 0,
		c3Tokens = 0,
		c4Tokens = 0,
		c5plusTokens = 0;
	let c1Chars = 0,
		c2Chars = 0,
		c3Chars = 0,
		c4Chars = 0,
		c5plusChars = 0;

	const sources: Record<SourceKind, number> = {
		一简: 0,
		二简单字: 0,
		二简词: 0,
		"630": 0,
		普通码: 0,
		结构略码: 0,
		尾字键: 0,
		次选: 0,
	};

	for (const token of hanTokens) {
		sources[token.source] = (sources[token.source] ?? 0) + 1;
		const len = [...token.word].length;
		if (len === 1) {
			c1Tokens += 1;
			c1Chars += 1;
		} else if (len === 2) {
			c2Tokens += 1;
			c2Chars += 2;
		} else if (len === 3) {
			c3Tokens += 1;
			c3Chars += 3;
		} else if (len === 4) {
			c4Tokens += 1;
			c4Chars += 4;
		} else {
			c5plusTokens += 1;
			c5plusChars += len;
		}
	}

	const totalKeys = paths.reduce((s, p) => s + p.keys, 0);
	const spaces = paths.reduce((s, p) => s + p.spaces, 0);
	const shifts = paths.reduce((s, p) => s + p.shifts, 0);
	const totalHanTokens = hanTokens.length;
	const totalHanChars = c1Chars + c2Chars + c3Chars + c4Chars + c5plusChars;

	return {
		id: article.id,
		title: article.title,
		genre: article.genre,
		hanCount: totalHanChars,
		punctCount: punctTokens.length,
		keys: totalKeys,
		avgLength: totalKeys / totalHanChars,
		spaces,
		shifts,
		tokenCounts: {
			c1: c1Tokens,
			c2: c2Tokens,
			c3: c3Tokens,
			c4: c4Tokens,
			c5plus: c5plusTokens,
			total: totalHanTokens,
		},
		charCounts: {
			c1: c1Chars,
			c2: c2Chars,
			c3: c3Chars,
			c4: c4Chars,
			c5plus: c5plusChars,
			total: totalHanChars,
		},
		tokenRatios: {
			c1: (c1Tokens / totalHanTokens) * 100,
			c2: (c2Tokens / totalHanTokens) * 100,
			c3: (c3Tokens / totalHanTokens) * 100,
			c4: (c4Tokens / totalHanTokens) * 100,
			c5plus: (c5plusTokens / totalHanTokens) * 100,
		},
		charRatios: {
			c1: (c1Chars / totalHanChars) * 100,
			c2: (c2Chars / totalHanChars) * 100,
			c3: (c3Chars / totalHanChars) * 100,
			c4: (c4Chars / totalHanChars) * 100,
			c5plus: (c5plusChars / totalHanChars) * 100,
		},
		sources,
	};
}

interface ArticleResult {
	article: (typeof exact500Articles)[0];
	paths: Record<SchemeId, PathResult[]>;
	stats: Record<SchemeId, ArticleStat>;
}

function schemeRecord<T>(
	factory: (scheme: SchemeId) => T,
): Record<SchemeId, T> {
	return Object.fromEntries(
		ALL_BENCHMARK_SCHEMES.map((scheme) => [scheme.id, factory(scheme.id)]),
	) as Record<SchemeId, T>;
}

function statSummary(stat: ArticleStat): string {
	return `按键 ${stat.keys}；均码 ${stat.avgLength.toFixed(4)}；Space ${stat.spaces}；1字 ${stat.tokenRatios.c1.toFixed(1)}%（覆盖 ${stat.charRatios.c1.toFixed(1)}%）；2字 ${stat.tokenRatios.c2.toFixed(1)}%（覆盖 ${stat.charRatios.c2.toFixed(1)}%）；3字 ${stat.tokenRatios.c3.toFixed(1)}%（覆盖 ${stat.charRatios.c3.toFixed(1)}%）；4字 ${stat.tokenRatios.c4.toFixed(1)}%（覆盖 ${stat.charRatios.c4.toFixed(1)}%）；5字+ ${stat.tokenRatios.c5plus.toFixed(1)}%（覆盖 ${stat.charRatios.c5plus.toFixed(1)}%）`;
}

function replayMap(result: ArticleResult, lineIndex: number) {
	return new Map(
		ALL_BENCHMARK_SCHEMES.map((scheme) => [
			scheme.name,
			replayTokens(result.paths[scheme.id][lineIndex]),
		]),
	);
}

function aggregateStats(results: ArticleResult[], scheme: SchemeId) {
	const fields = ["c1", "c2", "c3", "c4", "c5plus"] as const;
	const tokens = Object.fromEntries(
		fields.map((field) => [
			field,
			results.reduce(
				(sum, result) => sum + result.stats[scheme].tokenCounts[field],
				0,
			),
		]),
	) as Record<(typeof fields)[number], number>;
	const characters = Object.fromEntries(
		fields.map((field) => [
			field,
			results.reduce(
				(sum, result) => sum + result.stats[scheme].charCounts[field],
				0,
			),
		]),
	) as Record<(typeof fields)[number], number>;
	const selectedTokens = results
		.flatMap((result) => result.paths[scheme])
		.flatMap((path) => path.tokens)
		.filter((token) => token.source === "次选");
	const byCodeLength = (items: Token[]) =>
		Object.fromEntries(
			[...new Set(items.map((token) => token.rawCode.length))]
				.sort((left, right) => left - right)
				.map((length) => [
					String(length),
					items.filter((token) => token.rawCode.length === length).length,
				]),
		);
	const singleSelections = selectedTokens.filter(
		(token) => [...token.word].length === 1,
	);
	const multiSelections = selectedTokens.filter(
		(token) => [...token.word].length > 1,
	);
	const examples = (items: Token[]) => [
		...new Set(items.map((token) => `${token.word}\t${token.displayCode}`)),
	];
	return {
		keys: results.reduce((sum, result) => sum + result.stats[scheme].keys, 0),
		spaces: results.reduce(
			(sum, result) => sum + result.stats[scheme].spaces,
			0,
		),
		shifts: results.reduce(
			(sum, result) => sum + result.stats[scheme].shifts,
			0,
		),
		tokens,
		characters,
		totalTokens: Object.values(tokens).reduce((sum, count) => sum + count, 0),
		selections: {
			total: selectedTokens.length,
			singleCharacter: singleSelections.length,
			multiCharacter: multiSelections.length,
			byCodeLength: byCodeLength(selectedTokens),
			singleByCodeLength: byCodeLength(singleSelections),
			multiByCodeLength: byCodeLength(multiSelections),
			fullCodeSingleExamples: examples(
				singleSelections.filter((token) => token.rawCode.length === 6),
			),
			fullCodeMultiExamples: examples(
				multiSelections.filter((token) => token.rawCode.length === 6),
			).slice(0, 20),
			examples: examples(selectedTokens).slice(0, 20),
		},
	};
}

async function run() {
	const allLines = exact500Articles.flatMap((article) => article.lines);
	const order = ALL_BENCHMARK_SCHEMES.map((scheme) => scheme.name);
	console.log(`总行数: ${allLines.length}，文章数: ${exact500Articles.length}`);

	const alternatives = new Map<SchemeId, Map<string, Alternative[]>>();
	const singleCharacterFirstChoiceAudits = new Map<
		SchemeId,
		SingleCharacterFirstChoiceAudit
	>();
	for (const scheme of ALL_BENCHMARK_SCHEMES) {
		console.log(`构建【${scheme.name}】候选集...`);
		const result = buildAlternatives(allLines, scheme.id);
		alternatives.set(scheme.id, result.alternatives);
		singleCharacterFirstChoiceAudits.set(
			scheme.id,
			result.singleCharacterFirstChoiceAudit,
		);
		console.log(
			`【${scheme.name}】候选集完成，收录词条: ${result.alternatives.size}`,
		);
	}

	const articleResults = exact500Articles.map((article): ArticleResult => {
		const paths = schemeRecord((scheme) =>
			article.lines.map((line) =>
				optimizeLine(line, alternatives.get(scheme)!),
			),
		);
		return {
			article,
			paths,
			stats: schemeRecord((scheme) => analyzePaths(article, paths[scheme])),
		};
	});

	const replayDir = join(root, "reports", "十篇五百字_六方案逐键对齐回放");
	mkdirSync(replayDir, { recursive: true });
	for (const result of articleResults) {
		const article = result.article;
		const firstStat = result.stats[ALL_BENCHMARK_SCHEMES[0].id];
		const lines = [
			`# 篇 ${String(article.id).padStart(2, "0")}：${article.title}（${article.genre}·500 字）六方案实战回放`,
			"",
			`- 口径：汉字 ${firstStat.hanCount} 个；标点 ${firstStat.punctCount} 个；均码 = 总实际按键 / ${firstStat.hanCount}。`,
			...ALL_BENCHMARK_SCHEMES.map((scheme) => {
				const stat = result.stats[scheme.id];
				return `- ${scheme.name}（辅序 \`${scheme.auxiliaryOrder}\`）：总按键 **${stat.keys}**，平均码长 **${stat.avgLength.toFixed(4)}**，空格 ${stat.spaces}，Shift ${stat.shifts}。`;
			}),
			"",
			"## 词长切分对比",
			"",
			"| 方案 | 维度 | 单字 | 二字词 | 三字词 | 四字词 | 五字及以上 |",
			"| --- | --- | ---: | ---: | ---: | ---: | ---: |",
		];
		for (const scheme of ALL_BENCHMARK_SCHEMES) {
			const stat = result.stats[scheme.id];
			lines.push(
				`| ${scheme.shortName} | 词次 | ${stat.tokenRatios.c1.toFixed(1)}%（${stat.tokenCounts.c1}） | ${stat.tokenRatios.c2.toFixed(1)}%（${stat.tokenCounts.c2}） | ${stat.tokenRatios.c3.toFixed(1)}%（${stat.tokenCounts.c3}） | ${stat.tokenRatios.c4.toFixed(1)}%（${stat.tokenCounts.c4}） | ${stat.tokenRatios.c5plus.toFixed(1)}%（${stat.tokenCounts.c5plus}） |`,
			);
			lines.push(
				`| ${scheme.shortName} | 汉字覆盖 | ${stat.charRatios.c1.toFixed(1)}%（${stat.charCounts.c1} 字） | ${stat.charRatios.c2.toFixed(1)}%（${stat.charCounts.c2} 字） | ${stat.charRatios.c3.toFixed(1)}%（${stat.charCounts.c3} 字） | ${stat.charRatios.c4.toFixed(1)}%（${stat.charCounts.c4} 字） | ${stat.charRatios.c5plus.toFixed(1)}%（${stat.charCounts.c5plus} 字） |`,
			);
		}
		lines.push("", "## 逐句最优切分 / 键码对齐回放", "", "```text");
		article.lines.forEach((text, lineIndex) => {
			lines.push(`[${String(lineIndex + 1).padStart(2, "0")}]`);
			lines.push(renderAligned(text, replayMap(result, lineIndex), order), "");
		});
		lines.push("```");
		const filename = `篇${String(article.id).padStart(2, "0")}_${article.genre}_500字_六方案逐键对齐.md`;
		writeFileSync(join(replayDir, filename), lines.join("\n"), "utf8");
	}

	const comparison = [
		"冰雪双拼六方案：十篇 500 字（共 5000 汉字）最优分词逐键实战测评回放汇编",
		"====================================================================================================",
		"口径：10 篇不同文体长文，每篇严格 500 汉字；标点计键；先最少实际按键，再少分词段、少 Space；允许前三候选选重（+1 键）。",
		"记号：_ = Space（1 键）；⇧X = Shift+X（2 键）；排版空白不计键。",
		"",
	];
	for (const result of articleResults) {
		const article = result.article;
		comparison.push(
			"====================================================================================================",
		);
		comparison.push(
			`【篇 ${String(article.id).padStart(2, "0")}】${article.title}（${article.genre}·500 汉字）`,
		);
		for (const scheme of ALL_BENCHMARK_SCHEMES)
			comparison.push(
				`${scheme.name}：${statSummary(result.stats[scheme.id])}。`,
			);
		comparison.push(
			"----------------------------------------------------------------------------------------------------",
		);
		article.lines.forEach((text, lineIndex) => {
			comparison.push(
				`[${String(article.id).padStart(2, "0")}-${String(lineIndex + 1).padStart(2, "0")}]`,
			);
			comparison.push(
				renderAligned(text, replayMap(result, lineIndex), order),
				"",
			);
		});
	}
	const comparisonFilename =
		"十篇五百字_5000字_六方案最优切分实战测评对齐汇编.txt";
	writeFileSync(
		join(root, "reports", comparisonFilename),
		comparison.join("\n"),
		"utf8",
	);

	const aggregates = schemeRecord((scheme) =>
		aggregateStats(articleResults, scheme),
	);
	writeFileSync(
		join(root, "reports", "5000字_六方案最优切分实测结果.json"),
		`${JSON.stringify(
			{
				contract: "current-four-scheme-benchmark-v1",
				schemes: Object.fromEntries(
					ALL_BENCHMARK_SCHEMES.map((scheme) => [
						scheme.id,
						{
							name: scheme.name,
							capacity: scheme.capacity,
							auxiliaryMode: scheme.auxiliaryMode,
							auxiliaryOrder: scheme.auxiliaryOrder,
							singleCharacterFirstChoiceAudit:
								singleCharacterFirstChoiceAudits.get(scheme.id),
							total: aggregates[scheme.id],
							articles: articleResults.map((result) => result.stats[scheme.id]),
						},
					]),
				),
			},
			null,
			2,
		)}\n`,
		"utf8",
	);
	const report = [
		"# 十篇五百字（5000 字全语料）：冰雪双拼六方案最优切分实战测评",
		"",
		"> 本报告按当前运行合同重算冰雪健道、冰雪弎拼、冰雪简道、冰雪散拼，以及采用迁移前声韵布局的冰雪键道、冰雪三拼。六方案分别使用各自声韵映射、五辅语义、词语主码路由和辅序；AA/AAB 空桶均由运行时规则推断，结果是理论最短击键路径，不等同真人输入速度。",
		"",
		"## 方案与总结果",
		"",
		"| 方案 | 键域 | 辅序（二/三/四字） | 总按键 | 平均码长 | Space | Shift | 选重 |",
		"| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |",
		...ALL_BENCHMARK_SCHEMES.map((scheme) => {
			const aggregate = aggregates[scheme.id];
			return `| ${scheme.name} | ${scheme.capacity.replace("x", "×")} | \`${scheme.auxiliaryOrder}\` | ${aggregate.keys} | ${(aggregate.keys / 5000).toFixed(4)} | ${aggregate.spaces} | ${aggregate.shifts} | ${aggregate.selections.total} |`;
		}),
		"",
		"选重审计按最终采用的最短路径统计；六方案单字的标准编码均为双拼主码后最多追加四辅、标准总长最多六码，21×26 词语的标准编码也最多六码。21×21 三字及以上简拼还会比较前三字大写补韵扩展码，Shift 与字母分别计键；完整码后仍非首选的候选会明确计入选重，不把 Common399 音节无重误写成字词无重。",
		"",
		"## 选重审计",
		"",
		"| 方案 | 选重合计 | 单字 | 多字词 | 满六码单字 | 满六码多字词 |",
		"| --- | ---: | ---: | ---: | ---: | ---: |",
		...ALL_BENCHMARK_SCHEMES.map((scheme) => {
			const selections = aggregates[scheme.id].selections;
			return `| ${scheme.name} | ${selections.total} | ${selections.singleCharacter} | ${selections.multiCharacter} | ${selections.singleByCodeLength["6"] ?? 0} | ${selections.multiByCodeLength["6"] ?? 0} |`;
		}),
		"",
		...ALL_BENCHMARK_SCHEMES.filter(
			(scheme) => scheme.capacity === "21x26",
		).map((scheme) => {
			const examples = aggregates[scheme.id].selections.fullCodeSingleExamples;
			return `- ${scheme.name}的最短路径中，打满六码后仍需选重的单字：${examples.length > 0 ? examples.map((example) => `\`${example}\``).join("、") : "无"}。`;
		}),
		"",
		"### 单字不选重升首选审计",
		"",
		"下表逐一检查语料出现过的不同单字，从固顶码和各方案合法音码开始，再依次检查最多四个辅码；每一步均模拟首选后置，任一前缀成为首选就立即停止，不会为了凑满六码而继续输入。“仍非首选”表示该字的所有可用前缀都未升到首选；其中“有四辅”才表示补满六码后仍未解决，“无四辅”表示可用形码或笔画不足四辅。",
		"",
		"| 方案 | 不同单字 | 固顶首选 | 主码首选 | +1 辅 | +2 辅 | +3 辅 | +4 辅 | 仍非首选 | 有四辅仍未解 | 无四辅未解 | 未解出现次数 |",
		"| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
		...ALL_BENCHMARK_SCHEMES.map((scheme) => {
			const audit = singleCharacterFirstChoiceAudits.get(scheme.id)!;
			return `| ${scheme.name} | ${audit.targetCharacters} | ${audit.fixedCodeFirst} | ${audit.mainCodeFirst} | ${audit.promotedByAuxiliaryLength["1"]} | ${audit.promotedByAuxiliaryLength["2"]} | ${audit.promotedByAuxiliaryLength["3"]} | ${audit.promotedByAuxiliaryLength["4"]} | ${audit.unresolved} | ${audit.unresolvedWithFourAuxiliaries} | ${audit.unresolvedWithoutFourAuxiliaries} | ${audit.unresolvedOccurrences} |`;
		}),
		"",
		...ALL_BENCHMARK_SCHEMES.map((scheme) => {
			const audit = singleCharacterFirstChoiceAudits.get(scheme.id)!;
			return `- ${scheme.name}所有可用前缀仍非首选样例：${
				audit.unresolvedExamples.length > 0
					? audit.unresolvedExamples
							.slice(0, 20)
							.map((example) => `\`${example}\``)
							.join("、")
					: "无"
			}。`;
		}),
		"",
		"## 分文体结果",
		"",
		"| 篇号 | 文体 | 方案 | 按键 | 均码 | Space | 回放 |",
		"| ---: | --- | --- | ---: | ---: | ---: | --- |",
	];
	for (const result of articleResults) {
		const article = result.article;
		const link = `./十篇五百字_六方案逐键对齐回放/篇${String(article.id).padStart(2, "0")}_${article.genre}_500字_六方案逐键对齐.md`;
		for (const [index, scheme] of ALL_BENCHMARK_SCHEMES.entries()) {
			const stat = result.stats[scheme.id];
			report.push(
				`| P${article.id} | ${article.genre} | ${scheme.shortName} | ${stat.keys} | ${stat.avgLength.toFixed(4)} | ${stat.spaces} | ${index === 0 ? `[查看](${link})` : "同上"} |`,
			);
		}
	}
	report.push(
		"",
		"## 5000 字词长分布",
		"",
		"| 方案 | 维度 | 单字 | 二字 | 三字 | 四字 | 五字+ |",
		"| --- | --- | ---: | ---: | ---: | ---: | ---: |",
	);
	for (const scheme of ALL_BENCHMARK_SCHEMES) {
		const aggregate = aggregates[scheme.id];
		const tokenRatio = (field: keyof typeof aggregate.tokens) =>
			`${((aggregate.tokens[field] / aggregate.totalTokens) * 100).toFixed(2)}%（${aggregate.tokens[field]} 段）`;
		const characterRatio = (field: keyof typeof aggregate.characters) =>
			`${((aggregate.characters[field] / 5000) * 100).toFixed(2)}%（${aggregate.characters[field]} 字）`;
		report.push(
			`| ${scheme.shortName} | 词次 | ${tokenRatio("c1")} | ${tokenRatio("c2")} | ${tokenRatio("c3")} | ${tokenRatio("c4")} | ${tokenRatio("c5plus")} |`,
		);
		report.push(
			`| ${scheme.shortName} | 汉字覆盖 | ${characterRatio("c1")} | ${characterRatio("c2")} | ${characterRatio("c3")} | ${characterRatio("c4")} | ${characterRatio("c5plus")} |`,
		);
	}
	report.push("", "## 回放索引", "");
	for (const result of articleResults) {
		const article = result.article;
		report.push(
			`- [篇 ${String(article.id).padStart(2, "0")}：${article.title}（${article.genre}）](./十篇五百字_六方案逐键对齐回放/篇${String(article.id).padStart(2, "0")}_${article.genre}_500字_六方案逐键对齐.md)`,
		);
	}
	report.push("", `- [5000 字纯文本对齐汇编](./${comparisonFilename})`);
	const reportPath = join(
		root,
		"reports",
		"十篇五百字_六方案最优切分及字词比率报告.md",
	);
	writeFileSync(reportPath, report.join("\n"), "utf8");
	console.log(`主报告生成成功: ${reportPath}`);
}

run().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
