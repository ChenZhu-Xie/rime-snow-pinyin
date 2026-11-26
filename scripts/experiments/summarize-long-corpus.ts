import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
	readFileSync,
	writeFileSync,
	readdirSync,
	statSync,
	existsSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { countBenchmarkKeys } from "../lib/benchmark-key-counts";
import {
	benchmarkWordStatistics,
	renderBenchmarkWordStatistics,
} from "../lib/benchmark-word-statistics";
const directory = resolve(process.argv[2] ?? "output/corpus-benchmark-current");
const ids = [
	"sipin",
	"oc21-shape",
	"oc21-tone",
	"qingyun",
	"rc26-shape",
	"rc26-tone",
	"liandao",
	"zhudao",
	"classic-shape",
	"classic-tone",
	"sbxh",
	"flypy",
];
const results = ids.map((id) =>
	JSON.parse(readFileSync(join(directory, `${id}-summary.json`), "utf8")),
);
assert.equal(new Set(results.map((r) => r.sampleSha256)).size, 1);
const paths = new Map(
	ids.map((id) => [
		id,
		readFileSync(join(directory, `${id}-paths.jsonl`), "utf8")
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line)),
	]),
);
const groups = ["original5500", "gsd", "pud", "hotel"];
const common = new Map(
	groups.map((group) => {
		let set: Set<number> | undefined;
		for (const rows of paths.values()) {
			const indices = new Set<number>(
				rows.filter((r) => r.group === group).map((r) => r.index),
			);
			set = set ? new Set([...set].filter((x) => indices.has(x))) : indices;
		}
		return [group, set!];
	}),
);
const summaries = results.map((result) => {
	const cachePath = result.evidence.cache as string;
	const cacheFiles = statSync(cachePath).isDirectory()
		? readdirSync(cachePath)
				.filter((name) => name.endsWith(".jsonl"))
				.map((name) => join(cachePath, name))
		: [cachePath];
	const cacheManifest = cacheFiles.map((path) => {
		const bytes = readFileSync(path);
		return {
			path,
			bytes: bytes.length,
			sha256: createHash("sha256").update(bytes).digest("hex"),
			records: path.endsWith(".jsonl")
				? bytes.toString("utf8").trim().split("\n").length
				: undefined,
		};
	});
	const rows = paths.get(result.id)!;
	for (const s of result.summaries) {
		const subset = rows.filter((r) => r.group === s.group);
		assert.equal(
			subset.reduce((n, r) => n + r.keys, 0),
			s.keys,
		);
		assert.equal(
			subset.reduce((n, r) => n + [...r.text].length, 0),
			s.characters,
		);
		assert.equal(
			s.characters +
				s.excluded.reduce((n: number, r: any) => n + [...r.text].length, 0),
			s.requested,
		);
	}
	const measure = (selected: any[]) => {
		const counts = countBenchmarkKeys(
			selected.flatMap((r) =>
				r.tokens.map((t: any) => t.displayCode + (t.separator ? "_" : "")),
			),
		);
		const characters = selected.reduce((n, r) => n + [...r.text].length, 0);
		const wordStatistics = benchmarkWordStatistics(
			selected.map((row) => ({
				text: row.text,
				replay: row.tokens.map((token: any) => [
					token.start,
					token.displayCode + (token.separator ? "_" : ""),
				]),
			})),
		);
		assert.equal(wordStatistics.total.inputKeys, counts.keys);
		return {
			characters,
			...counts,
			average: counts.keys / characters,
			wordStatistics,
		};
	};
	return {
		...result,
		queryOptions:
			result.id === "flypy"
				? null
				: result.id === "sbxh"
					? {}
					: {
							popping: true,
							buffered: false,
							character: false,
							ascii_mode: false,
							full_shape: false,
							traditionalization: false,
						},
		cacheManifest,
		all: measure(rows.filter((r) => r.group !== "original5500")),
		common: measure(
			rows.filter(
				(r) => r.group !== "original5500" && common.get(r.group)!.has(r.index),
			),
		),
		common5500: measure(
			rows.filter(
				(r) => r.group === "original5500" && common.get(r.group)!.has(r.index),
			),
		),
	};
});
const provenance = JSON.parse(
	readFileSync(join(directory, "production-inputs.json"), "utf8"),
);
const externalProvenance = existsSync(join(directory, "external-inputs.json"))
	? JSON.parse(readFileSync(join(directory, "external-inputs.json"), "utf8"))
	: null;
if (externalProvenance)
	for (const [path, hash] of Object.entries(externalProvenance.files))
		assert.equal(
			createHash("sha256").update(readFileSync(path)).digest("hex"),
			hash,
			`外部输入变化：${path}`,
		);
for (const [path, hash] of Object.entries(provenance.files))
	assert.equal(
		createHash("sha256").update(readFileSync(path)).digest("hex"),
		hash,
		`生产输入变化：${path}`,
	);
const resources = JSON.parse(
	readFileSync(join(directory, "resources.json"), "utf8").replace(
		/^\uFEFF/,
		"",
	),
);
writeFileSync(
	join(directory, "summary.json"),
	JSON.stringify(
		{
			definition: results[0].definition,
			provenance,
			externalProvenance,
			resources,
			results: summaries,
		},
		null,
		2,
	) + "\n",
);
const lines = [
	"# 36,235 字十二方案评测",
	"",
	results[0].definition +
		"。清韵使用字词模式。小鹤音形使用发布码表排序模型，其余方案使用本地隔离 DLL 查询。",
	"",
	"跨方案排名使用十二方案共同可编码片段，避免各自删去难例造成分母不同。完整切分、排除清单、候选缓存及资源记录位于同目录，不纳入 Git。",
	"",
	"| 方案 | 各自覆盖字数 | 排除字数 | 共同覆盖字数 | 共同总键数 | 共同均键 | 选重 | Space | Shift | 翻页 |",
	"| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
	...summaries.map(
		(r) =>
			`| ${r.name} | ${r.all.characters} | ${36235 - r.all.characters} | ${r.common.characters} | ${r.common.keys} | ${r.common.average.toFixed(5)} | ${r.common.selections} | ${r.common.spaces} | ${r.common.shifts} | ${r.common.pageTurns} |`,
	),
	"",
	"功能键次数是总键数的子集，<、> 各计基础键一次，另计 Shift；选重记号的括号不计。",
	"",
	"| 方案 | [ | ] | ; | / | < | > |",
	"| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
	...summaries.map(
		(r) =>
			`| ${r.name} | ${["[", "]", ";", "/", "<", ">"].map((k) => r.common.functionKeys[k]).join(" | ")} |`,
	),
	"",
	"## 5500 字同流程对照",
	"",
	"| 方案 | 共同覆盖字数 | 纯汉字段总键数 | 选重 |",
	"| --- | ---: | ---: | ---: |",
	...summaries.map(
		(r) =>
			`| ${r.name} | ${r.common5500.characters} | ${r.common5500.keys} | ${r.common5500.selections} |`,
	),
	"",
	"该对照按标点分段，不计标点按键，不可直接与包含标点的正式 5500 字总键数相减。",
	"",
];
lines.push(
	"## 共同片段字词分布",
	"",
	renderBenchmarkWordStatistics(
		summaries.map((row) => ({
			name: row.name,
			totalKeys: row.common.keys,
			statistics: row.common.wordStatistics,
		})),
	),
	"",
);
writeFileSync(join(directory, "summary.md"), lines.join("\n"));
console.log(
	summaries.map((r) => ({ name: r.name, ...r.common, frequencies: undefined })),
);
