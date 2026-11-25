/** 本地隔离 DLL 与 CI 同输入对照；由外部调度器限制并行和内存。 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { RimeCandidateOracle } from "../lib/rime-candidate-oracle";

const [schema, inputArg, ciArg, outputArg, compiledArg, mode = "compare"] = process.argv.slice(2);
assert.ok(schema && inputArg && ciArg && outputArg && compiledArg);
const output = resolve(outputArg);
const compiled = resolve(compiledArg);
mkdirSync(output, { recursive: true });
const input = JSON.parse(readFileSync(resolve(inputArg), "utf8"));
const codes: string[] = input.schemas[schema].codes;
const ci = new Map<string, any>();
for (const line of readFileSync(resolve(ciArg), "utf8").trim().split("\n")) {
	const row = JSON.parse(line);
	if (row.schema === schema && row.variant === "default") ci.set(row.code, row);
}
type Result = ReturnType<RimeCandidateOracle["observeUncached"]>;
const start = performance.now();
const cpuStart = process.cpuUsage();
const oracle = new RimeCandidateOracle([schema], {
	cacheRoot: join(output, "cache"), compiledCacheRoot: compiled,
});
oracle.selectSchema(schema);
oracle.setOptions({ popping: true, buffered: false, character: false, ascii_mode: false, full_shape: false, traditionalization: false });
const ready = performance.now();
console.log(`${schema}: deployment ready in ${(ready - start).toFixed(1)} ms`);
const samples: Record<string, unknown> = {};
const reference = new Map<string, Result>();
const first = (result: Result) => result.completed ? result.commit || result.candidates[0] || null : null;
try {
	if (mode === "compare") {
		let begin = performance.now();
		for (const code of codes) reference.set(code, oracle.observeUncached(code, true));
		samples.freshSessionsMs = performance.now() - begin;
		console.log(`${schema}: fresh sessions complete`);
		const different = [];
		begin = performance.now();
		for (const code of [...codes].reverse()) {
			const actual = oracle.observeUncached(code);
			if (JSON.stringify(actual) !== JSON.stringify(reference.get(code))) different.push({ code, actual, expected: reference.get(code) });
		}
		samples.reusedSessionMs = performance.now() - begin;
		samples.reusedSessionDifferences = different;
	}
	const prefixes = new Map<string, Result>();
	let executions = 0;
	const prefixBegin = performance.now();
	for (const code of [...codes].sort((a, b) => b.length - a.length || a.localeCompare(b))) {
		if (prefixes.has(code)) continue;
		executions++;
		const result = oracle.observeUncached(code, mode === "compare", (prefix, observation) => {
			const previous = prefixes.get(prefix);
			if (previous) assert.deepEqual(observation, previous, `同一前缀的候选依赖路径：${prefix}`);
			prefixes.set(prefix, observation);
		});
		prefixes.set(code, result);
	}
	samples.prefixBatchMs = performance.now() - prefixBegin;
	samples.engineExecutions = executions;
	const prefixDifferences = [];
	const ciDifferences = [];
	for (const code of codes) {
		const actual = prefixes.get(code)!;
		if (reference.has(code) && JSON.stringify(actual) !== JSON.stringify(reference.get(code))) prefixDifferences.push({ code, actual, expected: reference.get(code) });
		const expected = ci.get(code);
		assert.ok(expected, `CI 缺少输入：${code}`);
		if (first(actual) !== (expected.commit || expected.candidates[0]?.text || null)) ciDifferences.push({ code, local: first(actual), ci: expected.commit || expected.candidates[0]?.text || null });
	}
	samples.prefixDifferences = prefixDifferences;
	samples.ciDifferences = ciDifferences;
	const cacheFile = join(output, "observations.jsonl");
	writeFileSync(cacheFile, [...prefixes].map(([code, result]) => JSON.stringify({ code, ...result })).join("\n") + "\n");
	const diskBegin = performance.now();
	const disk = new Map(readFileSync(cacheFile, "utf8").trim().split("\n").map(line => {
		const row = JSON.parse(line); return [row.code, row] as const;
	}));
	samples.diskCacheLoadMs = performance.now() - diskBegin;
	const cacheBegin = performance.now();
	for (const code of codes) assert.ok(disk.get(code));
	samples.cacheQueryMs = performance.now() - cacheBegin;
	const cpu = process.cpuUsage(cpuStart);
	writeFileSync(join(output, "report.json"), JSON.stringify({ schema, inputCount: codes.length, mode, startupMs: ready - start, elapsedMs: performance.now() - start, cpuMs: (cpu.user + cpu.system) / 1000, peakRssKiB: process.resourceUsage().maxRSS, ...samples }, null, 2));
	console.log(JSON.stringify({ schema, startupMs: ready - start, ...samples }));
} finally {
	oracle.close();
}
