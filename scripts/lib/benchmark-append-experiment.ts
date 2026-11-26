import type { BenchmarkAlternative } from "./benchmark-paths";

export interface AppendPrefixObservation {
	candidates: readonly string[];
	commit: string;
	completed?: boolean;
}

export function appendProbeInput(displayCode: string): string {
	return displayCode.replace(/[⇧?]/gu, "").replace(/\[([1-9])\]/gu, "$1");
}

/** 固定同一候选池，删除旧 / 路径后前插或追加新字；保留普通整词短码参与竞争。 */
export function retargetBenchmarkAppend(
	pool: ReadonlyMap<string, readonly BenchmarkAlternative[]>,
	targetWords: ReadonlySet<string>,
	tail: string,
	prefix: (input: string) => AppendPrefixObservation | undefined,
	direction: "append" | "prepend" = "append",
): {
	alternatives: Map<string, BenchmarkAlternative[]>;
	missing: Array<{ input: string; word: string }>;
} {
	if (!/^\p{Script=Han}$/u.test(tail) || tail === "的")
		throw new Error("追加字必须是除「的」以外的一个汉字");
	const alternatives = new Map<string, BenchmarkAlternative[]>();
	const missing = new Map<string, { input: string; word: string }>();
	const add = (route: BenchmarkAlternative) => {
		const values = alternatives.get(route.word) ?? [];
		if (!values.some((value) => value.displayCode === route.displayCode)) {
			values.push(route);
			alternatives.set(route.word, values);
		}
	};
	for (const routes of pool.values())
		for (const route of routes)
			if (!route.displayCode.includes("/")) add(route);
	const bases = [...alternatives.values()].flat();
	if (targetWords.has(tail))
		add({
			word: tail,
			displayCode: "/",
			rawCode: "/",
			keyCost: 1,
			instant: true,
			popppable: false,
			source: "尾字键",
			shift: 0,
			selectionCount: 0,
		});
	for (const route of bases) {
		const word =
			direction === "prepend" ? tail + route.word : route.word + tail;
		if (!targetWords.has(word)) continue;
		const input = appendProbeInput(route.displayCode);
		const observed = prefix(input);
		if (!observed) {
			missing.set(`${input}\t${route.word}`, { input, word: route.word });
			continue;
		}
		// 已经上屏或尚未完整处理的前缀不能冒充仍可由 / 确认的首选。
		if (
			observed.completed === false ||
			observed.commit !== "" ||
			observed.candidates[0] !== route.word
		)
			continue;
		add({
			...route,
			word,
			displayCode: route.displayCode + "/",
			rawCode: route.rawCode + "/",
			keyCost: route.keyCost + 1,
			instant: true,
			popppable: false,
			source: direction === "prepend" ? "前插键" : "尾字键",
		});
	}
	return { alternatives, missing: [...missing.values()] };
}
