import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { freemem } from "node:os";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { RimeCandidateOracle } from "../lib/rime-candidate-oracle";
import { physicalKeys } from "../lib/character-first-choice";
import { candidateSelection } from "../lib/benchmark-selection";

// 仅复核给定缺测字；独立空词典、逐键输入，先寻找首选，再探查选重。
const schema = process.argv[2];
assert.ok(["snow_landao", "snow_liandao"].includes(schema));
const base = resolve(
	process.argv[3] ?? `output/filter-disabled-recheck/${schema}`,
);
const input = readFileSync(base + "/input.json", "utf8");
const revision = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8",
}).trim();
const guard = () => {
	assert.ok(freemem() >= 8 * 1024 ** 3, "须预留至少 8 GiB 系统内存");
	assert.ok(
		process.memoryUsage().rss < 4 * 1024 ** 3,
		"工作进程不得超过 4 GiB",
	);
};
guard();
const oracle = new RimeCandidateOracle([schema], {
	cacheRoot: base + "/cache",
	compiledCacheRoot: base + "/compiled",
});
const observations = new Map<string, any>();
const results: any[] = [];
try {
	oracle.selectSchema(schema);
	oracle.setOptions({
		popping: true,
		buffered: false,
		character: false,
		ascii_mode: false,
		traditionalization: false,
	});
	for (const [text, routes] of Object.entries(JSON.parse(input)) as [
		string,
		string[],
	][]) {
		const codes = [
			...new Set(
				routes.flatMap((c) =>
					Array.from({ length: c.length }, (_, i) => c.slice(0, i + 1)),
				),
			),
		];
		const hits: { code: string; rank: number; keys: number }[] = [];
		for (const code of codes) {
			guard();
			if (!observations.has(code))
				observations.set(code, oracle.observeUncached(code, true));
			const r = observations.get(code);
			if (!r.completed || r.commit) continue;
			const rank = r.candidates.indexOf(text) + 1;
			if (rank)
				hits.push({
					code,
					rank,
					keys: physicalKeys(code) + candidateSelection(rank, 6).keys,
				});
		}
		// 已找到首选时无须翻页；否则每条输入独立重放后逐页保存，最多 1000 页。
		if (!hits.some((h) => h.rank === 1)) {
			for (const code of codes) {
				guard();
				let r = observations.get(code);
				if (!r.completed || r.commit) continue;
				if (!r.expanded) {
					const initial = oracle.observeUncached(code, true);
					assert.deepEqual(initial.candidates, r.candidates.slice(0, 6));
					r = {
						...initial,
						candidates: [...initial.candidates],
						expanded: true,
						pages: 1,
						exhausted: false,
					};
					let last = initial.candidates.join("\t");
					while (r.pages < 1000) {
						guard();
						oracle["library"].symbols.RimeProcessKey(
							oracle["session"],
							0xff56,
							0,
						);
						const next = oracle["readCandidates"]();
						const key = next.join("\t");
						if (!key || key === last) {
							r.exhausted = true;
							break;
						}
						r.candidates.push(...next);
						r.pages++;
						last = key;
					}
					observations.set(code, r);
				}
				const rank = r.candidates.indexOf(text) + 1;
				if (rank > 6)
					hits.push({
						code,
						rank,
						keys: physicalKeys(code) + candidateSelection(rank, 6).keys,
					});
			}
		}
		hits.sort(
			(a, b) =>
				Number(a.rank > 1) - Number(b.rank > 1) ||
				a.keys - b.keys ||
				a.rank - b.rank ||
				a.code.localeCompare(b.code),
		);
		results.push({ text, best: hits[0] ?? null, hits });
		console.log(schema, text, JSON.stringify(hits[0] ?? null));
	}
} finally {
	oracle.close();
	const raw = JSON.stringify([...observations], null, 2);
	writeFileSync(base + "/observations.json", raw);
	writeFileSync(
		base + "/result.json",
		JSON.stringify(
			{
				schema,
				revision,
				inputSha256: createHash("sha256").update(input).digest("hex"),
				observationsSha256: createHash("sha256").update(raw).digest("hex"),
				results,
			},
			null,
			2,
		),
	);
}
