import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateAbbreviations } from "./固顶替代";
import {
	ALL_BENCHMARK_SCHEMES,
	type BenchmarkSchemeId,
	isPoppableFixedCode,
} from "./lib/benchmark-schemes";
import {
	type BenchmarkDictionaryEntry,
	rankBenchmarkCodes,
} from "./lib/benchmark-ranking";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const compareRoot =
	process.argv[2] ?? "D:\\C2D\\Desktop\\输入法 对比 inputmethod compare";
const fivePath = join(
	compareRoot,
	"冰雪+小鹤_五方案_500字_最优分词_最短键码对齐.txt",
);
const sbxhPath = join(compareRoot, "声笔小鹤_500字_最优分词_最短键码回放.txt");
const outputPath = resolve(
	process.argv[3] ??
		join(root, "reports", "冰雪双拼十方案_500字_最短键码实战测评.txt"),
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

function width(text: string) {
	let result = 0;
	for (const character of text) {
		if (/\p{Script=Han}|[，。；：！？、“”‘’（）《》【】]/u.test(character))
			result += 2;
		else result += 1;
	}
	return result;
}

function visiblePositions(text: string) {
	const result: Array<{ character: string; position: number }> = [];
	let position = 0;
	for (const character of text) {
		if (character !== " ") result.push({ character, position });
		position += width(character);
	}
	return result;
}

function parseAlignedFive(content: string) {
	const lines = content.split(/\r?\n/);
	const result: ReplayLine[] = [];
	for (let index = 0; index < lines.length; index += 1) {
		if (!lines[index].startsWith("原文")) continue;
		const originalBody = lines[index].slice("原文".length);
		const visible = visiblePositions(originalBody);
		const text = visible.map(({ character }) => character).join("");
		const schemes = new Map<string, ReplayToken[]>();
		for (let offset = 1; offset <= 5; offset += 1) {
			const line = lines[index + offset];
			if (!line || !/^(清韵|四拼|三拼|键道|小鹤)/u.test(line)) {
				throw new Error(`五方案回放第 ${result.length + 1} 段格式异常。`);
			}
			const label = line.match(/^(清韵|四拼|三拼|键道|小鹤)/u)?.[0] as string;
			const body = line.slice(label.length);
			const starts: Array<{ code: string; position: number }> = [];
			const matcher = /\S+/gu;
			let match = matcher.exec(body);
			while (match) {
				starts.push({
					code: match[0],
					position: width(body.slice(0, match.index)),
				});
				match = matcher.exec(body);
			}
			const mapped = starts.map(({ code, position }) => {
				const start = visible.findIndex((item) => item.position === position);
				if (start < 0)
					throw new Error(
						`${label} 第 ${result.length + 1} 段编码 ${code} 未与原文字首对齐（列 ${position}）。`,
					);
				return { start, code };
			});
			schemes.set(
				label,
				mapped.map(({ start, code }, tokenIndex) => {
					const end = mapped[tokenIndex + 1]?.start ?? [...text].length;
					return {
						start,
						end,
						word: [...text].slice(start, end).join(""),
						code,
					};
				}),
			);
		}
		result.push({ text, schemes });
	}
	return result;
}

function parseSbxh(content: string, target: ReplayLine[]) {
	const sourceLines = content.split(/\r?\n/);
	const originals = sourceLines.filter((line) => /^\[\d+\] 原文/u.test(line));
	const codes = sourceLines.filter((line) => /^\s+声笔小鹤/u.test(line));
	if (originals.length !== target.length || codes.length !== target.length)
		throw new Error("声笔小鹤回放段数与五方案回放不一致。");
	for (let index = 0; index < target.length; index += 1) {
		const words = originals[index]
			.replace(/^\[\d+\] 原文\s+/u, "")
			.split(/\s+\/\s+/u);
		const codeList = codes[index]
			.replace(/^\s+声笔小鹤\s+/u, "")
			.split(/\s+\/\s+/u);
		if (words.length !== codeList.length)
			throw new Error(`声笔小鹤第 ${index + 1} 段词码数不一致。`);
		let start = 0;
		const tokens = words.map((word, wordIndex) => {
			const length = [...word].length;
			const token = {
				start,
				end: start + length,
				word,
				code: codeList[wordIndex],
			};
			start += length;
			return token;
		});
		if (words.join("") !== target[index].text)
			throw new Error(`声笔小鹤第 ${index + 1} 段原文不一致。`);
		target[index].schemes.set("声笔小鹤", tokens);
	}
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

function buildAlternatives(replay: ReplayLine[], scheme: SchemeId) {
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
	const targetEntries = new Map<
		string,
		{ word: string; syllables: string[]; weight: number }
	>();
	const allEntries: BenchmarkDictionaryEntry[] = [];
	for (const dictionary of dictionaries) {
		for (const line of readFileSync(join(root, dictionary), "utf8").split(
			/\r?\n/,
		)) {
			const entry = parseDictionaryLine(line);
			if (!entry) continue;
			allEntries.push(entry);
			if (!targetWords.has(entry.word)) continue;
			const key = `${entry.word}\t${entry.syllables.join(" ")}`;
			const previous = targetEntries.get(key);
			if (!previous || entry.weight > previous.weight)
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

	for (const ranked of rankBenchmarkCodes(
		scheme,
		targetEntries.values(),
		allEntries,
		fixed,
	)) {
		if (ranked.rank > 3) continue;
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
		});
	}

	// 大写结构略码会立即提交当前候选；Shift 和字母各计一键。
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

	// “的/了”尾字键既可接普通候选，也可接已立即提交的结构略码。
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
	if (!best[0]) {
		const missing = [...text].filter(
			(character) =>
				/\p{Script=Han}/u.test(character) && !alternatives.has(character),
		);
		throw new Error(
			`无法编码：${text}；缺少单字候选：${[...new Set(missing)].join("")}`,
		);
	}
	return best[0];
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

const replay = parseAlignedFive(readFileSync(fivePath, "utf8"));
parseSbxh(readFileSync(sbxhPath, "utf8"), replay);
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
for (const scheme of ALL_BENCHMARK_SCHEMES) {
	console.log(`正在重算 ${scheme.name}...`);
	const alternatives = buildAlternatives(replay, scheme.id);
	const paths = replay.map(({ text }) => optimizeLine(text, alternatives));
	const total = paths.reduce<PathResult>(
		(summary, path) => ({
			tokens: [...summary.tokens, ...path.tokens],
			keys: summary.keys + path.keys,
			spaces: summary.spaces + path.spaces,
			shifts: summary.shifts + path.shifts,
		}),
		{ tokens: [], keys: 0, spaces: 0, shifts: 0 },
	);
	generated.set(scheme.name, { paths, total });
	for (const [index, path] of paths.entries())
		replay[index].schemes.set(scheme.name, replayTokens(path));
}

const frozenStats = [
	{ scheme: "四拼", keys: 919, spaces: 49, shifts: 0, segments: 264 },
	{ scheme: "声笔小鹤", keys: 960, spaces: 29, shifts: 0, segments: 238 },
	{ scheme: "清韵", keys: 1045, spaces: 99, shifts: 42, segments: 325 },
	{ scheme: "小鹤音形", keys: 1114, spaces: 110, shifts: 0, segments: 305 },
];
const generatedStats = [...generated].map(([scheme, value]) => ({
	scheme,
	keys: value.total.keys,
	spaces: value.total.spaces,
	shifts: value.total.shifts,
	segments: value.total.tokens.filter((token) =>
		/^\p{Script=Han}+$/u.test(token.word),
	).length,
}));
const stats = [...frozenStats, ...generatedStats].sort(
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

const order = [
	"四拼",
	...ALL_BENCHMARK_SCHEMES.map((scheme) => scheme.name),
	"声笔小鹤",
	"清韵",
	"小鹤",
];
const output = `冰雪双拼四套现行方案与两套经典方案：500 字赛文十方案最短键码实战测评
====================================================================================================
口径：500 个汉字；中文逗号/句号 43 个；标点计键；均码 = 总实际按键 / 500。
重算轨：冰雪健道、冰雪弎拼、冰雪简道、冰雪散拼，以及采用迁移前声韵布局的冰雪键道、冰雪三拼；六条本地轨均按现行功能与同一最短路径模型复算，其余四轨逐键沿用两份指定冻结回放。
辅序：冰雪健道与经典冰雪键道共用 12/231/24，冰雪弎拼与经典冰雪三拼共用 12/213/23；冰雪简道为 12/21/42，冰雪散拼为 12/21/13。
优化目标：先最少实际按键，再少分词段、少 Space；允许前三候选选重（选重计 +1 键），并使用各级简码、630、尾字键和原生结构略码。
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

六条仓库内可复算轨最短路径使用统计
----------------------------------------------------------------------------------------------------
${detail.join("\n")}

完整方案-specific 分词 / 键码对齐回放
====================================================================================================
${replay.map((line, index) => `[${String(index + 1).padStart(2, "0")}]\n${renderAligned(line, order)}`).join("\n\n")}

核验说明
====================================================================================================
1. 六条本地轨均读取当前发布 fixed 表与运行时合同；冰雪键道、冰雪三拼只从 scripts/data/legacy-schemes/3658e22 还原迁移前声韵代数。六轨共用当前五部词典和受版本控制的字形／笔画源。
2. 单字与二／三／四字词均枚举合法标准码、空桶短码和逐级扩展码；每条路径先按现行权重生成原始候选，再逐键模拟首选后置，交由全文动态规划选取总按键最少的分词与编码。
3. 只有不能由下一词首键或标点顶屏的候选才补 Space；结构略码的大写触发键按 Shift+字母两键计。
4. 冰雪键道／冰雪三拼不再采用外部冻结统计；二者只保留迁移前声韵布局，AA/AAB、630、fixed、动态首选后置与辅序均按当前发布方案合同复算。
`;

writeFileSync(outputPath, output, "utf8");
console.log(`已生成 ${outputPath}`);
for (const stat of stats)
	console.log(`${stat.scheme}\t${stat.keys}\t${(stat.keys / 500).toFixed(4)}`);
