/** 单字静态路由的逐键首选模型；不调用 Rime，也不把次选当成首选。 */
export interface CharacterRoute {
	text: string;
	code: string;
	weight: number;
	order: number;
	/** 默认原字排序在固顶、学习优先与后置之前完成。 */
	deferred?: boolean;
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
				.sort(
					(a, b) =>
						Number(!!a.deferred) - Number(!!b.deferred) ||
						b.weight - a.weight ||
						a.order - b.order,
				)
				.map(({ text }) => text),
		]),
	);
}

/** 首选最多排除 n-1 个前缀首选和固定项，故每码只需保留 n+固定项+1 个竞争文本。 */
export class FirstChoicePools {
	private readonly rows = new Map<string, CharacterRoute[]>();
	constructor(
		private readonly relevant: ReadonlySet<string>,
		private readonly fixed: ReadonlyMap<string, readonly string[]>,
	) {}
	add(route: CharacterRoute) {
		if (!this.relevant.has(route.code)) return;
		const rows = this.rows.get(route.code) ?? [];
		const previous = rows.findIndex(({ text }) => text === route.text);
		if (previous >= 0) {
			if (rows[previous].weight >= route.weight) return;
			rows.splice(previous, 1);
		}
		rows.push(route);
		rows.sort(
			(a, b) =>
				Number(!!a.deferred) - Number(!!b.deferred) ||
				b.weight - a.weight ||
				a.order - b.order,
		);
		const limit =
			route.code.length + (this.fixed.get(route.code)?.length ?? 0) + 1;
		if (rows.length > limit) rows.length = limit;
		this.rows.set(route.code, rows);
	}
	finish() {
		const result = new Map(
			[...this.rows].map(([code, rows]) => [
				code,
				rows.map(({ text }) => text),
			]),
		);
		this.rows.clear();
		return result;
	}
}

export function relevantCharacterCodes(
	routes: Iterable<Pick<CharacterRoute, "code">>,
) {
	const codes = new Set<string>();
	for (const { code } of routes)
		for (let length = 1; length <= code.length; length++)
			codes.add(code.slice(0, length));
	return codes;
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
	const paths = new Set(routes.map(({ code }) => code));
	interface History {
		text: string;
		parent?: History;
	}
	const cache = new Map<string, History | undefined>();
	const visit = (code: string): History | undefined => {
		const cached = cache.get(code);
		if (cache.has(code)) return cached;
		let known = code.length > 1 ? visit(code.slice(0, -1)) : undefined;
		const reset = resetHistory(code);
		if (reset) known = undefined;
		const wasFirst = (text: string) => {
			for (let node = known; node; node = node.parent)
				if (node.text === text) return true;
			return false;
		};
		const pinned = fixed.get(code) ?? [];
		const free = (pools.get(code) ?? []).filter(
			(text) => !pinned.includes(text),
		);
		// 冰雪生产后置只检查前十项；声笔排除沿用自己的完整过滤池。
		const window =
			postpone === "move"
				? free.slice(0, Math.max(0, 10 - pinned.length))
				: free;
		const ordinary =
			postpone === "none" ? window : window.filter((text) => !wasFirst(text));
		let repeated: string | undefined;
		if (postpone === "move" && ordinary.length === 0) {
			for (let node = known; node; node = node.parent) {
				if (window.includes(node.text)) {
					repeated = node.text;
					break;
				}
			}
		}
		// 冰雪后置仍可在没有新候选时返回旧候选；声笔直接排除旧首选。
		const first = pinned[0] ?? ordinary[0] ?? repeated;
		observe?.(code, first);
		if (first) {
			if (!reset) known = { text: first, parent: known };
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
	for (const code of paths) visit(code);
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
