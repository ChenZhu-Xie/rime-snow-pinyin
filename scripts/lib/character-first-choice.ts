/** 单字静态路由的逐键首选模型；不调用 Rime，也不把次选当成首选。 */
export interface CharacterRoute {
	text: string;
	code: string;
	weight: number;
	order: number;
}

export interface FirstChoice {
	code: string;
	keys: number;
}

export function physicalKeys(code: string): number {
	return [...code].length + (code.match(/[A-Z]/gu)?.length ?? 0);
}

/** 同一码同一文本取最大权重；等权保持来源文件顺序。 */
export function candidatePools(routes: Iterable<CharacterRoute>) {
	const pools = new Map<string, Map<string, CharacterRoute>>();
	for (const route of routes) {
		const pool = pools.get(route.code) ?? new Map<string, CharacterRoute>();
		const previous = pool.get(route.text);
		if (!previous || route.weight > previous.weight)
			pool.set(route.text, route);
		pools.set(route.code, pool);
	}
	return new Map(
		[...pools].map(([code, pool]) => [
			code,
			[...pool.values()]
				.sort((a, b) => b.weight - a.weight || a.order - b.order)
				.map(({ text }) => text),
		]),
	);
}

/**
 * 沿每条完整路由逐键记下旧首选，模拟生产后置；固定项仍占原位置。
 * 各目标字只是取样，不参与裁剪候选池。不能先截 Top m 再排名。
 */
export function minimumFirstChoices(
	routes: readonly CharacterRoute[],
	pools: ReadonlyMap<string, readonly string[]>,
	fixed: ReadonlyMap<string, readonly string[]>,
	postpone: "none" | "move" | "exclude",
	observe?: (code: string, first: string | undefined) => void,
	resetHistory: (code: string) => boolean = () => false,
): Map<string, FirstChoice> {
	const result = new Map<string, FirstChoice>();
	const paths = new Map<string, string>();
	for (const { code } of routes) paths.set(code, code);
	const cache = new Map<string, Map<string, number>>();
	const visit = (code: string): Map<string, number> => {
		const cached = cache.get(code);
		if (cached) return cached;
		const known =
			code.length > 1
				? new Map(visit(code.slice(0, -1)))
				: new Map<string, number>();
		const reset = resetHistory(code);
		if (reset) known.clear();
		const pinned = fixed.get(code) ?? [];
		const free = (pools.get(code) ?? []).filter(
			(text) => !pinned.includes(text),
		);
		const ordinary =
			postpone === "none" ? free : free.filter((text) => !known.has(text));
		// 冰雪后置仍可在没有新候选时返回旧候选；声笔直接排除旧首选。
		const first =
			pinned[0] ?? ordinary[0] ?? (postpone === "move" ? free[0] : undefined);
		observe?.(code, first);
		if (first) {
			if (!reset) known.set(first, code.length);
			const keys = physicalKeys(code);
			const previous = result.get(first);
			if (
				!previous ||
				keys < previous.keys ||
				(keys === previous.keys && code < previous.code)
			)
				result.set(first, { code, keys });
		}
		cache.set(code, known);
		return known;
	};
	for (const code of paths.keys()) visit(code);
	return result;
}

export function summarizeFirstChoices(
	characters: readonly { text: string; frequency: number }[],
	choices: ReadonlyMap<string, FirstChoice>,
) {
	const distribution: Record<number, number> = {};
	let keySum = 0;
	let weightedKeys = 0;
	let coveredFrequency = 0;
	const missing: string[] = [];
	for (const { text, frequency } of characters) {
		const choice = choices.get(text);
		if (!choice) {
			missing.push(text);
			continue;
		}
		distribution[choice.keys] = (distribution[choice.keys] ?? 0) + 1;
		keySum += choice.keys;
		weightedKeys += choice.keys * frequency;
		coveredFrequency += frequency;
	}
	const covered = characters.length - missing.length;
	return {
		count: characters.length,
		covered,
		missing,
		distribution,
		// 无穷大不写成 JSON null；未覆盖全体时整体平均明确缺测。
		mean: missing.length === 0 ? keySum / characters.length : null,
		coveredMean: covered ? keySum / covered : null,
		frequencyWeightedCoveredMean: coveredFrequency
			? weightedKeys / coveredFrequency
			: null,
	};
}
