import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { exact500Articles } from "./exact_500_articles";
import { ALL_BENCHMARK_SCHEMES } from "./lib/benchmark-schemes";
import { countBenchmarkKeys } from "./lib/benchmark-key-counts";
import {
	readBenchmarkReplayCache,
	renderBenchmarkReplays,
} from "./lib/benchmark-replay";
import { rootPath } from "./lib/paths";

// 额外 500 字与第十篇完全一致，直接导出本轮实测路径，避免再维护一套分叉的求解器。
const baseline = JSON.parse(
	readFileSync(
		rootPath("reports/5000字_当前十方案最优切分实测结果.json"),
		"utf8",
	),
);
const replay = readBenchmarkReplayCache(
	rootPath("output/benchmark-replays/internal.json"),
);
assert.equal(replay.contract, baseline.contract);
const article = exact500Articles[9];
assert.equal(
	[...article.lines.join("")].filter((c) => /\p{Script=Han}/u.test(c)).length,
	500,
);
const ranking = ALL_BENCHMARK_SCHEMES.map((scheme) => {
	const stats = baseline.schemes[scheme.id].articles[9];
	const counts = countBenchmarkKeys(
		replay.schemes[scheme.id][9].flatMap((line) =>
			line.map(([, code]) => code),
		),
	);
	assert.equal(counts.keys, stats.keys, scheme.id);
	assert.equal(counts.shifts, stats.shifts, scheme.id);
	assert.equal(counts.spaces, stats.spaces, scheme.id);
	assert.equal(counts.selections, stats.selectionCount, scheme.id);
	return { scheme, stats };
}).sort((a, b) => a.stats.keys - b.stats.keys);
const lines = [
	"冰雪当前十方案：500 字赛文本轮实测路径导出",
	"",
	"语料与本轮 5000 字第十篇及 5500 字第十一场景相同。本文件复用同一轮已验证的最优路径，不另外调用旧求解器。",
	"口径：全部实际按键／500 汉字；包含 Shift、Space、数字选重和标点。<／> 均为 Shift＋逗号／句号，各计两键。词长直选使用类别首词，另计次数。",
	"",
	"| 排名 | 方案 | 总按键 | 总均码／字 | Space | Shift | 选重 | 词长直选 |",
	"| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
	...ranking.map(
		({ scheme, stats }, index) =>
			`| ${index + 1} | ${scheme.shortName} | ${stats.keys} | ${(stats.keys / 500).toFixed(4)} | ${stats.spaces} | ${stats.shifts} | ${stats.selectionCount} | ${stats.sources["词长直选"] ?? 0} |`,
	),
	"",
	"```text",
];
article.lines.forEach((text, index) => {
	lines.push(
		`[${String(index + 1).padStart(2, "0")}]`,
		renderBenchmarkReplays(
			text,
			ALL_BENCHMARK_SCHEMES.map((scheme) => ({
				name: scheme.shortName,
				replay: replay.schemes[scheme.id][9][index],
			})),
		),
		"",
	);
});
lines.push("```", "");
const destination = resolve(
	process.argv[2] ??
		rootPath("reports/冰雪当前十方案_500字_最短键码实战测评.txt"),
);
writeFileSync(destination, lines.join("\n"));
console.log(`已从本轮第十篇导出额外 500 字：${destination}`);
