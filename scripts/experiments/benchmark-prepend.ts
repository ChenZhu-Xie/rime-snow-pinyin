// 冻结的长语料候选缓存上比较 / 前插；输出仅写 output，不改变生产方案。
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
	readFileSync,
	writeFileSync,
	mkdirSync,
	appendFileSync,
	existsSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { retargetBenchmarkAppend } from "../lib/benchmark-append-experiment";
import {
	optimizeBenchmarkLine,
	type BenchmarkAlternative,
} from "../lib/benchmark-paths";
import { rootPath } from "../lib/paths";

const [id = "sipin", sourceArg = "output/sipin-production-fix/source"] =
	process.argv.slice(2);
const source = resolve(sourceArg);
const output = rootPath("output/prepend-experiment");
mkdirSync(output, { recursive: true });
const validationPath = join(output, `${id}-validation.json`);
const validation = existsSync(validationPath)
	? JSON.parse(readFileSync(validationPath, "utf8"))
	: undefined;
const rejected = new Set<string>(
	validation?.results
		.filter((r: any) => !r.ok)
		.map((r: any) => `${r.direction}\t${r.code}`) ?? [],
);
const load = (p: string) => import(pathToFileURL(join(source, p)).href);
const { buildBenchmarkCorpus, buildAlternatives } = await load(
	"scripts/generate_full_benchmark_reports.ts",
);
const { ALL_BENCHMARK_SCHEMES } = await load(
	"scripts/lib/benchmark-schemes.ts",
);
const scheme = ALL_BENCHMARK_SCHEMES.find((s: any) => s.id === id);
assert.ok(scheme && id !== "qingyun", "请选择支持追加字的冰雪方案");
const previous = JSON.parse(
	readFileSync(
		rootPath(`output/corpus-benchmark-current/${id}-summary.json`),
		"utf8",
	),
);
// 逐字节核对原评测生产源码；不能把新布局与旧缓存混用。
const manifest = JSON.parse(
	readFileSync(
		rootPath("output/corpus-benchmark-current/production-inputs.json"),
		"utf8",
	),
);
for (const [file, hash] of Object.entries(manifest.files)) {
	if (file.startsWith("output/") || /^[A-Za-z]:/.test(file)) continue;
	assert.equal(
		createHash("sha256")
			.update(readFileSync(join(source, file)))
			.digest("hex"),
		hash,
		file,
	);
}
const oldRows = readFileSync(
	rootPath(`output/corpus-benchmark-current/${id}-paths.jsonl`),
	"utf8",
)
	.trim()
	.split("\n")
	.map(JSON.parse);
const groups = new Map<string, string[]>();
// 使用已完成基准的同一可编码片段；所有变体严格同分母。
for (const row of oldRows) {
	const list = groups.get(row.group) ?? [];
	list.push(row.text);
	groups.set(row.group, list);
}
// 构池仍用完整语料，避免因排除片段改变候选审计范围。
const { exact500Articles } = await load("scripts/exact_500_articles.ts");
const prepared = JSON.parse(
	readFileSync(rootPath("output/append-generalization/corpora.json"), "utf8"),
);
const allTexts = [...exact500Articles, exact500Articles[9]].flatMap((a: any) =>
	a.lines.flatMap((l: string) => l.match(/\p{Script=Han}{1,80}/gu) ?? []),
);
for (const c of prepared.corpora) allTexts.push(...c.sample.segments);
const corpus = buildBenchmarkCorpus(allTexts);
const options = {
	popping: true,
	buffered: false,
	character: false,
	ascii_mode: false,
	full_shape: false,
	traditionalization: false,
};
const suffix = createHash("sha256")
	.update(JSON.stringify(Object.entries(options).sort()))
	.digest("hex")
	.slice(0, 16);
const cacheFile = join(
	previous.evidence.cache,
	`${scheme.schemaId}-${suffix}.jsonl`,
);
const records = new Map<string, any>();
for (const line of readFileSync(cacheFile, "utf8").trim().split("\n")) {
	const r = JSON.parse(line);
	records.set(r.code, r);
}
let native: any;
const observe = (code: string) => {
	const record = records.get(code);
	if (record) return record;
	if (!native) throw new Error(`候选缓存缺失 ${code}`);
	return native.observe(code);
};
// 大部分查询复用审计过的缓存；新增前插前缀缺失时才启动 DLL。
const { RimeCandidateOracle } = await import("../lib/rime-candidate-oracle");
const ensureNative = () => {
	if (!native) {
		native = new RimeCandidateOracle([scheme.schemaId], {
			sourceDirectory: source,
			cacheRoot: join(output, "cache", id),
			compiledCacheRoot: join(output, "compiled", id),
		});
		native.selectSchema(scheme.schemaId);
		native.setOptions(options);
	}
};
const query = (code: string) => {
	if (!records.has(code)) ensureNative();
	return observe(code);
};
try {
	const { alternatives: pool } = buildAlternatives(
		corpus,
		id,
		(c: string) => query(c).candidates,
		(c: string) => query(c).commit,
	) as { alternatives: Map<string, BenchmarkAlternative[]> };
	const variants = new Map<string, Map<string, BenchmarkAlternative[]>>();
	variants.set("production", pool);
	variants.set(
		"withoutSlash",
		new Map(
			[...pool].map(([w, r]) => [
				w,
				r.filter((a) => !a.displayCode.includes("/")),
			]),
		),
	);
	variants.set(
		"withoutSemicolon",
		new Map(
			[...pool].map(([w, r]) => [
				w,
				r.filter((a) => !a.displayCode.includes(";")),
			]),
		),
	);
	for (const direction of ["append", "prepend"] as const)
		for (const char of "了在不与是有我着对把被过地得中上下为以和也就都") {
			const v = retargetBenchmarkAppend(
				pool,
				corpus.targetWords,
				char,
				query,
				direction,
			);
			for (const [word, routes] of v.alternatives)
				v.alternatives.set(
					word,
					routes.filter((r) => !rejected.has(`${direction}\t${r.displayCode}`)),
				);
			assert.equal(v.missing.length, 0);
			variants.set(`${direction}:${char}`, v.alternatives);
		}
	const summaries: any[] = [];
	const probes = new Map<string, any>();
	writeFileSync(join(output, `${id}-paths.jsonl`), "");
	for (const [variant, alts] of variants) {
		const rows: any[] = [];
		for (const [group, texts] of groups) {
			let keys = 0,
				selections = 0,
				uses = 0,
				standalone = 0;
			for (const [index, text] of texts.entries()) {
				const path = optimizeBenchmarkLine(text, alts);
				assert.equal(path.tokens.map((t) => t.word).join(""), text);
				keys += path.keys;
				selections += path.selectionCount;
				for (const token of path.tokens)
					if (token.displayCode.includes("/")) {
						uses++;
						if (token.displayCode === "/") standalone++;
						if (variant.includes(":"))
							probes.set(`${variant}\t${token.displayCode}`, {
								variant,
								code: token.displayCode,
								expected: token.word,
							});
					}
				rows.push({ variant, group, index, text, ...path });
			}
			if (variant === "production") {
				const baseline = previous.summaries.find((s: any) => s.group === group);
				assert.equal(keys, baseline.keys, `${id}/${group} 基线必须完全复现`);
				assert.equal(selections, baseline.selections);
			}
			summaries.push({
				variant,
				group,
				characters: texts.reduce((n, t) => n + [...t].length, 0),
				keys,
				selections,
				uses,
				standalone,
			});
		}
		appendFileSync(
			join(output, `${id}-paths.jsonl`),
			rows.map((r) => JSON.stringify(r)).join("\n") + "\n",
		);
		console.log(`${id} ${variant} complete`);
	}
	writeFileSync(join(output, `${id}-pool.json`), JSON.stringify([...pool]));
	writeFileSync(
		join(output, `${id}-probes.json`),
		JSON.stringify([...probes.values()], null, 2),
	);
	writeFileSync(
		join(output, `${id}-summary.json`),
		JSON.stringify(
			{
				id,
				name: previous.name,
				source,
				cacheFile,
				cacheSha256: createHash("sha256")
					.update(readFileSync(cacheFile))
					.digest("hex"),
				status: "cached-prefix-screening; terminal validation pending",
				summaries,
			},
			null,
			2,
		),
	);
	console.log(
		JSON.stringify({
			id,
			variants: variants.size,
			terminalRejections: rejected.size,
		}),
	);
} finally {
	native?.close();
}
