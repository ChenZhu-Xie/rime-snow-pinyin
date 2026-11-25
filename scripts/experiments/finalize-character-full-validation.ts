/** 汇总同指纹全量采集；仅写 output，校验通过后再人工发布当前报告。 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { ALL_BENCHMARK_SCHEMES } from "../lib/benchmark-schemes";
const base = resolve(process.argv[2] ?? "output/character-full-current");
const read = (p: string) => readFileSync(p, "utf8").replace(/^\ufeff/, "");
const json = (p: string) => JSON.parse(read(p));
const hash = (p: string) =>
	createHash("sha256").update(readFileSync(p)).digest("hex");
const run = (args: string[]) => {
	const r = spawnSync("bun", args, { stdio: "inherit" });
	assert.equal(r.status, 0, args.join(" "));
};
const combined = join(base, "combined");
mkdirSync(combined, { recursive: true });
const results: any[] = [],
	probes: any[] = [],
	reports: any[] = [],
	observations: string[] = [];
let common: any;
for (const scheme of ALL_BENCHMARK_SCHEMES) {
	const dir = join(base, "run", scheme.schemaId);
	run(["scripts/audit-character-conflict-probes.ts", dir]);
	const m = json(join(dir, "results/manifest.json")),
		a = json(join(dir, "audit.json")),
		r = json(join(dir, "report.json"));
	assert.equal(r.targets, 8000);
	assert.equal(a.results[0].targets, 8000);
	assert.equal(a.results[0].found, r.found);
	if (common) {
		assert.equal(m.revision, common.revision);
		assert.equal(m.fingerprint, common.fingerprint);
		assert.deepEqual(m.sources, common.sources);
	}
	common = m;
	results.push(...a.results);
	probes.push(...m.probes);
	reports.push(r);
	let path = join(dir, "results/observations.jsonl");
	if (scheme.schemaId === "snow_qingyun") {
		const old = resolve("output/qingyun-130"),
			expanded = json(join(old, "local-observations.json"));
		const oldFingerprint = read(
			join(base, "run/snow_qingyun/fingerprint.txt"),
		).trim();
		// 哈希冻结既有后续页证据，防止无意复用另一轮结果。
		assert.equal(
			hash(join(old, "local-observations.json")),
			"624c62b7d44ec392b1c4ed7582a0f2639fe258a6177c8dbe857091e932c91deb",
		);
		const { existsSync } = await import("node:fs");
		assert.ok(
			existsSync(join(old, "local-cache", oldFingerprint)),
			"清韵后续页指纹不一致",
		);
		const rows = read(path)
				.trimEnd()
				.split("\n")
				.map((l) => JSON.parse(l)),
			map = new Map(rows.map((r) => [r.code, r]));
		for (const [code, o] of expanded) {
			const r = map.get(code);
			assert.ok(r, code);
			assert.deepEqual(
				r.candidates.map((c: any) => c.text),
				o.candidates.slice(0, 6),
				code,
			);
			assert.equal(r.commit ?? "", o.commit);
			assert.equal(r.completed, o.completed);
			r.candidates = o.candidates.map((text: string) => ({ text }));
		}
		const dest = join(base, "expanded", scheme.schemaId, "results");
		mkdirSync(dest, { recursive: true });
		path = join(dest, "observations.jsonl");
		writeFileSync(path, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
		writeFileSync(
			join(dest, "manifest.json"),
			JSON.stringify(
				{
					...m,
					expandedEvidence: {
						fingerprint: oldFingerprint,
						sha256: hash(join(old, "local-observations.json")),
						overlap: expanded.length,
					},
				},
				null,
				2,
			),
		);
	}
	observations.push(path);
}
const auditPath = join(combined, "audit.json");
writeFileSync(
	auditPath,
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
	join(combined, "manifest.json"),
	JSON.stringify({ ...common, probes }, null, 2) + "\n",
);
writeFileSync(
	join(combined, "reports.json"),
	JSON.stringify(reports, null, 2) + "\n",
);
run([
	"scripts/export-character-observed-corrections.ts",
	auditPath,
	"reports",
	join(base, "observed"),
	"--full-refresh",
]);
run([
	"scripts/export-character-selection-report.ts",
	join(base, "observed"),
	join(base, "final"),
	...observations,
]);
const name = "8000字_十二方案含选重键数";
const rows = read(join(base, "final", name + ".tsv"))
	.trimEnd()
	.split(/\r?\n/)
	.map((l) => l.split("\t"));
const previous = read("reports/" + name + ".tsv")
	.trimEnd()
	.split(/\r?\n/)
	.map((l) => l.split("\t"));
const meta = json(join(base, "final", name + ".json"));
assert.equal(rows.length, 8001);
for (const [i, s] of meta.schemes.entries()) {
	const txt = read(
		join(base, "final/各方案8000字码表", s.name + "_8000字_字频序.txt"),
	)
		.trimEnd()
		.split(/\r?\n/)
		.slice(2)
		.map((l) => l.split("\t"));
	assert.equal(txt.length, 8000);
	for (let n = 0; n < 8000; n++) {
		assert.equal(rows[n + 1][1], txt[n][0]);
		assert.equal(rows[n + 1].at(-1), txt[n].at(-1));
		assert.deepEqual(
			rows[n + 1].slice(2 + i * 3, 5 + i * 3),
			txt[n].slice(1, 4),
		);
		if (s.id === "sbxh" || s.id === "flypy")
			assert.deepEqual(
				rows[n + 1].slice(2 + i * 3, 5 + i * 3),
				previous[n + 1].slice(2 + i * 3, 5 + i * 3),
				"外部方案原资料必须保留",
			);
	}
	for (const [n, c] of Object.entries(s.cohorts) as [string, any][]) {
		const subset = rows.slice(1, Number(n) + 1),
			dist: Record<number, number> = {};
		let sum = 0,
			selected = 0;
		assert.equal(c.unresolved.length, 0, `${s.name} 仍有 NA，需补证`);
		for (const r of subset) {
			const k = Number(r[3 + i * 3]);
			assert.ok(k > 0);
			sum += k;
			selected += Number(r[4 + i * 3]);
			dist[k] = (dist[k] ?? 0) + 1;
		}
		assert.equal(c.mean, sum / Number(n));
		assert.equal(c.selection, selected);
		assert.deepEqual(c.distribution, dist);
	}
}
writeFileSync(
	join(base, "final/verified.json"),
	JSON.stringify(
		{
			records: 96000,
			observedTargets: 80000,
			cohorts: 108,
			externalDataUnchanged: true,
			auditSha256: hash(auditPath),
			observations: observations.map((path) => ({ path, sha256: hash(path) })),
		},
		null,
		2,
	) + "\n",
);
console.log(
	"已验证 96000 行、108 个口径汇总；十个冰雪方案均有空词典引擎证据，外部两方案数值未变。",
);
