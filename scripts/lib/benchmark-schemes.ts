import { readFileSync } from "node:fs";
import { loadAuxiliarySemantics } from "./auxiliary-semantics";
import { SpellingAlgebra } from "./algebra";
import { rootPath } from "./paths";
import { plainSyllable, readShapeCodes, toneOf } from "../固顶编译器";

export type BenchmarkSchemeId =
	| "classic-tone"
	| "classic-shape"
	| "u357-tone"
	| "u357-shape"
	| "overall17-tone"
	| "overall17-shape";

export type BenchmarkCapacity = "21x21" | "21x26";
export type BenchmarkAuxiliaryMode = "tone" | "shape";

export interface BenchmarkScheme {
	id: BenchmarkSchemeId;
	name: string;
	shortName: string;
	capacity: BenchmarkCapacity;
	soundLayout: "classic" | "u357" | "overall17";
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
		id: "u357-shape",
		name: "冰雪健道（U357 21×21）",
		shortName: "冰雪健道",
		capacity: "21x21",
		soundLayout: "u357",
		auxiliaryMode: "shape",
		fixedFile: "snow_jiandao.fixed.txt",
		auxiliaryOrder: "12/231/24",
	},
	{
		id: "u357-tone",
		name: "冰雪弎拼（U357 21×21）",
		shortName: "冰雪弎拼",
		capacity: "21x21",
		soundLayout: "u357",
		auxiliaryMode: "tone",
		fixedFile: "snow_sanpin.fixed.txt",
		auxiliaryOrder: "12/213/23",
	},
	{
		id: "overall17-shape",
		name: "冰雪简道（Overall-17 21×26）",
		shortName: "冰雪简道",
		capacity: "21x26",
		soundLayout: "overall17",
		auxiliaryMode: "shape",
		fixedFile: "snow_shenyun_shape.fixed.txt",
		auxiliaryOrder: "12/21/42",
	},
	{
		id: "overall17-tone",
		name: "冰雪散拼（Overall-17 21×26）",
		shortName: "冰雪散拼",
		capacity: "21x26",
		soundLayout: "overall17",
		auxiliaryMode: "tone",
		fixedFile: "snow_shenyun_tone.fixed.txt",
		auxiliaryOrder: "12/21/13",
	},
] as const;

export const LEGACY_BENCHMARK_SCHEMES: readonly BenchmarkScheme[] = [
	{
		id: "classic-shape",
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
const u357Mapping = JSON.parse(
	readFileSync(rootPath("docs", "shenyun-u357-mapping.json"), "utf8"),
) as { codes: Record<string, string | null> };
const overall17Algebra = new SpellingAlgebra(
	rootPath("snow_shenyun_common.yaml"),
	"shenyun_algebra",
	{ derive: false },
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
const u357ShapeCodes = readShapeCodes(
	rootPath("snow_jiandao_chaifen.dict.yaml"),
	Object.fromEntries(shapeElementKeys),
);

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

function soundCodes(scheme: BenchmarkScheme, syllable: string): string[] {
	const plain = plainSyllable(syllable);
	if (scheme.soundLayout === "u357") {
		const code = u357Mapping.codes[plain];
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
	const code = overall17Algebra.apply(`${plain}1`);
	return /^[a-z]{2}$/u.test(code) ? [code] : [];
}

function remapShapeCode(code: string, capacity: BenchmarkCapacity): string {
	const source = semantics["21x21"].shapeKeysByMeaning;
	const target = semantics[capacity].shapeKeysByMeaning;
	return [...code]
		.map((key) => {
			const index = source.indexOf(key);
			return index >= 0 ? target[index] : "";
		})
		.join("");
}

function shapeCode(character: string, capacity: BenchmarkCapacity): string {
	return remapShapeCode(u357ShapeCodes.get(character) ?? "", capacity);
}

function strokeCodes(character: string, capacity: BenchmarkCapacity): string[] {
	const keys = semantics[capacity].strokeKeysByStroke;
	return (strokeDigits.get(character) ?? []).map((digits) =>
		[...digits].map((digit) => keys[Number(digit) - 1] ?? "").join(""),
	);
}

function auxiliaryPositions(scheme: BenchmarkScheme, length: number): number[] {
	if (scheme.capacity === "21x26") {
		if (length === 2) return [1, 2];
		if (length === 3) return [2, 1];
		if (length === 4) return scheme.auxiliaryMode === "tone" ? [1, 3] : [4, 2];
		return [];
	}
	if (scheme.auxiliaryMode === "shape") {
		if (length === 2) return [1, 2];
		if (length === 3) return [2, 3, 1];
		if (length === 4) return [2, 4];
		return [];
	}
	if (length === 2) return [1, 2];
	if (length === 3) return [2, 1, 3];
	if (length === 4) return [2, 3];
	return [];
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
	if (scheme.capacity !== "21x21" || sounds.length < 3 || sounds.length > 4)
		return [base];
	const result = new Set<string>();
	for (let mask = 0; mask < 1 << 3; mask += 1) {
		result.add(
			sounds
				.map((sound, index) => {
					const initial = sound[0].toLowerCase();
					return index < 3 && (mask & (1 << index)) !== 0
						? initial + sound[1].toUpperCase()
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
	if (syllables.length === 1) {
		if (scheme.auxiliaryMode === "shape") {
			return [[...shapeCode(word, scheme.capacity)].slice(0, 4)];
		}
		const tone = toneOf(syllables[0]);
		const toneKey = tone
			? scheme.soundLayout === "classic"
				? "viuoa"[Number(tone) - 1]
				: semantics[scheme.capacity].toneKeysByTone[Number(tone) - 1]
			: undefined;
		if (!toneKey) return [[]];
		const strokes = strokeCodes(word, scheme.capacity);
		return strokes.length > 0
			? strokes.map((stroke) => [toneKey, ...stroke].slice(0, 4))
			: [[toneKey]];
	}
	const positions = auxiliaryPositions(scheme, syllables.length);
	if (scheme.auxiliaryMode === "shape") {
		return [
			positions.map(
				(position) =>
					shapeCode([...word][position - 1] ?? "", scheme.capacity)[0] ?? "",
			),
		];
	}
	return [
		positions.map((position) => {
			const tone = toneOf(syllables[position - 1] ?? "");
			if (!tone) return "";
			return scheme.soundLayout === "classic"
				? ("viuoa"[Number(tone) - 1] ?? "")
				: (semantics[scheme.capacity].toneKeysByTone[Number(tone) - 1] ?? "");
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
	return [...result.values()];
}

export function isPoppableCode(
	id: BenchmarkSchemeId,
	code: BenchmarkCode,
): boolean {
	const scheme = schemeById(id);
	if (code.auxiliaryLength > 0) return true;
	if (scheme.capacity === "21x26") return code.mainLength >= 4;
	return /^(?:[bpmfdtnlgkhjqxzcsrwye][A-Z]?){4}$/u.test(code.code);
}

export function isPoppableFixedCode(
	id: BenchmarkSchemeId,
	code: string,
): boolean {
	const scheme = schemeById(id);
	if (scheme.capacity === "21x26") return code.length >= 4;
	const auxiliaryKeys = new Set([
		...semantics[scheme.capacity].shapeKeysByMeaning,
	]);
	return (
		[...code].some((key) => auxiliaryKeys.has(key)) ||
		(code.length >= 4 && /^[bpmfdtnlgkhjqxzcsrwye]+$/u.test(code))
	);
}
