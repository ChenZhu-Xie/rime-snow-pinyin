import { readFileSync } from "node:fs";
import { plainSyllable, readShapeCodes, toneOf } from "../固顶编译器";
import { SpellingAlgebra } from "./algebra";
import { loadAuxiliarySemantics } from "./auxiliary-semantics";
import { rootPath } from "./paths";

export type BenchmarkSchemeId =
	| "sipin"
	| "qingyun"
	| "classic-tone"
	| "classic-shape"
	| "qz-tone"
	| "qz-shape"
	| "u357-first-tone"
	| "u357-first-shape"
	| "d3v1-tone"
	| "d3v1-shape"
	| "overall17-first-tone"
	| "overall17-first-shape";

export type BenchmarkCapacity = "四拼" | "21x9" | "21x21" | "21x26";
export type BenchmarkAuxiliaryMode = "tone" | "shape";

export interface BenchmarkScheme {
	id: BenchmarkSchemeId;
	schemaId: string;
	name: string;
	shortName: string;
	capacity: BenchmarkCapacity;
	soundLayout:
		| "sipin"
		| "qingyun"
		| "classic"
		| "qz"
		| "u357"
		| "d3v1"
		| "overall17";
	auxiliaryMode: BenchmarkAuxiliaryMode;
	fixedFile: string;
	auxiliaryOrder: string;
}

export interface BenchmarkCode {
	code: string;
	mainLength: number;
	auxiliaryLength: number;
}

export const BENCHMARK_SCHEMES: readonly BenchmarkScheme[] = [
	{
		id: "sipin",
		schemaId: "snow_sipin",
		name: "冰雪四拼",
		shortName: "冰雪四拼",
		capacity: "四拼",
		soundLayout: "sipin",
		auxiliaryMode: "shape",
		fixedFile: "snow_sipin.fixed.txt",
		auxiliaryOrder: "单字笔画／部件",
	},
	{
		id: "qz-shape",
		schemaId: "snow_jiandao",
		name: "冰雪健道（QZ-e8f37a 21×21）",
		shortName: "冰雪健道",
		capacity: "21x21",
		soundLayout: "qz",
		auxiliaryMode: "shape",
		fixedFile: "snow_jiandao.fixed.txt",
		auxiliaryOrder: "12/213/24",
	},
	{
		id: "qz-tone",
		schemaId: "snow_sanpin",
		name: "冰雪弎拼（QZ-e8f37a 21×21）",
		shortName: "冰雪弎拼",
		capacity: "21x21",
		soundLayout: "qz",
		auxiliaryMode: "tone",
		fixedFile: "snow_sanpin.fixed.txt",
		auxiliaryOrder: "12/213/23",
	},
	{
		id: "qingyun",
		schemaId: "snow_qingyun",
		name: "冰雪清韵",
		shortName: "冰雪清韵",
		capacity: "21x9",
		soundLayout: "qingyun",
		auxiliaryMode: "shape",
		fixedFile: "snow_qingyun.fixed.txt",
		auxiliaryOrder: "词语音码／单字形码",
	},
	{
		id: "d3v1-shape",
		schemaId: "snow_shenyun_shape",
		name: "冰雪简道（D3/V1 21×26）",
		shortName: "冰雪简道",
		capacity: "21x26",
		soundLayout: "d3v1",
		auxiliaryMode: "shape",
		fixedFile: "snow_shenyun_shape.fixed.txt",
		auxiliaryOrder: "12/12/24",
	},
	{
		id: "d3v1-tone",
		schemaId: "snow_shenyun_tone",
		name: "冰雪散拼（D3/V1 21×26）",
		shortName: "冰雪散拼",
		capacity: "21x26",
		soundLayout: "d3v1",
		auxiliaryMode: "tone",
		fixedFile: "snow_shenyun_tone.fixed.txt",
		auxiliaryOrder: "12/21/13",
	},
	{
		id: "u357-first-shape",
		schemaId: "snow_jiandao_first",
		name: "冰雪健道·初代（U357 21×21）",
		shortName: "冰雪健道·初代",
		capacity: "21x21",
		soundLayout: "u357",
		auxiliaryMode: "shape",
		fixedFile: "snow_jiandao_first.fixed.txt",
		auxiliaryOrder: "12/231/24",
	},
	{
		id: "u357-first-tone",
		schemaId: "snow_sanpin_first",
		name: "冰雪弎拼·初代（U357 21×21）",
		shortName: "冰雪弎拼·初代",
		capacity: "21x21",
		soundLayout: "u357",
		auxiliaryMode: "tone",
		fixedFile: "snow_sanpin_first.fixed.txt",
		auxiliaryOrder: "12/213/23",
	},
	{
		id: "overall17-first-shape",
		schemaId: "snow_shenyun_shape_first",
		name: "冰雪简道·初代（Overall-17 21×26）",
		shortName: "冰雪简道·初代",
		capacity: "21x26",
		soundLayout: "overall17",
		auxiliaryMode: "shape",
		fixedFile: "snow_shenyun_shape_first.fixed.txt",
		auxiliaryOrder: "12/21/42",
	},
	{
		id: "overall17-first-tone",
		schemaId: "snow_shenyun_tone_first",
		name: "冰雪散拼·初代（Overall-17 21×26）",
		shortName: "冰雪散拼·初代",
		capacity: "21x26",
		soundLayout: "overall17",
		auxiliaryMode: "tone",
		fixedFile: "snow_shenyun_tone_first.fixed.txt",
		auxiliaryOrder: "12/21/13",
	},
] as const;

export const LEGACY_BENCHMARK_SCHEMES: readonly BenchmarkScheme[] = [
	{
		id: "classic-shape",
		schemaId: "snow_jiandao_classic",
		name: "冰雪键道",
		shortName: "冰雪键道",
		capacity: "21x21",
		soundLayout: "classic",
		auxiliaryMode: "shape",
		fixedFile: "snow_jiandao_classic.fixed.txt",
		auxiliaryOrder: "12/231/24",
	},
	{
		id: "classic-tone",
		schemaId: "snow_sanpin_classic",
		name: "冰雪三拼",
		shortName: "冰雪三拼",
		capacity: "21x21",
		soundLayout: "classic",
		auxiliaryMode: "tone",
		fixedFile: "snow_sanpin_classic.fixed.txt",
		auxiliaryOrder: "12/213/23",
	},
] as const;

export const ALL_BENCHMARK_SCHEMES: readonly BenchmarkScheme[] = [
	...BENCHMARK_SCHEMES,
	...LEGACY_BENCHMARK_SCHEMES,
];

const schemesById = new Map(
	ALL_BENCHMARK_SCHEMES.map((scheme) => [scheme.id, scheme]),
);
const semantics = {
	"21x21": loadAuxiliarySemantics("21x21"),
	"21x26": loadAuxiliarySemantics("21x26"),
};
const qzMapping = JSON.parse(
	readFileSync(rootPath("docs", "shenyun-qz-e8f37a-mapping.json"), "utf8"),
) as { codes: Record<string, string | null> };
const u357Mapping = JSON.parse(
	readFileSync(rootPath("docs", "shenyun-u357-mapping.json"), "utf8"),
) as { codes: Record<string, string | null> };
const d3v1Algebra = new SpellingAlgebra(
	rootPath("snow_shenyun_common.yaml"),
	"shenyun_algebra",
	{ derive: false },
);
const overall17Algebra = new SpellingAlgebra(
	rootPath("snow_shenyun_first_common.yaml"),
	"shenyun_algebra",
	{ derive: false },
);
const sipinAlgebra = new SpellingAlgebra(
	rootPath("snow_sipin.schema.yaml"),
	"sipin_algebra",
);
const qingyunAlgebra = new SpellingAlgebra(
	rootPath("snow_qingyun.schema.yaml"),
	"speller/algebra",
);
const classicAlgebra = new SpellingAlgebra(
	rootPath(
		"scripts",
		"data",
		"legacy-schemes",
		"3658e22",
		"schemas",
		"snow_sanpin.schema.yaml",
	),
	"sanpin_algebra",
);

const shapeElementKeys = new Map<string, string>();
for (const line of readFileSync(
	rootPath("lua", "snow", "radical_jiandao.txt"),
	"utf8",
).split(/\r?\n/u)) {
	const [element, code] = line.split("\t");
	if (element && code) shapeElementKeys.set(element, code);
}
const activeShapeCodes = readShapeCodes(
	rootPath("snow_jiandao_chaifen.dict.yaml"),
	Object.fromEntries(shapeElementKeys),
);
const firstShapeElementKeys = new Map<string, string>();
for (const line of readFileSync(
	rootPath("lua", "snow", "radical_jiandao_first.txt"),
	"utf8",
).split(/\r?\n/u)) {
	const [element, code] = line.split("\t");
	if (element && code) firstShapeElementKeys.set(element, code);
}
const firstShapeCodes = readShapeCodes(
	rootPath("snow_jiandao_chaifen.dict.yaml"),
	Object.fromEntries(firstShapeElementKeys),
);

const sipinElementKeys = new Map<string, string>();
for (const line of readFileSync(
	rootPath("lua", "snow", "radical_sipin.txt"),
	"utf8",
).split(/\r?\n/u)) {
	const [element, code] = line.split("\t");
	if (element && code) sipinElementKeys.set(element, code);
}
const sipinShapeCodes = readShapeCodes(
	rootPath("snow_bushou.dict.yaml"),
	Object.fromEntries(sipinElementKeys),
);

const qingyunShapeReadings = new Map<string, string[][]>();
for (const line of readFileSync(
	rootPath("snow_qingyun.dict.yaml"),
	"utf8",
).split(/\r?\n/u)) {
	if (!line.includes("\t") || line.startsWith("#")) continue;
	const [character, reading] = line.split("\t");
	if (!character || !reading || [...character].length !== 1) continue;
	const values = qingyunShapeReadings.get(character) ?? [];
	values.push(reading.split(" "));
	qingyunShapeReadings.set(character, values);
}

const strokeDigits = new Map<string, string[]>();
for (const line of readFileSync(rootPath("snow_bihua.dict.yaml"), "utf8").split(
	/\r?\n/u,
)) {
	if (!line.includes("\t") || line.startsWith("#")) continue;
	const [character, taggedCode] = line.split("\t");
	const match = taggedCode?.match(/^(\d+)([A-Z]*)$/u);
	if (!character || [...character].length !== 1 || !match) continue;
	const [, digits, sources] = match;
	if (sources !== "" && !sources.includes("G")) continue;
	const values = strokeDigits.get(character) ?? [];
	if (!values.includes(digits)) values.push(digits);
	strokeDigits.set(character, values);
}

function schemeById(id: BenchmarkSchemeId): BenchmarkScheme {
	const scheme = schemesById.get(id);
	if (!scheme) throw new Error(`未知实测方案：${id}`);
	return scheme;
}

export function supportsStructuralAbbreviations(
	id: BenchmarkSchemeId,
): boolean {
	return (
		id === "sipin" ||
		id === "d3v1-shape" ||
		id === "d3v1-tone" ||
		id === "overall17-first-shape" ||
		id === "overall17-first-tone"
	);
}

export function directOutputCodes(
	id: BenchmarkSchemeId,
): ReadonlyArray<readonly [word: string, code: string]> {
	if (id === "qingyun") {
		return [
			["了", "a"],
			["我", "o"],
			["的", "e"],
			["是", "i"],
			["不", "u"],
			["在", ";"],
			["和", "/"],
		];
	}
	return [
		["的", ";"],
		["了", "/"],
	];
}

export function suffixOutputCodes(
	id: BenchmarkSchemeId,
): ReadonlyArray<readonly [tail: string, code: string]> {
	return id === "qingyun"
		? []
		: [
				["的", ";"],
				["了", "/"],
			];
}

function soundCodes(scheme: BenchmarkScheme, syllable: string): string[] {
	if (scheme.soundLayout === "sipin") {
		return sipinAlgebra
			.applyAll(syllable)
			.filter((code) => /^[bpmfdtnlgkhjqxzcsrwyv][aeiou]{1,4}$/u.test(code));
	}
	if (scheme.soundLayout === "qingyun") {
		return qingyunAlgebra
			.applyAll(syllable)
			.filter((code) => /^[bpmfdtnlgkhjqxzcsrwyv][aoeiu;,./]$/u.test(code));
	}
	const plain = plainSyllable(syllable);
	if (scheme.soundLayout === "qz" || scheme.soundLayout === "u357") {
		const mapping = scheme.soundLayout === "qz" ? qzMapping : u357Mapping;
		const code = mapping.codes[plain];
		return code ? [code] : [];
	}
	if (scheme.soundLayout === "classic") {
		const tone = toneOf(syllable) ?? "1";
		return [
			...new Set(
				classicAlgebra
					.applyAll(`${plain}${tone}`)
					.filter((code) => /^[a-z]{3}$/u.test(code))
					.map((code) => code.slice(0, 2)),
			),
		];
	}
	const algebra =
		scheme.soundLayout === "d3v1" ? d3v1Algebra : overall17Algebra;
	const code = algebra.apply(`${plain}1`);
	return /^[a-z]{2}$/u.test(code) ? [code] : [];
}

function isDoublePinyinCapacity(
	capacity: BenchmarkCapacity,
): capacity is "21x21" | "21x26" {
	return capacity === "21x21" || capacity === "21x26";
}

function remapShapeCode(code: string, capacity: "21x21" | "21x26"): string {
	const source = semantics["21x21"].shapeKeysByMeaning;
	const target = semantics[capacity].shapeKeysByMeaning;
	return [...code]
		.map((key) => {
			const index = source.indexOf(key);
			return index >= 0 ? target[index] : "";
		})
		.join("");
}

function shapeCode(character: string, scheme: BenchmarkScheme): string {
	if (!isDoublePinyinCapacity(scheme.capacity)) return "";
	const source = scheme.id.includes("first")
		? firstShapeCodes
		: activeShapeCodes;
	return remapShapeCode(source.get(character) ?? "", scheme.capacity);
}

function strokeCodes(character: string, capacity: BenchmarkCapacity): string[] {
	if (!isDoublePinyinCapacity(capacity)) return [];
	const keys = semantics[capacity].strokeKeysByStroke;
	return (strokeDigits.get(character) ?? []).map((digits) =>
		[...digits].map((digit) => keys[Number(digit) - 1] ?? "").join(""),
	);
}

function sipinStrokeCodes(character: string): string[] {
	const keys = "eiuoa";
	return (strokeDigits.get(character) ?? []).map((digits) =>
		[...digits].map((digit) => keys[Number(digit) - 1] ?? "").join(""),
	);
}

function auxiliaryPositions(scheme: BenchmarkScheme, length: number): number[] {
	if (!isDoublePinyinCapacity(scheme.capacity)) return [];
	if (length < 2 || length > 4) return [];
	const policy = scheme.auxiliaryOrder.split("/")[length - 2];
	return policy ? [...policy].map(Number) : [];
}

function sipinCodes(word: string, sounds: string[]): BenchmarkCode[] {
	const result = new Map<string, BenchmarkCode>();
	if (sounds.length === 1) {
		const main = sounds[0];
		for (let length = 1; length <= main.length; length += 1) {
			const code = main.slice(0, length);
			result.set(code, { code, mainLength: length, auxiliaryLength: 0 });
		}
		for (const stroke of sipinStrokeCodes(word)) {
			for (let length = 1; length <= Math.min(stroke.length, 4); length += 1) {
				const code = main + stroke.slice(0, length);
				result.set(code, {
					code,
					mainLength: main.length,
					auxiliaryLength: length,
				});
			}
		}
		const shape = sipinShapeCodes.get(word) ?? "";
		for (let length = 1; length <= shape.length; length += 1) {
			const code = `${main}1${shape.slice(0, length)}`;
			result.set(code, {
				code,
				mainLength: main.length,
				auxiliaryLength: length + 1,
			});
		}
		return [...result.values()];
	}
	let main = sounds
		.map((code, index) =>
			index < 4 ? code[0].toLowerCase() : code[0].toUpperCase(),
		)
		.join("");
	main += sounds.at(-1)?.slice(1, 3) ?? "";
	main += sounds[0]?.slice(1, 3) ?? "";
	for (let length = sounds.length; length <= main.length; length += 1) {
		const code = main.slice(0, length);
		result.set(code, { code, mainLength: length, auxiliaryLength: 0 });
	}
	return [...result.values()];
}

function qingyunCodes(sounds: string[]): BenchmarkCode[] {
	if (sounds.length === 0) return [];
	const result = new Map<string, BenchmarkCode>();
	let main = sounds
		.map((code, index) =>
			index < 4 ? code[0].toLowerCase() : code[0].toUpperCase(),
		)
		.join("");
	result.set(main, {
		code: main,
		mainLength: main.length,
		auxiliaryLength: 0,
	});
	if (sounds.length <= 3) {
		main += sounds.at(-1)?.slice(1) ?? "";
		result.set(main, {
			code: main,
			mainLength: main.length,
			auxiliaryLength: 0,
		});
	}
	return [...result.values()];
}

function mainCode(scheme: BenchmarkScheme, sounds: string[]): string | null {
	if (sounds.length === 0) return null;
	if (sounds.length === 1) return sounds[0];
	if (sounds.length === 2) return sounds.join("");
	if (scheme.capacity === "21x26") {
		if (sounds.length === 3)
			return sounds.map((code) => code[0]).join("") + sounds[2][1];
		if (sounds.length === 4) return sounds.map((code) => code[0]).join("");
		return null;
	}
	return sounds
		.map((code, index) =>
			index < 4 ? code[0].toLowerCase() : code[0].toUpperCase(),
		)
		.join("");
}

function mainCodes(scheme: BenchmarkScheme, sounds: string[]): string[] {
	const base = mainCode(scheme, sounds);
	if (!base) return [];
	if (scheme.capacity !== "21x21" || sounds.length < 3) return [base];
	const result = new Set<string>();
	for (let mask = 0; mask < 1 << 3; mask += 1) {
		result.add(
			sounds
				.map((sound, index) => {
					const initial =
						index < 4 ? sound[0].toLowerCase() : sound[0].toUpperCase();
					return index < 3 && (mask & (1 << index)) !== 0
						? sound[0].toLowerCase() + sound[1].toUpperCase()
						: initial;
				})
				.join(""),
		);
	}
	return [...result];
}

function auxiliarySequences(
	scheme: BenchmarkScheme,
	word: string,
	syllables: string[],
): string[][] {
	if (!isDoublePinyinCapacity(scheme.capacity)) return [[]];
	const capacity = scheme.capacity;
	if (syllables.length === 1) {
		if (scheme.auxiliaryMode === "shape") {
			return [[...shapeCode(word, scheme)].slice(0, 4)];
		}
		const tone = toneOf(syllables[0]);
		const toneKey = tone
			? semantics[capacity].toneKeysByTone[Number(tone) - 1]
			: undefined;
		if (!toneKey) return [[]];
		const strokes = strokeCodes(word, capacity);
		return strokes.length > 0
			? strokes.map((stroke) => [toneKey, ...stroke].slice(0, 4))
			: [[toneKey]];
	}
	const positions = auxiliaryPositions(scheme, syllables.length);
	if (scheme.auxiliaryMode === "shape") {
		return [
			positions.map(
				(position) => shapeCode([...word][position - 1] ?? "", scheme)[0] ?? "",
			),
		];
	}
	return [
		positions.map((position) => {
			const tone = toneOf(syllables[position - 1] ?? "");
			if (!tone) return "";
			return semantics[capacity].toneKeysByTone[Number(tone) - 1] ?? "";
		}),
	];
}

export function pronunciationCodes(
	id: BenchmarkSchemeId,
	word: string,
	syllables: string[],
): BenchmarkCode[] {
	if ([...word].length !== syllables.length || syllables.length === 0)
		return [];
	const scheme = schemeById(id);
	const result = new Map<string, BenchmarkCode>();
	let soundCombinations: string[][] = [[]];
	for (const syllable of syllables) {
		const alternatives = soundCodes(scheme, syllable);
		if (alternatives.length === 0) return [];
		soundCombinations = soundCombinations.flatMap((prefix) =>
			alternatives.map((code) => [...prefix, code]),
		);
	}
	for (const sounds of soundCombinations) {
		if (scheme.soundLayout === "sipin") {
			for (const generated of sipinCodes(word, sounds))
				result.set(generated.code, generated);
			continue;
		}
		if (scheme.soundLayout === "qingyun") {
			for (const generated of qingyunCodes(sounds))
				result.set(generated.code, generated);
			continue;
		}
		for (const main of mainCodes(scheme, sounds)) {
			if (syllables.length === 1) {
				result.set(main.slice(0, 1), {
					code: main.slice(0, 1),
					mainLength: 1,
					auxiliaryLength: 0,
				});
			}
			if (scheme.capacity === "21x26" && syllables.length === 3) {
				result.set(main.slice(0, 3), {
					code: main.slice(0, 3),
					mainLength: 3,
					auxiliaryLength: 0,
				});
			}
			result.set(main, {
				code: main,
				mainLength: main.length,
				auxiliaryLength: 0,
			});
			for (const sequence of auxiliarySequences(scheme, word, syllables)) {
				let code = main;
				for (const auxiliary of sequence) {
					if (!auxiliary) break;
					code += auxiliary;
					result.set(code, {
						code,
						mainLength: main.length,
						auxiliaryLength: code.length - main.length,
					});
				}
			}
		}
	}
	if (scheme.soundLayout === "qingyun" && syllables.length === 1) {
		for (const readings of qingyunShapeReadings.get(word) ?? []) {
			let combinations: string[][] = [[]];
			for (const reading of readings) {
				const alternatives = soundCodes(scheme, reading);
				combinations = combinations.flatMap((prefix) =>
					alternatives.map((code) => [...prefix, code]),
				);
			}
			for (const combination of combinations) {
				for (const generated of qingyunCodes(combination))
					result.set(generated.code, generated);
			}
		}
	}
	return [...result.values()];
}

export function isPoppableCode(
	id: BenchmarkSchemeId,
	code: BenchmarkCode,
): boolean {
	const scheme = schemeById(id);
	if (code.auxiliaryLength > 0) return true;
	if (scheme.soundLayout === "sipin")
		return (
			code.mainLength >= 4 ||
			/^[bpmfdtnlgkhjqxzcsrwyv].*[aeiou]$/u.test(code.code)
		);
	if (scheme.soundLayout === "qingyun")
		return code.mainLength >= 4 || /[aoeiu;,./]$/u.test(code.code);
	if (scheme.capacity === "21x26") return code.mainLength >= 4;
	return /^(?:[bpmfdtnlgkhjqxzcsrwye][A-Z]?){4}$/u.test(code.code);
}

export function isPoppableFixedCode(
	id: BenchmarkSchemeId,
	code: string,
): boolean {
	const scheme = schemeById(id);
	if (scheme.soundLayout === "sipin")
		return code.length >= 4 || /^[bpmfdtnlgkhjqxzcsrwyv].*[aeiou]$/u.test(code);
	if (scheme.soundLayout === "qingyun")
		return code.length >= 4 || /[aoeiu;,./]$/u.test(code);
	if (scheme.capacity === "21x26") return code.length >= 4;
	if (scheme.capacity !== "21x21") return false;
	const auxiliaryKeys = new Set([
		...semantics[scheme.capacity].shapeKeysByMeaning,
	]);
	return (
		[...code].some((key) => auxiliaryKeys.has(key)) ||
		(code.length >= 4 && /^[bpmfdtnlgkhjqxzcsrwye]+$/u.test(code))
	);
}
