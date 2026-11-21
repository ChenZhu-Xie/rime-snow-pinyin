export interface ThreeKeyFixedCandidate {
	code: string;
	word: string;
	reading: string;
	weight: number;
	sipinLevel?: number;
}

// 四拼短码是选字偏好，权重仍属于当前读音；不将其称为一字词频。
function compareCandidates(
	a: ThreeKeyFixedCandidate,
	b: ThreeKeyFixedCandidate,
) {
	return (
		(a.sipinLevel ?? 100) - (b.sipinLevel ?? 100) ||
		b.weight - a.weight ||
		a.word.localeCompare(b.word, "zh-CN") ||
		a.reading.localeCompare(b.reading)
	);
}

export function selectThreeKeyFixed(
	candidates: readonly ThreeKeyFixedCandidate[],
	reservedWords: Iterable<string>,
): Map<string, string> {
	const pools = new Map<string, ThreeKeyFixedCandidate[]>();
	const usedWords = new Set(reservedWords);
	for (const candidate of candidates) {
		if (usedWords.has(candidate.word)) continue;
		const pool = pools.get(candidate.code) ?? [];
		pool.push(candidate);
		pools.set(candidate.code, pool);
	}
	const result = new Map<string, string>();
	const poolSizes = new Map(
		[...pools].map(([code, pool]) => [
			code,
			new Set(pool.map(({ word }) => word)).size,
		]),
	);
	// 先分配可选字较少的桶，避免多音字提前占走窄桶唯一的可用字。
	for (const code of [...pools.keys()].sort(
		(a, b) =>
			(poolSizes.get(a) ?? 0) - (poolSizes.get(b) ?? 0) || a.localeCompare(b),
	)) {
		const selected = pools
			.get(code)
			?.sort(compareCandidates)
			.find(({ word }) => !usedWords.has(word));
		if (!selected) continue;
		result.set(code, selected.word);
		usedWords.add(selected.word);
	}
	return result;
}
