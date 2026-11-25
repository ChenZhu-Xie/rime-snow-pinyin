/** 合并生产来源和运行时一致的采集批次；重叠观测必须一致。 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { rootPath, writeOutput } from "./lib/paths";

const [outputArg, ...inputArgs] = process.argv.slice(2);
assert.ok(outputArg && inputArgs.length >= 2, "需要输出目录及至少两个采集根目录");
const output = resolve(outputArg);
const inputs = inputArgs.map(directory => resolve(directory));
assert.ok(!inputs.includes(output), "合并结果必须写入新目录");
const json = (file: string) => JSON.parse(readFileSync(file, "utf8"));
interface Target {
	routes: string[];
	previousMinimum: string;
	rank: number;
	userCode?: string;
}
const schemas: Record<string, { codes: Set<string>; targets: Record<string, Target> }> = {};
const observations = new Map<string, any>();
let manifest: any;
let runtimeHash: string | undefined;
const provenance = [];
for (const directory of inputs) {
	const current = json(join(directory, "results/manifest.json"));
	const hash = readFileSync(join(directory, "runtime.sha256"), "utf8").trim().split(/\s/u)[0];
	assert.match(hash, /^[a-f0-9]{64}$/u);
	if (runtimeHash) assert.equal(hash, runtimeHash, "运行时二进制不同，禁止混合");
	runtimeHash = hash;
	assert.equal(spawnSync("git", ["diff", "--exit-code", current.revision, "--", "lua", "deps", "snow_*.yaml", "snow_*.txt"], { cwd: rootPath(), encoding: "utf8" }).status, 0, "采集之后生产来源已变化");
	if (manifest) {
		assert.equal(current.runtime, manifest.runtime);
		assert.deepEqual(current.sources, manifest.sources, "采集来源不一致");
	}
	manifest = current;
	const cases = json(join(directory, "input.json"));
	for (const [schema, entry] of Object.entries(cases.schemas) as [string, { codes: string[]; targets: Record<string, Target> }][]) {
		const merged = schemas[schema] ?? { codes: new Set<string>(), targets: {} };
		entry.codes.forEach(code => merged.codes.add(code));
		for (const [text, target] of Object.entries(entry.targets)) {
			const previous = merged.targets[text];
			merged.targets[text] = { ...previous, ...target, routes: [...new Set([...(previous?.routes ?? []), ...target.routes])] };
		}
		schemas[schema] = merged;
	}
	for (const probe of current.probes) {
		assert.equal(probe.variant, "default");
		assert.ok(schemas[probe.schema], `清单方案缺少输入定义：${probe.schema}`);
		for (const code of probe.codes) schemas[probe.schema].codes.add(code);
	}
	const content = readFileSync(join(directory, "results/observations.jsonl"), "utf8");
	for (const line of content.trim().split("\n")) {
		const row = JSON.parse(line);
		assert.equal(row.variant, "default");
		const key = `${row.schema}/${row.code}`;
		const previous = observations.get(key);
		if (previous) assert.deepEqual([row.commit, row.candidates.map((c: any) => c.text)], [previous.commit, previous.candidates.map((c: any) => c.text)], `重叠候选不一致：${key}`);
		observations.set(key, row);
	}
	provenance.push({ directory, revision: current.revision, observationsSha256: createHash("sha256").update(content).digest("hex") });
}
const mergedSchemas = Object.fromEntries(Object.entries(schemas).map(([schema, entry]) => [schema, { codes: [...entry.codes].sort(), targets: entry.targets }]));
const probes = Object.entries(mergedSchemas).map(([schema, entry]) => ({ schema, variant: "default", codes: entry.codes }));
for (const probe of probes) for (const code of probe.codes) assert.ok(observations.has(`${probe.schema}/${code}`), `缺少观测：${probe.schema}/${code}`);
assert.equal(observations.size, probes.reduce((sum, probe) => sum + probe.codes.length, 0));
writeOutput(join(output, "input.json"), JSON.stringify({ schemas: mergedSchemas }, null, 2) + "\n");
writeOutput(join(output, "results/manifest.json"), JSON.stringify({ ...manifest, probes, mergedFrom: provenance }, null, 2) + "\n");
writeOutput(join(output, "results/observations.jsonl"), [...observations.values()].map(row => JSON.stringify(row)).join("\n") + "\n");
writeOutput(join(output, "runtime.sha256"), runtimeHash + "  mira\n");
console.log(`合并 ${inputs.length} 批，共 ${observations.size} 条观测`);
