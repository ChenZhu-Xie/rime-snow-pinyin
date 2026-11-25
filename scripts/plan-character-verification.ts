/** 按同版本观测给预测标注证据，并生成有编码预算的 CI 队列。 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { ALL_BENCHMARK_SCHEMES } from "./lib/benchmark-schemes";
import { observedMinimum, type CharacterObservation } from "./lib/character-observed-choice";
import { rootPath, writeOutput } from "./lib/paths";

const [offlineArg, observationArg, outputArg, budgetArg = "1000"] = process.argv.slice(2);
assert.ok(offlineArg && observationArg && outputArg, "需要离线目录、观测目录、输出目录和可选每方案编码预算");
const offline = resolve(offlineArg), observations = resolve(observationArg), output = resolve(outputArg);
const budget = Number(budgetArg);
assert.ok(Number.isInteger(budget) && budget > 0);
const read = (file: string) => readFileSync(file, "utf8");
const meta = JSON.parse(read(join(offline, "8000字_十二方案最短首选键数.json")));
const manifest = JSON.parse(read(join(observations, "manifest.json")));
const diff = spawnSync("git", ["diff", "--exit-code", manifest.revision, "--", "lua", "deps", "snow_*.yaml", "snow_*.txt"], { cwd: rootPath(), encoding: "utf8" });
assert.equal(diff.status, 0, "生产来源已变化，旧观测需要重新验证");
for (const [file, digest] of Object.entries(manifest.sources)) {
	const content = read(rootPath(file));
	assert.ok([content, content.replaceAll("\r\n", "\n")].some(text =>
		createHash("sha256").update(text).digest("hex") === digest), `观测来源已变化：${file}`);
}
const records = new Map<string, Map<string, CharacterObservation>>();
for (const line of read(join(observations, "observations.jsonl")).trim().split("\n")) {
	const row = JSON.parse(line);
	if (row.variant !== "default") continue;
	const map = records.get(row.schema) ?? new Map();
	map.set(row.code, row);
	records.set(row.schema, map);
}
const rows = read(join(offline, "8000字_十二方案最短首选键数.tsv")).trimEnd().split(/\r?\n/u).slice(1).map(line => line.split("\t"));
const prefixes = (code: string) => Array.from({ length: code.length }, (_, i) => code.slice(0, i + 1));
const table = ["方案\t字\t字频序\t预测码\t证据状态\t最短性证明\t本轮入队\t冻结频次"];
const schemas: Record<string, { codes: string[]; targets: Record<string, { routes: string[]; previousMinimum: string; rank: number }> }> = {};
const summaries = [];
for (const [index, scheme] of meta.schemes.entries()) {
	const schema = ALL_BENCHMARK_SCHEMES.find(s => s.id === scheme.id)?.schemaId;
	const map = schema ? records.get(schema) ?? new Map() : new Map();
	const codes = new Set<string>();
	const targets: Record<string, { routes: string[]; previousMinimum: string; rank: number }> = {};
	const counts: Record<string, number> = {};
	for (const row of rows) {
		const code = row[4 + index * 2];
		let status = "未实测：候选排序待验证";
		let queued = false;
		if (!schema) status = "外部方案：沿用既有资料";
		else if (code === "NA") status = "缺少预测路径：需扩展枚举";
		else {
			const path = prefixes(code);
			if (path.every(prefix => map.has(prefix))) {
				const choice = observedMinimum(row[1], [code], map);
				status = choice?.code === code ? "同版本实测：预测路径达到首选" : "同版本实测：预测路径有冲突";
			} else {
				const added = path.filter(prefix => !codes.has(prefix));
				if (codes.size + added.length <= budget) {
					path.forEach(prefix => codes.add(prefix));
					targets[row[1]] = { routes: [code], previousMinimum: code, rank: Number(row[0]) };
					queued = true;
				}
			}
		}
		counts[status] = (counts[status] ?? 0) + 1;
		table.push([scheme.name, row[1], row[0], code, status, "尚未证明所有更短路径已覆盖", Number(queued), row[2]].join("\t"));
	}
	if (schema && codes.size) schemas[schema] = { codes: [...codes].sort(), targets };
	summaries.push({ scheme: scheme.name, counts, queuedCharacters: Object.keys(targets).length, independentInputs: codes.size, newInputs: [...codes].filter(code => !map.has(code)).length });
}
writeOutput(join(output, "confidence.tsv"), "\uFEFF" + table.join("\n") + "\n");
writeOutput(join(output, "input.json"), JSON.stringify({ contract: "character-budgeted-verification-v1", schemas }, null, 2) + "\n");
writeOutput(join(output, "summary.json"), JSON.stringify({ revision: manifest.revision, perSchemaBudget: budget, probabilityCalibrated: false, summaries }, null, 2) + "\n");
console.log(JSON.stringify(summaries));
