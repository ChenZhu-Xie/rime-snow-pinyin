import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ALL_BENCHMARK_SCHEMES } from "./lib/benchmark-schemes";
import { benchmarkCharacters } from "./lib/benchmark-characters";
import { rootPath } from "./lib/paths";
const base = process.argv[2] ?? rootPath("output/character-full-local");
const expected = benchmarkCharacters(
	readFileSync(
		rootPath("scripts/data/benchmark-character-frequency.tsv"),
		"utf8",
	),
)
	.map((row) => row.text)
	.sort();
const output = join(base, "combined");
mkdirSync(output, { recursive: true });
const read = (file: string) => JSON.parse(readFileSync(file, "utf8"));
const results = [];
const probes = [];
const reports = [];
let common: any;
for (const scheme of ALL_BENCHMARK_SCHEMES) {
	const directory = join(base, "run", scheme.schemaId);
	const manifest = read(join(directory, "results/manifest.json"));
	const audit = read(join(directory, "audit.json"));
	const report = read(join(directory, "report.json"));
	assert.equal(report.targets, 8000);
	assert.equal(audit.results[0].targets, 8000);
	assert.equal(audit.results[0].found, report.found);
	assert.deepEqual(
		audit.results[0].characters.map((row: { text: string }) => row.text).sort(),
		expected,
		`字集不符：${scheme.schemaId}`,
	);
	if (common) {
		assert.equal(manifest.revision, common.revision);
		assert.equal(manifest.fingerprint, common.fingerprint);
		assert.deepEqual(manifest.sources, common.sources);
	}
	common = manifest;
	results.push(...audit.results);
	probes.push(...manifest.probes);
	reports.push(report);
}
writeFileSync(
	join(output, "audit.json"),
	JSON.stringify(
		{
			contract: "character-first-choice-real-probe-audit-v1",
			revision: common.revision,
			runtime: common.runtime,
			fingerprint: common.fingerprint,
			sources: common.sources,
			results,
		},
		null,
		2,
	) + "\n",
);
writeFileSync(
	join(output, "manifest.json"),
	JSON.stringify({ ...common, probes }, null, 2) + "\n",
);
writeFileSync(
	join(output, "reports.json"),
	JSON.stringify(reports, null, 2) + "\n",
);
console.log(
	reports
		.map((r) => `${r.schema}: ${r.found}/8000, ${r.inputs} observations`)
		.join("\n"),
);
