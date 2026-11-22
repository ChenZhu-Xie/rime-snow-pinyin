import { countBenchmarkKeys } from "./benchmark-key-counts";
import type { BenchmarkDictionaryEntry } from "./benchmark-ranking";
import {
	ALL_BENCHMARK_SCHEMES,
	pronunciationCodes,
	type BenchmarkSchemeId,
} from "./benchmark-schemes";

/** 只作探针范围的上界筛选；生效边界、候选类型和最终名次均由真实处理器决定。 */
export function wordLengthProbeCodes(
	scheme: BenchmarkSchemeId,
	entries: Iterable<BenchmarkDictionaryEntry>,
	maximumCost: (word: string) => number = () => Number.POSITIVE_INFINITY,
): string[] {
	const capacity = ALL_BENCHMARK_SCHEMES.find((s) => s.id === scheme)?.capacity;
	if (capacity !== "21x21" && capacity !== "21x26") return [];
	const codes = new Set<string>();
	for (const entry of entries) {
		if (entry.syllables.length < 2) continue;
		const bound = maximumCost(entry.word);
		for (const { code } of pronunciationCodes(
			scheme,
			entry.word,
			entry.syllables,
		)) {
			// 已有零选重路径的最坏成本包含可能的一键 Space；更贵的直选必被其支配。
			if (countBenchmarkKeys([code + "<"]).keys > bound) continue;
			if (capacity === "21x26") {
				if (/^[a-z]{4}[aeuio]*$/u.test(code)) codes.add(code);
			} else if (/^[a-zA-Z]+$/u.test(code)) {
				const sound = code.replace(/[avuio]+$/u, "");
				if ((sound.match(/[a-z]/gu) ?? []).length === 4) codes.add(code);
			}
		}
	}
	return [...codes].sort((a, b) => a.length - b.length || a.localeCompare(b));
}

export function wordLengthAlternatives(
	codes: readonly string[],
	targetWords: ReadonlySet<string>,
	committedText: (code: string) => string,
) {
	const result = [];
	for (const code of codes) {
		for (const trigger of ["<", ">"] as const) {
			const input = code + trigger;
			const word = committedText(input);
			if (!/^\p{Script=Han}+$/u.test(word) || !targetWords.has(word)) continue;
			const counts = countBenchmarkKeys([input]);
			result.push({
				word,
				displayCode: input,
				rawCode: input,
				keyCost: counts.keys,
				instant: true,
				popppable: false,
				source: "词长直选" as const,
				shift: counts.shifts,
				selectionCount: 0,
			});
		}
	}
	return result;
}
