import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { physicalKeys } from "../lib/character-first-choice";
import { candidateSelection } from "../lib/benchmark-selection";

const read = (p: string) => readFileSync(p, "utf8").replace(/^\ufeff/, "");
const hash = (p: string) =>
	createHash("sha256").update(readFileSync(p)).digest("hex");
const base = "reports/8000字_十二方案含选重键数";
const meta = JSON.parse(read(base + ".json"));
const rows = read(base + ".tsv")
	.trimEnd()
	.split(/\r?\n/)
	.map((l) => l.split("\t"));
const audit = [
	"方案\t字\t编码\t候选序号\t翻页次数\t选重\t总键数\t字频序\t冻结频次",
];
const evidence = [];
for (const [id, schema, count] of [
	["oc21-shape", "snow_jiandao", 17],
	["liandao", "snow_jiandao_toned", 18],
] as const) {
	const dir = `output/filter-disabled-recheck/${schema}`;
	const result = JSON.parse(read(dir + "/result.json"));
	assert.equal(hash(dir + "/input.json"), result.inputSha256);
	assert.equal(hash(dir + "/observations.json"), result.observationsSha256);
	assert.equal(result.schema, schema);
	assert.equal(result.results.length, count);
	const observations = new Map<string, any>(
		JSON.parse(read(dir + "/observations.json")),
	);
	const index = meta.schemes.findIndex((s: any) => s.id === id),
		scheme = meta.schemes[index];
	const path = `reports/各方案8000字码表/${scheme.name}_8000字_字频序.txt`;
	const txt = read(path).trimEnd().split(/\r?\n/);
	const targets = new Map<string, any>(
		result.results.map((r: any) => [r.text, r]),
	);
	assert.equal(targets.size, count);
	const unresolved = new Set(scheme.cohorts[8000].unresolved);
	// 本次迁移只填原 NA；也允许同一份证据幂等重放。
	let changed = 0;
	for (let i = 2; i < txt.length; i++) {
		const r = txt[i].split("\t"),
			target = targets.get(r[0]);
		if (!target) continue;
		const best = target.best;
		assert.ok(best, `仍无可达证据：${r[0]}`);
		assert.ok(unresolved.has(r[0]) || r[4] === "停用过滤器后空词典引擎观测");
		const o = observations.get(best.code);
		assert.ok(o.completed && !o.commit);
		assert.equal(o.candidates[best.rank - 1], r[0]);
		const sorted = [...target.hits].sort(
			(a, b) =>
				Number(a.rank > 1) - Number(b.rank > 1) ||
				a.keys - b.keys ||
				a.rank - b.rank ||
				a.code.localeCompare(b.code),
		);
		assert.deepEqual(best, sorted[0]);
		const selection = candidateSelection(best.rank, 6),
			keys = physicalKeys(best.code) + selection.keys;
		assert.equal(keys, best.keys);
		r[1] = best.code;
		r[2] = String(keys);
		r[3] = String(Number(best.rank > 1));
		r[4] = "停用过滤器后空词典引擎观测";
		txt[i] = r.join("\t");
		const row = rows[i - 1];
		assert.equal(row[1], r[0]);
		row.splice(2 + index * 3, 3, ...r.slice(1, 4));
		audit.push(
			[
				scheme.name,
				r[0],
				best.code,
				best.rank,
				selection.pages,
				r[3],
				keys,
				r[5],
				r[6],
			].join("\t"),
		);
		changed++;
	}
	assert.equal(changed, count);
	txt[0] =
		"# 优先无选重，否则计入翻页与选重；来源列标识本次补测，其余字沿用原观测。最短性限于已枚举路径。";
	writeFileSync(path, txt.join("\n") + "\n");
	for (const n of Object.keys(scheme.cohorts).map(Number)) {
		let sum = 0,
			selection = 0;
		const distribution: Record<number, number> = {},
			unresolved: string[] = [];
		for (const r of rows.slice(1, n + 1)) {
			const v = r[3 + index * 3];
			if (v === "NA") {
				unresolved.push(r[1]);
				continue;
			}
			const k = Number(v);
			assert.ok(k > 0);
			sum += k;
			selection += Number(r[4 + index * 3]);
			distribution[k] = (distribution[k] ?? 0) + 1;
		}
		scheme.cohorts[n] = {
			count: n,
			mean: unresolved.length ? null : sum / n,
			selection,
			unresolved,
			distribution,
		};
	}
	evidence.push({
		schema,
		targets: count,
		revision: result.revision,
		inputSha256: result.inputSha256,
		observationsSha256: result.observationsSha256,
		resultSha256: hash(dir + "/result.json"),
	});
	console.log(scheme.name, scheme.cohorts[8000]);
}
meta.filterDisabledSupplement = {
	evidence,
	audit: "兰道莲道35字可达性复核.tsv",
	scope: "只补测此前 NA 的 35 字，其余字沿用原观测；非停用过滤器后的全量重算",
};
meta.sourceCounts = {};
for (const file of readdirSync("reports/各方案8000字码表")) {
	if (!file.endsWith(".txt")) continue;
	for (const line of read("reports/各方案8000字码表/" + file)
		.trimEnd()
		.split(/\r?\n/)
		.slice(2)) {
		const r = line.split("\t");
		if (r[1] === "NA") continue;
		meta.sourceCounts[r[4]] = (meta.sourceCounts[r[4]] ?? 0) + 1;
	}
}
writeFileSync("reports/兰道莲道35字可达性复核.tsv", audit.join("\n") + "\n");
writeFileSync(base + ".tsv", rows.map((r) => r.join("\t")).join("\n") + "\n");
writeFileSync(base + ".json", JSON.stringify(meta, null, 2) + "\n");
const lines = [
	"# 十二方案单字键数（优先无选重，计入翻页）",
	"",
	"只要枚举路径中能无选重打出，就优先采用最短首选路径；否则在已验证候选路径中比较编码键、翻页键和选重键的总和。冰雪方案每页六项，翻页每次一键，选择候选一键；首选不计确认空格。均键按字等权，未验证记录为 NA，含 NA 的总体均键待核实。外部方案保留原资料。最短性限于已观测路径。",
	"",
	"清韵原 130 条缺测字已经补证；现已按翻页成本重新选择路径。候选序号与页数见 [清韵130字可达性审计](清韵130字可达性审计.tsv)。兰道 17 字、莲道 18 字已用停用过滤器后的当前方案补测，详见 [兰道莲道35字复核](兰道莲道35字可达性复核.tsv)。其余字沿用原观测，尚不是停用过滤器后的全量重算。",
	"",
];
for (const n of [500, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 8000]) {
	const lengths = [
		...new Set<number>(
			meta.schemes.flatMap((s: any) =>
				Object.keys(s.cohorts[n].distribution).map(Number),
			),
		),
	].sort((a, b) => a - b);
	const cell = (v: number) => v + "／" + ((100 * v) / n).toFixed(2) + "%";
	lines.push(
		"## 前 " + n + " 字",
		"",
		"| 方案 | 均键 | 选重 | " + lengths.map((k) => k + "键").join(" | ") + " |",
		"| --- | " +
			Array(lengths.length + 2)
				.fill("---:")
				.join(" | ") +
			" |",
	);
	for (const s of meta.schemes) {
		const c = s.cohorts[n];
		lines.push(
			"| " +
				s.name +
				" | " +
				(c.mean?.toFixed(4) ?? "待核实") +
				" | " +
				cell(c.selection) +
				" | " +
				lengths.map((k) => cell(c.distribution[k] ?? 0)).join(" | ") +
				" |",
		);
	}
	lines.push("");
	for (const s of meta.schemes) {
		const c = s.cohorts[n];
		if (c.unresolved.length)
			lines.push(
				s.name +
					"尚有 " +
					c.unresolved.length +
					" 字可达性待核实：" +
					c.unresolved.join("、") +
					"。",
				"",
			);
	}
}

writeFileSync(base + ".md", lines.join("\n"));
