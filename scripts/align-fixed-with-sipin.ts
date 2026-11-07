import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SpellingAlgebra } from "./lib/algebra";

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
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targets: Target[] = [
	{
		schema: "snow_jiandao.schema.yaml",
		fixed: "snow_jiandao.fixed.txt",
		kind: "21x21",
	},
	{
		schema: "snow_sanpin.schema.yaml",
		fixed: "snow_sanpin.fixed.txt",
		kind: "21x21",
	},
	{
		schema: "snow_jiandao_classic.schema.yaml",
		fixed: "snow_jiandao_classic.fixed.txt",
		kind: "21x21",
	},
	{
		schema: "snow_sanpin_classic.schema.yaml",
		fixed: "snow_sanpin_classic.fixed.txt",
		kind: "21x21",
	},
	{
		schema: "snow_shenyun_shape.schema.yaml",
		fixed: "snow_shenyun_shape.fixed.txt",
		kind: "21x26",
	},
	{
		schema: "snow_shenyun_tone.schema.yaml",
		fixed: "snow_shenyun_tone.fixed.txt",
		kind: "21x26",
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

function firstWord(value: string): string {
	return value.split(" ")[0] ?? "";
}

function singlePriorities(): Priority[] {
	const result: Priority[] = [];
	let order = 0;
	for (const line of sipinLines) {
		if (line.startsWith("#") || !line.includes("\t")) continue;
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

function baseReferences(targetAlgebra: SpellingAlgebra): Map<string, string> {
	const preferred = new Map<string, Priority>();
	for (const priority of singlePriorities()) {
		const code = targetAlgebra.apply(priority.reading).slice(0, 2);
		if (code.length !== 2) continue;
		const previous = preferred.get(code);
		if (
			!previous ||
			priority.level < previous.level ||
			(priority.level === previous.level && priority.order < previous.order)
		) {
			preferred.set(code, priority);
		}
	}
	return new Map(
		[...preferred].map(([code, priority]) => [code, priority.word]),
	);
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
	const values = candidates.split(" ").filter(Boolean);
	values[0] = word;
	return values.join(" ");
}

function render21x21(
	source: string,
	ones: Map<string, string>,
	bases: Map<string, string>,
	phrases: Map<string, string>,
	keytao: boolean,
): string {
	const lines = source.trimEnd().split("\n");
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
		} else if (section === "单字") {
			replacement = code.length === 1 ? ones.get(code) : bases.get(code);
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
	return `${output.join("\n")}\n`;
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

let stale = false;
for (const target of targets) {
	const algebra = new SpellingAlgebra(
		resolve(root, target.schema),
		"speller/algebra",
		{
			derive: false,
		},
	);
	const source = read(target.fixed);
	const ones = oneKeyReferences(algebra);
	const bases = baseReferences(algebra);
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
