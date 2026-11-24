import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
	closeSync,
	existsSync,
	openSync,
	readFileSync,
	readSync,
	readdirSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { gunzipSync } from "node:zlib";
import {
	ALL_BENCHMARK_SCHEMES,
	directOutputCodes,
	productionCharacterCodes,
	qingyunReadingCodes,
} from "./lib/benchmark-schemes";
import {
	type CharacterRoute,
	type FirstChoice,
	candidatePools,
	FirstChoicePools,
	relevantCharacterCodes,
	minimumFirstChoices,
	physicalKeys,
	summarizeFirstChoices,
} from "./lib/character-first-choice";
import {
	parseFlypyCodetable,
	parseFlypyWdatDump,
	rankFlypyEntries,
} from "./lib/flypy-benchmark";
import { ROOT, dataPath, rootPath, writeOutput } from "./lib/paths";
import { sbxhSupplementalStrokes } from "./lib/sbxh-benchmark";

const arg = (key: string) => {
	const index = process.argv.indexOf(key);
	return index < 0 ? undefined : process.argv[index + 1];
};
const hash = (content: string | Buffer) =>
	createHash("sha256").update(content).digest("hex");
const frequencyPath = dataPath("benchmark-character-frequency.tsv");
const frequencyMetadataPath = dataPath("benchmark-character-frequency.json");
const importHtml = arg("--import-frequency");
if (importHtml) {
	const html = readFileSync(importHtml, "utf8");
	const at = html.indexOf('<script id="payload"');
	assert.ok(at >= 0, "找不到 benchmark payload");
	const start = html.indexOf(">", at) + 1;
	const payload = JSON.parse(
		gunzipSync(
			Buffer.from(
				html.slice(start, html.indexOf("</script>", start)),
				"base64",
			),
		).toString(),
	);
	const rows = payload.characters as [string, number, number, number, number][];
	assert.equal(new Set(rows.map(([text]) => text)).size, rows.length);
	const content =
		"# 字\t冻结频次\t主读音\tCKT_common\n" +
		rows
			.map(
				([text, py, tone, frequency, common]) =>
					`${text}\t${frequency}\t${payload.pinyin[py]}${tone}\t${common}`,
			)
			.join("\n") +
		"\n";
	writeOutput(frequencyPath, content);
	writeOutput(
		frequencyMetadataPath,
		JSON.stringify(
			{
				source: "shuangpin-layout-benchmark/a7_CKT_R11.html payload.characters",
				sourceUrl:
					"https://github.com/more-14-different/shuangpin-layout-benchmark",
				sourceSha256: hash(html),
				charactersSha256: hash(JSON.stringify(rows)),
				tsvSha256: hash(content),
				rows: rows.length,
				commonRows: rows.filter((row) => row[4]).length,
				definition:
					"冻结 benchmark 单字频次；用于选定 Top m 字集，不改写各方案词典的排序权重；同频保持 payload 原行序。",
			},
			null,
			2,
		) + "\n",
	);
	console.log(`已冻结 ${rows.length} 字的频次来源。`);
	process.exit(0);
}

const sources: Record<string, string> = {};
function read(path: string) {
	const content = readFileSync(path, "utf8");
	sources[relative(ROOT, path).replaceAll("\\", "/")] = hash(content);
	return content;
}
const frequencyContent = read(frequencyPath);
const frequencyMetadata = JSON.parse(read(frequencyMetadataPath));
// 冻结表的摘要按 LF 计算；Windows checkout 可能按 core.autocrlf 转为 CRLF。
assert.equal(
	hash(frequencyContent.replaceAll("\r\n", "\n")),
	frequencyMetadata.tsvSha256,
);
const characters = frequencyContent
	.split(/\r?\n/u)
	.filter((line) => line && !line.startsWith("#"))
	.map((line) => {
		const [text, frequency, pronunciation, common] = line.split("\t");
		return {
			text,
			frequency: Number(frequency),
			pronunciation,
			common: common === "1",
		};
	})
	.filter(({ common }) => common)
	.sort((a, b) => b.frequency - a.frequency)
	.slice(0, 8000);
assert.equal(characters.length, 8000);
assert.equal(new Set(characters.map(({ text }) => text)).size, 8000);
const targetSet = new Set(characters.map(({ text }) => text));
const cohorts = [500, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 8000];
const outputDirectory = resolve(
	arg("--output-dir") ?? rootPath("output/character-first-choice-v2"),
);
const sbxhDirectory = resolve(
	arg("--sbxh-dir") ?? join(process.env.APPDATA ?? "", "Rime"),
);
const flypyDirectory = resolve(
	arg("--flypy-dir") ?? "C:/Program Files/WindInput/data_custom",
);
const sbxhDump = resolve(
	arg("--sbxh-dump") ??
		rootPath("output/character-first-choice/sbxh-extended.tsv"),
);
const baseline = JSON.parse(
	read(rootPath("reports/5000字_当前十方案最优切分实测结果.json")),
);
const externalBaseline = JSON.parse(
	read(rootPath("reports/5000字_当前十二方案最优切分实测结果.json")),
);
const results: Array<{
	id: string;
	name: string;
	method: string;
	choices: Map<string, FirstChoice>;
	audit: {
		compared: number;
		matched: number;
		differences: Array<{
			code: string;
			model: string | null;
			observed: string | null;
		}>;
	};
}> = [];

function fixedEntries(file: string) {
	const fixed = new Map<string, string[]>();
	for (const line of read(file).split(/\r?\n/u)) {
		if (!line || line.startsWith("#")) continue;
		const [code, text] = line.split("\t");
		if (code && text) fixed.set(code, text.split(" "));
	}
	return fixed;
}
const maxMemoryMiB = Number(arg("--max-memory-mib") ?? "768");
assert.ok(maxMemoryMiB >= 128 && Number.isFinite(maxMemoryMiB));
function checkMemory(stage: string) {
	const rss = process.memoryUsage().rss / 1024 / 1024;
	if (rss <= maxMemoryMiB) return;
	Bun.gc(true);
	assert.ok(
		process.memoryUsage().rss / 1024 / 1024 <= maxMemoryMiB,
		`${stage} 超过 ${maxMemoryMiB} MiB 内存上限，已停止；改用更小的字集分批运行。`,
	);
}
function* dictionary(file: string): Generator<CharacterRoute> {
	const descriptor = openSync(file, "r");
	const digest = createHash("sha256");
	const buffer = Buffer.alloc(64 * 1024);
	const decoder = new StringDecoder("utf8");
	let pending = "";
	let order = 0;
	try {
		while (true) {
			const size = readSync(descriptor, buffer);
			if (size) digest.update(buffer.subarray(0, size));
			pending += size ? decoder.write(buffer.subarray(0, size)) : decoder.end();
			const lines = pending.split("\n");
			pending = size ? lines.pop()! : "";
			for (const raw of lines) {
				const line = raw.replace(/\r$/u, "");
				if (order++ % 4096 === 0) checkMemory(file);
				if (!line.includes("\t") || line.startsWith("#")) continue;
				const [text, code, weight] = line.split("\t");
				if (text && code)
					yield { text, code, weight: Number(weight) || 0, order: order - 1 };
			}
			if (!size) break;
		}
		sources[relative(ROOT, file).replaceAll("\\", "/")] = digest.digest("hex");
	} finally {
		closeSync(descriptor);
	}
}
const singles = [...dictionary(rootPath("snow_pinyin.dict.yaml"))].filter(
	({ text }) => [...text].length === 1 || /^\d+$/u.test(text),
);
const qingyunSingles = [...dictionary(rootPath("snow_qingyun.dict.yaml"))];
const scriptPreference = JSON.parse(
	read(dataPath("character-script-preference.json")),
) as { deferredCharacters: string };
const deferred = new Set([...scriptPreference.deferredCharacters]);
for (const name of readdirSync(ROOT)) {
	if (/^snow_.*(?:\.schema|_common)\.yaml$/u.test(name)) read(rootPath(name));
}
for (const file of [
	"snow_bihua.dict.yaml",
	"snow_bushou.dict.yaml",
	"snow_jiandao_chaifen.dict.yaml",
	"lua/snow/radical_sipin.txt",
	"lua/snow/radical_jiandao.txt",
	"scripts/lib/benchmark-schemes.ts",
	"scripts/lib/character-first-choice.ts",
	"scripts/generate-character-first-choice.ts",
	"scripts/export-rime-table.py",
	"scripts/lib/algebra.ts",
	"scripts/lib/auxiliary-semantics.ts",
	"scripts/lib/flypy-benchmark.ts",
	"scripts/lib/sbxh-benchmark.ts",
	"config/shenyun-21x21-mapping.json",
	"config/shenyun-21x26-mapping.json",
	"docs/shenyun-ued-3158ce08b5bc-mapping.json",
	"scripts/research/auxiliary_semantics.js",
	"scripts/固顶编译器.ts",
])
	read(rootPath(file));

function auditObserver(schema: string, cacheDirectory: string | undefined) {
	const audit = {
		compared: 0,
		matched: 0,
		differences: [] as Array<{
			code: string;
			model: string | null;
			observed: string | null;
		}>,
	};
	const records = new Map<string, string | null>();
	const path = cacheDirectory ? join(cacheDirectory, `${schema}.jsonl`) : "";
	if (path && existsSync(path)) {
		for (const line of read(path).split(/\r?\n/u)) {
			if (!line) continue;
			const row = JSON.parse(line);
			records.set(row.code, row.commit || row.candidates[0] || null);
		}
	}
	return {
		audit,
		observe: (code: string, first: string | undefined) => {
			if (!records.has(code)) return;
			audit.compared++;
			const observed = records.get(code) ?? null;
			if ((first ?? null) === observed) audit.matched++;
			else audit.differences.push({ code, model: first ?? null, observed });
		},
	};
}

function internalScheme(
	scheme: (typeof ALL_BENCHMARK_SCHEMES)[number],
	prefix: string,
) {
	const fixed = new Map(
		[...fixedEntries(rootPath(scheme.fixedFile))].filter(([code]) =>
			code.startsWith(prefix),
		),
	);
	const routes: CharacterRoute[] = [];
	// 音码、英数入口执行生产 speller；清韵形码另按自己的词典记录生成。
	for (const entry of singles) {
		if (!targetSet.has(entry.text)) continue;
		for (const { code } of productionCharacterCodes(
			scheme.id,
			entry.text,
			entry.code,
			prefix,
		))
			if (code.startsWith(prefix)) routes.push({ ...entry, code });
	}
	if (scheme.id === "qingyun") {
		for (const entry of qingyunSingles)
			if (targetSet.has(entry.text))
				for (const { code } of qingyunReadingCodes(entry.code.split(" ")))
					if (code.startsWith(prefix)) routes.push({ ...entry, code });
	}
	for (const [code, texts] of fixed)
		routes.push({ code, text: texts[0], weight: Infinity, order: -1 });
	const relevant = relevantCharacterCodes(routes);
	const builder = new FirstChoicePools(relevant, fixed);
	const add = (route: CharacterRoute) => {
		if (scheme.id !== "sipin" && scheme.id !== "qingyun")
			route.deferred = deferred.has(route.text);
		builder.add(route);
	};
	const literals = new Map<string, CharacterRoute[]>();
	let processed = 0;
	for (const entry of singles) {
		if (processed++ % 2048 === 0) checkMemory(scheme.shortName);
		for (const { code } of productionCharacterCodes(
			scheme.id,
			entry.text,
			entry.code,
			prefix,
		)) {
			if (!code.startsWith(prefix)) continue;
			const route = { ...entry, code };
			add(route);
			if (!/\p{Script=Han}/u.test(entry.text)) {
				const entries = literals.get(code) ?? [];
				entries.push(route);
				literals.set(code, entries);
			}
		}
	}
	if (scheme.id === "qingyun") {
		for (const entry of qingyunSingles)
			for (const { code } of qingyunReadingCodes(entry.code.split(" ")))
				add({ ...entry, code });
		for (const file of [
			"snow_pinyin.base.dict.yaml",
			"snow_pinyin.ext.dict.yaml",
			"snow_pinyin.tencent.dict.yaml",
			"snow_pinyin.user.dict.yaml",
		]) {
			for (const entry of dictionary(rootPath(file))) {
				const readings = entry.code.split(" ");
				if (
					[...entry.text].length < 2 ||
					readings.length !== [...entry.text].length
				)
					continue;
				for (const { code } of qingyunReadingCodes(readings, true))
					if (relevant.has(code)) add({ ...entry, code });
			}
		}
	}
	// 英数候选通过无部件／无笔画的过滤分支时仍会保留，不能只加入其裸码。
	for (const code of relevant) {
		if (!/^[a-z]+$/u.test(code)) continue;
		for (let length = 1; length < code.length; length++)
			for (const entry of literals.get(code.slice(0, length)) ?? [])
				add({ ...entry, code });
	}
	const pools = builder.finish();
	const cache =
		scheme.id === "sipin" || scheme.id === "qingyun"
			? (baseline.reusedUnchangedCandidateCache ?? baseline.candidateCache)
			: baseline.candidateCache;
	const { audit, observe } = auditObserver(scheme.schemaId, cache);
	const choices = minimumFirstChoices(routes, pools, fixed, "move", observe);
	for (const [text, code] of directOutputCodes(scheme.id))
		if (code.startsWith(prefix))
			choices.set(text, { code, keys: physicalKeys(code) });
	for (const text of choices.keys())
		if (!targetSet.has(text)) choices.delete(text);
	return {
		id: scheme.id,
		name: scheme.shortName,
		method:
			"v2：生产单字拼写、英数竞争、独立清韵字根权重与普通词、固定首选、后置前原字排序；尚未完整复现 librime 排名",
		choices,
		audit,
	};
}
const worker = arg("--worker");
const validWorkers = [
	...ALL_BENCHMARK_SCHEMES.map(({ id }) => id),
	"sbxh",
	"flypy",
];
assert.ok(!worker || validWorkers.includes(worker), `未知方案：${worker}`);
if (!worker) {
	// 每个方案一个短生命周期进程；避免 JSC 的已提交页在后续方案间累积。
	for (const id of validWorkers) {
		const completed = Bun.spawnSync(
			[process.execPath, ...process.argv.slice(1), "--worker", id],
			{ stdout: "inherit", stderr: "inherit" },
		);
		assert.equal(completed.exitCode, 0, `${id} 子进程失败，未生成总报告`);
		const snapshot = JSON.parse(
			readFileSync(join(outputDirectory, ".workers", `${id}.json`), "utf8"),
		);
		for (const [file, digest] of Object.entries(snapshot.sources)) {
			if (sources[file])
				assert.equal(sources[file], digest, `各批次来源变化：${file}`);
			sources[file] = digest as string;
		}
		results.push({
			...snapshot.result,
			choices: new Map(snapshot.result.choices),
		});
	}
}
for (const scheme of ALL_BENCHMARK_SCHEMES.filter(({ id }) => id === worker)) {
	console.log(`离线枚举 ${scheme.shortName}（按编码首键分批）…`);
	const prefixes = new Set<string>();
	for (const entry of singles) {
		if (!targetSet.has(entry.text)) continue;
		for (const { code } of productionCharacterCodes(
			scheme.id,
			entry.text,
			entry.code,
		))
			prefixes.add(code[0]);
	}
	if (scheme.id === "qingyun")
		for (const entry of qingyunSingles)
			if (targetSet.has(entry.text))
				for (const { code } of qingyunReadingCodes(entry.code.split(" ")))
					prefixes.add(code[0]);
	for (const code of fixedEntries(rootPath(scheme.fixedFile)).keys())
		prefixes.add(code[0]);
	const combined: ReturnType<typeof internalScheme> = {
		id: scheme.id,
		name: scheme.shortName,
		method: "",
		choices: new Map(),
		audit: { compared: 0, matched: 0, differences: [] },
	};
	for (const prefix of [...prefixes].sort()) {
		const batch = internalScheme(scheme, prefix);
		combined.method = batch.method;
		for (const [text, value] of batch.choices) {
			const old = combined.choices.get(text);
			if (
				!old ||
				value.keys < old.keys ||
				(value.keys === old.keys && value.code < old.code)
			)
				combined.choices.set(text, value);
		}
		combined.audit.compared += batch.audit.compared;
		combined.audit.matched += batch.audit.matched;
		combined.audit.differences.push(...batch.audit.differences);
		Bun.gc(true);
		checkMemory(`${scheme.shortName}/${prefix}`);
	}
	results.push(combined);
	console.log(
		`${scheme.shortName} 完成，RSS ${(process.memoryUsage().rss / 1024 / 1024).toFixed(0)} MiB`,
	);
}

function externalSbxh() {
	console.log("离线枚举声笔小鹤…");
	const sbxhStrokes = new Map(
		read(join(sbxhDirectory, "lua/sbxlm/strokes.txt"))
			.split(/\r?\n/u)
			.map((line) => line.split("\t") as [string, string]),
	);
	const sbxhStatic = [...dictionary(join(sbxhDirectory, "sbxh.dict.yaml"))];
	const sbxhStaticPools = candidatePools(sbxhStatic);
	const sbxhDumpMetadata = JSON.parse(read(`${sbxhDump}.json`));
	assert.equal(
		hash(readFileSync(sbxhDump)),
		sbxhDumpMetadata.dumpSha256,
		"声笔 TSV 与解码清单不一致",
	);
	const sbxhBinary = join(sbxhDirectory, "build/sbxh.extended.table.bin");
	sources[sbxhBinary] = hash(readFileSync(sbxhBinary));
	assert.equal(
		sources[sbxhBinary],
		sbxhDumpMetadata.sourceSha256,
		"声笔发布扩展表已变化，须重新只读导出",
	);
	for (const file of [
		"sbxh.schema.yaml",
		"lua/sbxlm/auto_length.lua",
		"lua/sbxlm/core.lua",
	])
		read(join(sbxhDirectory, file));
	const sbxhRoutes: CharacterRoute[] = [];
	function* extendedRoutes(targetsOnly: boolean): Generator<CharacterRoute> {
		for (const entry of dictionary(sbxhDump)) {
			if (!/^[a-z]{4}$/u.test(entry.code)) continue;
			if (targetsOnly && !targetSet.has(entry.text)) continue;
			if ([...entry.text].length === 1) {
				const full =
					entry.code +
					sbxhSupplementalStrokes([sbxhStrokes.get(entry.text) ?? ""]);
				for (let length = 4; length <= full.length; length++)
					yield { ...entry, code: full.slice(0, length) };
			} else if (!targetsOnly) yield entry;
		}
	}
	sbxhRoutes.push(...extendedRoutes(true));
	sbxhRoutes.push(
		...sbxhStatic.filter(
			({ code, text }) => code.length <= 3 && targetSet.has(text),
		),
	);
	const sbxhFixed = new Map<string, string[]>();
	for (const [code, texts] of sbxhStaticPools)
		if (code.length <= 3) sbxhFixed.set(code, [texts[0]]);
	const builder = new FirstChoicePools(
		relevantCharacterCodes(sbxhRoutes),
		sbxhFixed,
	);
	for (const entry of extendedRoutes(false)) builder.add(entry);
	const sbxhPools = builder.finish();
	// 静态一、二、三码只查静态表；四码以后才查自动码长扩展表。
	for (const [code, texts] of sbxhStaticPools)
		if (code.length <= 3) sbxhPools.set(code, texts);
	const sbxhAudit = auditObserver(
		"sbxh",
		externalBaseline.schemes.sbxh.candidateCache,
	);
	const sbxhChoices = minimumFirstChoices(
		sbxhRoutes,
		sbxhPools,
		sbxhFixed,
		"exclude",
		sbxhAudit.observe,
		(code) => code.length <= 3,
	);
	for (const text of sbxhChoices.keys())
		if (!targetSet.has(text)) sbxhChoices.delete(text);
	return {
		id: "sbxh",
		name: "声笔小鹤",
		method: "发布静态简码＋只读解码扩展表＋逐笔过滤／旧首选排除的离线模型",
		choices: sbxhChoices,
		audit: sbxhAudit.audit,
	};
}
if (worker === "sbxh") results.push(externalSbxh());
Bun.gc(true);
checkMemory("声笔小鹤");
function externalFlypy() {
	console.log("离线枚举小鹤音形（清风版）…");
	const dumpExecutable = resolve(
		arg("--wdat-dump") ??
			"D:/C2D/Temp/WindInput-v0.130.1/wind_input/target/release/examples/wdat_dump.exe",
	);
	const mainWdat = join(flypyDirectory, "schemas/flypy/00_xh.wdat");
	sources[mainWdat] = hash(readFileSync(mainWdat));
	read(join(flypyDirectory, "schemas/flypy.schema.toml"));
	const dumped = Bun.spawnSync([dumpExecutable, mainWdat]);
	assert.equal(dumped.exitCode, 0, new TextDecoder().decode(dumped.stderr));
	const flypyEntries = parseFlypyWdatDump(
		new TextDecoder().decode(dumped.stdout),
		{ id: "xh", baseOrder: 0, defaultWeight: 7000 },
	);
	for (const layer of [
		{ file: "11_fl.dict.yaml", id: "fl", baseOrder: 1, defaultWeight: 6500 },
		{ file: "21_yj.dict.yaml", id: "yj", baseOrder: 2, defaultWeight: 6000 },
		{ file: "31_vt.dict.yaml", id: "vt", baseOrder: 4, defaultWeight: 5500 },
		{ file: "32_yh.dict.yaml", id: "yh", baseOrder: 5, defaultWeight: 5000 },
		{ file: "41_fh.dict.yaml", id: "fh", baseOrder: 6, defaultWeight: 4500 },
		{ file: "61_ok.dict.yaml", id: "ok", baseOrder: 10 },
	])
		flypyEntries.push(
			...parseFlypyCodetable(
				read(join(flypyDirectory, "schemas/flypy", layer.file)),
				layer,
			),
		);
	checkMemory("小鹤音形码表解析");
	const flypyChoices = new Map<string, FirstChoice>();
	for (const item of rankFlypyEntries(flypyEntries, targetSet)) {
		if (item.rank !== 1) continue;
		const previous = flypyChoices.get(item.word);
		const keys = physicalKeys(item.code);
		if (!previous || keys < previous.keys)
			flypyChoices.set(item.word, { code: item.code, keys });
	}
	return {
		id: "flypy",
		name: "小鹤音形（清风版）",
		method: "5500 字报告同款官方 wdat 解码器和完整默认静态码表排序器",
		choices: flypyChoices,
		audit: { compared: 0, matched: 0, differences: [] },
	};
}
if (worker === "flypy") results.push(externalFlypy());
Bun.gc(true);
checkMemory("小鹤音形");
if (worker) {
	assert.equal(results.length, 1);
	const [result] = results;
	writeOutput(
		join(outputDirectory, ".workers", `${worker}.json`),
		JSON.stringify({
			result: { ...result, choices: [...result.choices] },
			sources,
		}),
	);
	process.exit(0);
}
assert.equal(results.length, 12);
// 与其他会话共用仓库时，拒绝把不同输入时刻的结果混成一份报告。
for (const [file, expected] of Object.entries(sources)) {
	assert.equal(
		hash(readFileSync(resolve(ROOT, file))),
		expected,
		`统计期间来源变化，须重跑：${file}`,
	);
}

function writeReport(file: string, content: string) {
	if (process.argv.includes("--check"))
		assert.equal(
			readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
			content,
			`报告已过期：${file}`,
		);
	else writeOutput(file, content);
}

const json = {
	contract: "character-first-choice-offline-v2",
	validationStatus: "partial-contract-v2-unvalidated",
	validationReport: relative(
		outputDirectory,
		rootPath("reports/单字首选算法差异审计.md"),
	).replaceAll("\\", "/"),
	maxMemoryMiB,
	frequencyMetadata,
	definition:
		"空白用户词典静态模型；生产简码与直出纳入，个人学习和选重排除；成为首选即停止，不计确认空格；Top m 只筛字集，不裁剪排名池。",
	sources,
	schemes: results.map(({ id, name, method, audit, choices }) => ({
		id,
		name,
		method,
		audit,
		cohorts: Object.fromEntries(
			cohorts.map((n) => [
				n,
				summarizeFirstChoices(characters.slice(0, n), choices),
			]),
		),
	})),
};
const basename = "8000字_十二方案最短首选键数";
writeReport(
	join(outputDirectory, `${basename}.json`),
	JSON.stringify(json, null, 2) + "\n",
);
writeReport(
	join(outputDirectory, `${basename}.tsv`),
	[
		[
			"字频序",
			"字",
			"冻结频次",
			...results.flatMap(({ name }) => [`${name}键数`, `${name}编码`]),
		].join("\t"),
		...characters.map(({ text, frequency }, index) =>
			[
				index + 1,
				text,
				frequency,
				...results.flatMap(({ choices }) => {
					const value = choices.get(text);
					return [value?.keys ?? "NA", value?.code ?? "NA"];
				}),
			].join("\t"),
		),
	].join("\n") + "\n",
);
const lines = [
	"# 前 8000 常用字：十二方案最短首选键数（离线模型）",
	"",
	"**v2 实验稿，尚未通过完整真实候选校验，暂不可用于确定方案优劣。** 已修正四拼补码枚举、英数竞争和清韵来源权重，并按新生产过滤链在后置前排列原字。旧问题见仓库 reports/单字首选算法差异审计.md。",
	"",
	"范围与仓库 `reports/十一场景_5500字_当前十二方案对比评测.md` 相同；本报告是独立单字任务，不是从 5500 字赛文中抽字，也不把词组最优切分的码长挪用为单字码长。",
	"",
	"**这是包含生产简码的离线模型估算，不是真实输入法候选实测。** 已有缓存核对发现部分方案存在明显偏差，尤其冰雪四拼和冰雪清韵；具体一致率和模型边界见文末。未找到首选编码表示本模型枚举未覆盖，不能据此认定实际输入法必然无法首选。",
	"",
	"## 统计口径",
	"",
	"每个字从空输入开始，取已枚举生产路由中最短的首选编码，包含自带一简、二简、其他固定首选与直出键；允许使用字典收录的不同读音。字数和占比按字种等权，列内为「字数／占该列字频范围的百分比」，各键数列互斥。只计达到首选所需的编码键，Shift 另算一键，不含确认空格、选重、翻页、反查、临时切换开关、个人学习或手动置顶。",
	"",
	"字集取 CKT v5.2 所用 HTML 的 payload.characters，保留 common=1 的 8095 字，按冻结频次降序取前 8000 字，同频保持原行序。这里的『常用』及『频次』指该 benchmark 的冻结语料口径，不等同于国家字表顺序或另一套现代汉语通用字频。各前 m 字只改变统计分母，所有表复用同一候选池（详见模型边界）；不会让前 500 字只与这 500 字竞争。主读音仅保存作来源审计，编码枚举使用各方案当前词典的全部读音。",
	"",
	"均键为字种等权算术平均。未找到首选路由的字列入『未获首选』；存在这类字时，全体均键尚未确定，表中显示『—』，另外给出已覆盖字均键。不能把选重后上屏当作首选，也不能删除未覆盖字后仍声称是全体均值。仅省略某个字频范围内十二方案全部为零的键数列，所有非零键数均逐列展开。",
	"",
	"## 各字频范围横评",
	"",
];
for (const count of cohorts) {
	const keyLengths = [
		...new Set(
			results.flatMap(({ choices }) =>
				characters
					.slice(0, count)
					.flatMap(({ text }) => choices.get(text)?.keys ?? []),
			),
		),
	].sort((a, b) => a - b);
	lines.push(
		`### 前 ${count} 字`,
		"",
		`| 方案 | ${keyLengths.map((keys) => `${keys}键`).join(" | ")} | 未获首选 | 全体均键 | 已覆盖均键 |`,
		`| --- | ${Array.from({ length: keyLengths.length + 3 }, () => "---:").join(" | ")} |`,
	);
	const cell = (n: number) => `${n}／${((n / count) * 100).toFixed(2)}%`;
	for (const { name, choices } of results) {
		const stat = summarizeFirstChoices(characters.slice(0, count), choices);
		assert.equal(
			Object.values(stat.distribution).reduce((a, b) => a + b, 0) +
				stat.missing.length,
			count,
		);
		lines.push(
			`| ${name} | ${keyLengths.map((keys) => cell(stat.distribution[keys] ?? 0)).join(" | ")} | ${cell(stat.missing.length)} | ${stat.mean?.toFixed(4) ?? "—"} | ${stat.coveredMean?.toFixed(4) ?? "—"} |`,
		);
	}
	lines.push("");
}
lines.push(
	"## 方法与边界",
	"",
	"CKT v5.2 改的是耗时和错误损失模型；它继承原有码路，并不直接求含生产简码的最短首选键数。本报告复用本仓库 5500 字评测的编码构造器、五辅语义与清风静态码表排序器，另外枚举完整单字辅码；无需启动 librime.dll、Mira 或真实输入法。声笔扩展词典由 Python 的 marisa-trie 只读解析 Table/4.0，解析条数必须与文件头相等。",
	"",
	"冰雪十方案使用全部单字读音竞争，保留非目标字及英数入口；清韵另外加入普通词条并区分形码与音码权重。固定词保留其码位，并模拟逐键后置；这是单字静态近似，未完整重现 librime 的拼音质量计算、跨翻译器排序、词语补全及组句竞争。冰雪清韵双翻译器尤其可能有偏差。声笔模拟静态简码、四码扩展和逐笔过滤，未重现全部 Lua 路由。小鹤音形使用完整默认启用字词码表的实际静态排序。表中『最短』均限于枚举码路和所述模型，不能当作已通过实际候选验证的全局最短。",
	"",
	"### 与已有真实候选缓存交叉核对",
	"",
	"仅比较 5500 字评测已有记录的同一码首选，不启动新查询、不用缓存覆盖模型结果。缓存只覆盖赛文相关编码，其一致率不能外推为 8000 字的准确率；差异明细在 JSON 中。",
	"",
	"| 方案 | 重合编码 | 首选一致 | 一致率 |",
	"| --- | ---: | ---: | ---: |",
);
for (const { name, audit } of results)
	lines.push(
		`| ${name} | ${audit.compared} | ${audit.matched} | ${audit.compared ? `${((audit.matched / audit.compared) * 100).toFixed(2)}%` : "—"} |`,
	);
lines.push(
	"",
	"## 复算与逐字审计",
	"",
	`- [逐字键数与最短首选编码](${basename}.tsv)：8000 行，每个方案分别保存键数和见证编码，NA 表示模型枚举未获首选。`,
	`- [统计、来源 SHA-256 与缓存差异](${basename}.json)。`,
	"- 字频冻结表：`scripts/data/benchmark-character-frequency.tsv`；来源摘要见同名 JSON。",
	"",
	"```powershell",
	"# 首次准备声笔扩展表；只读发布数据，不加载 librime",
	"python -m pip install marisa-trie==1.4.1",
	'python scripts/export-rime-table.py "$env:APPDATA/Rime/build/sbxh.extended.table.bin" output/character-first-choice/sbxh-extended.tsv',
	"bun scripts/generate-character-first-choice.ts",
	"```",
	"",
	"外部方案目录或工具位置变化时，可传 `--sbxh-dir`、`--sbxh-dump`、`--flypy-dir`、`--wdat-dump`；`--output-dir` 改写报告目录。首次或主动更新 benchmark 字频才运行 `--import-frequency <a7_CKT_R11.html>`，普通复算无需外部 HTML。默认内存上限 768 MiB，`--max-memory-mib` 可调整；逐方案串行使用独立子进程，按编码首键分批，字典流式读取，每码仅保留足以决定首选的竞争前列，共享不可变前缀历史。达到上限后尝试回收，仍超限则中止而不生成报告。",
	"",
);
writeReport(join(outputDirectory, `${basename}.md`), lines.join("\n"));
for (const { name, choices, audit } of results)
	console.log(
		`${name}: ${JSON.stringify(summarizeFirstChoices(characters, choices).distribution)}；未获首选 ${characters.filter(({ text }) => !choices.has(text)).length}；缓存 ${audit.matched}/${audit.compared}`,
	);
console.log(`完成：${join(outputDirectory, `${basename}.md`)}`);
