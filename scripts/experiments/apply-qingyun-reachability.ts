import assert from "node:assert/strict";
import {
	readFileSync,
	writeFileSync,
	copyFileSync,
	mkdirSync,
	readdirSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { candidateSelection } from "../lib/benchmark-selection";
import { physicalKeys } from "../lib/character-first-choice";
const base = "reports/8000字_十二方案含选重键数",
	dir = "output/qingyun-130",
	read = (p: string) => readFileSync(p, "utf8");
const evidence = JSON.parse(read(dir + "/local-result.json"));
assert.equal(
	createHash("sha256")
		.update(readFileSync(dir + "/local-observations.json"))
		.digest("hex"),
	"624c62b7d44ec392b1c4ed7582a0f2639fe258a6177c8dbe857091e932c91deb",
);
const observations = new Map<string, any>(
	JSON.parse(read(dir + "/local-observations.json")),
);
for (const entry of evidence) {
	const row = observations.get(entry.selection.code);
	assert.ok(row.completed && !row.commit);
	assert.equal(row.candidates[entry.selection.rank - 1], entry.text);
	// 翻页开始计键后，必须重新比较所有已观测路径，不能沿用最短编码。
	entry.selection = [...entry.hits].sort(
		(a, b) =>
			physicalKeys(a.code) +
				candidateSelection(a.rank, 6).keys -
				physicalKeys(b.code) -
				candidateSelection(b.rank, 6).keys ||
			a.rank - b.rank ||
			a.code.localeCompare(b.code),
	)[0];
	assert.equal(
		observations.get(entry.selection.code).candidates[entry.selection.rank - 1],
		entry.text,
	);
}
const meta = JSON.parse(read(base + ".json"));
const index = meta.schemes.findIndex((s: any) => s.id === "qingyun"),
	scheme = meta.schemes[index];
const path = "reports/各方案8000字码表/冰雪清韵_8000字_字频序.txt";
const txt = read(path).trimEnd().split(/\r?\n/);
txt[0] =
	"# 优先无选重；否则计入编码、翻页与选重键。最短性限于已观测路径，未实测可达性见来源列。";
const tsv = read(base + ".tsv")
	.trimEnd()
	.split(/\r?\n/)
	.map((l) => l.split("\t"));
const map = new Map(evidence.map((r: any) => [r.text, r]));
assert.equal(map.size, 130);
assert.equal(scheme.cohorts[8000].unresolved.length, 0);
mkdirSync(dir + "/before-page-cost", { recursive: true });
for (const p of [path, base + ".json", base + ".md", base + ".tsv"])
	copyFileSync(p, dir + "/before-page-cost/" + p.split("/").at(-1));
let changed = 0;
for (let i = 2; i < txt.length; i++) {
	const r = txt[i].split("\t"),
		e: any = map.get(r[0]);
	if (!e) continue;
	assert.equal(r[3], "1");
	assert.equal(e.first, null);
	assert.ok(e.selection);
	r[1] = e.selection.code;
	r[2] = String(
		physicalKeys(r[1]) + candidateSelection(e.selection.rank, 6).keys,
	);
	r[3] = "1";
	r[4] = "实测后续页候选＋翻页及选重";
	txt[i] = r.join("\t");
	const row = tsv[i - 1];
	assert.equal(row[1], r[0]);
	row[2 + index * 3] = r[1];
	row[3 + index * 3] = r[2];
	row[4 + index * 3] = "1";
	changed++;
}
assert.equal(changed, 130);
// 同批后续页也可能让其他选重字获得更省键的路径；已有首选绝不覆盖。
const shorterSelections = [];
for (let i = 2; i < txt.length; i++) {
	const r = txt[i].split("\t");
	if (r[3] !== "1") continue;
	for (const [code, observation] of observations) {
		if (!observation.completed || observation.commit) continue;
		const rank = observation.candidates.indexOf(r[0]) + 1;
		if (rank < 2) continue;
		const keys = physicalKeys(code) + candidateSelection(rank, 6).keys;
		if (keys >= Number(r[2])) continue;
		shorterSelections.push({ text: r[0], code, rank, keys });
		r[1] = code;
		r[2] = String(keys);
		r[4] = "实测后续页候选＋翻页及选重";
	}
	txt[i] = r.join("\t");
	tsv[i - 1][2 + index * 3] = r[1];
	tsv[i - 1][3 + index * 3] = r[2];
}
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
delete meta.sourceCounts["实测后续页候选＋理想选重一键（不计翻页）"];
meta.sourceCounts["实测后续页候选＋翻页及选重"] = 130;
meta.sourceCounts = {};
for (const file of readdirSync("reports/各方案8000字码表")) {
	if (!file.endsWith(".txt")) continue;
	const rows =
		file === path.split("/").at(-1)
			? txt
			: read("reports/各方案8000字码表/" + file)
					.trimEnd()
					.split(/\r?\n/);
	for (const line of rows.slice(2)) {
		const fields = line.split("\t");
		if (fields[1] === "NA") continue;
		meta.sourceCounts[fields[4]] = (meta.sourceCounts[fields[4]] ?? 0) + 1;
	}
}
meta.pageCost = 1;
meta.pageSize = 6;
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
	pageCost: 1,
	shorterSelections,
};

const lines = [
	"# 十二方案单字键数（优先无选重，计入翻页）",
	"",
	"只要枚举路径中能无选重打出，就优先采用最短首选路径；否则在已验证候选路径中比较编码键、翻页键和选重键的总和。冰雪方案每页六项，翻页每次一键，选择候选一键；首选不计确认空格。均键按字等权，未验证记录为 NA，含 NA 的总体均键待核实。外部方案保留原资料。最短性限于已观测路径。",
	"",
	"清韵原 130 条缺测字已经补证；现已按翻页成本重新选择路径。候选序号与页数见 [清韵130字可达性审计](清韵130字可达性审计.tsv)。其他方案数据来源与版本沿用此前报告。",
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
const upstream = JSON.parse(read(dir + "/upstream-result.json"));
const audit = [
	"字\t本地选重编码\t本地候选序号\t本地翻页次数\t本地总键数\t上游选重编码\t上游候选序号\t上游翻页次数\t上游总键数",
];
for (const e of evidence) {
	const u = upstream.find((x: any) => x.text === e.text);
	const best = [...u.hits].sort(
		(a, b) =>
			physicalKeys(a.code) +
				candidateSelection(a.rank, 6).keys -
				physicalKeys(b.code) -
				candidateSelection(b.rank, 6).keys ||
			a.rank - b.rank ||
			a.code.localeCompare(b.code),
	)[0];
	const l = e.selection;
	audit.push(
		[
			e.text,
			l.code,
			l.rank,
			candidateSelection(l.rank, 6).pages,
			physicalKeys(l.code) + candidateSelection(l.rank, 6).keys,
			best.code,
			best.rank,
			candidateSelection(best.rank, 6).pages,
			physicalKeys(best.code) + candidateSelection(best.rank, 6).keys,
		].join("\t"),
	);
}
writeFileSync(
	"reports/清韵130字可达性审计.tsv",
	"\ufeff" + audit.join("\n") + "\n",
);
writeFileSync(path, txt.join("\n") + "\n");
writeFileSync(base + ".tsv", tsv.map((r) => r.join("\t")).join("\n") + "\n");
writeFileSync(base + ".json", JSON.stringify(meta, null, 2) + "\n");
writeFileSync(base + ".md", lines.join("\n"));
console.log({ changed, qingyun: scheme.cohorts[8000] });
