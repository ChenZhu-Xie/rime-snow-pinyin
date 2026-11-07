import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SpellingAlgebra } from "./lib/algebra";
import { loadAuxiliarySemantics } from "./lib/auxiliary-semantics";
import {
	mergeDictionaries,
	readDictionary,
	readShapeCodes,
	toneOf,
	wordLength,
} from "./固顶编译器";
import { isDirectlyComposableFixedWord } from "./固顶替代";

interface Priority {
	word: string;
	reading: string;
	level: number;
	order: number;
}

interface Target {
	schema: string;
	fixed: string;
	kind: "21x21" | "21x26";
	auxiliary: "shape" | "tone";
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targets: Target[] = [
	{
		schema: "snow_jiandao.schema.yaml",
		fixed: "snow_jiandao.fixed.txt",
		kind: "21x21",
		auxiliary: "shape",
	},
	{
		schema: "snow_sanpin.schema.yaml",
		fixed: "snow_sanpin.fixed.txt",
		kind: "21x21",
		auxiliary: "tone",
	},
	{
		schema: "snow_jiandao_classic.schema.yaml",
		fixed: "snow_jiandao_classic.fixed.txt",
		kind: "21x21",
		auxiliary: "shape",
	},
	{
		schema: "snow_sanpin_classic.schema.yaml",
		fixed: "snow_sanpin_classic.fixed.txt",
		kind: "21x21",
		auxiliary: "tone",
	},
	{
		schema: "snow_shenyun_shape.schema.yaml",
		fixed: "snow_shenyun_shape.fixed.txt",
		kind: "21x26",
		auxiliary: "shape",
	},
	{
		schema: "snow_shenyun_tone.schema.yaml",
		fixed: "snow_shenyun_tone.fixed.txt",
		kind: "21x26",
		auxiliary: "tone",
	},
];

function read(path: string): string {
	return readFileSync(resolve(root, path), "utf8").replace(/\r\n/gu, "\n");
}

const readings = new Map<string, string[]>();
for (const line of read("scripts/data/tygf-pinyin.tsv").trim().split("\n")) {
	const [word, reading] = line.split("\t");
	const values = readings.get(word) ?? [];
	values.push(reading);
	readings.set(word, values);
}

const dictionaryFiles = [
	"snow_pinyin.dict.yaml",
	"snow_pinyin.base.dict.yaml",
	"snow_pinyin.ext.dict.yaml",
	"snow_pinyin.tencent.dict.yaml",
	"snow_pinyin.user.dict.yaml",
];
let dictionary_entries_cache: ReturnType<typeof mergeDictionaries> | undefined;
function replacementDictionaryEntries() {
	if (!dictionary_entries_cache) {
		dictionary_entries_cache = mergeDictionaries(
			dictionaryFiles.flatMap((file) => readDictionary(resolve(root, file))),
		);
	}
	return dictionary_entries_cache;
}

let shape_codes_cache: ReturnType<typeof readShapeCodes> | undefined;
function replacementShapeCodes() {
	if (!shape_codes_cache) {
		const shape_element_keys: Record<string, string> = {};
		for (const line of read("lua/snow/radical_jiandao.txt").split("\n")) {
			const [element, code] = line.split("\t");
			if (element && code) shape_element_keys[element] = code;
		}
		shape_codes_cache = readShapeCodes(
			resolve(root, "snow_jiandao_chaifen.dict.yaml"),
			shape_element_keys,
		);
	}
	return shape_codes_cache;
}

const sipinAlgebra = new SpellingAlgebra(
	resolve(root, "snow_sipin.schema.yaml"),
	"speller/algebra",
);
const sipinLines = read("snow_sipin.fixed.txt").split("\n");
const shenyunLetters = JSON.parse(
	read("config/shenyun-21x26-letter-buckets.json"),
) as {
	letters: Array<{
		letter: string;
		code: string;
		naturalTop3: Array<{ text: string }>;
	}>;
};
const shenyunLetterByCode = new Map(
	shenyunLetters.letters.map((entry) => [entry.code, entry]),
);
const keytaoLetterByCode = new Map(
	[
		...[..."bpmfdtnlgkhjqxzcsrwye"].map((letter) => ({
			letter,
			code: `${letter}c`,
		})),
		...[
			{ letter: "v", code: "xg" },
			{ letter: "i", code: "xl" },
			{ letter: "u", code: "xh" },
			{ letter: "o", code: "xd" },
			{ letter: "a", code: "xw" },
		],
	].map((entry) => [entry.code, entry.letter]),
);
const numberWordByDigits = new Map([
	["0", "零"],
	["1", "一"],
	["2", "二"],
	["3", "三"],
	["4", "四"],
	["5", "五"],
	["6", "六"],
	["7", "七"],
	["8", "八"],
	["9", "九"],
	["10", "十"],
]);

function firstWord(value: string): string {
	return value.split(" ")[0] ?? "";
}

function singlePriorities(): Priority[] {
	const result: Priority[] = [];
	let order = 0;
	for (const line of sipinLines) {
		if (line.startsWith("#")) break;
		if (!line.includes("\t")) continue;
		const [code, candidates] = line.split("\t");
		const word = firstWord(candidates);
		if ([...word].length !== 1) continue;
		for (const reading of readings.get(word) ?? []) {
			if (
				sipinAlgebra.applyAll(reading).some((value) => value.startsWith(code))
			) {
				result.push({ word, reading, level: code.length, order });
			}
		}
		order += 1;
	}
	return result;
}

function oneKeyReferences(
	target: Target,
	targetAlgebra: SpellingAlgebra,
): Map<string, string> {
	const result = new Map<string, string>();
	for (const line of sipinLines) {
		if (line.startsWith("#") || !line.includes("\t")) continue;
		const [code, candidates] = line.split("\t");
		if (code.length !== 1) continue;
		const word = firstWord(candidates);
		const reading = (readings.get(word) ?? []).find((value) =>
			sipinAlgebra.apply(value).startsWith(code),
		);
		if (!reading) continue;
		const targetCode = targetAlgebra.apply(reading).slice(0, 1);
		if (targetCode) result.set(targetCode, word);
	}
	// p 槽不机械照搬四拼的“跑”：形辅方案取较高频且完整码仍需选重的“配”，
	// 调辅方案保留历史上更熟悉、完整码候选更深的“平”。
	result.set("p", target.auxiliary === "shape" ? "配" : "平");
	return result;
}

interface ReplacementCandidate {
	word: string;
	weight: number;
}

function addReplacementCandidate(
	pools: Map<string, ReplacementCandidate[]>,
	wanted: ReadonlySet<string>,
	section: "二简词" | "630",
	code: string,
	candidate: ReplacementCandidate,
) {
	if (!code || isDirectlyComposableFixedWord(candidate.word)) return;
	const key = `${section}\t${code}`;
	if (!wanted.has(key)) return;
	const values = pools.get(key) ?? [];
	const previous = values.find((value) => value.word === candidate.word);
	if (previous) {
		previous.weight = Math.max(previous.weight, candidate.weight);
	} else {
		values.push(candidate);
	}
	pools.set(key, values);
}

function replacementPools(
	target: Target,
	algebra: SpellingAlgebra,
	wanted: ReadonlySet<string>,
) {
	const pools = new Map<string, ReplacementCandidate[]>();
	const tone_keys = loadAuxiliarySemantics(target.kind).toneKeysByTone;
	const sound_key_cache = new Map<string, string>();
	const sound_key = (syllable: string) => {
		const cached = sound_key_cache.get(syllable);
		if (cached !== undefined) return cached;
		const value = algebra.apply(syllable).slice(0, 1);
		sound_key_cache.set(syllable, value);
		return value;
	};
	const shape_codes =
		target.auxiliary === "shape" ? replacementShapeCodes() : undefined;
	for (const entry of replacementDictionaryEntries()) {
		const length = wordLength(entry.word);
		if (
			entry.weight <= 1 ||
			length < 2 ||
			length > 4 ||
			entry.syllables.length !== length ||
			!/^\p{Script=Han}+$/u.test(entry.word)
		) {
			continue;
		}
		const first = sound_key(entry.syllables[0]);
		if (!first) continue;
		if (length === 2) {
			const second = sound_key(entry.syllables[1]);
			if (second) {
				addReplacementCandidate(pools, wanted, "二简词", first + second, entry);
			}
		}
		if (target.kind !== "21x21") continue;
		if (target.auxiliary === "shape") {
			if (length !== 2) continue;
			const shape = shape_codes?.get([...entry.word][1] ?? "") ?? "";
			if (shape.length >= 1) {
				addReplacementCandidate(pools, wanted, "630", first + shape[0], entry);
			}
			if (shape.length >= 2) {
				addReplacementCandidate(
					pools,
					wanted,
					"630",
					first + shape.slice(0, 2),
					entry,
				);
			}
		} else {
			const second_tone = toneOf(entry.syllables[1]);
			if (!second_tone) continue;
			const second_key = tone_keys[Number(second_tone) - 1];
			if (!second_key) continue;
			const two_key_code = first + second_key;
			addReplacementCandidate(pools, wanted, "630", two_key_code, entry);
			const target_syllable =
				length === 2 ? entry.syllables[0] : entry.syllables[2];
			const target_tone = target_syllable && toneOf(target_syllable);
			const third_key = target_tone
				? tone_keys[Number(target_tone) - 1]
				: undefined;
			if (third_key) {
				addReplacementCandidate(
					pools,
					wanted,
					"630",
					two_key_code + third_key,
					entry,
				);
			}
		}
	}
	for (const values of pools.values()) {
		values.sort(
			(left, right) =>
				right.weight - left.weight ||
				left.word.localeCompare(right.word, "zh-CN"),
		);
	}
	return pools;
}

function replaceDirectlyComposableRows(
	source: string,
	target: Target,
	algebra: SpellingAlgebra,
) {
	const lines = source.trimEnd().split("\n");
	const used = new Set<string>();
	const wanted = new Set<string>();
	let replacement_count = 0;
	let section = "";
	for (const line of lines) {
		if (line.startsWith("#")) {
			section = line.slice(1).trim();
			continue;
		}
		if ((section === "二简词" || section === "630") && line.includes("\t")) {
			const word = firstWord(line.split("\t")[1]);
			if (isDirectlyComposableFixedWord(word)) {
				replacement_count += 1;
				const [code] = line.split("\t");
				wanted.add(`${section}\t${code}`);
			} else {
				used.add(word);
			}
		}
	}
	if (replacement_count === 0) return source;
	const pools = replacementPools(target, algebra, wanted);
	section = "";
	for (const [index, line] of lines.entries()) {
		if (line.startsWith("#")) {
			section = line.slice(1).trim();
			continue;
		}
		if ((section !== "二简词" && section !== "630") || !line.includes("\t")) {
			continue;
		}
		const [code, candidates] = line.split("\t");
		const word = firstWord(candidates);
		if (!isDirectlyComposableFixedWord(word)) continue;
		const replacement = pools
			.get(`${section}\t${code}`)
			?.find((candidate) => !used.has(candidate.word));
		if (!replacement) {
			throw new Error(
				`${target.fixed} ${section} ${code} 无可用的结构替代候选`,
			);
		}
		used.add(replacement.word);
		lines[index] = `${code}\t${mergeFirst(candidates, replacement.word)}`;
	}
	return `${lines.join("\n")}\n`;
}

function baseReferences(
	targetAlgebra: SpellingAlgebra,
	reservedWords: Iterable<string>,
): Map<string, string> {
	const candidatesByCode = new Map<string, Priority[]>();
	let fallbackOrder = 1_000_000;
	function add(code: string, priority: Priority) {
		if (code.length !== 2) return;
		const candidates = candidatesByCode.get(code) ?? [];
		if (!candidates.some((entry) => entry.word === priority.word)) {
			candidates.push(priority);
			candidatesByCode.set(code, candidates);
		}
	}
	for (const priority of singlePriorities()
		.filter((entry) => entry.level > 1)
		.sort((a, b) => a.level - b.level || a.order - b.order)) {
		const code = targetAlgebra.apply(priority.reading).slice(0, 2);
		add(code, priority);
	}
	for (const [word, wordReadings] of readings) {
		if (!/^\p{Script=Han}$/u.test(word)) continue;
		for (const reading of wordReadings) {
			add(targetAlgebra.apply(reading).slice(0, 2), {
				word,
				reading,
				level: 100,
				order: fallbackOrder++,
			});
		}
	}
	const codeByWord = new Map<string, string>();
	for (const word of reservedWords) codeByWord.set(word, "");
	const preferred = new Map<string, string>();
	function assign(code: string, visitedCodes: Set<string>): boolean {
		if (visitedCodes.has(code)) return false;
		visitedCodes.add(code);
		for (const candidate of candidatesByCode.get(code) ?? []) {
			const previousCode = codeByWord.get(candidate.word);
			if (previousCode === "") continue;
			if (previousCode === undefined || assign(previousCode, visitedCodes)) {
				preferred.set(code, candidate.word);
				codeByWord.set(candidate.word, code);
				return true;
			}
		}
		return false;
	}
	for (const code of [...candidatesByCode.keys()].sort(
		(a, b) =>
			(candidatesByCode.get(a)?.length ?? 0) -
				(candidatesByCode.get(b)?.length ?? 0) || a.localeCompare(b),
	)) {
		assign(code, new Set());
	}
	return preferred;
}

function occupiedBases(targetAlgebra: SpellingAlgebra): Set<string> {
	const result = new Set<string>();
	for (const filename of [
		"snow_pinyin.dict.yaml",
		"snow_pinyin.base.dict.yaml",
		"snow_pinyin.ext.dict.yaml",
		"snow_pinyin.tencent.dict.yaml",
		"snow_pinyin.user.dict.yaml",
	]) {
		for (const line of read(filename).split("\n")) {
			if (line.startsWith("#") || !line.includes("\t")) continue;
			const [text, spelling, rawWeight] = line.split("\t");
			if (
				[...text].length !== 1 ||
				!spelling ||
				spelling.startsWith("~") ||
				Number(rawWeight) <= 1
			) {
				continue;
			}
			const code = targetAlgebra.apply(spelling).slice(0, 2);
			if (code.length === 2) result.add(code);
		}
	}
	return result;
}

function phraseReferences(targetAlgebra: SpellingAlgebra): Map<string, string> {
	const occupied = occupiedBases(targetAlgebra);
	const result = new Map<string, string>();
	let phraseSection = false;
	for (const line of sipinLines) {
		if (line.startsWith("# 数量搭配")) phraseSection = true;
		if (!phraseSection || line.startsWith("#") || !line.includes("\t"))
			continue;
		const [sourceCode, candidates] = line.split("\t");
		const word = firstWord(candidates);
		if (sourceCode.length !== 2 || [...word].length !== 2) continue;
		const targetCode: string[] = [];
		for (const [index, character] of [...word].entries()) {
			const reading = (readings.get(character) ?? []).find((value) =>
				sipinAlgebra.apply(value).startsWith(sourceCode[index] ?? ""),
			);
			if (!reading) {
				targetCode.length = 0;
				break;
			}
			targetCode.push(targetAlgebra.apply(reading).slice(0, 1));
		}
		const code = targetCode.join("");
		if (code.length === 2 && !occupied.has(code) && !result.has(code)) {
			result.set(code, word);
		}
	}
	return result;
}

function mergeFirst(candidates: string, word: string): string {
	const suffixes = candidates
		.split(" ")
		.filter((value) => value && !/^\p{Script=Han}+$/u.test(value));
	return [word, ...suffixes].join(" ");
}

function render21x21(
	source: string,
	ones: Map<string, string>,
	bases: Map<string, string>,
	phrases: Map<string, string>,
	keytao: boolean,
): string {
	const lines = source.trimEnd().split("\n");
	const reservedPhraseWords = new Set<string>();
	let sourceSection = "";
	for (const line of lines) {
		if (line.startsWith("#")) {
			sourceSection = line.slice(1).trim();
			continue;
		}
		if (sourceSection !== "二简词" && line.includes("\t")) {
			reservedPhraseWords.add(firstWord(line.split("\t")[1]));
		}
	}
	const output: string[] = [];
	let section = "";
	for (const line of lines) {
		if (line.startsWith("#")) {
			section = line.slice(1).trim();
			output.push(line);
			continue;
		}
		if (!line.includes("\t")) {
			output.push(line);
			continue;
		}
		const [code, candidates] = line.split("\t");
		let replacement: string | undefined;
		if (section === "二简词") {
			replacement = phrases.get(code);
			if (replacement && reservedPhraseWords.has(replacement)) {
				replacement = undefined;
			} else if (replacement) {
				reservedPhraseWords.add(replacement);
			}
		} else if (section === "单字") {
			const digits = candidates
				.split(" ")
				.find((value) => numberWordByDigits.has(value));
			replacement =
				code.length === 1
					? ones.get(code)
					: digits
						? numberWordByDigits.get(digits)
						: bases.get(code);
		}
		let renderedCandidates = replacement
			? mergeFirst(candidates, replacement)
			: candidates;
		const letter = keytao ? keytaoLetterByCode.get(code) : undefined;
		if (
			letter &&
			!renderedCandidates.endsWith(` ${letter.toUpperCase()} ${letter}`)
		) {
			renderedCandidates += ` ${letter.toUpperCase()} ${letter}`;
		}
		output.push(`${code}\t${renderedCandidates}`);
	}
	let singleSection = false;
	const singleLines: Array<{
		index: number;
		code: string;
		candidates: string[];
	}> = [];
	for (const [index, line] of output.entries()) {
		if (line.startsWith("#")) {
			singleSection = line.slice(1).trim() === "单字";
			continue;
		}
		if (!singleSection || !line.includes("\t")) continue;
		const [code, candidates] = line.split("\t");
		singleLines.push({ index, code, candidates: candidates.split(" ") });
	}
	const usedWords = new Set<string>();
	const removed = new Set<number>();
	for (const entry of singleLines.sort(
		(a, b) => a.code.length - b.code.length || a.index - b.index,
	)) {
		if (entry.code.length <= 2) {
			for (const word of entry.candidates) {
				if (/^\p{Script=Han}+$/u.test(word)) usedWords.add(word);
			}
			continue;
		}
		const candidates = entry.candidates.filter(
			(value) => !/^\p{Script=Han}+$/u.test(value) || !usedWords.has(value),
		);
		const words = candidates.filter((value) =>
			/^\p{Script=Han}+$/u.test(value),
		);
		if (
			words.length === 0 &&
			candidates.every((value) => /^\p{Script=Han}+$/u.test(value))
		) {
			removed.add(entry.index);
			continue;
		}
		for (const word of words) usedWords.add(word);
		output[entry.index] = `${entry.code}\t${candidates.join(" ")}`;
	}
	return `${output.filter((_, index) => !removed.has(index)).join("\n")}\n`;
}

function render21x26(
	source: string,
	ones: Map<string, string>,
	bases: Map<string, string>,
	phrases: Map<string, string>,
): string {
	const original = new Map<string, string>();
	for (const line of source.split("\n")) {
		if (!line.startsWith("#") && line.includes("\t")) {
			const [code, candidates] = line.split("\t");
			original.set(code, candidates);
		}
	}
	const letterCodes = new Set(shenyunLetterByCode.keys());
	const mergeOriginal = (code: string, word: string): string =>
		original.has(code) ? mergeFirst(original.get(code) ?? "", word) : word;
	if (!ones.has("s")) ones.set("s", "三");
	const output = [
		"# 冰雪神韵 21×26 固顶候选；单字与二简词优先级参考冰雪四拼并按本方案物理码重映射。",
		"# 一级简码只固定首选；二简词只占用无单字音节的空槽；字母保持大写第 2、小写第 3。",
		"# 五辅扩展位继续由冰雪简道、冰雪散拼各自的形辅／声调语义决定。",
		"# 一级简码",
		...[...ones]
			.sort()
			.map(([code, word]) => `${code}\t${mergeOriginal(code, word)}`),
		"# 单字",
		...[...bases]
			.filter(([code]) => !letterCodes.has(code))
			.sort()
			.map(([code, word]) => `${code}\t${mergeOriginal(code, word)}`),
		"# 二简词",
		...[...phrases].sort().map(([code, word]) => `${code}\t${word}`),
		"# 字母",
		...shenyunLetters.letters.map(({ code }) => {
			const entry = shenyunLetterByCode.get(code);
			const word = bases.get(code) ?? entry?.naturalTop3[0]?.text ?? "";
			return `${code}\t${word} ${entry?.letter.toUpperCase()} ${entry?.letter}`;
		}),
	];
	return `${output.join("\n")}\n`;
}

export function alignFixedContent(fixed: string, source: string): string {
	const target = targets.find((entry) => entry.fixed === fixed);
	if (!target) throw new Error(`不支持对齐固顶文件：${fixed}`);
	const algebra = new SpellingAlgebra(
		resolve(root, target.schema),
		"speller/algebra",
		{
			derive: false,
		},
	);
	const ones = oneKeyReferences(target, algebra);
	const reservedOneKeyWords = new Set(ones.values());
	for (const line of source.split("\n")) {
		if (line.startsWith("#") || !line.includes("\t")) continue;
		const [code, candidates] = line.split("\t");
		if (code.length === 1 && !ones.has(code)) {
			reservedOneKeyWords.add(firstWord(candidates));
		}
		for (const value of candidates.split(" ")) {
			const numberWord = numberWordByDigits.get(value);
			if (numberWord) reservedOneKeyWords.add(numberWord);
		}
	}
	const bases = baseReferences(algebra, reservedOneKeyWords);
	const phrases = phraseReferences(algebra);
	const rendered =
		target.kind === "21x21"
			? render21x21(
					source,
					ones,
					bases,
					phrases,
					target.fixed.includes("jiandao"),
				)
			: render21x26(source, ones, bases, phrases);
	return replaceDirectlyComposableRows(rendered, target, algebra);
}

function main() {
	let stale = false;
	for (const target of targets) {
		const source = read(target.fixed);
		const rendered = alignFixedContent(target.fixed, source);
		if (process.argv.includes("--check")) {
			if (source !== rendered) {
				console.error(`${target.fixed} 未与冰雪四拼固顶优先级同步`);
				stale = true;
			}
		} else {
			writeFileSync(resolve(root, target.fixed), rendered, "utf8");
			console.log(`已更新 ${target.fixed}`);
		}
	}

	if (stale) process.exitCode = 1;
}

if (import.meta.main) main();
