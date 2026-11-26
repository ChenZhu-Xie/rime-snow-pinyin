// 先运行 prepare-append-corpora.ts；--extended 加入字幕前40个单字词，查询缓存可复用。
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
	appendProbeInput,
	retargetBenchmarkAppend,
} from "../lib/benchmark-append-experiment";
import type {
	BenchmarkAlternative,
	BenchmarkPathResult,
} from "../lib/benchmark-paths";
import { rootPath } from "../lib/paths";
import { RimeCandidateOracle } from "../lib/rime-candidate-oracle";

const directory = rootPath("output/append-generalization");
const experiment = rootPath("output/append-characters");
const revision = "27019df92c87dbdbed52da18f9ded7d8bf5ac031";
const source = join(experiment, `source-${revision}`);
const load = (path: string) => import(pathToFileURL(join(source, path)).href);
const { buildBenchmarkCorpus, buildAlternatives } = await load(
	"scripts/generate_full_benchmark_reports.ts",
);
const { ALL_BENCHMARK_SCHEMES } = await load(
	"scripts/lib/benchmark-schemes.ts",
);
const { exact500Articles } = await load("scripts/exact_500_articles.ts");
const { optimizeBenchmarkLine } = await load("scripts/lib/benchmark-paths.ts");
const prepared = JSON.parse(
	readFileSync(join(directory, "corpora.json"), "utf8"),
);
const toolingSha256 = createHash("sha256")
	.update(readFileSync(import.meta.path))
	.digest("hex");
const groups: Array<{ id: string; hanCharacters: number; segments: string[] }> =
	[
		{
			id: "original5500",
			hanCharacters: 5500,
			segments: [...exact500Articles, exact500Articles[9]].flatMap(
				(article: { lines: string[] }) =>
					article.lines.flatMap(
						(line) => line.match(/\p{Script=Han}{1,80}/gu) ?? [],
					),
			),
		},
		...prepared.corpora.map(
			(corpus: {
				id: string;
				sample: { hanCharacters: number; segments: string[] };
			}) => ({ id: corpus.id, ...corpus.sample }),
		),
	];
const corpus = buildBenchmarkCorpus(groups.flatMap((group) => group.segments));
const schemes = ALL_BENCHMARK_SCHEMES.filter((scheme: { id: string }) =>
	["oc21-shape", "rc26-shape", "sipin"].includes(scheme.id),
);
const extended = process.argv.includes("--extended");
const subtitleSingles = new TextDecoder("gb18030")
	.decode(readFileSync(join(directory, "data/SUBTLEX-CH-WF")))
	.split(/\r?\n/u)
	.slice(3)
	.map((line) => line.split("\t")[0])
	.filter((word) => /^\p{Script=Han}$/u.test(word) && word !== "的")
	.slice(0, 40);
const tails = [
	...new Set([
		..."了与在是和有不中也地得着过",
		...(extended ? subtitleSingles : []),
	]),
];
type AlternativePool = Map<string, BenchmarkAlternative[]>;
const pools = new Map<string, Map<string, AlternativePool>>();
const includedTexts = new Map<string, string[]>();
const paths = new Map<string, BenchmarkPathResult[]>();
const skipped = new Map<string, Array<{ text: string; error: string }>>();
const oracle = new RimeCandidateOracle(
	ALL_BENCHMARK_SCHEMES.filter(
		(scheme: { id: string }) => scheme.id !== "qingyun",
	).map((scheme: { schemaId: string }) => scheme.schemaId),
	{
		sourceDirectory: source,
		appendCharacter: "了",
		cacheRoot: join(experiment, "native-cache"),
		compiledCacheRoot: join(experiment, "native-compiled"),
	},
);
const key = (scheme: string, tail: string, group: string) =>
	`${scheme}/${tail}/${group}`;
let measuredQueries = 0;
const startTime = Date.now();
const setOptions = (oracle: RimeCandidateOracle) =>
	oracle.setOptions({
		popping: true,
		buffered: false,
		character: false,
		ascii_mode: false,
		full_shape: false,
		traditionalization: false,
	});
try {
	for (const scheme of schemes) {
		console.log(`构建新语料真实候选：${scheme.shortName}`);
		oracle.selectSchema(scheme.schemaId);
		setOptions(oracle);
		const { alternatives: pool }: { alternatives: AlternativePool } =
			buildAlternatives(
				corpus,
				scheme.id,
				(input: string) => {
					if (++measuredQueries % 5000 === 0)
						console.log(
							`候选调用 ${measuredQueries}，耗时 ${((Date.now() - startTime) / 1000).toFixed(0)}秒，${JSON.stringify(oracle.cacheStats())}`,
						);
					return oracle.candidates(input);
				},
				(input: string) => oracle.committedText(input),
			);
		const variants = new Map<string, AlternativePool>();
		variants.set(
			"withoutSlash",
			new Map(
				[...pool].map(([word, routes]) => [
					word,
					routes.filter((route) => !route.displayCode.includes("/")),
				]),
			),
		);
		for (const tail of tails) {
			const transformed = retargetBenchmarkAppend(
				pool,
				corpus.targetWords,
				tail,
				(input) => oracle.observe(input),
			);
			assert.equal(transformed.missing.length, 0);
			variants.set(tail, transformed.alternatives);
		}
		pools.set(scheme.id, variants);
		// 同一方案的各追加字使用相同的可编码片段交集，避免只为某候选删难例。
		for (const group of groups) {
			const included: string[] = [];
			const failures: Array<{ text: string; error: string }> = [];
			for (const tail of [...tails, "withoutSlash"])
				paths.set(key(scheme.id, tail, group.id), []);
			for (const text of group.segments) {
				try {
					const comparedTails = [...tails, "withoutSlash"];
					const results = comparedTails.map((tail) =>
						optimizeBenchmarkLine(text, variants.get(tail)!),
					);
					for (const [index, tail] of comparedTails.entries())
						paths.get(key(scheme.id, tail, group.id))!.push(results[index]);
					included.push(text);
				} catch (error) {
					if (!String(error).includes("无法求得最优路径")) throw error;
					failures.push({ text, error: String(error) });
				}
			}
			skipped.set(`${scheme.id}/${group.id}`, failures);
			includedTexts.set(`${scheme.id}/${group.id}`, included);
		}
		oracle.auditCachedQueries();
		writeFileSync(
			join(
				directory,
				`checkpoint-${scheme.id}${extended ? "-extended" : ""}.json`,
			),
			JSON.stringify(
				{
					revision,
					groups: groups.map((group) => ({
						id: group.id,
						excluded: skipped.get(`${scheme.id}/${group.id}`),
						candidates: tails.map((tail) => {
							const selected = paths.get(key(scheme.id, tail, group.id))!;
							return {
								tail,
								keys: selected.reduce((sum, path) => sum + path.keys, 0),
								selections: selected.reduce(
									(sum, path) => sum + path.selectionCount,
									0,
								),
							};
						}),
					})),
				},
				null,
				2,
			) + "\n",
		);
		console.log(
			`${scheme.shortName} 完成初步切分；${JSON.stringify(oracle.cacheStats())}`,
		);
	}
} finally {
	oracle.close();
}
const verification: Record<string, unknown> = {};
const rejectedAppendRoutes: Array<{
	scheme: string;
	tail: string;
	input: string;
	expected: string;
	actual: string;
}> = [];
// 主要竞争字及每组最省键的追加字，直接查询本地隔离部署的实际终端提交。
const verifyTails = new Set(["了", "与", "在"]);
function enqueueWinners() {
	for (const scheme of schemes)
		for (const group of groups) {
			const ranking = tails
				.map((tail) => ({
					tail,
					selections: paths
						.get(key(scheme.id, tail, group.id))!
						.reduce((sum, path) => sum + path.selectionCount, 0),
					keys: paths
						.get(key(scheme.id, tail, group.id))!
						.reduce((sum, path) => sum + path.keys, 0),
				}))
				.sort((a, b) => a.selections - b.selections || a.keys - b.keys);
			verifyTails.add(ranking[0].tail);
		}
	for (const scheme of schemes) {
		const ranking = tails
			.map((tail) => {
				const selected = groups
					.filter((group) => group.id !== "original5500")
					.flatMap((group) => paths.get(key(scheme.id, tail, group.id))!);
				return {
					tail,
					keys: selected.reduce((sum, path) => sum + path.keys, 0),
					selections: selected.reduce(
						(sum, path) => sum + path.selectionCount,
						0,
					),
				};
			})
			.sort((a, b) => a.selections - b.selections || a.keys - b.keys);
		verifyTails.add(ranking[0].tail);
	}
}
enqueueWinners();
for (const tail of verifyTails) {
	const oracle = new RimeCandidateOracle(
		ALL_BENCHMARK_SCHEMES.filter(
			(scheme: { id: string }) => scheme.id !== "qingyun",
		).map((scheme: { schemaId: string }) => scheme.schemaId),
		{
			sourceDirectory: source,
			appendCharacter: tail,
			cacheRoot: join(experiment, "native-cache"),
			compiledCacheRoot: join(experiment, "native-compiled"),
		},
	);
	try {
		for (const scheme of schemes) {
			oracle.selectSchema(scheme.schemaId);
			setOptions(oracle);
			for (let iteration = 0; ; iteration++) {
				assert.ok(iteration < 20, "追加路径反例过多，需要先检查候选合同");
				const selected = groups
					.flatMap((group) => paths.get(key(scheme.id, tail, group.id))!)
					.flatMap((path) => path.tokens)
					.filter((route) => route.displayCode.includes("/"));
				const unique = new Map(
					selected.map((route) => [
						appendProbeInput(route.displayCode),
						route.word,
					]),
				);
				const failed: Array<{
					input: string;
					expected: string;
					actual: string;
				}> = [];
				for (const [input, expected] of unique) {
					const result = oracle.observe(input);
					if (!result.completed || result.commit !== expected)
						failed.push({ input, expected, actual: result.commit });
				}
				oracle.auditCachedQueries();
				verification[scheme.id + "/" + tail] = {
					uses: selected.length,
					distinctInputs: unique.size,
					failed,
				};
				if (failed.length > 0) {
					rejectedAppendRoutes.push(
						...failed.map((failure) => ({
							scheme: scheme.shortName,
							tail,
							...failure,
						})),
					);
					const alternatives = pools.get(scheme.id)!.get(tail)!;
					let removed = 0;
					for (const failure of failed) {
						const routes = alternatives.get(failure.expected)!;
						const valid = routes.filter(
							(route) => appendProbeInput(route.displayCode) !== failure.input,
						);
						removed += routes.length - valid.length;
						alternatives.set(failure.expected, valid);
					}
					assert.ok(removed > 0, "必须实际删除失败路径后才可重算");
					for (const group of groups)
						paths.set(
							key(scheme.id, tail, group.id),
							includedTexts
								.get(`${scheme.id}/${group.id}`)!
								.map((text) => optimizeBenchmarkLine(text, alternatives)),
						);
					console.log(
						`${scheme.shortName}/${tail}：剔除 ${removed} 条无效追加路径，重新求解并验证；${JSON.stringify(failed)}`,
					);
					continue;
				}
				console.log(
					`${scheme.shortName}/${tail}：实际追加验证 ${unique.size} 条通过`,
				);
				break;
			}
		}
	} finally {
		oracle.close();
	}
	enqueueWinners();
}
const rows = [];
for (const scheme of schemes)
	for (const group of groups) {
		const base = paths
			.get(key(scheme.id, "了", group.id))!
			.reduce((sum, path) => sum + path.keys, 0);
		const excluded = skipped.get(`${scheme.id}/${group.id}`)!;
		const withoutSlashKeys = paths
			.get(key(scheme.id, "withoutSlash", group.id))!
			.reduce((sum, path) => sum + path.keys, 0);
		const excludedCharacters = excluded.reduce(
			(sum, row) => sum + [...row.text].length,
			0,
		);
		const characters = group.hanCharacters - excludedCharacters;
		for (const tail of tails) {
			const selected = paths.get(key(scheme.id, tail, group.id))!;
			const functionTokens = selected
				.flatMap((path) => path.tokens)
				.filter((route) => route.displayCode.includes("/"));
			const keys = selected.reduce((sum, path) => sum + path.keys, 0);
			rows.push({
				scheme: scheme.shortName,
				group: group.id,
				tail,
				characters,
				excludedCharacters,
				keys,
				withoutSlashKeys,
				functionBenefit: withoutSlashKeys - keys,
				removedLeBenefit: withoutSlashKeys - base,
				saved: base - keys,
				savedPer10000Han: ((base - keys) * 10000) / characters,
				selections: selected.reduce(
					(sum, path) => sum + path.selectionCount,
					0,
				),
				uses: functionTokens.length,
				directUses: functionTokens.filter((route) => route.displayCode === "/")
					.length,
				appendUses: functionTokens.filter((route) => route.displayCode !== "/")
					.length,
			});
		}
	}
const output = {
	revision,
	definition:
		"三种结构代表：冰雪四拼、冰雪兰道、冰雪鹤道；原冻结候选生成合同，新增语料真实本地候选、空用户词典；比较纯汉字段编码与确认键，标点等恒定成本不计；各方案各候选共用可编码片段交集；对了/与/在及各组最省键对象的最终追加路径另行逐条验真",
	candidates: tails,
	verifiedTails: [...verifyTails],
	sources: prepared.sources,
	toolingSha256,
	sampleFingerprints: Object.fromEntries(
		prepared.corpora.map(
			(corpus: { id: string; sample: { segmentSha256: string } }) => [
				corpus.id,
				corpus.sample.segmentSha256,
			],
		),
	),
	sampling: prepared.sampling,
	verification,
	rejectedAppendRoutes,
	excluded: Object.fromEntries(skipped),
	rows,
	runtime: {
		essaySha256: process.env.RIME_SHARED_DATA
			? createHash("sha256")
					.update(readFileSync(join(process.env.RIME_SHARED_DATA, "essay.txt")))
					.digest("hex")
			: null,
		dllSha256: process.env.RIME_DLL
			? createHash("sha256")
					.update(readFileSync(process.env.RIME_DLL))
					.digest("hex")
			: null,
	},
};
writeFileSync(
	join(directory, extended ? "measured-extended.json" : "measured.json"),
	JSON.stringify(output, null, 2) + "\n",
);
writeFileSync(
	join(directory, extended ? "measured-extended.tsv" : "measured.tsv"),
	[
		"方案\t语料\t追加字\t纳入汉字\t排除汉字\t总键数\t较了净省\t每万字净省\t选重\t使用次数",
		...rows.map((row) =>
			[
				row.scheme,
				row.group,
				row.tail,
				row.characters,
				row.excludedCharacters,
				row.keys,
				row.saved,
				row.savedPer10000Han.toFixed(2),
				row.selections,
				row.uses,
			].join("\t"),
		),
	].join("\n") + "\n",
);
console.log(rows.filter((row) => ["了", "与", "在"].includes(row.tail)));
