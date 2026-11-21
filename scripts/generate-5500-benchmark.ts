import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { exact500Articles } from "./exact_500_articles";
import { countBenchmarkKeys } from "./lib/benchmark-key-counts";
import {
	assertBenchmarkReplaySchemes,
	readBenchmarkReplayCache,
	renderBenchmarkReplays,
} from "./lib/benchmark-replay";
import { ALL_BENCHMARK_SCHEMES } from "./lib/benchmark-schemes";
import { rootPath } from "./lib/paths";

interface ArticleStats {
	id: number;
	keys: number;
	spaces: number;
	shifts: number;
	selectionCount: number;
}
interface SchemeStats {
	name: string;
	total: {
		keys: number;
		spaces: number;
		shifts?: number;
		selections: number | { total: number };
	};
	articles: ArticleStats[];
}

const baselineName = "5000字_当前十二方案最优切分实测结果.json";
const baseline = JSON.parse(
	readFileSync(rootPath("reports", baselineName), "utf8"),
) as { contract: string; schemes: Record<string, SchemeStats> };
const replays = readBenchmarkReplayCache(
	rootPath("output/benchmark-replays/combined.json"),
);
assert.equal(replays.contract, baseline.contract);
const expectedIds = [
	...ALL_BENCHMARK_SCHEMES.map((s) => s.id),
	"sbxh",
	"flypy",
];
assert.deepEqual(Object.keys(baseline.schemes), expectedIds);
assertBenchmarkReplaySchemes(replays, expectedIds, "十二方案 5500 字");

const scenes = [
	...exact500Articles.map((article, index) => ({
		article,
		index,
		standalone: false,
	})),
	{ article: exact500Articles[9], index: 9, standalone: true },
];
const sceneDirectory = rootPath(
	"reports/十一场景_5500字_当前十二方案逐键对齐回放",
);
mkdirSync(sceneDirectory, { recursive: true });
const selectionCount = (value: SchemeStats["total"]["selections"]) =>
	typeof value === "number" ? value : value.total;
const schemes = Object.fromEntries(
	Object.entries(baseline.schemes).map(([id, scheme]) => {
		assert.equal(replays.schemes[id].length, 10);
		const articles = exact500Articles.map((article, i) => {
			const replay = replays.schemes[id][i];
			assert.equal(
				replay.length,
				article.lines.length,
				`${id}/P${article.id} 行数`,
			);
			const counts = countBenchmarkKeys(
				replay.flatMap((line) => line.map(([, code]) => code)),
			);
			const stat = scheme.articles.find((s) => s.id === article.id)!;
			assert.ok(stat, `${id}/P${article.id} 统计`);
			for (const field of ["keys", "spaces", "shifts"] as const)
				assert.equal(
					counts[field],
					stat[field],
					`${id}/P${article.id}/${field}`,
				);
			assert.equal(
				counts.selections,
				stat.selectionCount,
				`${id}/P${article.id}/选重`,
			);
			return {
				id: article.id,
				title: article.title,
				genre: article.genre,
				...counts,
			};
		});
		assert.equal(
			articles.reduce((n, a) => n + a.keys, 0),
			scheme.total.keys,
			`${id}/5000 字`,
		);
		assert.equal(
			articles.reduce((n, a) => n + a.selections, 0),
			selectionCount(scheme.total.selections),
			`${id}/5000 字选重`,
		);
		const sceneStats = [
			...articles,
			{ ...articles[9], id: 11, title: "独立 500 字输入法赛文（同第十篇）" },
		];
		const total = countBenchmarkKeys(
			scenes.flatMap(({ index }) =>
				replays.schemes[id][index].flatMap((line) =>
					line.map(([, code]) => code),
				),
			),
		);
		return [
			id,
			{
				name: scheme.name,
				total: { ...total, averageLength: total.keys / 5500 },
				scenes: sceneStats,
			},
		];
	}),
);

const sceneLinks = scenes.map(({ article, index, standalone }, i) => {
	const filename = `场景${String(i + 1).padStart(2, "0")}_${standalone ? "独立赛文" : article.genre}_500字.md`;
	const lines = [
		`# 场景 ${i + 1}：${standalone ? "独立输入法赛文" : article.title}（500 字）`,
		"",
		...(standalone
			? [
					"本场景与第十篇使用相同原文及最优路径，沿用既有 5500 字口径，单独计入；不是新增的不同语料。",
					"",
				]
			: []),
	];
	for (const [lineIndex, text] of article.lines.entries())
		lines.push(
			"```text",
			renderBenchmarkReplays(
				text,
				Object.entries(schemes).map(([id, scheme]) => ({
					name: scheme.name,
					replay: replays.schemes[id][index][lineIndex],
				})),
			),
			"```",
			"",
		);
	writeFileSync(join(sceneDirectory, filename), lines.join("\n"));
	return `[场景 ${i + 1}：${standalone ? "独立输入法赛文" : article.genre}](./十一场景_5500字_当前十二方案逐键对齐回放/${filename})`;
});
const corpusText = scenes.flatMap(({ article }) => article.lines).join("\n");
const corpus = {
	scenes: 11,
	hanCharacters: [...corpusText].filter((c) => /\p{Script=Han}/u.test(c))
		.length,
	punctuationCharacters: [...corpusText].filter(
		(c) => !/\p{Script=Han}|\s/u.test(c),
	).length,
	note: "十篇各 500 字，加与第十篇相同的独立 500 字赛文，按两个场景计入。",
};
assert.equal(corpus.hanCharacters, 5500);
assert.equal(corpus.punctuationCharacters, 392);
const report = {
	contract: "snow-twelve-scheme-5500-v1",
	baseline: baseline.contract,
	corpus,
	schemes,
};
writeFileSync(
	rootPath("reports/5500字_当前十二方案最优切分实测结果.json"),
	`${JSON.stringify(report, null, 2)}\n`,
);
const ranking = Object.entries(schemes).sort(
	([, a], [, b]) => a.total.keys - b.total.keys,
);
const markdown = [
	"# 十一场景 5500 字：当前十二方案最优切分对比",
	"",
	"按每个方案自身规则枚举合法编码，在空白用户词典、无提交和无调频的候选顺序下，先最少化选重次数，再最少化实际按键；同为首选时优先最短标准码。Shift、Space、标点和选重均计键。结果为规则内最优切分模型，不代表真人速度。",
	"",
	`语料：${corpus.note} 共 5500 汉字、392 标点。5000 字部分另见[十篇完整报告](./十篇五百字_当前十二方案最优切分及字词比率报告.md)。`,
	"",
	"| 排名 | 方案 | 总按键 | 平均码长 | Space | Shift | 选重 |",
	"| ---: | --- | ---: | ---: | ---: | ---: | ---: |",
	...ranking.map(
		([, scheme], i) =>
			`| ${i + 1} | ${scheme.name} | ${scheme.total.keys} | ${scheme.total.averageLength.toFixed(4)} | ${scheme.total.spaces} | ${scheme.total.shifts} | ${scheme.total.selections} |`,
	),
	"",
	"## 带调方案规则",
	"",
	"冰雪莲道使用 CR-REF-7e650f7a4c 的带调 21×21 主码、纯形辅序 21/231/14，声声空桶按反序 12 每字取两辅；三字以上保留前三字大写补韵与长词大写声母。冰雪鹮道使用 T2126-V52-M4-ec60a3637a99 的带调 21×26 主码、纯形辅序 21/12/23，声声空桶同样反序 12；三字词按自身四码／空桶三码路径处理，保留继承的结构略码。两者声调已进入第二码，后续不重复补调辅。",
	"",
	"其他方案分别沿用当前发布的声韵、辅序、固顶、空桶、略码和顶屏规则。声笔小鹤使用本机安装方案的独立空白部署；小鹤音形（清风版）使用本机 WindInput 的发布词库及候选顺序。外部方案版本与来源见 5000 字 JSON。",
	"",
	"本轮移除了旧冰雪脚本针对「数字化」「与数字」「化转型」的人工分词限制，只从实际词典取得读音和合法候选。各方案按原文连续子串（最多 12 字）枚举自身可用词，再求最优切分；本轮冰雪词典在赛文中没有超过 12 字的匹配词。",
	"",
	"## 回放",
	"",
	...sceneLinks.map((link) => `- ${link}`),
	"",
	"## 缓存与复跑",
	"",
	"运行 `just benchmark-5500`（或 `bun scripts/run-5500-benchmark.ts`），按十个冰雪方案、声笔小鹤、小鹤音形、5500 字汇总顺序串行执行。",
	"",
	"真实候选缓存位于 `output/benchmark-rime-cache/<源文件与运行库 SHA-256>/<schema_id>.jsonl`，逐条追加，允许中断后续跑；冰雪莲道与冰雪鹮道各自独立保存。源方案、字典、Lua、共享数据或 Rime 库变化会使对应指纹失效。声笔反查缓存位于 `output/benchmark-sbxh-reverse-cache/`，清风词库缓存位于 `output/benchmark-flypy-cache/`，回放位于 `output/benchmark-replays/`。运行日志和本轮输入指纹位于 `output/benchmark-runs/`。缓存不提交 Git，重新运行会重新验证源文件并复用匹配的记录。",
	"",
	"逐篇回放按键、Space、Shift、选重与 5000 字原始统计逐项核对，再加独立赛文；全按键键频随 5500 字 JSON 保存。清风回放若只给候选序号，键频使用 CandidateN 逻辑名称，不假定物理选重键。",
	"",
];
const reportPath = rootPath("reports/十一场景_5500字_当前十二方案对比评测.md");
writeFileSync(reportPath, markdown.join("\n"));
console.log(`5500 字十二方案报告：${reportPath}`);
for (const [, scheme] of ranking)
	console.log(
		`${scheme.name}\t${scheme.total.keys}\t${scheme.total.averageLength.toFixed(4)}\t选重 ${scheme.total.selections}`,
	);
