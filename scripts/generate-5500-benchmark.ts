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
import {
	benchmarkWordStatistics,
	renderBenchmarkWordStatistics,
} from "./lib/benchmark-word-statistics";
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
		const wordStatistics = benchmarkWordStatistics(
			scenes.flatMap(({ article, index }) =>
				article.lines.map((text, lineIndex) => ({
					text,
					replay: replays.schemes[id][index][lineIndex],
				})),
			),
		);
		assert.equal(wordStatistics.total.hanCharacters, 5500, `${id}/统计汉字数`);
		assert.equal(
			wordStatistics.total.selections,
			total.selections,
			`${id}/统计选重`,
		);
		return [
			id,
			{
				name: scheme.name,
				total: { ...total, averageLength: total.keys / 5500 },
				wordStatistics,
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
for (const [id, scheme] of Object.entries(schemes)) {
	assert.equal(
		scheme.wordStatistics.total.codeKeys,
		scheme.total.keys -
			scheme.total.spaces -
			scheme.total.shifts -
			scheme.total.selections -
			corpus.punctuationCharacters,
		`${id}/编码、标点、Shift、Space、选重必须还原原始总按键`,
	);
	assert.equal(
		scheme.wordStatistics.total.inputKeys + corpus.punctuationCharacters,
		scheme.total.keys,
		`${id}/字词实际按键加标点必须还原原始总按键`,
	);
}
const report = {
	contract: "snow-twelve-scheme-5500-v2",
	baseline: baseline.contract,
	corpus,
	wordStatisticsDefinition: {
		unit: "最优路径实际汉字输出段的出现次数，重复出现重复计数；含结构略码及追加的／了，不重新分词；不含标点段",
		codeLength:
			"codeKeys、codeLengths 为纯编码拆账，含辅码、定位及略码键；大写字母计一码；不含额外 Shift、Space、选重键和排版标记，不用于报告平均码长及分布",
		inputLength:
			"inputKeys、keyLengths 为字词实际按键，包含编码、额外 Shift、Space、选重键；用于报告的码长分布及平均码长；标点另计入方案总按键",
		tokenRateDenominator: "各方案全部汉字输出段数",
		codeLengthRateDenominator: "本词长类别的汉字输出段数",
		selectionRateDenominator: "对应行的汉字输出段数；合计行为全方案",
		averageEncodingLength:
			"JSON 中保留的纯编码拆账字段＝codeKeys／汉字输出段数，不用于报告平均码长",
		averageCodeLength:
			"字词平均码长＝inputKeys／汉字输出段数，包含额外 Shift、Space、选重键；用于报告均码／段",
		totalAverageLength:
			"全方案总按键／5500 汉字；包含编码、Space、Shift、选重与标点",
	},
	schemes,
};
writeFileSync(
	rootPath("reports/5500字_当前十二方案最优切分实测结果.json"),
	`${JSON.stringify(report, null, 2)}\n`,
);
const ranking = Object.entries(schemes).sort(
	([, a], [, b]) => a.total.keys - b.total.keys,
);
const wordStatisticsTable = renderBenchmarkWordStatistics(
	ranking.map(([, scheme]) => ({
		name: scheme.name.startsWith("小鹤音形")
			? "小鹤音形（清风版）"
			: scheme.name.replace(/（.*$/u, ""),
		totalKeys: scheme.total.keys,
		statistics: scheme.wordStatistics,
	})),
);
const comparisonSchemes = [schemes.qingyun, schemes.flypy];
const comparison = comparisonSchemes.map((scheme) => ({
	tokens: scheme.wordStatistics.total.tokens,
	mean: scheme.wordStatistics.total.averageCodeLength.toFixed(3),
	breakdown: `${scheme.wordStatistics.total.codeKeys}＋${scheme.total.spaces}＋${scheme.total.shifts}＋${scheme.total.selections}＋${corpus.punctuationCharacters}＝${scheme.total.keys}`,
}));
const markdown = [
	"# 十一场景 5500 字：当前十二方案最优切分对比",
	"",
	"按每个方案自身规则枚举合法编码，在独立会话、空白用户词典并关闭学习的候选顺序下，先最少化选重次数，再最少化实际按键；总按键相同时优先最短标准码。Shift、Space、标点和选重均计键。候选枚举按物理键数比较，不能因较短编码含 Shift 而漏掉实际更省键的较长小写码。结果为规则内最优切分模型，不代表真人速度。",
	"",
	"本轮已作废旧候选缓存并校正查询协议：逐键读取候选、发送真实 Shift 修饰键、分方案隔离会话、关闭学习，并排除中途上屏的编码。旧回放误将冰雪莲道 `xkd`、冰雪鹮道 `yvd` 记作「新时代」首选；干净部署中两者均为「形式的」首选，「新时代」排第五。本报告使用校正后重新求解的全部路径。",
	"",
	`语料：${corpus.note} 共 5500 汉字、392 标点。5000 字部分另见[十篇完整报告](./十篇五百字_当前十二方案最优切分及字词比率报告.md)。`,
	"",
	"| 排名 | 方案 | 总按键 | 总平均码长（键／字） | Space | Shift | 选重 |",
	"| ---: | --- | ---: | ---: | ---: | ---: | ---: |",
	...ranking.map(
		([, scheme], i) =>
			`| ${i + 1} | ${scheme.name} | ${scheme.total.keys} | ${scheme.total.averageLength.toFixed(4)} | ${scheme.total.spaces} | ${scheme.total.shifts} | ${scheme.total.selections} |`,
	),
	"",
	"## 词长、码长与选重统一统计",
	"",
	"按十一场景最优路径的实际汉字输出段统计，重复出现重复计数，标点不计词次。输出段包括结构略码及追加「的／了」，不再按另一套词典重新分词；五字及以上合并为多字词。第十一场景的额外 500 字同样计入。",
	"",
	"下表按总按键从少到多排列，每个方案的五行词长与各码长列组成码长分布矩阵；每格为「次数／该词长类别占比」，空格表示零次，合计行不重复展开分布。存在短码长词等规则，矩阵不强制为严格三角形。",
	"",
	"「输出段数／占比」统计的是字词输出段的出现次数，分母为本方案全部汉字输出段数，不是汉字数；所有方案输入的汉字均为 5500 字。「选重率」为对应行选重次数除以输出段数，粗体合计行为全方案选重个数及比率。百分比保留两位小数，四舍五入后之和可能略偏离 100%。",
	"",
	"方案总平均码长、各词长类别的平均码长及码长分布均按实际按键统计，包含编码键、额外 Shift、Space、选重键；大写字母需要的 Shift 另计一键，排版标记不计。「总均码／字」＝含标点的全方案总按键／5500 汉字，保留四位小数；「均码／段」＝对应行汉字输出段的实际按键总数／输出段数，保留三位小数。标点段不属于字词，单独计入方案总按键；没有输出段的类别以「—」表示均码。",
	"",
	`例如，冰雪清韵将 5500 字切为 ${comparison[0].tokens} 个输出段，小鹤音形（清风版）切为 ${comparison[1].tokens} 段；含 Shift、Space、选重的平均每段实际按键分别为 ${comparison[0].mean} 和 ${comparison[1].mean}。拆账为纯编码＋Space＋Shift＋选重＋标点，分别为 ${comparison[0].breakdown} 键、${comparison[1].breakdown} 键，故按总按键排序与按输出段数排序可以不同。`,
	"",
	wordStatisticsTable,
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
	"缓存指纹也包含查询实现与只读部署补丁。每条记录保存候选和中途上屏文本；发生中途上屏时仅缓存空候选，避免把尾段误记为完整编码。缓存命中后仍绕过缓存实查每方案首尾各八条记录，并额外检查 `xkd`／`yvd`；不一致或日志出现 Lua／词典运行错误时整轮失败，不能仅凭重复回放一致宣布缓存正确。",
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
if (process.argv.includes("--print-word-statistics"))
	console.log(`\n${wordStatisticsTable}`);
