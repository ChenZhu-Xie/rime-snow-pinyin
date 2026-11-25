import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { benchmarkCharacters } from "../lib/benchmark-characters";
import { rootPath } from "../lib/paths";
const base = resolve(process.argv[2] ?? "output/classic-fixed-ab");
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const chars = benchmarkCharacters(
	readFileSync(
		rootPath("scripts/data/benchmark-character-frequency.tsv"),
		"utf8",
	),
);
const cohorts = [500, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 8000];
const names = {
	snow_jiandao_classic: "冰雪键道",
	snow_sanpin_classic: "冰雪三拼",
};
const results: any[] = [];
const differences = [
	"方案\t字\t字频序\t当前编码\t当前键数\t当前选重\t上游单字编码\t上游单字键数\t上游单字选重\t冻结频次",
];
for (const [schema, name] of Object.entries(names)) {
	const aManifest = read(
		join(base, "current", "run", schema, "results/manifest.json"),
	);
	const bManifest = read(
		join(base, "upstream-singles", "run", schema, "results/manifest.json"),
	);
	assert.equal(aManifest.revision, bManifest.revision);
	assert.deepEqual(
		Object.keys(aManifest.sources).sort(),
		Object.keys(bManifest.sources).sort(),
	);
	const changedSources = Object.keys(aManifest.sources)
		.filter((k) => aManifest.sources[k] !== bManifest.sources[k])
		.sort();
	assert.deepEqual(changedSources, [
		"snow_jiandao_classic.fixed.txt",
		"snow_sanpin_classic.fixed.txt",
	]);
	const groups: any = {};
	for (const variant of ["current", "upstream-singles"]) {
		const dir = join(base, variant, "run", schema),
			audit = read(join(dir, "audit.json")).results[0];
		assert.deepEqual(
			audit.characters.map((r: any) => r.text).sort(),
			chars.map((c) => c.text).sort(),
		);
		const choices = new Map<string, any>(
			audit.characters
				.filter((r: any) => r.choice)
				.map((r: any) => [r.text, { ...r.choice, selection: false }]),
		);
		const obs = readFileSync(join(dir, "results/observations.jsonl"), "utf8")
			.trimEnd()
			.split(/\r?\n/)
			.map((l) => JSON.parse(l));
		const interrupted = new Set(
			obs.filter((r) => r.commit || r.completed === false).map((r) => r.code),
		);
		for (const row of obs) {
			if (
				[...Array(row.code.length)].some((_, i) =>
					interrupted.has(row.code.slice(0, i + 1)),
				)
			)
				continue;
			for (const c of row.candidates.slice(1)) {
				const old = choices.get(c.text);
				if (old && !old.selection) continue;
				const v = {
					code: row.code,
					keys: row.code.length + 1,
					selection: true,
				};
				if (
					!old ||
					v.keys < old.keys ||
					(v.keys === old.keys && v.code < old.code)
				)
					choices.set(c.text, v);
			}
		}
		const stats = Object.fromEntries(
			cohorts.map((n) => {
				const rows = chars.slice(0, n).map((c) => choices.get(c.text));
				const found = rows.filter(Boolean);
				const first = found.filter((c) => !c.selection);
				return [
					n,
					{
						first: first.length,
						selection: found.length - first.length,
						unresolved: n - found.length,
						mean:
							found.length === n
								? found.reduce((a, c) => a + c.keys, 0) / n
								: null,
						firstMean: first.reduce((a, c) => a + c.keys, 0) / first.length,
					},
				];
			}),
		);
		groups[variant] = { stats, choices };
	}
	let improved = 0,
		worsened = 0,
		equal = 0,
		firstGain = 0,
		firstLoss = 0;
	for (const [i, c] of chars.entries()) {
		const a = groups.current.choices.get(c.text),
			b = groups["upstream-singles"].choices.get(c.text);
		if (a && !a.selection && b && !b.selection) {
			if (a.keys > b.keys) improved++;
			else if (a.keys < b.keys) worsened++;
			else equal++;
		}
		if (b && !b.selection && (!a || a.selection)) firstGain++;
		if (a && !a.selection && (!b || b.selection)) firstLoss++;
		if (JSON.stringify(a) !== JSON.stringify(b))
			differences.push(
				[
					name,
					c.text,
					i + 1,
					a?.code ?? "NA",
					a?.keys ?? "NA",
					a ? +a.selection : "NA",
					b?.code ?? "NA",
					b?.keys ?? "NA",
					b ? +b.selection : "NA",
					c.frequency,
				].join("\t"),
			);
	}
	results.push({
		schema,
		name,
		current: groups.current.stats,
		upstream: groups["upstream-singles"].stats,
		improved,
		worsened,
		equal,
		firstGain,
		firstLoss,
	});
}
const md = [
	"# 经典方案单字固顶 A/B 实测",
	"",
	"两组均停用简体原字优先，空词典逐键查询；仅替换上游单字固顶并映射第三码声调。保留本地非单字候选顺序，qe／hv 的原词语仍优先。先无选重，再最短；最短限于已枚举路径。选重只接受首页实测证据，未覆盖记录不估算均键。",
	"",
];
for (const n of cohorts) {
	md.push(
		`## 前 ${n} 字`,
		"",
		"| 方案 | 固顶组 | 无选重 | 选重 | 待核实 | 全体均键 | 无选重字均键 |",
		"| --- | --- | ---: | ---: | ---: | ---: | ---: |",
	);
	for (const r of results)
		for (const [key, label] of [
			["current", "当前"],
			["upstream", "上游单字"],
		]) {
			const s = r[key][n];
			md.push(
				`| ${r.name} | ${label} | ${s.first} | ${s.selection} | ${s.unresolved} | ${s.mean?.toFixed(4) ?? "待核实"} | ${s.firstMean.toFixed(4)} |`,
			);
		}
	md.push("");
}
writeFileSync(join(base, "comparison.json"), JSON.stringify(results, null, 2));
writeFileSync(join(base, "comparison.md"), md.join("\n"));
writeFileSync(
	join(base, "differences.tsv"),
	"\ufeff" + differences.join("\n") + "\n",
);
console.log(
	results.map((r) => ({
		name: r.name,
		current: r.current[8000],
		upstream: r.upstream[8000],
		improved: r.improved,
		worsened: r.worsened,
		firstGain: r.firstGain,
		firstLoss: r.firstLoss,
	})),
);
