import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ALL_BENCHMARK_SCHEMES } from "../lib/benchmark-schemes";
import { RimeCandidateOracle } from "../lib/rime-candidate-oracle";
const output = resolve(process.argv[2] ?? "output/corpus-benchmark-current");
const id = process.argv[3] ?? "sipin";
const scheme = ALL_BENCHMARK_SCHEMES.find((s) => s.id === id)!;
assert.ok(scheme);
const summary = JSON.parse(
	readFileSync(join(output, `${id}-summary.json`), "utf8"),
);
const file = readdirSync(summary.evidence.cache).find(
	(name) => name.startsWith(scheme.schemaId + "-") && name.endsWith(".jsonl"),
)!;
const records = readFileSync(join(summary.evidence.cache, file), "utf8")
	.trim()
	.split("\n")
	.map((line) => JSON.parse(line));
const indices = [
	...new Set([
		...Array.from({ length: 16 }, (_, i) => i),
		...Array.from({ length: 16 }, (_, i) => records.length - 1 - i),
		...Array.from({ length: 32 }, (_, i) =>
			Math.floor((i * records.length) / 32),
		),
	]),
];
const oracle = new RimeCandidateOracle([scheme.schemaId], {
	cacheRoot: join(output, "cache", id),
	compiledCacheRoot: join(output, "compiled", id),
});
try {
	oracle.selectSchema(scheme.schemaId);
	oracle.setOptions({
		popping: true,
		buffered: false,
		character: false,
		ascii_mode: false,
		full_shape: false,
		traditionalization: false,
	});
	assert.equal(
		oracle.cacheDirectory(),
		summary.evidence.cache,
		"实现或部署变化，不能将旧缓存冒充当前复用",
	);
	for (const index of indices) {
		const { code, ...expected } = records[index];
		assert.deepEqual(oracle.observe(code), expected);
		assert.deepEqual(oracle.observeUncached(code, true), expected, code);
	}
	const stats = oracle.cacheStats();
	assert.equal(stats.misses, 0);
	const appendCounterexample =
		id === "sipin" ? oracle.observeUncached("mueaa/", true) : undefined;
	if (appendCounterexample)
		assert.notEqual(
			appendCounterexample.commit,
			"母了",
			"若引擎已修复此路径，应重新检查反例预期",
		);
	writeFileSync(
		join(output, `${id}-prefix-cache-verification.json`),
		JSON.stringify(
			{
				sampledRecords: indices.length,
				cacheRecords: records.length,
				freshSessionMatches: indices.length,
				stats,
				appendCounterexample,
			},
			null,
			2,
		) + "\n",
	);
	console.log(stats);
} finally {
	oracle.close();
}
