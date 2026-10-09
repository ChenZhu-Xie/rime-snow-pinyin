import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { corpusArticles } from "./benchmark_corpus";
import { generateAbbreviations } from "./固顶替代";
import { plainSyllable, readShapeCodes, toneOf } from "./固顶编译器";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const mainKeys = new Set([..."bpmfdtnlgkhjqxzcsrwye"]);
const auxiliaryKeys = new Set([..."ivuao"]);
const toneKeys: Readonly<Record<string, string>> = {
	"1": "i",
	"2": "v",
	"3": "u",
	"4": "a",
	"5": "o",
};
const mapping = JSON.parse(
	readFileSync(join(root, "docs", "shenyun-r9-mapping.json"), "utf8"),
) as { scheme: string; codes: Record<string, string | null> };

const shapeElementKeys = new Map<string, string>();
for (const line of readFileSync(
	join(root, "lua", "snow", "radical_jiandao.txt"),
	"utf8",
).split(/\r?\n/)) {
	const [element, code] = line.split("\t");
	if (element && code) shapeElementKeys.set(element, code);
}
const shapeCodes = readShapeCodes(
	join(root, "snow_jiandao_chaifen.dict.yaml"),
	Object.fromEntries(shapeElementKeys),
);

const strokeCodes = new Map<string, string[]>();
const strokeKeyMap: Readonly<Record<string, string>> = {
	h: "v",
	s: "i",
	p: "u",
	n: "o",
	z: "a",
};
for (const line of readFileSync(
	join(root, "rime-stroke", "stroke.dict.yaml"),
	"utf8",
).split(/\r?\n/)) {
	if (!line.includes("\t") || line.startsWith("#")) continue;
	const [character, strokes] = line.split("\t");
	if (!character || [...character].length !== 1 || !strokes) continue;
	const code = [...strokes]
		.map((stroke) => strokeKeyMap[stroke] ?? "")
		.join("");
	if (!code) continue;
	const values = strokeCodes.get(character) ?? [];
	if (!values.includes(code)) values.push(code);
	strokeCodes.set(character, values);
}

type SchemeId = "sanpin" | "jiandao";
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

function soundCode(syllable: string) {
	return mapping.codes[plainSyllable(syllable)] ?? null;
}

function pronunciationCodes(
	scheme: SchemeId,
	word: string,
	syllables: string[],
) {
	if ([...word].length !== syllables.length || syllables.length === 0)
		return [];
	const sounds = syllables.map(soundCode);
	if (sounds.some((code) => !code)) return [];
	const safeSounds = sounds as string[];
	let base = "";
	let suffixes: string[] = [];
	if (syllables.length === 1) {
		base = safeSounds[0];
		if (scheme === "sanpin") {
			const tone = toneOf(syllables[0]);
			if (tone && toneKeys[tone]) {
				const toned = base + toneKeys[tone];
				const codes = [base, toned];
				for (const strokes of strokeCodes.get(word) ?? []) {
					let code = toned;
					for (const stroke of strokes) {
						code += stroke;
						codes.push(code);
					}
				}
				return [...new Set(codes)];
			}
		} else {
			suffixes = [...(shapeCodes.get(word) ?? "")].slice(0, 3);
		}
	} else if (syllables.length === 2) {
		base = safeSounds.join("");
		if (scheme === "sanpin") {
			const secondTone = toneOf(syllables[1]);
			const firstTone = toneOf(syllables[0]);
			suffixes = [secondTone, firstTone]
				.map((tone) => (tone ? toneKeys[tone] : undefined))
				.filter((value): value is string => Boolean(value));
		} else {
			suffixes = [...word].map(
				(character) => shapeCodes.get(character)?.[0] ?? "",
			);
		}
	} else {
		base = safeSounds.map((code) => code[0]).join("");
		if (scheme === "sanpin") {
			const indexes = [syllables.length - 1, 0, 1];
			suffixes = indexes
				.map((index) => toneOf(syllables[index]))
				.map((tone) => (tone ? toneKeys[tone] : undefined))
				.filter((value): value is string => Boolean(value));
		} else {
			const limit = syllables.length === 3 ? 3 : 2;
			suffixes = [...word]
				.slice(0, limit)
				.map((character) => shapeCodes.get(character)?.[0] ?? "");
		}
	}
	const codes = [base];
	for (const suffix of suffixes) {
		if (!suffix) break;
		codes.push(codes.at(-1) + suffix);
	}
	return codes;
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

function isPoppable(rawCode: string) {
	if ([...rawCode].some((key) => auxiliaryKeys.has(key))) return true;
	return rawCode.length >= 4 && [...rawCode].every((key) => mainKeys.has(key));
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

// 缓存解析后的全部词典记录，避免重复读取
console.log("Loading dictionary files...");
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
	for (const line of readFileSync(join(root, dictionary), "utf8").split(/\r?\n/)) {
		const entry = parseDictionaryLine(line);
		if (entry) allDictEntries.push(entry);
	}
}
console.log(`Loaded ${allDictEntries.length} dictionary entries.`);

function buildAlternativesForTexts(texts: string[], scheme: SchemeId) {
	const targetWords = new Set<string>();
	for (const text of texts) {
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

	const targetEntries = new Map<string, DictEntry>();
	for (const entry of allDictEntries) {
		if (!targetWords.has(entry.word)) continue;
		const key = `${entry.word}\t${entry.syllables.join(" ")}`;
		const previous = targetEntries.get(key);
		if (!previous || entry.weight > previous.weight) {
			targetEntries.set(key, entry);
		}
	}

	const fixed = readFixed(
		scheme === "sanpin" ? "snow_sanpin.fixed.txt" : "snow_jiandao.fixed.txt",
	);
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
		add({
			word: value.word,
			displayCode: code,
			rawCode: code,
			keyCost: code.length,
			instant: false,
			popppable: isPoppable(code),
			source: value.source,
			shift: 0,
		});
	}

	const relevantCodes = new Set<string>();
	const targetCodeOwners = new Map<string, Set<string>>();
	for (const entry of targetEntries.values()) {
		for (const code of pronunciationCodes(
			scheme,
			entry.word,
			entry.syllables,
		)) {
			relevantCodes.add(code);
			const owners = targetCodeOwners.get(code) ?? new Set<string>();
			owners.add(entry.word);
			targetCodeOwners.set(code, owners);
		}
	}

	const top = new Map<string, Array<{ word: string; weight: number }>>();
	for (const entry of allDictEntries) {
		for (const code of pronunciationCodes(
			scheme,
			entry.word,
			entry.syllables,
		)) {
			if (!relevantCodes.has(code)) continue;
			const fixedOwner = fixed.get(code)?.word;
			if (fixedOwner) {
				top.set(code, [{ word: fixedOwner, weight: Number.MAX_SAFE_INTEGER }]);
				continue;
			}
			const list = top.get(code) ?? [];
			const existingIndex = list.findIndex(item => item.word === entry.word);
			if (existingIndex >= 0) {
				if (entry.weight > list[existingIndex].weight) {
					list[existingIndex].weight = entry.weight;
				}
			} else {
				list.push({ word: entry.word, weight: entry.weight });
			}
			list.sort((a, b) => b.weight - a.weight || a.word.localeCompare(b.word, "zh-CN"));
			if (list.length > 3) list.length = 3;
			top.set(code, list);
		}
	}

	for (const [code, owners] of targetCodeOwners) {
		const candidates = top.get(code) ?? [];
		candidates.forEach((cand, rank) => {
			if (!owners.has(cand.word) || fixed.has(code)) return;
			// rank === 0 为首选；rank > 0 为次选/三选，需加 1 键选重（相当于立即确认上屏）
			const isFirst = rank === 0;
			add({
				word: cand.word,
				displayCode: isFirst ? code : `${code}[${rank + 1}]`,
				rawCode: code,
				keyCost: code.length + (isFirst ? 0 : 1),
				instant: !isFirst,
				popppable: isFirst ? isPoppable(code) : false,
				source: isFirst ? "普通码" : "次选",
				shift: 0,
			});
		});
	}

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

	return alternatives;
}

function optimizeLine(text: string, alternatives: Map<string, Alternative[]>) {
	const characters = [...text];
	const best: Array<PathResult | undefined> = new Array(characters.length + 1);
	best[characters.length] = { tokens: [], keys: 0, spaces: 0, shifts: 0 };
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
							character === "，" ? "," : character === "。" ? "." : character,
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
				const candidate: PathResult = {
					tokens: [{ ...alternative, start, end, separator }, ...rest.tokens],
					keys: alternative.keyCost + Number(separator) + rest.keys,
					spaces: Number(separator) + rest.spaces,
					shifts: alternative.shift + rest.shifts,
				};
				const current = best[start];
				if (
					!current ||
					candidate.keys < current.keys ||
					(candidate.keys === current.keys &&
						candidate.tokens.length < current.tokens.length) ||
					(candidate.keys === current.keys &&
						candidate.tokens.length === current.tokens.length &&
						(candidate.spaces < current.spaces ||
							(candidate.spaces === current.spaces &&
								candidate.shifts < current.shifts)))
				) {
					best[start] = candidate;
				}
			}
		}
	}
	for (let i = characters.length - 1; i >= 0; i--) {
		if (!best[i]) {
			console.log(`从后往前第一个断链位置: index ${i}, 字符 '${characters[i]}', 上下文: '${characters.slice(Math.max(0, i - 3), i + 4).join("")}'`);
			const values = alternatives.get(characters[i]);
			console.log(`该单字 alternatives:`, values?.map(v => `${v.rawCode}(${v.source})`));
			break;
		}
	}
	const result = best[0];
	if (!result) throw new Error("无法求得最优路径");
	return result;
}

interface StatResult {
	totalChars: number;
	totalPunct: number;
	totalKeys: number;
	avgLength: number;
	spaces: number;
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
}

function analyzePath(path: PathResult): StatResult {
	const hanTokens = path.tokens.filter((t) => /\p{Script=Han}/u.test(t.word));
	const punctTokens = path.tokens.filter((t) => !/\p{Script=Han}/u.test(t.word));

	let c1Tokens = 0;
	let c2Tokens = 0;
	let c3Tokens = 0;
	let c4Tokens = 0;
	let c5plusTokens = 0;

	let c1Chars = 0;
	let c2Chars = 0;
	let c3Chars = 0;
	let c4Chars = 0;
	let c5plusChars = 0;

	for (const token of hanTokens) {
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

	const totalHanTokens = hanTokens.length;
	const totalHanChars = c1Chars + c2Chars + c3Chars + c4Chars + c5plusChars;

	return {
		totalChars: totalHanChars,
		totalPunct: punctTokens.length,
		totalKeys: path.keys,
		avgLength: path.keys / totalHanChars,
		spaces: path.spaces,
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
	};
}

async function run() {
	const texts = corpusArticles.map((a) => a.text);
	
	// 核对各篇字数
	console.log("\n=== 语料篇目汉字字数检查 ===");
	let sumHan = 0;
	corpusArticles.forEach((a) => {
		const hanCount = [...a.text].filter((c) => /\p{Script=Han}/u.test(c)).length;
		sumHan += hanCount;
		console.log(`[篇${a.id}] ${a.genre} - ${a.title}: 汉字 ${hanCount} 个`);
	});
	console.log(`总计汉字: ${sumHan} 个\n`);

	const schemes: SchemeId[] = ["sanpin", "jiandao"];
	const schemeNames: Record<SchemeId, string> = {
		sanpin: "神韵三拼",
		jiandao: "神韵键道",
	};

	const allResults: Record<SchemeId, { articles: StatResult[]; total: StatResult }> = {
		sanpin: { articles: [], total: {} as any },
		jiandao: { articles: [], total: {} as any },
	};

	for (const scheme of schemes) {
		console.log(`\n========================================`);
		console.log(`正在为【${schemeNames[scheme]}】构建候选集...`);
		const t0 = Date.now();
		const alternatives = buildAlternativesForTexts(texts, scheme);
		console.log(`构建完成，耗时 ${Date.now() - t0} ms，候选词数：${alternatives.size}`);

		console.log(`正在进行 10 篇 500 字独立最优 DP 切分...`);
		const articleStats: StatResult[] = [];
		for (const a of corpusArticles) {
			const path = optimizeLine(a.text, alternatives);
			const stat = analyzePath(path);
			articleStats.push(stat);
		}
		allResults[scheme].articles = articleStats;

		// 拼接成 5000 字长文切分
		console.log(`正在进行 5000 字长文合并全局最优 DP 切分...`);
		const fullText = texts.join(" ");
		const fullPath = optimizeLine(fullText, alternatives);
		const fullStat = analyzePath(fullPath);
		allResults[scheme].total = fullStat;
	}

	// 汇总输出报表
	console.log("\n\n==========================================================================================");
	console.log("【实测结果一：10 篇 500 字不同文体统计详情】");
	console.log("==========================================================================================");

	for (const scheme of schemes) {
		console.log(`\n### 方案：${schemeNames[scheme]}`);
		console.log(`篇号\t文体\t汉字数\t总按键\t平均码长\t空格\t1字词%\t2字词%\t3字词%\t4字词%\t5字+%\t| 1字覆盖%\t2字覆盖%\t3字覆盖%\t4字覆盖%\t5字+覆盖%`);
		for (let i = 0; i < corpusArticles.length; i++) {
			const a = corpusArticles[i];
			const s = allResults[scheme].articles[i];
			console.log(
				`P${a.id}\t${a.genre}\t${s.totalChars}\t${s.totalKeys}\t${s.avgLength.toFixed(4)}\t${s.spaces}\t` +
				`${s.tokenRatios.c1.toFixed(1)}%\t${s.tokenRatios.c2.toFixed(1)}%\t${s.tokenRatios.c3.toFixed(1)}%\t${s.tokenRatios.c4.toFixed(1)}%\t${s.tokenRatios.c5plus.toFixed(1)}%\t| ` +
				`${s.charRatios.c1.toFixed(1)}%\t${s.charRatios.c2.toFixed(1)}%\t${s.charRatios.c3.toFixed(1)}%\t${s.charRatios.c4.toFixed(1)}%\t${s.charRatios.c5plus.toFixed(1)}%`
			);
		}

		// 计算 10 篇均值
		const avgTokenR1 = articleStatsAvg(allResults[scheme].articles, (s) => s.tokenRatios.c1);
		const avgTokenR2 = articleStatsAvg(allResults[scheme].articles, (s) => s.tokenRatios.c2);
		const avgTokenR3 = articleStatsAvg(allResults[scheme].articles, (s) => s.tokenRatios.c3);
		const avgTokenR4 = articleStatsAvg(allResults[scheme].articles, (s) => s.tokenRatios.c4);
		const avgTokenR5 = articleStatsAvg(allResults[scheme].articles, (s) => s.tokenRatios.c5plus);

		const avgCharR1 = articleStatsAvg(allResults[scheme].articles, (s) => s.charRatios.c1);
		const avgCharR2 = articleStatsAvg(allResults[scheme].articles, (s) => s.charRatios.c2);
		const avgCharR3 = articleStatsAvg(allResults[scheme].articles, (s) => s.charRatios.c3);
		const avgCharR4 = articleStatsAvg(allResults[scheme].articles, (s) => s.charRatios.c4);
		const avgCharR5 = articleStatsAvg(allResults[scheme].articles, (s) => s.charRatios.c5plus);

		console.log(
			`均值\t10篇平均\t-\t-\t-\t-\t` +
			`${avgTokenR1.toFixed(1)}%\t${avgTokenR2.toFixed(1)}%\t${avgTokenR3.toFixed(1)}%\t${avgTokenR4.toFixed(1)}%\t${avgTokenR5.toFixed(1)}%\t| ` +
			`${avgCharR1.toFixed(1)}%\t${avgCharR2.toFixed(1)}%\t${avgCharR3.toFixed(1)}%\t${avgCharR4.toFixed(1)}%\t${avgCharR5.toFixed(1)}%`
		);
	}

	console.log("\n\n==========================================================================================");
	console.log("【实测结果二：5000 字长文全局最优切分总计】");
	console.log("==========================================================================================");
	for (const scheme of schemes) {
		const s = allResults[scheme].total;
		console.log(`\n方案：${schemeNames[scheme]}`);
		console.log(`总汉字数: ${s.totalChars}，标点: ${s.totalPunct}，总按键: ${s.totalKeys}，平均码长: ${s.avgLength.toFixed(4)}，空格: ${s.spaces}`);
		console.log(`【按分词切分动作(词次)占比】：`);
		console.log(`  单字: ${s.tokenCounts.c1} (${s.tokenRatios.c1.toFixed(2)}%)`);
		console.log(`  二字: ${s.tokenCounts.c2} (${s.tokenRatios.c2.toFixed(2)}%)`);
		console.log(`  三字: ${s.tokenCounts.c3} (${s.tokenRatios.c3.toFixed(2)}%)`);
		console.log(`  四字: ${s.tokenCounts.c4} (${s.tokenRatios.c4.toFixed(2)}%)`);
		console.log(`  五字及以上: ${s.tokenCounts.c5plus} (${s.tokenRatios.c5plus.toFixed(2)}%)`);
		console.log(`【按汉字位置(覆盖率)占比】：`);
		console.log(`  单字覆盖: ${s.charCounts.c1} 字 (${s.charRatios.c1.toFixed(2)}%)`);
		console.log(`  二字覆盖: ${s.charCounts.c2} 字 (${s.charRatios.c2.toFixed(2)}%)`);
		console.log(`  三字覆盖: ${s.charCounts.c3} 字 (${s.charRatios.c3.toFixed(2)}%)`);
		console.log(`  四字覆盖: ${s.charCounts.c4} 字 (${s.charRatios.c4.toFixed(2)}%)`);
		console.log(`  五字及以上: ${s.charCounts.c5plus} 字 (${s.charRatios.c5plus.toFixed(2)}%)`);
	}

	// 保存详细 JSON 数据方便分析
	writeFileSync(
		join(root, "reports", "5000字_三拼键道最优切分实测结果.json"),
		JSON.stringify(allResults, null, 2),
		"utf8"
	);
	console.log("\n已保存结果至 reports/5000字_三拼键道最优切分实测结果.json");
}

function articleStatsAvg(list: StatResult[], fn: (s: StatResult) => number) {
	return list.reduce((acc, cur) => acc + fn(cur), 0) / list.length;
}

run().catch(console.error);
