import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SpellingAlgebra } from "./lib/algebra";
import { loadAuxiliarySemantics } from "./lib/auxiliary-semantics";
import { characterReadingPriorities } from "./lib/character-reading-priorities";
import { addNumberAliases, numeralReadings } from "./lib/fixed-number-aliases";
import { loadVacancyFallbackSyllables } from "./lib/runtime-vacancy";
import {
	selectThreeKeyFixed,
	type ThreeKeyFixedCandidate,
} from "./lib/three-key-fixed";
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
		schema: "snow_huandao.schema.yaml",
		fixed: "snow_huandao.fixed.txt",
		kind: "21x26",
		auxiliary: "shape",
	},
	{
		schema: "snow_landao.schema.yaml",
		fixed: "snow_landao.fixed.txt",
		kind: "21x21",
		auxiliary: "shape",
	},
	{
		schema: "snow_lanpin.schema.yaml",
		fixed: "snow_lanpin.fixed.txt",
		kind: "21x21",
		auxiliary: "tone",
	},
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
		schema: "snow_hedao.schema.yaml",
		fixed: "snow_hedao.fixed.txt",
		kind: "21x26",
		auxiliary: "shape",
	},
	{
		schema: "snow_hepin.schema.yaml",
		fixed: "snow_hepin.fixed.txt",
		kind: "21x26",
		auxiliary: "tone",
	},
	{
		schema: "snow_liandao.schema.yaml",
		fixed: "snow_liandao.fixed.txt",
		kind: "21x21",
		auxiliary: "shape",
	},
];

function read(path: string): string {
	return readFileSync(resolve(root, path), "utf8").replace(/\r\n/gu, "\n");
}

const readings = new Map<string, string[]>();
const readingSource = read("scripts/data/tygf-pinyin.tsv");
const readingPriorities = characterReadingPriorities(readingSource);
// 原始读音顺序仍用于解释四拼的显式固顶，权重排序只作用于兜底候选。
for (const line of readingSource.trim().split("\n")) {
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
			resolve(root, "snow_landao_chaifen.dict.yaml"),
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

function oneKeyReferences(targetAlgebra: SpellingAlgebra): Map<string, string> {
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
	// 四拼显式固顶仍优先；兜底按每条实际读音的权重排列。
	// 例如尿 niao4 的高权重不能提升尿 sui1 在 qz 桶中的位置。
	for (const { word, reading } of readingPriorities) {
		if (!/^\p{Script=Han}$/u.test(word)) continue;
		add(targetAlgebra.apply(reading).slice(0, 2), {
			word,
			reading,
			level: 100,
			order: fallbackOrder++,
		});
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

function occupiedBases(
	targetAlgebra: SpellingAlgebra,
	fallbackSyllables?: ReadonlySet<string>,
): Set<string> {
	const result = new Set<string>();
	const spellings = new Set<string>();
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
				(fallbackSyllables
					? fallbackSyllables.has(spelling.replace(/[0-9]$/u, ""))
					: Number(rawWeight) <= 1)
			) {
				continue;
			}
			spellings.add(spelling);
		}
	}
	for (const spelling of spellings) {
		const code = targetAlgebra.apply(spelling).slice(0, 2);
		if (code.length === 2) result.add(code);
	}
	return result;
}

function phraseReferences(
	targetAlgebra: SpellingAlgebra,
	fallbackSyllables?: ReadonlySet<string>,
): Map<string, string> {
	const occupied = occupiedBases(targetAlgebra, fallbackSyllables);
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
	const originalSingleCodeByWord = new Map<string, string>();
	let sourceSection = "";
	for (const line of lines) {
		if (line.startsWith("#")) {
			sourceSection = line.slice(1).trim();
			continue;
		}
		if (sourceSection !== "二简词" && line.includes("\t")) {
			reservedPhraseWords.add(firstWord(line.split("\t")[1]));
		}
		if (sourceSection === "单字" && line.includes("\t")) {
			const [code, candidates] = line.split("\t");
			for (const word of candidates.split(" ")) {
				if (/^\p{Script=Han}+$/u.test(word)) {
					originalSingleCodeByWord.set(word, code);
				}
			}
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
			const originalCode = replacement
				? originalSingleCodeByWord.get(replacement)
				: undefined;
			// d 统一首选「都」，允许从原有二码固顶提升为一级简码。
			if (code !== "d" && originalCode !== undefined && originalCode !== code) {
				replacement = undefined;
			}
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

function threeKeyShapeReferences(
	algebra: SpellingAlgebra,
	reservedWords: Iterable<string>,
): Map<string, string> {
	const sourceSemantics = loadAuxiliarySemantics("21x21");
	const targetSemantics = loadAuxiliarySemantics("21x26");
	const shapeKeyMap = new Map(
		[...sourceSemantics.shapeKeysByMeaning].map((key, index) => [
			key,
			targetSemantics.shapeKeysByMeaning[index],
		]),
	);
	const sipinLevels = new Map<string, number>();
	for (const { word, reading, level } of singlePriorities()) {
		const key = `${word}\t${reading}`;
		sipinLevels.set(key, Math.min(level, sipinLevels.get(key) ?? Infinity));
	}
	const shapes = replacementShapeCodes();
	const candidates: ThreeKeyFixedCandidate[] = [];
	const soundByReading = new Map<string, string>();
	for (const { word, reading, weight } of readingPriorities) {
		let sound = soundByReading.get(reading);
		if (sound === undefined) {
			sound = algebra.apply(reading);
			soundByReading.set(reading, sound);
		}
		const shape = shapes.get(word);
		const firstShape = shape && shapeKeyMap.get(shape[0]);
		if (sound.length !== 2 || !firstShape) continue;
		candidates.push({
			code: sound + firstShape,
			word,
			reading,
			weight,
			sipinLevel: sipinLevels.get(`${word}\t${reading}`),
		});
	}
	return selectThreeKeyFixed(candidates, reservedWords);
}

function render21x26(
	source: string,
	ones: Map<string, string>,
	bases: Map<string, string>,
	phrases: Map<string, string>,
	targetAlgebra: SpellingAlgebra,
	auxiliary: Target["auxiliary"],
	letters = shenyunLetters,
): string {
	const letterByCode = new Map(
		letters.letters.map((entry) => [entry.code, entry]),
	);
	const original = new Map<string, string>();
	for (const line of source.split("\n")) {
		if (!line.startsWith("#") && line.includes("\t")) {
			const [code, candidates] = line.split("\t");
			// 旧布局的字母后缀不能随汉字行继续迁移；只由当前字母桶表重建。
			original.set(
				code,
				candidates
					.split(" ")
					.filter((value) => !/^[A-Za-z]$/u.test(value))
					.join(" "),
			);
		}
	}
	const letterCodes = new Set(letterByCode.keys());
	const mergeOriginal = (code: string, word: string): string =>
		original.has(code) ? mergeFirst(original.get(code) ?? "", word) : word;
	const sanKey = targetAlgebra.apply("san1").slice(0, 1);
	if (sanKey && !ones.has(sanKey)) ones.set(sanKey, "三");
	const reservedWords = new Set([...ones.values(), ...bases.values()]);
	for (const { code, naturalTop3 } of letters.letters) {
		reservedWords.add(bases.get(code) ?? naturalTop3[0]?.text ?? "");
	}
	const threeKeySingles =
		auxiliary === "shape"
			? threeKeyShapeReferences(targetAlgebra, reservedWords)
			: new Map<string, string>();
	const output = [
		"# 冰雪神韵 21×26 固顶候选；单字与二简词优先级参考冰雪四拼并按本方案物理码重映射。",
		"# 一级简码只固定首选；二简词只占用无单字音节的空槽；字母保持大写第 2、小写第 3。",
		"# 五辅扩展位继续由冰雪鹤道、冰雪鹤拼各自的形辅／声调语义决定。",
		...(auxiliary === "shape"
			? [
					"# 三级单字取两码主码＋第一形辅；参考四拼单字偏好，读音权重仅作兜底，详见 docs/fixed-candidates.md。",
				]
			: []),
		"# 一级简码",
		...[...ones]
			.sort()
			.map(([code, word]) => `${code}\t${mergeOriginal(code, word)}`),
		"# 单字",
		...[...bases, ...threeKeySingles]
			.filter(([code]) => !letterCodes.has(code))
			.sort()
			.map(([code, word]) => `${code}\t${mergeOriginal(code, word)}`),
		"# 二简词",
		...[...phrases].sort().map(([code, word]) => `${code}\t${word}`),
		"# 字母",
		...letters.letters.map(({ code }) => {
			const entry = letterByCode.get(code);
			const word = bases.get(code) ?? entry?.naturalTop3[0]?.text ?? "";
			return `${code}\t${word} ${entry?.letter.toUpperCase()} ${entry?.letter}`;
		}),
	];
	return `${output.join("\n")}\n`;
}

function alignFixedContentOnce(fixed: string, source: string): string {
	const target = targets.find((entry) => entry.fixed === fixed);
	if (!target) throw new Error(`不支持对齐固顶文件：${fixed}`);
	const algebra = new SpellingAlgebra(
		resolve(root, target.schema),
		"speller/algebra",
		{
			derive: false,
		},
	);
	const ones = oneKeyReferences(algebra);
	const reservedOneKeyWords = new Set(ones.values());
	for (const line of source.split("\n")) {
		if (line.startsWith("#") || !line.includes("\t")) continue;
		const [code, candidates] = line.split("\t");
		if (code.length === 1 && !ones.has(code)) {
			reservedOneKeyWords.add(firstWord(candidates));
		}
		for (const value of target.kind === "21x21" ? candidates.split(" ") : []) {
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
			: render21x26(
					source,
					ones,
					bases,
					phrases,
					algebra,
					target.auxiliary,
					target.fixed === "snow_huandao.fixed.txt"
						? JSON.parse(read("config/snow-zhudao-letter-buckets.json"))
						: shenyunLetters,
				);
	return replaceDirectlyComposableRows(rendered, target, algebra);
}

export function alignFixedContent(fixed: string, source: string): string {
	const target = targets.find((entry) => entry.fixed === fixed);
	if (!target) throw new Error(`不支持对齐固顶文件：${fixed}`);
	const algebra = new SpellingAlgebra(
		resolve(root, target.schema),
		"speller/algebra",
		{ derive: false },
	);
	if (fixed === "snow_liandao.fixed.txt")
		return renderTonedFixed(target, algebra);
	if (target.kind === "21x26") {
		// 数字每次从稳定的汉字表重算，不把旧布局数字行反向当作选字依据。
		const withoutDigits = source
			.split("\n")
			.map((line) => {
				if (line.startsWith("#") || !line.includes("\t")) return line;
				const [code, text] = line.split("\t");
				return `${code}\t${text
					.split(" ")
					.filter((w) => !/^\d+$/u.test(w))
					.join(" ")}`;
			})
			.join("\n");
		let rendered = withoutDigits;
		for (let iteration = 0; iteration < 10; iteration += 1) {
			const next = alignFixedContentOnce(fixed, rendered);
			if (next === rendered) return numberAliases(target, next).content;
			rendered = next;
		}
		throw new Error(`${fixed} 的固顶优先级对齐未能在 10 轮内收敛`);
	}
	const numberReadings = [
		"ling2",
		"yi1",
		"er4",
		"san1",
		"si4",
		"wu3",
		"liu4",
		"qi1",
		"ba1",
		"jiu3",
		"shi2",
	];
	// 数字必须跟随对应汉字的现行音码；先移走旧物理码，随后统一对齐首选。
	const rows = source.split("\n");
	const aliases = new Map<string, string[]>();
	for (let index = 0; index < rows.length; index += 1) {
		const [code, candidates] = rows[index].split("\t");
		if (!candidates || code.startsWith("#")) continue;
		const values = candidates.split(" ");
		const digits = values.filter((value) => numberWordByDigits.has(value));
		if (digits.length === 0) continue;
		const remaining = values.filter((value) => !numberWordByDigits.has(value));
		rows[index] = `${code}\t${remaining.join(" ")}`;
		for (const digit of digits) {
			const sound = algebra.apply(numberReadings[Number(digit)]).slice(0, 2);
			const nextCode =
				code.length === 1 ? sound.slice(0, 1) : sound + code.slice(2);
			if (
				nextCode !== code &&
				remaining.length === 1 &&
				remaining[0] === numberWordByDigits.get(digit)
			)
				rows[index] = "";
			const next = aliases.get(nextCode) ?? [];
			next.push(digit);
			aliases.set(nextCode, next);
		}
	}
	for (const [code, digits] of aliases) {
		const index = rows.findIndex((line) => line.startsWith(`${code}\t`));
		if (index >= 0) rows[index] += ` ${digits.join(" ")}`;
		else
			rows.push(
				`${code}\t${numberWordByDigits.get(digits[0])} ${digits.join(" ")}`,
			);
	}
	let rendered = `${rows.filter(Boolean).join("\n")}\n`;
	for (let iteration = 0; iteration < 10; iteration += 1) {
		const next = alignFixedContentOnce(fixed, rendered);
		if (next === rendered) return next;
		rendered = next;
	}
	throw new Error(`${fixed} 的固顶优先级对齐未能在 10 轮内收敛`);
}

function numberAliases(target: Target, source: string) {
	const semantics = loadAuxiliarySemantics(target.kind);
	const sourceShapeKeys = loadAuxiliarySemantics("21x21").shapeKeysByMeaning;
	return addNumberAliases(
		source,
		new SpellingAlgebra(resolve(root, target.schema), "speller/algebra", {
			derive: false,
		}),
		target.auxiliary,
		replacementShapeCodes(),
		new Map(
			[...sourceShapeKeys].map((key, i) => [
				key,
				semantics.shapeKeysByMeaning[i],
			]),
		),
		semantics.toneKeysByTone,
	);
}

// 莲道按现行声母重映射兰道的 630；单字、数字和空桶按带调音码重算。
function renderTonedFixed(target: Target, algebra: SpellingAlgebra): string {
	const parent = read("snow_landao.fixed.txt");
	const parentAlgebra = new SpellingAlgebra(
		resolve(root, "snow_landao.schema.yaml"),
		"speller/algebra",
		{ derive: false },
	);
	const ones = oneKeyReferences(algebra);
	const bases = baseReferences(algebra, ones.values());
	const phrases = phraseReferences(algebra, loadVacancyFallbackSyllables());
	const sections = new Map<string, string[]>();
	let section = "";
	for (const line of parent.split("\n")) {
		if (line.startsWith("#")) {
			section = line.slice(1).trim();
			continue;
		}
		if (!line.includes("\t")) continue;
		const rows = sections.get(section) ?? [];
		rows.push(line);
		sections.set(section, rows);
	}
	const numberReadings = [
		"ling2",
		"yi1",
		"er4",
		"san1",
		"si4",
		"wu3",
		"liu4",
		"qi1",
		"ba1",
		"jiu3",
		"shi2",
	];
	const singles = new Map(bases);
	const usedWords = new Set([...ones.values(), ...bases.values()]);
	for (const line of sections.get("单字") ?? []) {
		const [code, candidates] = line.split("\t");
		const values = candidates.split(" ");
		const digit = values.find((value) => numberWordByDigits.has(value));
		if (digit) {
			const word = numberWordByDigits.get(digit)!;
			const sound = algebra.apply(numberReadings[Number(digit)]);
			const nextCode = code.length === 1 ? sound[0] : sound + code.slice(2);
			(code.length === 1 ? ones : singles).set(nextCode, `${word} ${digit}`);
			continue;
		}
		if (code.length <= 2) continue;
		for (const word of values.filter((value) =>
			/^\p{Script=Han}$/u.test(value),
		)) {
			if (usedWords.has(word)) continue;
			const reading = (readings.get(word) ?? []).find(
				(value) => parentAlgebra.apply(value) === code.slice(0, 2),
			);
			if (!reading) continue;
			const nextCode = algebra.apply(reading) + code.slice(2);
			if (nextCode.length > 6 || singles.has(nextCode)) continue;
			singles.set(nextCode, word);
			usedWords.add(word);
		}
	}
	const letterCodes = new Set(keytaoLetterByCode.keys());
	const shortcuts = new Map<string, string[]>();
	for (const line of sections.get("630") ?? []) {
		const [code, candidates] = line.split("\t");
		for (const word of candidates.split(" ")) {
			const reading = (readings.get([...word][0]) ?? []).find((value) =>
				parentAlgebra.apply(value).startsWith(code[0]),
			);
			if (!reading) throw new Error(`630 无法还原声母：${code} ${word}`);
			const nextCode = algebra.apply(reading)[0] + code.slice(1);
			const values = shortcuts.get(nextCode) ?? [];
			if (!values.includes(word)) values.push(word);
			shortcuts.set(nextCode, values);
		}
	}
	return [
		"# 冰雪莲道 CR-REF-7e650f7a4c；由 scripts/align-fixed-with-sipin.ts 生成。",
		"# 按现行声母重映射冰雪兰道 630；单字、数字及二简词按带调音码重算，字母大写第二、小写第三。",
		"# 一级简码",
		...[...ones].sort().map(([code, word]) => `${code}\t${word}`),
		"# 单字",
		...[...singles]
			.filter(([code]) => !letterCodes.has(code))
			.sort()
			.map(([code, word]) => `${code}\t${word}`),
		"# 二简词",
		...[...phrases]
			.filter(([code]) => !letterCodes.has(code))
			.sort()
			.map(([code, word]) => `${code}\t${word}`),
		"# 630",
		...[...shortcuts]
			.sort()
			.map(([code, words]) => `${code}\t${words.join(" ")}`),
		"# 字母",
		...[...keytaoLetterByCode].map(
			([code, letter]) =>
				`${code}\t${singles.get(code) ?? "∅"} ${letter.toUpperCase()} ${letter}`,
		),
		"",
	].join("\n");
}

function main() {
	let stale = false;
	const numberCodes = new Map<string, string[]>();
	for (const target of targets) {
		const source = read(target.fixed);
		const rendered = alignFixedContent(target.fixed, source);
		if (target.kind === "21x26")
			numberCodes.set(
				target.schema.replace(".schema.yaml", ""),
				numberAliases(target, rendered).codes,
			);
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
	const path = "config/shenyun-21x26-number-codes.json";
	const config = {
		id: "SNOW-SHENYUN-21X26-NUMBER-CODES-V1",
		status: "enabled",
		schemes: {
			shape: "snow_hedao",
			tone: "snow_hepin",
			tonedShape: "snow_huandao",
		},
		contract: {
			source: "shortest-fixed-numeral-otherwise-first-auxiliary",
			candidateOrder: "preserve-existing-then-digit",
			vacantBucketsUsed: 0,
			preservedNamespaces: { ABA: 2205, AAB: "unchanged", AAAB: "unchanged" },
		},
		numbers: numeralReadings.map(([han, pinyin], i) => ({
			digit: String(i),
			han,
			pinyin,
			shapeCode: numberCodes.get("snow_hedao")![i],
			toneCode: numberCodes.get("snow_hepin")![i],
			tonedShapeCode: numberCodes.get("snow_huandao")![i],
		})),
	};
	const serialized = `${JSON.stringify(config, null, 2)}\n`;
	if (process.argv.includes("--check")) {
		if (read(path) !== serialized) {
			console.error(`${path} 未同步`);
			stale = true;
		}
	} else writeFileSync(resolve(root, path), serialized, "utf8");

	if (stale) process.exitCode = 1;
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
	main();
