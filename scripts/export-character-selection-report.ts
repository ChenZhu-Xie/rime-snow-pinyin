/** 在首选修订稿上加入选重兜底；离线路由与真实候选证据分别标记。 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import {
	ALL_BENCHMARK_SCHEMES,
	productionCharacterCodes,
	qingyunReadingCodes,
} from "./lib/benchmark-schemes";
import { physicalKeys } from "./lib/character-first-choice";
import { parseFlypyCodetable, parseFlypyWdatDump } from "./lib/flypy-benchmark";
import { rootPath, writeOutput } from "./lib/paths";

const input = resolve(
	process.argv[2] ?? rootPath("output/character-first-choice-v3"),
);
const output = resolve(
	process.argv[3] ?? rootPath("output/character-first-choice-v4"),
);
assert.notEqual(input, output);
const basename = "8000字_十二方案含选重键数";
const original = readFileSync(
	join(input, "8000字_十二方案最短首选键数.tsv"),
	"utf8",
);
const meta = JSON.parse(
	readFileSync(join(input, "8000字_十二方案最短首选键数.json"), "utf8"),
);
for (const [file, digest] of Object.entries(meta.sources)) {
	const content = readFileSync(rootPath(file), "utf8");
	assert.ok(
		[content, content.replaceAll("\r\n", "\n")].some(
			(text) => createHash("sha256").update(text).digest("hex") === digest,
		),
		`生产来源已变化：${file}`,
	);
}
const productionDiff = spawnSync(
	"git",
	[
		"diff",
		"--exit-code",
		meta.engineRevision,
		"--",
		"lua",
		"deps",
		"snow_*.yaml",
		"snow_*.txt",
	],
	{ cwd: rootPath(), encoding: "utf8" },
);
assert.equal(
	productionDiff.status,
	0,
	"生产来源已变化，须重新采集：" +
		productionDiff.stdout +
		productionDiff.stderr,
);
const rows = original
	.trimEnd()
	.split(/\r?\n/u)
	.slice(1)
	.map((line) => line.split("\t"));
assert.equal(rows.length, 8000);
interface Choice {
	code: string;
	keys: number;
	selection: boolean;
	source: string;
}
const choices: Map<string, Choice>[] = meta.schemes.map(
	(_: unknown, index: number) =>
		new Map(
			rows
				.filter((r) => r[4 + index * 2] !== "NA")
				.map((r) => [
					r[1],
					{
						code: r[4 + index * 2],
						keys: Number(r[3 + index * 2]),
						selection: false,
						source: "v3首选（实测与预测混合）",
					},
				]),
		),
);
for (const [index, scheme] of meta.schemes.entries()) {
	const lines = readFileSync(
		join(input, "各方案8000字码表", `${scheme.name}_8000字_字频序.txt`),
		"utf8",
	)
		.trimEnd()
		.split(/\r?\n/u)
		.slice(2);
	assert.equal(lines.length, 8000);
	for (const line of lines) {
		const [text, code, , source] = line.split("\t");
		const choice = choices[index].get(text);
		if (choice) {
			assert.equal(choice.code, code);
			choice.source = source;
		}
	}
}
const missing: Set<string>[] = choices.map(
	(map) => new Set(rows.filter((r) => !map.has(r[1])).map((r) => r[1])),
);
const alternatives = choices.map(() => new Map<string, Choice>());
function add(index: number, text: string, code: string, source: string) {
	if (!missing[index].has(text)) return;
	const value = { code, keys: physicalKeys(code) + 1, selection: true, source };
	const old = alternatives[index].get(text);
	const verified = source.startsWith("实测");
	const oldVerified = old?.source.startsWith("实测") ?? false;
	if (
		!old ||
		(verified && !oldVerified) ||
		(verified === oldVerified &&
			(value.keys < old.keys || (value.keys === old.keys && code < old.code)))
	)
		alternatives[index].set(text, value);
}
const sources: Record<string, string> = {};
async function* records(file: string) {
	// 大词表逐行读；摘要也用流，不构建全表数组。
	const digest = createHash("sha256");
	const stream = createReadStream(file);
	stream.on("data", (chunk) => digest.update(chunk));
	const reader = createInterface({ input: stream, crlfDelay: Infinity });
	for await (const line of reader) {
		if (!line || line.startsWith("#") || !line.includes("\t")) continue;
		yield line.split("\t");
	}
	sources[file] = digest.digest("hex");
}
for await (const [text, reading] of records(
	rootPath("snow_pinyin.dict.yaml"),
)) {
	for (let index = 0; index < meta.schemes.length; index++) {
		if (!missing[index].has(text)) continue;
		const scheme = ALL_BENCHMARK_SCHEMES.find(
			(s) => s.id === meta.schemes[index].id,
		);
		if (!scheme) continue;
		for (const code of productionCharacterCodes(scheme.id, text, reading)) {
			// 一键缩略通常只有固顶，不能据词典读音宣布目标已成为一键候选。
			if (code.auxiliaryLength === 0 && code.mainLength >= 2)
				add(index, text, code.code, "离线词典码路（候选可达性未实测）");
		}
	}
}
const qingyun = meta.schemes.findIndex(
	(s: { id: string }) => s.id === "qingyun",
);
for await (const [text, reading] of records(rootPath("snow_qingyun.dict.yaml")))
	if (missing[qingyun].has(text))
		for (const code of qingyunReadingCodes(reading.split(" ")))
			if (code.mainLength >= 2)
				add(qingyun, text, code.code, "离线形码词典（候选可达性未实测）");

// 原始观测仅保存首页六项；出现可证明存在，未出现不能证明不存在。
assert.ok(
	process.argv[4],
	"必须显式提供与首选修订稿同批的 observations.jsonl，禁止静默使用历史缓存",
);
const observations = new Map<
	string,
	Map<string, { commit: string | null; candidates: { text: string }[] }>
>();
for (const file of process.argv.slice(4)) {
	const probes = resolve(file);
	const probeManifest = JSON.parse(
		readFileSync(join(dirname(probes), "manifest.json"), "utf8"),
	);
	assert.equal(
		probeManifest.revision,
		meta.engineRevision,
		"选重候选与首选报告的采集提交不一致",
	);
	assert.deepEqual(
		probeManifest.sources,
		meta.sources,
		"选重候选与首选报告的生产来源不一致",
	);
	const digest = createHash("sha256");
	const stream = createReadStream(probes);
	stream.on("data", (chunk) => digest.update(chunk));
	const reader = createInterface({ input: stream, crlfDelay: Infinity });
	for await (const line of reader) {
		if (!line) continue;
		const row = JSON.parse(line);
		const schemeIndex = meta.schemes.findIndex(
			(scheme: { id: string }) =>
				ALL_BENCHMARK_SCHEMES.find((s) => s.id === scheme.id)?.schemaId ===
				row.schema,
		);
		// 上屏前缀必须保留；其他记录只需保存仍缺首选的目标候选。
		if (
			!row.commit &&
			(schemeIndex < 0 ||
				!row.candidates.some((candidate: { text: string }) =>
					missing[schemeIndex].has(candidate.text),
				))
		)
			continue;
		const map = observations.get(row.schema) ?? new Map();
		const existing = map.get(row.code);
		if (existing)
			assert.deepEqual(
				[
					existing.commit,
					existing.candidates.map((c: { text: string }) => c.text),
				],
				[row.commit, row.candidates.map((c: { text: string }) => c.text)],
				"同批重复观测不一致：" + row.schema + "/" + row.code,
			);
		map.set(row.code, row);
		observations.set(row.schema, map);
	}
	sources[probes] = digest.digest("hex");
}
for (let index = 0; index < meta.schemes.length; index++) {
	const schema = ALL_BENCHMARK_SCHEMES.find(
		(s) => s.id === meta.schemes[index].id,
	)?.schemaId;
	const map = schema && observations.get(schema);
	if (!map) continue;
	for (const [code, row] of map) {
		let interrupted = !!row.commit;
		for (let n = 1; n < code.length; n++)
			if (map.get(code.slice(0, n))?.commit) interrupted = true;
		if (interrupted) continue;
		for (const candidate of row.candidates.slice(1))
			add(index, candidate.text, code, "实测候选＋理想选重一键");
	}
}
const sbxh = meta.schemes.findIndex((s: { id: string }) => s.id === "sbxh");
for (const file of [
	join(process.env.APPDATA ?? "", "Rime/sbxh.dict.yaml"),
	rootPath("output/character-first-choice/sbxh-extended.tsv"),
])
	for await (const [text, code] of records(file))
		if (/^[a-z]{1,4}$/u.test(code))
			add(sbxh, text, code, "声笔发布码表（选重可达性未实测）");
const flypy = meta.schemes.findIndex((s: { id: string }) => s.id === "flypy");
const flypyRoot = "C:/Program Files/WindInput/data_custom/schemas/flypy";
const binary = join(flypyRoot, "00_xh.wdat");
const dump = spawnSync(
	"D:/C2D/Temp/WindInput-v0.130.1/wind_input/target/release/examples/wdat_dump.exe",
	[binary],
	{ encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);
assert.equal(dump.status, 0, dump.stderr);
sources[binary] = createHash("sha256")
	.update(readFileSync(binary))
	.digest("hex");
for (const item of parseFlypyWdatDump(dump.stdout, {
	id: "xh",
	baseOrder: 0,
	defaultWeight: 7000,
}))
	add(flypy, item.text, item.code, "小鹤发布码表（理想选重一键）");
for (const [order, file] of [
	"11_fl.dict.yaml",
	"21_yj.dict.yaml",
	"31_vt.dict.yaml",
	"32_yh.dict.yaml",
	"41_fh.dict.yaml",
	"61_ok.dict.yaml",
].entries()) {
	const path = join(flypyRoot, file),
		content = readFileSync(path, "utf8");
	sources[path] = createHash("sha256").update(content).digest("hex");
	for (const item of parseFlypyCodetable(content, {
		id: file,
		baseOrder: order + 1,
	}))
		add(flypy, item.text, item.code, "小鹤发布码表（理想选重一键）");
}
for (let index = 0; index < choices.length; index++)
	for (const [text, value] of alternatives[index])
		choices[index].set(text, value);
// 用户逐键确认的清风版次选；总键数已经包含选重的一键，不再重复加键。
for (const [text, code] of [
	["棋", "qim"],
	["巾", "jbl"],
]) {
	const choice = choices[flypy].get(text);
	if (choice?.selection && choice.code === code) {
		choice.code += ";";
		choice.source = "用户实敲核对：末尾分号为次选键";
	}
}
const cohorts = [500, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 8000];
const schemes = meta.schemes.map(
	(scheme: { id: string; name: string }, index: number) => {
		const map = choices[index];
		const text = [
			"# 无首选时采用候选编码＋一键理想选重；未实测可达性见来源列。保留输入稿首选，未对所有选重路径证明最短。",
			"字\t编码\t总键数\t选重\t来源\t字频序\t冻结频次",
		];
		for (const row of rows) {
			const c = map.get(row[1]);
			text.push(
				[
					row[1],
					c?.code ?? "NA",
					c?.keys ?? "NA",
					c ? Number(c.selection) : "NA",
					c?.source ?? "未找到词典码路",
					row[0],
					row[2],
				].join("\t"),
			);
		}
		writeOutput(
			join(output, "各方案8000字码表", `${scheme.name}_8000字_字频序.txt`),
			"\uFEFF" + text.join("\n") + "\n",
		);
		const stats = Object.fromEntries(
			cohorts.map((n) => {
				const distribution: Record<number, number> = {};
				let sum = 0,
					selection = 0;
				const unresolved: string[] = [];
				for (const row of rows.slice(0, n)) {
					const c = map.get(row[1]);
					if (!c) {
						unresolved.push(row[1]);
						continue;
					}
					sum += c.keys;
					selection += Number(c.selection);
					distribution[c.keys] = (distribution[c.keys] ?? 0) + 1;
				}
				return [
					n,
					{
						count: n,
						mean: unresolved.length ? null : sum / n,
						selection,
						unresolved,
						distribution,
					},
				];
			}),
		);
		console.log(
			`${scheme.name}: 选重 ${stats[8000].selection}，未找到码路 ${stats[8000].unresolved.length}`,
		);
		return { ...scheme, cohorts: stats };
	},
);
const sourceCounts: Record<string, number> = {};
for (const map of choices)
	for (const choice of map.values())
		sourceCounts[choice.source] = (sourceCounts[choice.source] ?? 0) + 1;
const markdown = [
	"# 十二方案单字键数（无首选时加一键选重）",
	"",
	"均键按字等权；选重列为字数／占当前前m字的比例。键数分布已包含选重的一键。仅无首选记录使用选重；没有比较所有字的较短选重路径。选重统一假设一次动作，不计翻页，首选不计确认空格。来源包含未实测的离线词典码路，不能据此声明全部可实际输入或全量最短。原始首选数据保留在输入目录，旧版 TSV 不覆盖。",
	"",
	`本表是实测与预测混合的修订稿，共 96000 个方案—字记录。首选实测 ${sourceCounts["空词典引擎观测"] ?? 0} 条，首页选重候选实测 ${sourceCounts["实测候选＋理想选重一键"] ?? 0} 条；其他行保留各自来源，不是全量通过验证。采集生产提交：${meta.engineRevision}。`,
	"",
];
for (const n of cohorts) {
	const lengths = [
		...new Set<number>(
			schemes.flatMap((s: any) =>
				Object.keys(s.cohorts[n].distribution).map(Number),
			),
		),
	].sort((a, b) => a - b);
	const cell = (value: number) =>
		`${value}／${((value * 100) / n).toFixed(2)}%`;
	markdown.push(
		`## 前 ${n} 字`,
		"",
		`| 方案 | 均键 | 选重 | ${lengths.map((k) => `${k}键`).join(" | ")} |`,
		`| --- | ${Array(lengths.length + 2)
			.fill("---:")
			.join(" | ")} |`,
	);
	for (const scheme of schemes) {
		const s = scheme.cohorts[n];
		markdown.push(
			`| ${scheme.name} | ${s.mean?.toFixed(4) ?? "待核实"} | ${cell(s.selection)} | ${lengths.map((k) => cell(s.distribution[k] ?? 0)).join(" | ")} |`,
		);
	}
	markdown.push("");
	for (const scheme of schemes) {
		const s = scheme.cohorts[n];
		if (s.unresolved.length)
			markdown.push(
				`${scheme.name}尚缺 ${s.unresolved.length} 字码路：${s.unresolved.join("、")}。`,
				"",
			);
	}
}
writeOutput(join(output, `${basename}.md`), markdown.join("\n"));
writeOutput(
	join(output, `${basename}.json`),
	JSON.stringify(
		{
			contract: "character-selection-hybrid-v4",
			selectionCost: 1,
			validationStatus: "mixed-unverified-selection-routes",
			sourceCounts,
			parentEngineRevision: meta.engineRevision,
			parentRuntime: meta.runtime,
			parentSha256: createHash("sha256").update(original).digest("hex"),
			sources,
			schemes,
		},
		null,
		2,
	) + "\n",
);
const header = [
	"字频序",
	"字",
	...meta.schemes.flatMap((s: { name: string }) => [
		`${s.name}编码`,
		`${s.name}键数`,
		`${s.name}选重`,
	]),
	"冻结频次",
];
writeOutput(
	join(output, `${basename}.tsv`),
	[
		header.join("\t"),
		...rows.map((r) =>
			[
				r[0],
				r[1],
				...choices.flatMap((m) => {
					const c = m.get(r[1]);
					return [
						c?.code ?? "NA",
						c?.keys ?? "NA",
						c ? Number(c.selection) : "NA",
					];
				}),
				r[2],
			].join("\t"),
		),
	].join("\n") + "\n",
);
