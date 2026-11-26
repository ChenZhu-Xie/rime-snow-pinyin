import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { rootPath } from "../lib/paths";

const source = resolve(process.argv[2] ?? rootPath("output/append-actions"));
const output = resolve(
	process.argv[3] ?? rootPath("output/append-characters/observations"),
);
const files: string[] = [];
function walk(directory: string) {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) walk(path);
		else files.push(path);
	}
}
walk(source);
const runtimeHashes = files
	.filter((path) => path.endsWith("runtime.sha256"))
	.map((path) => readFileSync(path, "utf8").trim().split(/\s/u)[0]);
assert.equal(runtimeHashes.length, 9, "必须收齐九个方案的运行时指纹");
assert.equal(new Set(runtimeHashes).size, 1, "不同运行时的观测不能混合");
const summaries = files
	.filter((path) => path.endsWith("summary.json"))
	.map((path) => JSON.parse(readFileSync(path, "utf8")));
assert.equal(summaries.length, 9);
assert.equal(new Set(summaries.map((row) => row.revision)).size, 1);
const rows = files
	.filter((path) => path.endsWith("observations.jsonl"))
	.flatMap((path) =>
		readFileSync(path, "utf8")
			.trim()
			.split(/\r?\n/u)
			.map((line) => JSON.parse(line)),
	);
assert.equal(new Set(rows.map((row) => row.schema)).size, 9);
assert.equal(
	rows.length,
	summaries.reduce((sum, row) => sum + row.observations, 0),
);
const failed = rows.filter((row) => row.kind === "append" && !row.passed);
const summary = {
	revision: summaries[0].revision,
	runtimeSha256: runtimeHashes[0],
	schemas: 9,
	observations: rows.length,
	appendQueries: rows.filter((row) => row.kind === "append").length,
	appendFailures: failed.length,
	failed,
};
mkdirSync(output, { recursive: true });
writeFileSync(
	join(output, "observations.jsonl"),
	rows.map((row) => JSON.stringify(row)).join("\n") + "\n",
);
writeFileSync(
	join(output, "audit.json"),
	JSON.stringify(summary, null, 2) + "\n",
);
console.log(
	JSON.stringify({ ...summary, failed: failed.slice(0, 5) }, null, 2),
);
