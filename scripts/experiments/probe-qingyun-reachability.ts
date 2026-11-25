import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
// 专用诊断：逐键查询后翻页至重复页或 1000 页；不向首页缓存写入扩展候选。
const base = resolve(process.argv[3] ?? "output/qingyun-130"),
	mode = process.argv[2];
if (!["local", "upstream"].includes(mode))
	throw new Error("mode must be local or upstream");
const { RimeCandidateOracle } = await import(
	mode === "upstream"
		? resolve(
				"output/four-character-compare/upstream/scripts/lib/rime-candidate-oracle.ts",
			)
		: "../lib/rime-candidate-oracle.ts"
);
const input = JSON.parse(readFileSync(base + "/input.json", "utf8"));
const oracle = new RimeCandidateOracle(["snow_qingyun"], {
	cacheRoot: base + "/" + mode + "-cache",
	compiledCacheRoot: base + "/" + mode + "-compiled",
});
const output = [];
try {
	oracle.selectSchema("snow_qingyun");
	oracle.setOptions({
		popping: true,
		buffered: false,
		character: process.argv.includes("--character"),
		ascii_mode: false,
		traditionalization: false,
	});
	const cached = new Map<string, any>();
	for (const [text, routes] of Object.entries(input) as [string, string[]][]) {
		const codes = [
			...new Set(
				routes.flatMap((c) =>
					Array.from({ length: c.length }, (_, i) => c.slice(0, i + 1)),
				),
			),
		].sort((a, b) => a.length - b.length || a.localeCompare(b));
		let first = null,
			selection = null;
		const hits = [];
		for (const code of codes) {
			let r = cached.get(code);
			if (!r) {
				const initial = oracle.observeUncached(code, true);
				const candidates = [...initial.candidates];
				let pages = 1,
					last = candidates.join("\t"),
					exhausted = false;
				if (initial.completed && !initial.commit) {
					while (pages < 1000) {
						oracle["library"].symbols.RimeProcessKey(
							oracle["session"],
							0xff56,
							0,
						);
						const next = oracle["readCandidates"]();
						const key = next.join("\t");
						if (!key || key === last) {
							exhausted = true;
							break;
						}
						last = key;
						candidates.push(...next);
						pages++;
					}
				}
				r = { ...initial, candidates, pages, exhausted };
				cached.set(code, r);
			}
			if (!r.completed || r.commit) continue;
			const index = r.candidates.indexOf(text);
			if (index < 0) continue;
			hits.push({ code, rank: index + 1 });
			if (index === 0 && !first) first = { code };
			if (!selection) selection = { code, rank: index + 1 };
		}
		output.push({ text, first, selection, hits });
		if (output.length % 20 === 0)
			console.log(
				mode,
				output.length,
				output.filter((r) => r.first || r.selection).length,
			);
	}
	writeFileSync(
		base + "/" + mode + "-observations.json",
		JSON.stringify([...cached], null, 2),
	);
} finally {
	oracle.close();
	writeFileSync(
		base + "/" + mode + "-result.json",
		JSON.stringify(output, null, 2),
	);
}
console.log(
	JSON.stringify({
		mode,
		total: output.length,
		first: output.filter((r) => r.first).length,
		reachable: output.filter((r) => r.first || r.selection).length,
	}),
);
