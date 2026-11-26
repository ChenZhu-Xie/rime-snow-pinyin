import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { plainSyllable, readShapeCodes, toneOf } from "../固顶编译器";
import { SpellingAlgebra } from "./algebra";
import { loadAuxiliarySemantics } from "./auxiliary-semantics";
import { rootPath } from "./paths";

export type BenchmarkSchemeId =
	| "sipin"
	| "qingyun"
	| "classic-tone"
	| "classic-shape"
	| "oc21-tone"
	| "oc21-shape"
	| "rc26-tone"
	| "rc26-shape"
	| "liandao"
	| "zhudao";

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
		| "oc21"
		| "rc26"
		| "liandao"
		| "zhudao";
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
		id: "oc21-shape",
		schemaId: "snow_landao",
		name: "冰雪兰道（UED-3158ce08b5bc 21×21）",
		shortName: "冰雪兰道",
		capacity: "21x21",
		soundLayout: "oc21",
		auxiliaryMode: "shape",
		fixedFile: "snow_landao.fixed.txt",
		auxiliaryOrder: "12/231/23",
	},
	{
		id: "oc21-tone",
		schemaId: "snow_lanpin",
		name: "冰雪兰拼（UED-3158ce08b5bc 21×21）",
		shortName: "冰雪兰拼",
		capacity: "21x21",
		soundLayout: "oc21",
		auxiliaryMode: "tone",
		fixedFile: "snow_lanpin.fixed.txt",
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
		id: "rc26-shape",
		schemaId: "snow_hedao",
		name: "冰雪鹤道（RC26-39a5bfdc045342cd 21×26）",
		shortName: "冰雪鹤道",
		capacity: "21x26",
		soundLayout: "rc26",
		auxiliaryMode: "shape",
		fixedFile: "snow_hedao.fixed.txt",
		auxiliaryOrder: "12/12/24",
	},
	{
		id: "rc26-tone",
		schemaId: "snow_hepin",
		name: "冰雪鹤拼（RC26-39a5bfdc045342cd 21×26）",
		shortName: "冰雪鹤拼",
		capacity: "21x26",
		soundLayout: "rc26",
		auxiliaryMode: "tone",
		fixedFile: "snow_hepin.fixed.txt",
		auxiliaryOrder: "12/21/13",
	},
	{
		id: "liandao",
		schemaId: "snow_liandao",
		name: "冰雪莲道（CR-REF-7e650f7a4c 21×21 带调）",
		shortName: "冰雪莲道",
		capacity: "21x21",
		soundLayout: "liandao",
		auxiliaryMode: "shape",
		fixedFile: "snow_liandao.fixed.txt",
		auxiliaryOrder: "21/231/14",
	},
	{
		id: "zhudao",
		schemaId: "snow_huandao",
		name: "冰雪鹮道（T2126-V52-M4-ec60a3637a99 21×26 带调）",
		shortName: "冰雪鹮道",
		capacity: "21x26",
		soundLayout: "zhudao",
		auxiliaryMode: "shape",
		fixedFile: "snow_huandao.fixed.txt",
		auxiliaryOrder: "21/12/23",
	},
] as const;

export const LEGACY_BENCHMARK_SCHEMES: readonly BenchmarkScheme[] = [
	{
		id: "classic-shape",
		schemaId: "snow_jiandao",
		name: "冰雪键道",
		shortName: "冰雪键道",
		capacity: "21x21",
		soundLayout: "classic",
		auxiliaryMode: "shape",
		fixedFile: "snow_jiandao.fixed.txt",
		auxiliaryOrder: "12/231/24",
	},
	{
		id: "classic-tone",
		schemaId: "snow_sanpin",
		name: "冰雪三拼",
		shortName: "冰雪三拼",
		capacity: "21x21",
		soundLayout: "classic",
		auxiliaryMode: "tone",
		fixedFile: "snow_sanpin.fixed.txt",
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
	readFileSync(
		rootPath("docs", "shenyun-ued-3158ce08b5bc-mapping.json"),
		"utf8",
	),
) as { codes: Record<string, string | null> };
const rc26Algebra = new SpellingAlgebra(
	rootPath("snow_shenyun_common.yaml"),
	"shenyun_algebra",
	{ derive: false },
);
const zhudaoAlgebra = new SpellingAlgebra(
	rootPath("snow_huandao.schema.yaml"),
	"shenyun_algebra",
	{ derive: false },
);
const liandaoAlgebra = new SpellingAlgebra(
	rootPath("snow_liandao_common.yaml"),
	"jiandao_toned_algebra",
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
	rootPath("snow_landao_chaifen.dict.yaml"),
	Object.fromEntries(shapeElementKeys),
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
		id === "rc26-shape" ||
		id === "rc26-tone" ||
		id === "zhudao"
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
	if (scheme.soundLayout === "liandao") {
		const code = liandaoAlgebra.apply(syllable.replace(/0$/u, "5"));
		return /^[a-z]{2}$/u.test(code) ? [code] : [];
	}
	if (scheme.soundLayout === "zhudao") {
		const code = zhudaoAlgebra.apply(syllable.replace(/0$/u, "5"));
		return /^[a-z]{2}$/u.test(code) ? [code] : [];
	}
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
	if (scheme.soundLayout === "oc21") {
		const code = qzMapping.codes[plain];
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
	const code = rc26Algebra.apply(`${plain}1`);
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
	return remapShapeCode(activeShapeCodes.get(character) ?? "", scheme.capacity);
}

/** 21×21 道系 shape_filter 对没有部件记录的汉字放行任意形辅；英数不走此分支。 */
export function passesUnknownShape(
	id: BenchmarkSchemeId,
	text: string,
): boolean {
	return (
		["oc21-shape", "classic-shape", "liandao"].includes(id) &&
		/^\p{Script=Han}$/u.test(text) &&
		!activeShapeCodes.get(text)
	);
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
	const policy =
		length === 2
			? standardWordOrder(scheme)
			: scheme.auxiliaryOrder.split("/")[length - 2];
	return policy ? [...policy].map(Number) : [];
}

const wordOrders = new Map<string, string>();
function standardWordOrder(scheme: BenchmarkScheme): string {
	const cached = wordOrders.get(scheme.id);
	if (cached) return cached;
	const source = load(
		readFileSync(rootPath(`${scheme.schemaId}.schema.yaml`), "utf8"),
	) as {
		translator?: { word_auxiliary_order: string };
		patch?: Record<string, unknown>;
	};
	const order =
		source.translator?.word_auxiliary_order ??
		source.patch?.["translator/word_auxiliary_order"];
	if (order !== "12" && order !== "21")
		throw new Error(`${scheme.schemaId} 缺少标准二字词辅序`);
	wordOrders.set(scheme.id, order);
	return order;
}

function sipinCodes(
	word: string,
	sounds: string[],
	singleAuxiliaryLimit = 4,
): BenchmarkCode[] {
	const result = new Map<string, BenchmarkCode>();
	if (sounds.length === 1) {
		const main = sounds[0];
		for (let length = 1; length <= main.length; length += 1) {
			const code = main.slice(0, length);
			result.set(code, { code, mainLength: length, auxiliaryLength: 0 });
		}
		for (const stroke of sipinStrokeCodes(word)) {
			for (
				let length = 1;
				length <= Math.min(stroke.length, singleAuxiliaryLimit);
				length += 1
			) {
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
		return sounds
			.map((code, index) => (index < 4 ? code[0] : code[0].toUpperCase()))
			.join("");
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
	if (scheme.capacity === "21x26" && sounds.length >= 5)
		return Array.from({ length: base.length - 3 }, (_, i) =>
			base.slice(0, i + 4),
		);
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
	singleAuxiliaryLimit = 4,
): string[][] {
	if (!isDoublePinyinCapacity(scheme.capacity)) return [[]];
	const capacity = scheme.capacity;
	if (syllables.length === 1) {
		if (scheme.auxiliaryMode === "shape") {
			const shape = shapeCode(word, scheme);
			const completed =
				shape.length > 0 && shape.length < 4 ? shape + shape.at(-1) : shape;
			return [[...completed].slice(0, singleAuxiliaryLimit)];
		}
		const tone = toneOf(syllables[0]);
		const toneKey = tone
			? semantics[capacity].toneKeysByTone[Number(tone) - 1]
			: undefined;
		if (!toneKey) return [[]];
		const strokes = strokeCodes(word, capacity);
		return strokes.length > 0
			? strokes.map((stroke) =>
					[toneKey, ...stroke].slice(0, singleAuxiliaryLimit),
				)
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

// 声声空桶使用各方案标准二字词辅序的反序，每字连续取两辅。
// 仅生成实际空桶；字母保留码仍由方案 recognizer/processor 决定，不能当作可用筛选码。
const initialPairOccupied = new Map<string, Set<string>>();
export function initialPairCodes(
	id: BenchmarkSchemeId,
	word: string,
	syllables: string[],
	standardOrder?: string,
	occupiedOverride?: ReadonlySet<string>,
): BenchmarkCode[] {
	const scheme = schemeById(id);
	if (
		!isDoublePinyinCapacity(scheme.capacity) ||
		syllables.length !== 2 ||
		[...word].length !== 2
	)
		return [];
	let occupied = occupiedOverride ?? initialPairOccupied.get(id);
	if (!occupied) {
		const generatedOccupied = new Set<string>();
		for (const line of readFileSync(
			rootPath("snow_pinyin.dict.yaml"),
			"utf8",
		).split(/\r?\n/u)) {
			const [character, spelling, rawWeight] = line.split("\t");
			if (!spelling || [...character].length !== 1 || Number(rawWeight) <= 1)
				continue;
			for (const code of soundCodes(scheme, spelling))
				generatedOccupied.add(code);
		}
		initialPairOccupied.set(id, generatedOccupied);
		occupied = generatedOccupied;
	}
	const sounds = syllables.map((spelling) => soundCodes(scheme, spelling)[0]);
	if (sounds.some((code) => !code)) return [];
	const main = sounds.map((code) => code[0]).join("");
	const initialKeys =
		scheme.capacity === "21x26"
			? "bpmfdtnlgkhjqwvxrzcsy"
			: "bpmfdtnlgkhjqxzcsrwye";
	if (
		![...main].every((key) => initialKeys.includes(key)) ||
		occupied.has(main)
	)
		return [];
	const order = standardOrder ?? standardWordOrder(scheme);
	if (order !== "12" && order !== "21")
		throw new Error(`无效二字词辅序：${order}`);
	const options = [...word].map((character, index) =>
		auxiliarySequences(scheme, character, [syllables[index]]).map((sequence) =>
			sequence.slice(0, 2).join(""),
		),
	);
	let codes = [""];
	for (const [index, position] of [...order].reverse().map(Number).entries()) {
		codes = codes.flatMap((prefix) =>
			prefix.length < index * 2
				? [prefix]
				: options[position - 1].map((suffix) => prefix + suffix),
		);
	}
	const result = new Map<string, BenchmarkCode>();
	for (const suffix of codes) {
		for (let length = 0; length <= suffix.length; length += 1) {
			const code = main + suffix.slice(0, length);
			result.set(code, { code, mainLength: 2, auxiliaryLength: length });
		}
	}
	return [...result.values()];
}

export function pronunciationCodes(
	id: BenchmarkSchemeId,
	word: string,
	syllables: string[],
	options: { singleAuxiliaryLimit?: number } = {},
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
			for (const generated of sipinCodes(
				word,
				sounds,
				options.singleAuxiliaryLimit,
			))
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
			for (const sequence of auxiliarySequences(
				scheme,
				word,
				syllables,
				options.singleAuxiliaryLimit,
			)) {
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

const singleSpellingAlgebras = new Map<BenchmarkSchemeId, SpellingAlgebra>();
const singleSpellings = new Map<string, string[]>();
const singleInitials = new Map<string, string[]>();

/** 单字离线枚举使用生产 speller；不改变 5500 字评测原有的标准码合同。 */
export function productionCharacterCodes(
	id: BenchmarkSchemeId,
	text: string,
	reading: string,
	firstKey?: string,
): BenchmarkCode[] {
	const scheme = schemeById(id);
	let algebra = singleSpellingAlgebras.get(id);
	if (!algebra) {
		algebra = new SpellingAlgebra(
			rootPath(`${scheme.schemaId}.schema.yaml`),
			"speller/algebra",
		);
		singleSpellingAlgebras.set(id, algebra);
	}
	const key = `${id}:${reading}`;
	const literal = reading.startsWith("~") || !/^\p{Script=Han}$/u.test(text);
	let spellings = singleSpellings.get(key);
	if (!spellings && (literal || id === "sipin")) {
		spellings = algebra.applyAll(reading);
		singleSpellings.set(key, spellings);
	}
	if (firstKey) {
		let initials = singleInitials.get(key);
		if (!initials) {
			initials = [
				...new Set(
					(spellings ?? soundCodes(scheme, reading)).map((code) => code[0]),
				),
			];
			singleInitials.set(key, initials);
		}
		if (!initials.includes(firstKey)) return [];
	}
	if (literal) {
		return spellings!
			.filter((code) => /^[a-z;,./]+$/u.test(code))
			.map((code) => ({ code, mainLength: code.length, auxiliaryLength: 0 }));
	}
	if (id === "qingyun") return qingyunReadingCodes([reading]);
	if (id !== "sipin")
		return pronunciationCodes(id, text, [reading], {
			singleAuxiliaryLimit: Infinity,
		});
	const result = new Map<string, BenchmarkCode>();
	const mains = spellings!.filter((code) =>
		/^[bpmfdtnlgkhjqxzcsrwyv][aeiou]{1,3}$/u.test(code),
	);
	for (const main of mains) {
		for (let length = 1; length <= main.length; length++) {
			const code = main.slice(0, length);
			result.set(code, { code, mainLength: length, auxiliaryLength: 0 });
		}
		// 生产规则只在四键主输入之后把后续元音键放进 shape_input。
		if (main.length === 4) {
			for (const strokes of sipinStrokeCodes(text))
				for (let length = 1; length <= strokes.length; length++) {
					const code = main + strokes.slice(0, length);
					result.set(code, { code, mainLength: 4, auxiliaryLength: length });
				}
		}
	}
	// 部件辅助码入口 1 可以接在一至四键音码后，不能仅枚举完整音节。
	const shape = sipinShapeCodes.get(text) ?? "";
	for (const base of [...result.values()].filter(
		({ auxiliaryLength }) => auxiliaryLength === 0,
	)) {
		// 入口键自身也会刷新候选与首选后置，尚未输入部件时不能跳过。
		for (let length = 0; length <= shape.length; length++) {
			const code = base.code + "1" + shape.slice(0, length);
			result.set(code, {
				code,
				mainLength: base.code.length,
				auxiliaryLength: length + 1,
			});
		}
	}
	return [...result.values()];
}

/** 清韵音节／字根的前缀合同；单字形码与拼音分别提供各自的词典权重。 */
const qingyunSingleSounds = new Map<string, string>();
export function qingyunReadingCodes(
	readings: readonly string[],
	word = false,
): BenchmarkCode[] {
	const sounds = readings.map((reading) => {
		let code = qingyunSingleSounds.get(reading);
		if (code === undefined) {
			code = qingyunAlgebra.apply(reading);
			qingyunSingleSounds.set(reading, code);
		}
		return code;
	});
	if (
		sounds.some((code) => !/^[bpmfdtnlgkhjqxzcsrwyv][aoeiu;,./]$/u.test(code))
	)
		return [];
	const main = sounds
		.slice(0, 4)
		.map((code) => code[0])
		.join("");
	const codes = new Set<string>();
	if (main && (!word || readings.length !== 2)) codes.add(main);
	if (readings.length <= 3 && sounds.length > 0)
		codes.add(main + sounds.at(-1)![1]);
	return [...codes].map((code) => ({
		code,
		mainLength: code.length,
		auxiliaryLength: 0,
	}));
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
