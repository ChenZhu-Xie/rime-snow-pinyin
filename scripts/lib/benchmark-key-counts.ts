export const benchmarkFunctionKeys = ["[", "]", ";", "/", "<", ">"] as const;
export type BenchmarkFunctionKey = (typeof benchmarkFunctionKeys)[number];
export type BenchmarkFunctionKeyCounts = Record<BenchmarkFunctionKey, number>;

export function emptyBenchmarkFunctionKeyCounts(): BenchmarkFunctionKeyCounts {
	return { "[": 0, "]": 0, ";": 0, "/": 0, "<": 0, ">": 0 };
}

export interface BenchmarkKeyCounts {
	keys: number;
	spaces: number;
	shifts: number;
	selections: number;
	pageTurns: number;
	functionKeys: BenchmarkFunctionKeyCounts;
	frequencies: Record<string, number>;
}

/** 统计回放的实际按键；Shift、Space、翻页和选重各自计键，排版标记不计。 */
export function countBenchmarkKeys(
	codes: readonly string[],
): BenchmarkKeyCounts {
	const result: BenchmarkKeyCounts = {
		keys: 0,
		spaces: 0,
		shifts: 0,
		selections: 0,
		pageTurns: 0,
		functionKeys: emptyBenchmarkFunctionKeyCounts(),
		frequencies: {},
	};
	const press = (key: string) => {
		result.keys++;
		result.frequencies[key] = (result.frequencies[key] ?? 0) + 1;
		if (key === "Space") result.spaces++;
		if (key === "Shift") result.shifts++;
		if (key === "PageUp" || key === "PageDown") result.pageTurns++;
	};
	for (const code of codes) {
		for (let i = 0; i < code.length; i++) {
			const pageTurn = code.slice(i).match(/^\{(PageUp|PageDown)\}/u);
			if (pageTurn) {
				press(pageTurn[1]);
				i += pageTurn[0].length - 1;
				continue;
			}
			if (code.startsWith("[Space]", i)) {
				press("Space");
				result.selections++;
				i += "[Space]".length - 1;
				continue;
			}
			const char = code[i];
			const selection = code.slice(i).match(/^\[(候选)?([0-9])\]/u);
			if (selection) {
				// 清风版回放只标候选序号，保留为逻辑选重键，不假定物理键位。
				press(selection[1] ? `Candidate${selection[2]}` : selection[2]);
				result.selections++;
				i += selection[0].length - 1;
			} else if (char === "⇧" || char === "?") {
				if (!/[A-Z]/u.test(code[i + 1] ?? ""))
					throw new Error(`无效 Shift 标记：${code}`);
			} else if (char === "_") press("Space");
			else if (char === "<" || char === ">") {
				result.functionKeys[char]++;
				press("Shift");
				press(char === "<" ? "," : ".");
			} else if (/[A-Z]/u.test(char)) {
				press("Shift");
				press(char);
			} else if (/[a-z]/u.test(char)) press(char.toUpperCase());
			else if (/[0-9,.;'\[\]\\/`-]/u.test(char)) {
				if (benchmarkFunctionKeys.includes(char as BenchmarkFunctionKey))
					result.functionKeys[char as BenchmarkFunctionKey]++;
				press(char);
			} else throw new Error(`未建模的回放按键：${char}（${code}）`);
		}
	}
	return result;
}
