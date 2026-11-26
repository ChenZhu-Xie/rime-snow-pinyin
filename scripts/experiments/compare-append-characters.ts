import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { unzipSync } from "fflate";
import {
	appendProbeInput,
	retargetBenchmarkAppend,
	type AppendPrefixObservation,
} from "../lib/benchmark-append-experiment";
import type { BenchmarkAlternative } from "../lib/benchmark-paths";
import { ROOT, rootPath } from "../lib/paths";

const argument = (name: string) => {
	const index = process.argv.indexOf(name);
	return index < 0 ? undefined : process.argv[index + 1];
};
const output = resolve(
	argument("--output") ?? rootPath("output/append-characters"),
);
mkdirSync(output, { recursive: true });
execFileSync("git", ["swap", "auto"], { cwd: ROOT, stdio: "ignore" });
const revision = execFileSync(
	"git",
	["rev-parse", argument("--ref") ?? "27019df"],
	{ cwd: ROOT, encoding: "utf8" },
).trim();
const snapshot = join(output, `source-${revision}`);
const marker = join(snapshot, "append-experiment-source.json");
if (!existsSync(marker)) {
	assert.ok(!existsSync(snapshot), "未完成的源码快照需另选输出目录");
	const archive = execFileSync("git", ["archive", "--format=zip", revision], {
		cwd: ROOT,
		maxBuffer: 512 * 1024 * 1024,
	});
	for (const [name, content] of Object.entries(unzipSync(archive))) {
		if (name.endsWith("/")) continue;
		const destination = resolve(snapshot, name);
		assert.ok(destination.startsWith(snapshot + sep));
		mkdirSync(dirname(destination), { recursive: true });
		writeFileSync(destination, content);
	}
	symlinkSync(
		rootPath("scripts/node_modules"),
		join(snapshot, "scripts/node_modules"),
		"junction",
	);
	const path = join(snapshot, "scripts/generate_full_benchmark_reports.ts");
	const original = readFileSync(path, "utf8");
	const harness = original.replace(
		/\nrun\(\)\.catch\(\(error\) => \{[\s\S]*$/u,
		"\nexport { buildBenchmarkCorpus, buildAlternatives };\n",
	);
	assert.notEqual(harness, original, "冻结生成器的入口结构发生变化");
	writeFileSync(path, harness);
	writeFileSync(
		marker,
		JSON.stringify({
			revision,
			originalGeneratorSha256: createHash("sha256")
				.update(original)
				.digest("hex"),
		}),
	);
}
assert.equal(JSON.parse(readFileSync(marker, "utf8")).revision, revision);
const load = async (path: string) =>
	import(pathToFileURL(join(snapshot, path)).href);
const { buildBenchmarkCorpus, buildAlternatives } = await load(
	"scripts/generate_full_benchmark_reports.ts",
);
const { exact500Articles } = await load("scripts/exact_500_articles.ts");
const { ALL_BENCHMARK_SCHEMES } = await load(
	"scripts/lib/benchmark-schemes.ts",
);
const { optimizeBenchmarkLine } = await load("scripts/lib/benchmark-paths.ts");
const baseline = JSON.parse(
	readFileSync(
		join(snapshot, "reports/5000字_当前十方案最优切分实测结果.json"),
		"utf8",
	),
);
const published = JSON.parse(
	readFileSync(
		join(snapshot, "reports/5500字_当前十二方案最优切分实测结果.json"),
		"utf8",
	),
);
const scenes = [...exact500Articles, exact500Articles[9]];
const lines: string[] = scenes.flatMap(
	(article: { lines: string[] }) => article.lines,
);
const frequencies = new Map<string, number>();
for (const line of lines)
	for (const character of line)
		if (/\p{Script=Han}/u.test(character))
			frequencies.set(character, (frequencies.get(character) ?? 0) + 1);
const candidates = [
	...new Set([
		"了",
		...[...frequencies]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 80)
			.map(([character]) => character),
		..."与在和是中了有不也而就为对上到等地得着过",
	]),
].filter((character) => character !== "的");
const corpus = buildBenchmarkCorpus(
	exact500Articles.flatMap((article: { lines: string[] }) => article.lines),
);
const observed = new Map<string, AppendPrefixObservation>();
const actualAppends = new Map<string, string>();
const observationPath = argument("--observations");
if (observationPath)
	assert.equal(
		JSON.parse(
			readFileSync(
				join(dirname(resolve(observationPath)), "audit.json"),
				"utf8",
			),
		).revision,
		revision,
		"观测必须来自同一冻结源码",
	);
if (observationPath)
	for (const line of readFileSync(resolve(observationPath), "utf8").split(
		/\r?\n/u,
	)) {
		if (!line) continue;
		const row = JSON.parse(line);
		if (row.kind === "append")
			actualAppends.set(`${row.schema}\t${row.tail}\t${row.input}`, row.commit);
		if (row.tail === "了" && row.kind === "state")
			observed.set(`${row.schema}\t${row.input}`, {
				candidates: row.candidates,
				commit: row.commit,
				completed: row.completed ?? true,
			});
	}
const results: Array<{
	scheme: string;
	char: string;
	frequency: number;
	keys: number;
	saved: number;
	selections: number;
	uses: number;
	missingPrefixes: number;
}> = [];
const probes: {
	revision: string;
	corpusSha256: string;
	definition: string;
	schemas: Record<
		string,
		{
			name: string;
			variants: Record<
				string,
				Array<{ input: string; kind: string; expected?: string }>
			>;
		}
	>;
} = {
	revision,
	corpusSha256: createHash("sha256")
		.update(JSON.stringify(exact500Articles))
		.digest("hex"),
	definition:
		"同一冻结候选池内的追加字反事实；不是当前生产方案的新实测，清韵与外部方案不改变键义。state 补齐未知前缀；append 验证最优路径采用的 / 提交结果。",
	schemas: {},
};
const provenance: Record<string, unknown> = {};
const validation: Record<string, unknown> = {};
const schemeNames = new Map<string, string>();
for (const scheme of ALL_BENCHMARK_SCHEMES.filter(
	(scheme: { id: string }) => scheme.id !== "qingyun",
)) {
	schemeNames.set(scheme.id, scheme.shortName);
	const cacheDirectory =
		scheme.id === "sipin"
			? baseline.reusedUnchangedCandidateCache
			: baseline.candidateCache;
	const cachePath = join(
		argument("--cache-root") ?? dirname(cacheDirectory),
		cacheDirectory.replaceAll("\\", "/").split("/").at(-1),
		`${scheme.schemaId}.jsonl`,
	);
	const cache = readFileSync(cachePath, "utf8");
	const rows = new Map<string, AppendPrefixObservation>();
	for (const line of cache.split(/\r?\n/u)) {
		if (!line) continue;
		const row = JSON.parse(line);
		assert.ok(Array.isArray(row.candidates) && typeof row.commit === "string");
		rows.set(row.code, row);
	}
	const get = (input: string) => {
		const row = rows.get(input);
		assert.ok(row, `${scheme.id} 冻结缓存缺少 ${input}`);
		return row;
	};
	const {
		alternatives: pool,
	}: { alternatives: Map<string, BenchmarkAlternative[]> } = buildAlternatives(
		corpus,
		scheme.id,
		(input: string) => get(input).candidates,
		scheme.id === "sipin"
			? undefined
			: (input: string) => {
					const row = get(input);
					return row.completed ? row.commit : "";
				},
	);
	const solve = (alternatives: Map<string, BenchmarkAlternative[]>) =>
		lines.map((line) => optimizeBenchmarkLine(line, alternatives));
	const original = solve(pool);
	const originalKeys = original.reduce(
		(sum: number, path: { keys: number }) => sum + path.keys,
		0,
	);
	assert.equal(
		originalKeys,
		published.schemes[scheme.id].total.keys,
		`${scheme.id} 必须先复现报告基线`,
	);
	const stateProbes = new Set<string>();
	const variants: Record<
		string,
		Array<{ input: string; kind: string; expected?: string }>
	> = {};
	for (const tail of candidates) {
		const { alternatives, missing } = retargetBenchmarkAppend(
			pool,
			corpus.targetWords,
			tail,
			(input) =>
				observed.get(`${scheme.schemaId}\t${input}`) ?? rows.get(input),
		);
		for (const { input } of missing) stateProbes.add(input);
		const paths = solve(alternatives);
		const keys = paths.reduce(
			(sum: number, path: { keys: number }) => sum + path.keys,
			0,
		);
		const selected = paths
			.flatMap((path: { tokens: BenchmarkAlternative[] }) => path.tokens)
			.filter((route: BenchmarkAlternative) => route.displayCode.includes("/"));
		const selections = paths.reduce(
			(sum: number, path: { selectionCount: number }) =>
				sum + path.selectionCount,
			0,
		);
		results.push({
			scheme: scheme.id,
			char: tail,
			frequency: frequencies.get(tail) ?? 0,
			keys,
			saved: originalKeys - keys,
			selections,
			uses: selected.length,
			missingPrefixes: missing.length,
		});
		if (["了", "与", "在"].includes(tail)) {
			if (observationPath) {
				let verified = 0;
				const unverified: Array<{ input: string; word: string }> = [];
				const wrong: Array<{ input: string; word: string; actual: string }> =
					[];
				for (const route of selected) {
					const input = appendProbeInput(route.displayCode);
					const actual = actualAppends.get(
						`${scheme.schemaId}\t${tail}\t${input}`,
					);
					if (actual === undefined)
						unverified.push({ input, word: route.word });
					else if (actual !== route.word)
						wrong.push({ input, word: route.word, actual });
					else verified++;
				}
				validation[scheme.id + "/" + tail] = {
					uses: selected.length,
					verified,
					unverified,
					wrong,
				};
			}
			const unique = new Map<
				string,
				{ input: string; kind: string; expected: string }
			>();
			for (const route of [...alternatives.values()]
				.flat()
				.filter((route) => route.displayCode.includes("/"))) {
				const input = appendProbeInput(route.displayCode);
				unique.set(input, { input, kind: "append", expected: route.word });
				if (input.length > 1) stateProbes.add(input.slice(0, -1));
			}
			variants[tail] = [...unique.values()];
		}
	}
	variants.了 = [
		...[...stateProbes].sort().map((input) => ({ input, kind: "state" })),
		...variants.了,
	];
	probes.schemas[scheme.schemaId] = { name: scheme.shortName, variants };
	const calibratedBaselineKeys = results.find(
		(row) => row.scheme === scheme.id && row.char === "了",
	)!.keys;
	for (const row of results)
		if (row.scheme === scheme.id) row.saved = calibratedBaselineKeys - row.keys;
	provenance[scheme.id] = {
		originalKeys,
		calibratedBaselineKeys,
		cacheSha256: createHash("sha256").update(cache).digest("hex"),
		stateProbes: stateProbes.size,
	};
	console.log(
		`${scheme.shortName}：基线 ${originalKeys}，比较 ${candidates.length} 个字，待核前缀 ${stateProbes.size}`,
	);
}
const ranking = candidates
	.map((char) => ({
		char,
		frequency: frequencies.get(char) ?? 0,
		summedSavings: results
			.filter((row) => row.char === char)
			.reduce((sum, row) => sum + row.saved, 0),
	}))
	.sort((a, b) => b.summedSavings - a.summedSavings);
const result = {
	revision,
	corpus: {
		hanCharacters: 5500,
		punctuationCharacters: 392,
		scenes: 11,
		duplicatedScene: 10,
	},
	definition: probes.definition,
	candidateRule:
		"5500 字频前 80，加常见虚词和原配置「了」，排除已由分号承担的「的」",
	observations: observationPath ?? null,
	provenance,
	validation,
	candidates,
	frequencies: Object.fromEntries(frequencies),
	ranking,
	results,
};
writeFileSync(
	join(output, "comparison.json"),
	JSON.stringify(result, null, 2) + "\n",
);
writeFileSync(
	join(output, "probes.json"),
	JSON.stringify(probes, null, 2) + "\n",
);
writeFileSync(
	join(output, "comparison.tsv"),
	[
		"方案\t追加字\t语料字频\t总按键\t较现行节省\t选重\t使用次数\t待核前缀",
		...results.map((row) =>
			[
				schemeNames.get(row.scheme),
				row.char,
				row.frequency,
				row.keys,
				row.saved,
				row.selections,
				row.uses,
				row.missingPrefixes,
			].join("\t"),
		),
	].join("\n") + "\n",
);
console.log(ranking.slice(0, 12));
writeFileSync(
	join(output, "ranking.tsv"),
	[
		"追加字\t语料字频\t九方案累计节省\t每方案最少节省\t每方案最多节省\t省键方案数",
		...ranking.map((row) => {
			const savings = results
				.filter((entry) => entry.char === row.char)
				.map((entry) => entry.saved);
			return [
				row.char,
				row.frequency,
				row.summedSavings,
				Math.min(...savings),
				Math.max(...savings),
				savings.filter((count) => count > 0).length,
			].join("\t");
		}),
	].join("\n") + "\n",
);
