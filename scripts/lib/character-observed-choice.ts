import { physicalKeys, type FirstChoice } from "./character-first-choice";

export interface CharacterObservation {
	code: string;
	commit: string | null;
	candidates: { text: string }[];
}

/** 所有前缀来自独立空会话；遇到上屏即终止该码路，禁止接用尾段候选。 */
export function observedMinimum(
	text: string,
	routes: readonly string[],
	records: ReadonlyMap<string, CharacterObservation>,
): FirstChoice | undefined {
	let best: FirstChoice | undefined;
	for (const route of routes) {
		for (let length = 1; length <= route.length; length++) {
			const code = route.slice(0, length);
			const row = records.get(code);
			if (!row) throw new Error(`缺少逐键观测：${text}/${code}`);
			const first = row.commit || row.candidates[0]?.text;
			if (first === text) {
				const keys = physicalKeys(code);
				if (
					!best ||
					keys < best.keys ||
					(keys === best.keys && code < best.code)
				)
					best = { code, keys };
			}
			if (row.commit) break;
		}
	}
	return best;
}
