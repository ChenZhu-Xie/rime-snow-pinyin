/** 以新鲜引擎观测修正冲突字；保留未经实测行的离线标识与旧版文件。 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ALL_BENCHMARK_SCHEMES } from "./lib/benchmark-schemes";
import {
	summarizeFirstChoices,
	type FirstChoice,
} from "./lib/character-first-choice";
import { rootPath, writeOutput } from "./lib/paths";

const auditPath = resolve(process.argv[2]);
const audit = JSON.parse(readFileSync(auditPath, "utf8")) as {
	revision: string;
	runtime: string;
	sources: Record<string, string>;
	results: {
		schema: string;
		characters: {
			text: string;
			previousMinimum: string;
			choice: FirstChoice | null;
		}[];
	}[];
};
for (const [file, digest] of Object.entries(audit.sources)) {
	const content = readFileSync(rootPath(file), "utf8");
	const hashes = [content, content.replaceAll("\r\n", "\n")].map((value) =>
		createHash("sha256").update(value).digest("hex"),
	);
	assert.ok(hashes.includes(digest), `引擎采集之后生产来源变化：${file}`);
}
const sourceDiff = spawnSync(
	"git",
	[
		"diff",
		"--exit-code",
		audit.revision,
		"--",
		"lua",
		"deps",
		"snow_*.yaml",
		"snow_*.txt",
	],
	{ cwd: rootPath(), encoding: "utf8" },
);
assert.equal(
	sourceDiff.status,
	0,
	"生产 Lua、依赖或方案已变化，须重新采集：" +
		sourceDiff.stdout +
		sourceDiff.stderr,
);
const old = resolve(
	process.argv[3] ?? rootPath("output/character-first-choice-v2"),
);
const out = resolve(
	process.argv[4] ?? rootPath("output/character-first-choice-v3"),
);
assert.notEqual(old, out, "保留原版 TSV，修订必须写新目录");
const basename = "8000字_十二方案最短首选键数";
const previous = JSON.parse(
	readFileSync(join(old, `${basename}.json`), "utf8"),
);
const fullRefresh = process.argv.includes("--full-refresh");
const refreshedBaseline =
	process.argv.includes("--current-baseline") || fullRefresh;
if (fullRefresh) {
	// 旧表只提供固定字频顺序与外部方案资料；十个冰雪方案必须全部有新证据。
	for (const scheme of ALL_BENCHMARK_SCHEMES) {
		const result = audit.results.find((r) => r.schema === scheme.schemaId);
		assert.equal(
			result?.characters.length,
			8000,
			`全量刷新缺少 ${scheme.schemaId}`,
		);
		assert.equal(new Set(result?.characters.map((r) => r.text)).size, 8000);
	}
}
if (process.argv.includes("--current-baseline")) {
	for (const [file, digest] of Object.entries(previous.sources)) {
		const content = readFileSync(rootPath(file));
		assert.ok(
			[
				content,
				Buffer.from(content.toString("utf8").replaceAll("\r\n", "\n")),
			].some(
				(value) => createHash("sha256").update(value).digest("hex") === digest,
			),
			`新版离线来源已变化：${file}`,
		);
	}
}
const lines = readFileSync(join(old, `${basename}.tsv`), "utf8")
	.trimEnd()
	.split(/\r?\n/u);
const header = lines.shift()!;
const rows = lines.map((line) => line.split("\t"));
assert.equal(rows.length, 8000);
const characters = rows.map((row) => ({
	text: row[1],
	frequency: Number(row[2]),
}));
const cohorts = [500, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 8000];
const schemes = previous.schemes.map(
	(scheme: { id: string; name: string }, index: number) => {
		const schema = ALL_BENCHMARK_SCHEMES.find(
			(s) => s.id === scheme.id,
		)?.schemaId;
		const corrections = new Map(
			(audit.results.find((r) => r.schema === schema)?.characters ?? []).map(
				(row) => [row.text, row],
			),
		);
		const choices = new Map<string, FirstChoice>();
		// 全量批次必须与报告使用同一字集，不能以同为 8000 行冒充覆盖。
		if (corrections.size === characters.length)
			assert.ok(
				characters.every(({ text }) => corrections.has(text)),
				`全量采集字集不符：${scheme.name}`,
			);
		const textLines = [
			corrections.size === 8000
				? "# 全部 8000 字已接受空词典 librime 逐键查询；有编码的行已实测到首选，NA 表示已枚举路径未获首选，不表示无法选重。最短性仅限已枚举路径。"
				: schema
					? "# 部分字有引擎观测，其他字未实测；来源列逐字区分。NA 仅表示已枚举路径未获首选。"
					: "# 外部方案沿用原资料，本轮未做全量 librime 复验；来源列区分已有资料和人工核对。",
			"字\t最短首选编码\t键数\t来源\t字频序\t冻结频次",
		];
		for (const row of rows) {
			const correction = corrections.get(row[1]);
			if (correction) {
				if (!refreshedBaseline)
					assert.equal(
						row[4 + index * 2],
						correction.previousMinimum,
						`v2来源不符：${scheme.name}/${row[1]}`,
					);
				row[3 + index * 2] = String(correction.choice?.keys ?? "NA");
				row[4 + index * 2] = correction.choice?.code ?? "NA";
			}
			const code = row[4 + index * 2];
			if (code !== "NA")
				choices.set(row[1], { code, keys: Number(row[3 + index * 2]) });
			textLines.push(
				[
					row[1],
					code,
					row[3 + index * 2],
					correction ? "空词典引擎观测" : "离线未验证",
					row[0],
					row[2],
				].join("\t"),
			);
		}
		writeOutput(
			join(out, "各方案8000字码表", `${scheme.name}_8000字_字频序.txt`),
			"\uFEFF" + textLines.join("\n") + "\n",
		);
		return {
			...scheme,
			observedTargets: corrections.size,
			cohorts: Object.fromEntries(
				cohorts.map((n) => [
					n,
					summarizeFirstChoices(characters.slice(0, n), choices),
				]),
			),
		};
	},
);
writeOutput(
	join(out, `${basename}.tsv`),
	[header, ...rows.map((row) => row.join("\t"))].join("\n") + "\n",
);
writeOutput(
	join(out, `${basename}.json`),
	JSON.stringify(
		{
			contract: "character-first-choice-hybrid-v3",
			validationStatus: "observed-enumerated-routes-with-external-baselines",
			engineRevision: audit.revision,
			baselineSha256: createHash("sha256")
				.update(readFileSync(join(old, `${basename}.tsv`)))
				.digest("hex"),
			runtime: audit.runtime,
			sources: audit.sources,
			auditSha256: createHash("sha256")
				.update(readFileSync(auditPath))
				.digest("hex"),
			schemes,
		},
		null,
		2,
	) + "\n",
);
const markdown = [
	"# 十二方案单字最短首选：真实引擎修订",
	"",
	`各方案观测目标数：${schemes.map((s: any) => `${s.name} ${s.observedTargets}/8000`).join("，")}。已观测字依据空白用户词典逐键引擎记录，其他字保留离线来源。最短仅限已枚举路径；未找到首选不能据此断言实际无法首选。旧版 TSV 保留。各方案 TXT 的来源列区分实测与预测，字频位于末列。`,
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
	markdown.push(
		`## 前 ${n} 字`,
		"",
		`| 方案 | ${lengths.map((k) => `${k}键`).join(" | ")} | 未获首选 | 全体均键 | 已覆盖均键 |`,
		`| --- | ${Array(lengths.length + 3)
			.fill("---:")
			.join(" | ")} |`,
	);
	const cell = (v: number) => `${v}／${((100 * v) / n).toFixed(2)}%`;
	for (const s of schemes) {
		const stat = s.cohorts[n];
		markdown.push(
			`| ${s.name} | ${lengths.map((k) => cell(stat.distribution[k] ?? 0)).join(" | ")} | ${cell(stat.missing.length)} | ${stat.mean?.toFixed(4) ?? "—"} | ${stat.coveredMean?.toFixed(4) ?? "—"} |`,
		);
	}
	markdown.push("");
}
writeOutput(join(out, `${basename}.md`), markdown.join("\n"));
console.log(
	`已写入 ${out}；各方案修订字数：${schemes.map((s: any) => `${s.name}=${s.observedTargets}`).join("，")}`,
);
