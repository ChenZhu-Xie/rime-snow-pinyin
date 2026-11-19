import { readFileSync } from "node:fs";
import { rootPath } from "./paths";

// 与运行时共用整组低频兜底音节；不能把常用音节的低频异调也当成空桶。
export function loadVacancyFallbackSyllables(): ReadonlySet<string> {
	const source = readFileSync(rootPath("lua/snow/vacancy.lua"), "utf8");
	const declaration = source.match(
		/local fallback_syllables = \{([\s\S]*?)\n\}/u,
	)?.[1];
	if (!declaration) throw new Error("找不到运行时声声空桶的兜底音节表");
	const syllables = new Set(
		[...declaration.matchAll(/^\s*(?:\["([^"]+)"\]|([a-z]+)) = true,/gmu)].map(
			(match) => match[1] ?? match[2],
		),
	);
	if (syllables.size === 0) throw new Error("运行时声声空桶的兜底音节表为空");
	return syllables;
}
