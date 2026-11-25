import assert from "node:assert/strict";
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
const base = "reports/8000字_十二方案含选重键数",
	dir = "output/qingyun-130",
	read = (p: string) => readFileSync(p, "utf8");
const evidence = JSON.parse(read(dir + "/local-result.json"));
assert.equal(createHash("sha256").update(readFileSync(dir + "/local-observations.json")).digest("hex"), "624c62b7d44ec392b1c4ed7582a0f2639fe258a6177c8dbe857091e932c91deb");
const observations = new Map<string, any>(JSON.parse(read(dir + "/local-observations.json")));
for (const entry of evidence) {
	const row = observations.get(entry.selection.code);
	assert.ok(row.completed && !row.commit);
	assert.equal(row.candidates[entry.selection.rank - 1], entry.text);
}
const meta = JSON.parse(read(base + ".json"));
const index = meta.schemes.findIndex((s: any) => s.id === "qingyun"),
	scheme = meta.schemes[index];
const path = "reports/各方案8000字码表/冰雪清韵_8000字_字频序.txt";
const txt = read(path).trimEnd().split(/\r?\n/);
const tsv = read(base + ".tsv")
	.trimEnd()
	.split(/\r?\n/)
	.map((l) => l.split("\t"));
const map = new Map(evidence.map((r: any) => [r.text, r]));
assert.equal(map.size, 130);
assert.deepEqual(
	[...scheme.cohorts[8000].unresolved].sort(),
	[...map.keys()].sort(),
);
mkdirSync(dir + "/previous-reports", { recursive: true });
for (const p of [path, base + ".json", base + ".md", base + ".tsv"])
	copyFileSync(p, dir + "/previous-reports/" + p.split("/").at(-1));
let changed = 0;
for (let i = 2; i < txt.length; i++) {
	const r = txt[i].split("\t"),
		e: any = map.get(r[0]);
	if (!e) continue;
	assert.equal(r[1], "NA");
	assert.equal(e.first, null);
	assert.ok(e.selection);
	r[1] = e.selection.code;
	r[2] = String(r[1].length + 1);
	r[3] = "1";
	r[4] = "实测后续页候选＋理想选重一键（不计翻页）";
	txt[i] = r.join("\t");
	const row = tsv[i - 1];
	assert.equal(row[1], r[0]);
	row[2 + index * 3] = r[1];
	row[3 + index * 3] = r[2];
	row[4 + index * 3] = "1";
	changed++;
}
assert.equal(changed, 130);
for (const key of Object.keys(scheme.cohorts)) {
	const n = Number(key),
		rows = tsv.slice(1, n + 1),
		distribution: Record<number, number> = {};
	let sum = 0,
		selection = 0;
	for (const r of rows) {
		const k = Number(r[3 + index * 3]);
		assert.ok(k > 0);
		sum += k;
		selection += Number(r[4 + index * 3]);
		distribution[k] = (distribution[k] ?? 0) + 1;
	}
	scheme.cohorts[key] = {
		count: n,
		mean: sum / n,
		selection,
		unresolved: [],
		distribution,
	};
}
meta.sourceCounts["实测后续页候选＋理想选重一键（不计翻页）"] = 130;
meta.supplementalEvidence = {
	schema: "snow_qingyun",
	targets: 130,
	sourceRevision: "399b1b01342cb7e1f05fccf5c1854b5bdbc0592e",
	upstreamRevision: "99c1d6010ff7252175f2b373f05ff30e9541f3c3",
	firstPageOverlap: 405,
	firstPageDifferences: 0,
	sha256: createHash("sha256")
		.update(readFileSync(dir + "/local-observations.json"))
		.digest("hex"),
	audit: "清韵130字可达性审计.tsv",
	selectionCost: 1,
	pageCost: 0,
};
let md = read(base + ".md");
md = md.replace("选重只接受", "选重只接受");
const lines = md.split("\n");
let n = 0,
	lengths: number[] = [];
for (let i = 0; i < lines.length; i++) {
	const l = lines[i];
	const h = l.match(/^## 前 (\d+) 字/);
	if (h) n = Number(h[1]);
	if (l.startsWith("| 方案 |"))
		lengths = [...l.matchAll(/ (\d+)键 /g)].map((m) => Number(m[1]));
	if (l.startsWith("| 冰雪清韵 |")) {
		const s = scheme.cohorts[n],
			cell = (v: number) => `${v}／${((100 * v) / n).toFixed(2)}%`;
		lines[i] =
			`| 冰雪清韵 | ${s.mean.toFixed(4)} | ${cell(s.selection)} | ${lengths.map((k) => cell(s.distribution[k] ?? 0)).join(" | ")} |`;
	}
	if (l.startsWith("冰雪清韵有 ") && l.includes("尚无可达证据")) lines[i] = "";
}
lines.splice(
	6,
	0,
	"清韵补充审计：原 130 条 NA 已在本地与上游的后续候选页确认可达，按「两键音码＋一键理想选重」计为 3 键，不计翻页。全部编码与候选序号见 [清韵130字可达性审计](清韵130字可达性审计.tsv)。本地 405 个重合编码的首页与旧观测一致，其余方案沿用原报告。",
	"",
);
writeFileSync(path, txt.join("\n") + "\n");
writeFileSync(base + ".tsv", tsv.map((r) => r.join("\t")).join("\n") + "\n");
writeFileSync(base + ".json", JSON.stringify(meta, null, 2) + "\n");
writeFileSync(base + ".md", lines.join("\n"));
console.log({ changed, qingyun: scheme.cohorts[8000] });
