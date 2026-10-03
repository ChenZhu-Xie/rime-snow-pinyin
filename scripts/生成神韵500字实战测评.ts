import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateAbbreviations } from "./固顶替代";
import { plainSyllable, readShapeCodes, toneOf } from "./固顶编译器";

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
		join(root, "reports", "神韵双拼八方案_500字_最短键码实战测评.txt"),
);

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
	for (const dictionary of dictionaries) {
		for (const line of readFileSync(join(root, dictionary), "utf8").split(
			/\r?\n/,
		)) {
			const entry = parseDictionaryLine(line);
			if (!entry || !targetWords.has(entry.word)) continue;
			const key = `${entry.word}\t${entry.syllables.join(" ")}`;
			const previous = targetEntries.get(key);
			if (!previous || entry.weight > previous.weight)
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
	const top = new Map<
		string,
		{ word: string; weight: number; reading: string }
	>();
	for (const dictionary of dictionaries) {
		for (const line of readFileSync(join(root, dictionary), "utf8").split(
			/\r?\n/,
		)) {
			const entry = parseDictionaryLine(line);
			if (!entry) continue;
			for (const code of pronunciationCodes(
				scheme,
				entry.word,
				entry.syllables,
			)) {
				if (!relevantCodes.has(code)) continue;
				const fixedOwner = fixed.get(code)?.word;
				if (fixedOwner) {
					top.set(code, {
						word: fixedOwner,
						weight: Number.MAX_SAFE_INTEGER,
						reading: "固顶",
					});
					continue;
				}
				const previous = top.get(code);
				const reading = entry.syllables.join(" ");
				if (
					!previous ||
					entry.weight > previous.weight ||
					(entry.weight === previous.weight &&
						entry.word.localeCompare(previous.word, "zh-CN") < 0)
				) {
					top.set(code, { word: entry.word, weight: entry.weight, reading });
				}
			}
		}
	}
	for (const [code, owners] of targetCodeOwners) {
		const winner = top.get(code)?.word;
		if (!winner || !owners.has(winner) || fixed.has(code)) continue;
		add({
			word: winner,
			displayCode: code,
			rawCode: code,
			keyCost: code.length,
			instant: false,
			popppable: isPoppable(code),
			source: "普通码",
			shift: 0,
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
	if (!best[0]) throw new Error(`无法编码：${text}`);
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
for (const [label, scheme] of [
	["神韵三拼", "sanpin"],
	["神韵键道", "jiandao"],
] as const) {
	const alternatives = buildAlternatives(replay, scheme);
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
	generated.set(label, { paths, total });
	for (const [index, path] of paths.entries())
		replay[index].schemes.set(label, replayTokens(path));
}

const frozenStats = [
	{ scheme: "四拼", keys: 919, spaces: 49, shifts: 0, segments: 264 },
	{ scheme: "三拼（原冰雪）", keys: 943, spaces: 55, shifts: 0, segments: 257 },
	{ scheme: "键道（原冰雪）", keys: 944, spaces: 55, shifts: 0, segments: 256 },
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
	return `${stat.scheme}：总实际按键 ${stat.keys}；平均码长 ${(stat.keys / 500).toFixed(4)}；Space ${stat.spaces}；Shift ${stat.shifts}；标点 ${punctuationCount}；非标点编码动作 ${stat.segments}（1字 ${lengths.get(1) ?? 0}；2字 ${lengths.get(2) ?? 0}；3字 ${lengths.get(3) ?? 0}；4字 ${lengths.get(4) ?? 0}；5字以上 ${lengths.get(5) ?? 0}）。\n  简码命中：一简 ${counts.get("一简") ?? 0}；二简单字 ${counts.get("二简单字") ?? 0}；二简词 ${counts.get("二简词") ?? 0}；630 ${counts.get("630") ?? 0}；结构略码 ${counts.get("结构略码") ?? 0}；尾字键 ${counts.get("尾字键") ?? 0}；普通码 ${counts.get("普通码") ?? 0}。`;
});

const order = [
	"四拼",
	"三拼",
	"键道",
	"神韵三拼",
	"神韵键道",
	"声笔小鹤",
	"清韵",
	"小鹤",
];
const output = `神韵双拼加持的键道、三拼：500 字赛文八方案最短键码实战测评
====================================================================================================
口径：500 个汉字；中文逗号/句号 43 个；标点计键；均码 = 总实际按键 / 500。
新增轨：${mapping.scheme} 神韵三拼、神韵键道；其余六轨逐键沿用两份指定冻结回放。
优化目标：先最少实际按键，再少分词段、少 Space；禁用数字选重，只使用首选、各级简码、630、尾字键和原生结构略码。
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

新增两轨简码使用统计
----------------------------------------------------------------------------------------------------
${detail.join("\n")}

完整方案-specific 分词 / 键码对齐回放
====================================================================================================
${replay.map((line, index) => `[${String(index + 1).padStart(2, "0")}]\n${renderAligned(line, order)}`).join("\n\n")}

核验说明
====================================================================================================
1. 新增两轨直接读取当前仓库 snow_sanpin.fixed.txt、snow_jiandao.fixed.txt、神韵 R9 映射和现行五部词典。
2. 固顶简码按码表首选；普通码按现行权重逐码比较首选；三拼追加声调、键道追加形码消歧。
3. 只有不能由下一词首键或标点顶屏的候选才补 Space；结构略码的大写触发键按 Shift+字母两键计。
4. 原冰雪三拼/键道与神韵三拼/键道分列；前者是指定旧回放，后者是本仓库当前布局的新回放。
`;

writeFileSync(outputPath, output, "utf8");
console.log(`已生成 ${outputPath}`);
for (const stat of stats)
	console.log(`${stat.scheme}\t${stat.keys}\t${(stat.keys / 500).toFixed(4)}`);
