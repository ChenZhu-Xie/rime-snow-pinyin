import type { RankedBenchmarkCode } from "./benchmark-ranking";

export interface BenchmarkAlternative<Source extends string = string> {
	word: string;
	displayCode: string;
	rawCode: string;
	keyCost: number;
	instant: boolean;
	popppable: boolean;
	source: Source;
	shift: number;
	selectionCount: number;
	punctuationNeedsSeparator?: boolean;
}

export interface BenchmarkToken<Source extends string = string>
	extends BenchmarkAlternative<Source> {
	start: number;
	end: number;
	separator: boolean;
}

export interface BenchmarkPathResult<Source extends string = string> {
	tokens: BenchmarkToken<Source>[];
	keys: number;
	spaces: number;
	shifts: number;
	fixedCount: number;
	selectionCount: number;
	codeLength: number;
}

const fixedSources = new Set(["一简", "二简单字", "二简词", "630"]);

export function preferredRankedCodes(
	codes: RankedBenchmarkCode[],
	maximumFallbackRank = 3,
): RankedBenchmarkCode[] {
	const byWord = new Map<string, RankedBenchmarkCode[]>();
	for (const code of codes) {
		const values = byWord.get(code.word) ?? [];
		values.push(code);
		byWord.set(code.word, values);
	}
	const result: RankedBenchmarkCode[] = [];
	for (const values of byWord.values()) {
		const firstChoices = values.filter(({ rank }) => rank === 1);
		if (firstChoices.length > 0) {
			const minimumLength = Math.min(
				...firstChoices.map(({ code }) => code.length),
			);
			result.push(
				...firstChoices.filter(({ code }) => code.length === minimumLength),
			);
		} else {
			result.push(
				...values.filter(
					({ rank }) => rank >= 2 && rank <= maximumFallbackRank,
				),
			);
		}
	}
	return result;
}

function punctuationCode(character: string): string {
	if (character === "，") return ",";
	if (character === "。") return ".";
	if (character === "、") return "\\";
	return character;
}

export function optimizeBenchmarkLine<Source extends string>(
	text: string,
	alternatives: Map<string, BenchmarkAlternative<Source>[]>,
): BenchmarkPathResult<Source> {
	const characters = [...text];
	const best: Array<BenchmarkPathResult<Source> | undefined> = new Array(
		characters.length + 1,
	);
	best[characters.length] = {
		tokens: [],
		keys: 0,
		spaces: 0,
		shifts: 0,
		fixedCount: 0,
		selectionCount: 0,
		codeLength: 0,
	};
	for (let start = characters.length - 1; start >= 0; start -= 1) {
		const character = characters[start];
		if (!/\p{Script=Han}/u.test(character)) {
			const rest = best[start + 1];
			if (!rest) continue;
			const code = punctuationCode(character);
			best[start] = {
				tokens: [
					{
						word: character,
						displayCode: code,
						rawCode: character,
						keyCost: 1,
						instant: true,
						popppable: false,
						source: "普通码" as Source,
						shift: 0,
						selectionCount: 0,
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
				selectionCount: rest.selectionCount,
				codeLength: rest.codeLength + 1,
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
				const followedByUnsafePunctuation =
					alternative.punctuationNeedsSeparator === true &&
					(characters[end] === "，" || characters[end] === "。");
				const separator =
					(followedByHan || followedByUnsafePunctuation) &&
					!alternative.instant &&
					!alternative.popppable;
				const candidate: BenchmarkPathResult<Source> = {
					tokens: [{ ...alternative, start, end, separator }, ...rest.tokens],
					keys: alternative.keyCost + Number(separator) + rest.keys,
					spaces: Number(separator) + rest.spaces,
					shifts: alternative.shift + rest.shifts,
					fixedCount:
						rest.fixedCount + Number(fixedSources.has(alternative.source)),
					selectionCount: alternative.selectionCount + rest.selectionCount,
					codeLength: alternative.rawCode.length + rest.codeLength,
				};
				const current = best[start];
				if (!current || isBetter(candidate, current)) best[start] = candidate;
			}
		}
	}
	const result = best[0];
	if (!result) throw new Error(`无法求得最优路径: ${text}`);
	return result;
}

function isBetter<Source extends string>(
	candidate: BenchmarkPathResult<Source>,
	current: BenchmarkPathResult<Source>,
): boolean {
	if (candidate.selectionCount !== current.selectionCount)
		return candidate.selectionCount < current.selectionCount;
	if (candidate.keys !== current.keys) return candidate.keys < current.keys;
	if (candidate.codeLength !== current.codeLength)
		return candidate.codeLength < current.codeLength;
	if (candidate.tokens.length !== current.tokens.length)
		return candidate.tokens.length < current.tokens.length;
	if (candidate.fixedCount !== current.fixedCount)
		return candidate.fixedCount > current.fixedCount;
	if (candidate.spaces !== current.spaces)
		return candidate.spaces < current.spaces;
	return candidate.shifts < current.shifts;
}
