import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	buildAlternatives,
	buildBenchmarkCorpus,
} from "../generate_full_benchmark_reports";
import { exact500Articles } from "../exact_500_articles";
import { ALL_BENCHMARK_SCHEMES } from "../lib/benchmark-schemes";
import {
	optimizeBenchmarkLine,
	type BenchmarkAlternative,
} from "../lib/benchmark-paths";
import { countBenchmarkKeys } from "../lib/benchmark-key-counts";
import { RimeCandidateOracle } from "../lib/rime-candidate-oracle";
import { rootPath } from "../lib/paths";

const [id, outputArg = "output/corpus-benchmark-current"] =
	process.argv.slice(2);
const output = resolve(outputArg);
mkdirSync(output, { recursive: true });
const prepared = JSON.parse(
	readFileSync(rootPath("output/append-generalization/corpora.json"), "utf8"),
);
const groups: Array<{ id: string; segments: string[]; hanCharacters: number }> =
	[
		{
			id: "original5500",
			hanCharacters: 5500,
			segments: [...exact500Articles, exact500Articles[9]].flatMap((a) =>
				a.lines.flatMap((line) => line.match(/\p{Script=Han}{1,80}/gu) ?? []),
			),
		},
		...prepared.corpora.map((c: any) => ({ id: c.id, ...c.sample })),
	];
for (const group of groups)
	assert.equal(
		group.segments.reduce((s, t) => s + [...t].length, 0),
		group.hanCharacters,
	);
const scheme = ALL_BENCHMARK_SCHEMES.find((s) => s.id === id);
let alternatives: Map<string, BenchmarkAlternative[]>;
let evidence: unknown;
const started = Date.now();
if (scheme) {
	const corpus = buildBenchmarkCorpus(groups.flatMap((g) => g.segments));
	const oracle = new RimeCandidateOracle([scheme.schemaId], {
		cacheRoot: join(output, "cache", id),
		compiledCacheRoot: join(output, "compiled", id),
	});
	try {
		oracle.selectSchema(scheme.schemaId);
		oracle.setOptions({
			popping: true,
			buffered: false,
			character: false,
			ascii_mode: false,
			full_shape: false,
			traditionalization: false,
		});
		let calls = 0;
		const result = buildAlternatives(
			corpus,
			scheme.id,
			(code) => {
				if (++calls % 2000 === 0) {
					Bun.gc(true);
					console.log(
						JSON.stringify({
							id,
							calls,
							seconds: (Date.now() - started) / 1000,
							...oracle.cacheStats(),
						}),
					);
				}
				return oracle.candidates(code);
			},
			(code) => oracle.committedText(code),
		);
		alternatives = result.alternatives;
		oracle.auditCachedQueries();
		evidence = {
			cache: oracle.cacheDirectory(),
			stats: oracle.cacheStats(),
			singleCharacterAudit: result.singleCharacterFirstChoiceAudit,
		};
	} finally {
		oracle.close();
	}
} else {
	assert.ok(id === "sbxh" || id === "flypy");
	const articles = join(output, `${id}-articles.json`),
		result = join(output, `${id}-alternatives.json`);
	writeFileSync(
		articles,
		JSON.stringify(
			groups.map((g, i) => ({
				id: i + 1,
				title: g.id,
				genre: g.id,
				lines: g.segments,
			})),
		),
	);
	process.env.BENCHMARK_ARTICLES = articles;
	process.env.BENCHMARK_ALTERNATIVES = result;
	await import(
		id === "sbxh" ? "../benchmark-sbxh-5000" : "../benchmark-flypy-5000"
	);
	const data = JSON.parse(readFileSync(result, "utf8"));
	alternatives = new Map(data.alternatives);
	evidence = { cache: data.candidateCache };
}
const records: any[] = [];
const summaries: any[] = [];
for (const group of groups) {
	const excluded: any[] = [];
	const selected: any[] = [];
	for (const [index, text] of group.segments.entries()) {
		try {
			const path = optimizeBenchmarkLine(text, alternatives);
			assert.equal(path.tokens.map((t) => t.word).join(""), text);
			const counts = countBenchmarkKeys(
				path.tokens.map((t) => t.displayCode + (t.separator ? "_" : "")),
			);
			assert.equal(counts.keys, path.keys);
			assert.equal(counts.selections, path.selectionCount);
			const row = { group: group.id, index, text, ...path, counts };
			selected.push(row);
			records.push(row);
		} catch (error) {
			if (!String(error).includes("无法求得最优路径")) throw error;
			excluded.push({ index, text, error: String(error) });
		}
	}
	summaries.push({
		group: group.id,
		requested: group.hanCharacters,
		characters: selected.reduce((s, r) => s + [...r.text].length, 0),
		keys: selected.reduce((s, r) => s + r.keys, 0),
		selections: selected.reduce((s, r) => s + r.selectionCount, 0),
		excluded,
	});
}
writeFileSync(
	join(output, `${id}-paths.jsonl`),
	records.map((r) => JSON.stringify(r)).join("\n") + "\n",
);
writeFileSync(
	join(output, `${id}-paths.tsv`),
	[
		"语料\t片段\t原文\t切分\t编码（_为空格）\t键数\t选重",
		...records.map((r) =>
			[
				r.group,
				r.index + 1,
				r.text,
				r.tokens.map((t: any) => t.word).join(" | "),
				r.tokens
					.map((t: any) => t.displayCode + (t.separator ? "_" : ""))
					.join(" | "),
				r.keys,
				r.selectionCount,
			].join("\t"),
		),
	].join("\n") + "\n",
);
writeFileSync(
	join(output, `${id}-summary.json`),
	JSON.stringify(
		{
			id,
			name:
				scheme?.shortName ??
				(id === "sbxh" ? "声笔小鹤" : "小鹤音形（清风版）"),
			definition:
				"已枚举路径内先最少选重再最少按键；纯汉字段；标点分界且最长80字；空词典关闭学习；缺测片段明确排除",
			sampleSha256: createHash("sha256")
				.update(JSON.stringify(groups))
				.digest("hex"),
			elapsedSeconds: (Date.now() - started) / 1000,
			evidence,
			summaries,
		},
		null,
		2,
	) + "\n",
);
console.log(`${id} 完成，${(Date.now() - started) / 1000} 秒`);
