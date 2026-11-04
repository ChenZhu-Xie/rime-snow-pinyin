import {
	type BenchmarkCode,
	type BenchmarkSchemeId,
	isPoppableCode,
	pronunciationCodes,
} from "./benchmark-schemes";
import { plainSyllable } from "../固顶编译器";

export interface BenchmarkDictionaryEntry {
	word: string;
	syllables: string[];
	weight: number;
}

export interface RankedBenchmarkCode extends BenchmarkCode {
	word: string;
	rank: number;
	popppable: boolean;
	candidates: string[];
	path: string[];
}

interface TargetRoute {
	word: string;
	generated: BenchmarkCode;
	path: string[];
}

const fallbackSyllables = new Set([
	"biang",
	"bong",
	"cei",
	"chua",
	"din",
	"eng",
	"fiao",
	"gue",
	"hm",
	"len",
	"lvan",
	"n",
	"nia",
	"nui",
	"nun",
	"pia",
	"r",
	"rua",
	"sei",
	"tei",
	"wong",
	"yai",
	"zhei",
	"ê",
]);

function wordLength(word: string): number {
	return [...word].length;
}

function routeKey(word: string, code: string): string {
	return `${word}\t${code}`;
}

function singleMainCode(
	scheme: BenchmarkSchemeId,
	character: string,
	syllable: string,
): string | undefined {
	return pronunciationCodes(scheme, character, [syllable]).find(
		({ mainLength, auxiliaryLength }) =>
			mainLength === 2 && auxiliaryLength === 0,
	)?.code;
}

function occupiedSingleCodes(
	scheme: BenchmarkSchemeId,
	entries: BenchmarkDictionaryEntry[],
): Set<string> {
	const occupied = new Set<string>();
	for (const entry of entries) {
		if (wordLength(entry.word) !== 1 || entry.syllables.length !== 1) continue;
		if (fallbackSyllables.has(plainSyllable(entry.syllables[0]))) continue;
		const code = singleMainCode(scheme, entry.word, entry.syllables[0]);
		if (code) occupied.add(code);
	}
	return occupied;
}

function wordCodes(
	scheme: BenchmarkSchemeId,
	entry: BenchmarkDictionaryEntry,
	occupied: ReadonlySet<string>,
	fixed?: ReadonlyMap<string, { word: string }>,
): BenchmarkCode[] {
	const regular = pronunciationCodes(scheme, entry.word, entry.syllables);
	const result = new Map(
		regular.map((generated) => [generated.code, generated]),
	);
	const characters = [...entry.word];
	if (characters.length !== entry.syllables.length) return [...result.values()];
	const overall = scheme.startsWith("overall17-");
	if (characters.length === 2) {
		const regularMain = regular.find(
			({ mainLength, auxiliaryLength }) =>
				mainLength === 4 && auxiliaryLength === 0,
		)?.code;
		if (!regularMain) return [...result.values()];
		const shortMain = regularMain[0] + regularMain[2];
		const vacant = !occupied.has(shortMain);
		const fixedOwner = fixed?.get(shortMain)?.word === entry.word;
		const reserved = scheme === "u357-shape" && /^(?:xh|xw)$/u.test(shortMain);
		if ((vacant || fixedOwner) && !reserved) {
			result.set(shortMain, {
				code: shortMain,
				mainLength: shortMain.length,
				auxiliaryLength: 0,
			});
		}
		if (vacant && !reserved) {
			const regularMainLength = 4;
			if (overall) {
				for (const generated of regular) {
					if (
						generated.mainLength === regularMainLength &&
						generated.auxiliaryLength > 0
					) {
						const suffix = generated.code.slice(regularMainLength);
						const code = shortMain + suffix;
						result.set(code, {
							code,
							mainLength: shortMain.length,
							auxiliaryLength: suffix.length,
						});
					}
				}
			} else {
				const auxiliaryLength = scheme.endsWith("-tone") ? 2 : 1;
				const source = regular.find(
					(generated) =>
						generated.mainLength === regularMainLength &&
						generated.auxiliaryLength === auxiliaryLength,
				);
				const auxiliary = source?.code.at(-1);
				if (auxiliary) {
					const code = shortMain + auxiliary;
					result.set(code, {
						code,
						mainLength: shortMain.length,
						auxiliaryLength: 1,
					});
				}
			}
		}
	}
	const overallThreeMain = regular.find(
		({ mainLength, auxiliaryLength }) =>
			mainLength === 4 && auxiliaryLength === 0,
	)?.code;
	if (
		overall &&
		characters.length === 3 &&
		overallThreeMain &&
		!occupied.has(overallThreeMain.slice(2, 4))
	) {
		const shortMain = overallThreeMain.slice(0, 3);
		for (const generated of regular) {
			if (generated.mainLength === 4 && generated.auxiliaryLength > 0) {
				const suffix = generated.code.slice(4);
				const code = shortMain + suffix;
				result.set(code, {
					code,
					mainLength: shortMain.length,
					auxiliaryLength: suffix.length,
				});
			}
		}
	}
	return [...result.values()];
}

function uniquePath(codes: string[]): string[] {
	return [...new Set(codes)].sort(
		(left, right) => left.length - right.length || left.localeCompare(right),
	);
}

function addTopCandidate(
	top: Map<string, Array<{ word: string; weight: number }>>,
	code: string,
	entry: BenchmarkDictionaryEntry,
): void {
	const candidates = top.get(code) ?? [];
	const existing = candidates.find(
		(candidate) => candidate.word === entry.word,
	);
	if (existing) {
		existing.weight = Math.max(existing.weight, entry.weight);
	} else {
		candidates.push({ word: entry.word, weight: entry.weight });
	}
	candidates.sort(
		(left, right) =>
			right.weight - left.weight ||
			left.word.localeCompare(right.word, "zh-CN"),
	);
	if (candidates.length > 10) candidates.length = 10;
	top.set(code, candidates);
}

function postponedCandidates(
	path: string[],
	top: ReadonlyMap<string, Array<{ word: string; weight: number }>>,
	fixed: ReadonlyMap<string, { word: string }>,
): string[] {
	const knownCandidates = new Map<string, number>();
	let result: string[] = [];
	for (const code of path) {
		for (const [word, length] of knownCandidates) {
			if (length >= code.length) knownCandidates.delete(word);
		}
		const fixedOwner = fixed.get(code)?.word;
		const freeCandidates = (top.get(code) ?? [])
			.map((candidate) => candidate.word)
			.filter((word) => word !== fixedOwner);
		const postponed = freeCandidates
			.filter((word) => knownCandidates.has(word))
			.sort(
				(left, right) =>
					(knownCandidates.get(right) ?? 0) - (knownCandidates.get(left) ?? 0),
			);
		const regular = freeCandidates.filter((word) => !knownCandidates.has(word));
		const reordered =
			regular.length > 0
				? [regular[0], ...postponed, ...regular.slice(1)]
				: postponed;
		result = fixedOwner ? [fixedOwner, ...reordered] : reordered;
		const first = result[0];
		if (first) knownCandidates.set(first, code.length);
	}
	return result;
}

export function rankBenchmarkCodes(
	scheme: BenchmarkSchemeId,
	targetEntries: Iterable<BenchmarkDictionaryEntry>,
	allEntries: Iterable<BenchmarkDictionaryEntry>,
	fixed: ReadonlyMap<string, { word: string }>,
): RankedBenchmarkCode[] {
	const targets = [...targetEntries];
	const entries = [...allEntries];
	const occupied = occupiedSingleCodes(scheme, entries);
	const relevantCodes = new Set<string>();
	const routes = new Map<string, TargetRoute[]>();
	for (const entry of targets) {
		const generatedCodes = wordCodes(scheme, entry, occupied, fixed);
		for (const generated of generatedCodes) {
			const path = generatedCodes
				.filter(
					(stage) =>
						stage.code.length <= generated.code.length &&
						generated.code.startsWith(stage.code),
				)
				.map((stage) => stage.code);
			for (let length = 1; length < generated.code.length; length += 1) {
				const prefix = generated.code.slice(0, length);
				const fixedWord = fixed.get(prefix)?.word;
				if (fixedWord && wordLength(fixedWord) === wordLength(entry.word)) {
					path.push(prefix);
				}
			}
			const normalizedPath = uniquePath(path);
			for (const code of normalizedPath) relevantCodes.add(code);
			const key = routeKey(entry.word, generated.code);
			const values = routes.get(key) ?? [];
			if (
				!values.some(
					(value) => value.path.join("\t") === normalizedPath.join("\t"),
				)
			) {
				values.push({ word: entry.word, generated, path: normalizedPath });
				routes.set(key, values);
			}
		}
	}

	const top = new Map<string, Array<{ word: string; weight: number }>>();
	for (const entry of entries) {
		for (const generated of wordCodes(scheme, entry, occupied, fixed)) {
			if (relevantCodes.has(generated.code)) {
				addTopCandidate(top, generated.code, entry);
			}
		}
	}

	const pathCache = new Map<string, string[]>();
	const result: RankedBenchmarkCode[] = [];
	for (const values of routes.values()) {
		let best: RankedBenchmarkCode | undefined;
		for (const route of values) {
			const pathKey = route.path.join("\t");
			let candidates = pathCache.get(pathKey);
			if (!candidates) {
				candidates = postponedCandidates(route.path, top, fixed);
				pathCache.set(pathKey, candidates);
			}
			const index = candidates.indexOf(route.word);
			const ranked: RankedBenchmarkCode = {
				...route.generated,
				word: route.word,
				rank: index >= 0 ? index + 1 : 11,
				popppable: isPoppableCode(scheme, route.generated),
				candidates: candidates.slice(0, 3),
				path: route.path,
			};
			if (!best || ranked.rank < best.rank) best = ranked;
		}
		if (best) result.push(best);
	}
	return result;
}
