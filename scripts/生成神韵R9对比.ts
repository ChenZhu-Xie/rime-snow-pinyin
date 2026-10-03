import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const benchmarkPath = process.argv[2];
if (!benchmarkPath) throw new Error("请传入 benchmark HTML 路径。");
const html = readFileSync(resolve(benchmarkPath), "utf8");
const payloadMatch = html.match(
	/<script id="payload"[^>]*>([\s\S]*?)<\/script>/,
);
if (!payloadMatch) throw new Error("Benchmark HTML 中未找到压缩 payload。");
const data = JSON.parse(
	gunzipSync(Buffer.from(payloadMatch[1].trim(), "base64")).toString("utf8"),
) as any;

const roundScoped = (suffix: string) => {
	const key = Object.keys(data)
		.filter((candidate) => candidate.endsWith(suffix))
		.sort(
			(a, b) =>
				Number(b.match(/^[Rr](\d+)/)?.[1] ?? 0) -
				Number(a.match(/^[Rr](\d+)/)?.[1] ?? 0),
		)[0];
	if (!key) throw new Error(`payload 缺少 *${suffix} 字段`);
	return data[key];
};
const loadSummaries = roundScoped("LoadSummaries");
const eligibilityByScheme = roundScoped("Eligibility");
const pairMetrics = roundScoped("PairMetrics");

const ids = ["R9-21X21-M40-02", "S005", "B04"] as const;
const benchmarkUrl =
	"https://github.com/more-14-different/shuangpin-layout-benchmark";
const common399Url =
	"https://wwwhomes.uni-bielefeld.de/gibbon/Syllables/Mandarin";
const s005Url =
	"https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts";
const cktUrl =
	"https://github.com/zhanghaozhecn/conditional-keystroke-timing";
const shoudaoUrl = "https://sspai.com/post/108949";
const mx34Url = "https://macroxue.github.io/shuangpin/eval.html";
const markdownLink = (text: string, url: string) => `[${text}](${url})`;
const labels: Record<(typeof ids)[number], string> = {
	"R9-21X21-M40-02": "神韵 R9（21×21）",
	S005: "原键道 S005（21×21）",
	B04: "首道 B04（26×26）",
};
const markdownLabels: Record<(typeof ids)[number], string> = {
	"R9-21X21-M40-02": labels["R9-21X21-M40-02"],
	S005: markdownLink(labels.S005, s005Url),
	B04: markdownLink(labels.B04, shoudaoUrl),
};
const entries = Object.fromEntries(
	ids.map((id) => [id, data.entries.find((entry: any) => entry.id === id)]),
) as Record<(typeof ids)[number], any>;
for (const id of ids) if (!entries[id]) throw new Error(`payload 缺少 ${id}`);

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = join(root, "reports", "shenyun-r9-comparison.md");
const jsonPath = join(root, "reports", "shenyun-r9-comparison.json");
const number = (value: unknown, digits = 4) =>
	typeof value === "number" && Number.isFinite(value)
		? value
				.toFixed(digits)
				.replace(/\.0+$/, "")
				.replace(/(\.\d*?)0+$/, "$1")
		: value == null
			? "—"
			: String(value);
const percent = (value: unknown, digits = 2) =>
	typeof value === "number" && Number.isFinite(value)
		? `${(value * 100).toFixed(digits)}%`
		: "—";
const table = (headers: string[], rows: Array<Array<string | number>>) =>
	`| ${headers.join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |\n${rows
		.map((row) => `| ${row.join(" | ")} |`)
		.join("\n")}`;
const metricTable = (
	rows: Array<
		[
			string,
			(id: (typeof ids)[number]) => unknown,
			"number" | "percent" | "text",
			string,
		]
	>,
) =>
	table(
		["指标", ...ids.map((id) => markdownLabels[id]), "何为好"],
		rows.map(([name, getter, format, direction]) => [
			name,
			...ids.map((id) => {
				const value = getter(id);
				return format === "percent"
					? percent(value)
					: format === "number"
						? number(value)
						: String(value ?? "—");
			}),
			direction,
		]),
	);

const r2 = (id: (typeof ids)[number]) => entries[id].memoryAuditR2;
const vowelDisplacement = (id: (typeof ids)[number]) => {
	const links = r2(id)?.finalLinkKeys ?? {};
	return [..."aeiou"].filter(
		(final) =>
			links[final]?.length !== 1 || links[final][0] !== final.toUpperCase(),
	).length;
};
const load = (id: (typeof ids)[number]) => loadSummaries[id];
const fair = (id: (typeof ids)[number]) => data.fairCKT.values[id];
const v6 = (id: (typeof ids)[number]) => data.ensembleV6.values[id];
const macro = (id: (typeof ids)[number], track: string) =>
	data.macroxue.values[id][track];
const s2 = (id: (typeof ids)[number]) => data.ckt.tracks[id].S2;
const eligibility = (id: (typeof ids)[number]) => eligibilityByScheme[id];

const overview = metricTable([
	[
		`${markdownLink("M-R2", benchmarkUrl)} 记忆项`,
		(id) => r2(id)?.M,
		"number",
		"越低越好",
	],
	[
		"普通声母偏移 D",
		(id) => r2(id)?.ordinaryDisplacedCount,
		"number",
		"越低规则越接近原键",
	],
	["a/e/i/o/u 韵键偏移 V", vowelDisplacement, "number", "越低越接近字母原键"],
	[
		`${markdownLink("共同 399", common399Url)} 覆盖`,
		(id) => `${eligibility(id).commonCovered}/399`,
		"text",
		"必须完整覆盖",
	],
	["不同二键码", (id) => eligibility(id).unique399, "number", "越高重码越少"],
	[
		`裸 S2 ${markdownLink("CKT", cktUrl)}（ms/项）`,
		(id) => s2(id).centerMs,
		"number",
		"越低越好",
	],
	[
		`规则补全 ${markdownLink("CKT", cktUrl)}（ms/项）`,
		(id) => fair(id).S2Completion.centerMs,
		"number",
		"越低越好；仅为固定五进制补全模型",
	],
	[markdownLink("系综当量 v5", benchmarkUrl), (id) => data.ensembleV5.values[id].score, "number", "越低越好"],
	[markdownLink("系综当量 v4", benchmarkUrl), (id) => data.ensembleV4.values[id].score, "number", "越低越好"],
	[
		markdownLink("系综当量 v4-C", benchmarkUrl),
		(id) => pairMetrics.values[id]._v4PublicSensitivity,
		"number",
		"越低越好；公开例外键表敏感性",
	],
	[markdownLink("系综当量 v6-CW150", benchmarkUrl), (id) => v6(id).score, "number", "越低越好；排除 S2"],
	[
		markdownLink("LU-v1r", benchmarkUrl),
		(id) => entries[id].logicUniformity?.score,
		"number",
		"越高规则一致性越强",
	],
	["S2 同指连击率", (id) => s2(id).sfb, "percent", "越低越好"],
	["S2 同键率", (id) => s2(id).repeat, "percent", "越低越好"],
	[
		"S2 左右手交替率",
		(id) => s2(id).alt,
		"percent",
		"越高通常越利于交替；非独立速度结论",
	],
	["S2 主键区占比", (id) => s2(id).home, "percent", "越高越集中于主键区"],
	[
		`日常纯汉字 ${markdownLink("MX34", mx34Url)} 得分`,
		(id) => macro(id, "daily|hanzi-only").score,
		"number",
		"同文稿越高越好；不含消歧",
	],
	[
		`默认说明兼容标点 ${markdownLink("MX34", mx34Url)} 得分`,
		(id) => macro(id, "default|native-punctuation").score,
		"number",
		"同文稿越高越好；敏感性对照",
	],
]);

const loadTable = metricTable([
	["S2 主键区", (id) => load(id).homeS2, "percent", "越高越集中"],
	["C4-Snow 主键区", (id) => load(id).homeC4, "percent", "越高越集中"],
	["WX-Snow-12 主键区", (id) => load(id).homeWX, "percent", "越高越集中"],
	[
		"含辅主键区下限",
		(id) => load(id).homeFloor,
		"percent",
		"C4/WX 两合同取低值；越高越集中",
	],
	["C4 上排", (id) => load(id).rowsC4[0], "percent", "描述性"],
	["C4 主行", (id) => load(id).rowsC4[1], "percent", "描述性"],
	["C4 下排", (id) => load(id).rowsC4[2], "percent", "描述性"],
	["WX 上排", (id) => load(id).rowsWX[0], "percent", "描述性"],
	["WX 主行", (id) => load(id).rowsWX[1], "percent", "描述性"],
	["WX 下排", (id) => load(id).rowsWX[2], "percent", "描述性"],
	[
		"含辅上下排差峰值",
		(id) => load(id).rowGap,
		"percent",
		"区间指标；越接近 0 越均衡",
	],
	[
		"下/上排最低比",
		(id) => load(id).lowerUpperRatio,
		"percent",
		"描述性；不是独立速度指标",
	],
	[
		"14 远键单键峰值",
		(id) => load(id).farMax,
		"percent",
		"越低表示指定键组的单键峰值更低",
	],
	["W 单键 20 合同峰值", (id) => load(id).Wmax, "percent", "描述性"],
	["Y 单键 20 合同峰值", (id) => load(id).Ymax, "percent", "描述性"],
	[
		"右小指 20 合同峰值",
		(id) => load(id).rightPinkyMax20,
		"percent",
		"越低峰值越小",
	],
	["右小指峰值合同", (id) => load(id).rightPinkyTrack, "text", "定位峰值来源"],
	[
		"左小指 20 合同峰值",
		(id) => load(id).leftPinkyMax20,
		"percent",
		"越低峰值越小",
	],
	["左小指峰值合同", (id) => load(id).leftPinkyTrack, "text", "定位峰值来源"],
	[
		"最大单指 20 合同峰值",
		(id) => load(id).maxFinger20,
		"percent",
		"越低峰值越小",
	],
]);

const fairnessTable = metricTable([
	[`${markdownLink("共同 399", common399Url)} 唯一码`, (id) => fair(id).unique399, "number", "越高越好"],
	[`${markdownLink("共同 399", common399Url)} 碰撞音节`, (id) => 399 - fair(id).unique399, "number", "越低越好"],
	[
		"补全后平均键数",
		(id) => fair(id).S2Completion.meanKeys,
		"number",
		"越低越好",
	],
	[
		"补全额外键数",
		(id) => fair(id).S2Completion.extraKeys,
		"number",
		"越低越好",
	],
	[
		"补全最长后缀",
		(id) => fair(id).S2Completion.maxSuffix,
		"number",
		"越低越好",
	],
	["S2 非首选权重", (id) => fair(id).S2miss, "percent", "越低越好"],
	[
		"单字含形辅非首选权重",
		(id) => fair(id).charShapeMiss,
		"percent",
		"越低越好",
	],
	[
		"二字词含形辅非首选权重",
		(id) => fair(id).wordShapeMiss,
		"percent",
		"越低越好",
	],
	...[0, 150, 300, 600].map(
		(tau) =>
			[
				`v5-S(${tau}ms)`,
				(id: (typeof ids)[number]) => fair(id).selectionScores[tau],
				"number",
				"同 τ、同合同越低越好",
			] as const,
	),
]);

const v6Table = metricTable([
	["v6-CW150", (id) => v6(id).score, "number", "越低越好"],
	...[0, 150, 300, 600].map(
		(tau) =>
			[
				`v6 选重敏感性 ${tau}ms`,
				(id: (typeof ids)[number]) => v6(id).selectionSensitivity[tau],
				"number",
				"排除 S2；同 τ 越低越好",
			] as const,
	),
	["v6 中心分", (id) => v6(id).centerScore, "number", "越低越好"],
	[
		"保护项均值（ms/项）",
		(id) => v6(id).guardMeanMsPerEntry,
		"number",
		"越低越好",
	],
	["原生键覆盖", (id) => v6(id).nativeKeyCoverage, "percent", "越高越好"],
	["长码占比", (id) => v6(id).longCodeShare, "percent", "描述性"],
]);

const contracts = Object.keys(load(ids[0]).homeByTrack);
const contractRows = contracts.map((contract) => [
	contract,
	...ids.flatMap((id) => [
		percent(load(id).homeByTrack[contract]),
		percent(load(id).leftPinkyByTrack[contract]),
		percent(load(id).rightPinkyByTrack[contract]),
		number(data.ckt.tracks[id][contract].centerMs, 3),
		percent(data.ckt.tracks[id][contract].miss),
	]),
]);
const contractTable = table(
	[
		"合同",
		...ids.flatMap((id) => [
			`${markdownLabels[id]} 主键区`,
			"左小指",
			"右小指",
			markdownLink("CKT", cktUrl),
			"非首选",
		]),
	],
	contractRows,
);

const macroTracks = [
	["daily|native-punctuation", "日常八场景＋兼容标点"],
	["daily|hanzi-only", "日常八场景＋仅汉字"],
	["default|native-punctuation", "原站默认说明＋兼容标点"],
	["default|hanzi-only", "原站默认说明＋仅汉字"],
] as const;
const macroMetricRows = (track: string) => {
	const buckets = (
		name: "same_finger_hits" | "diff_finger_hits",
		id: (typeof ids)[number],
		index: number,
	) => {
		const values = macro(id, track)[name] as number[];
		return index < 3
			? (values[index] ?? 0)
			: values.slice(3).reduce((sum, value) => sum + value, 0);
	};
	return metricTable([
		["速度得分", (id) => macro(id, track).score, "number", "越高越好"],
		["hits/time×100", (id) => macro(id, track).speed, "number", "越高越好"],
		["有效字符", (id) => macro(id, track).chars, "number", "同轨应相同"],
		["击键数", (id) => macro(id, track).hits, "number", "同轨应相同"],
		["相对总时间", (id) => macro(id, track).time, "number", "越低越好"],
		["平均时间/键", (id) => macro(id, track).avg_time, "number", "越低越好"],
		[
			"总距离",
			(id) => macro(id, track).total_distance,
			"number",
			"路径量，越低通常越短",
		],
		[
			"平均总距离/键",
			(id) => macro(id, track).avg_distance,
			"number",
			"越低通常越短",
		],
		[
			"有效距离",
			(id) => macro(id, track).effective_distance,
			"number",
			"越低通常越好",
		],
		[
			"平均有效距离/键",
			(id) => macro(id, track).avg_effective_distance,
			"number",
			"越低通常越好",
		],
		[
			"重叠距离",
			(id) => macro(id, track).overlap_distance,
			"number",
			"无独立单调方向",
		],
		[
			"平均重叠距离/键",
			(id) => macro(id, track).avg_overlap_distance,
			"number",
			"无独立单调方向",
		],
		[
			"同手连击占比",
			(id) => macro(id, track).same_hand_rate,
			"percent",
			"越低表示更多交替；非独立速度结论",
		],
		[
			"左手负载",
			(id) => macro(id, track).left_load / macro(id, track).hits,
			"percent",
			"描述性",
		],
		[
			"右手负载",
			(id) => macro(id, track).right_load / macro(id, track).hits,
			"percent",
			"描述性",
		],
		...[0, 1, 2].map(
			(row, index) =>
				[
					`${row === 0 ? "上" : row === 1 ? "主" : "下"}排负载`,
					(id: (typeof ids)[number]) =>
						macro(id, track).row_load[index] / macro(id, track).hits,
					"percent",
					"描述性",
				] as const,
		),
		...[
			"左小指",
			"左无名指",
			"左中指",
			"左食指",
			"右食指",
			"右中指",
			"右无名指",
			"右小指",
		].map((label, index) => {
			const finger = [0, 1, 2, 3, 6, 7, 8, 9][index];
			return [
				label,
				(id: (typeof ids)[number]) =>
					macro(id, track).finger_load[finger] / macro(id, track).hits,
				"percent",
				"描述性",
			] as const;
		}),
		...[0, 1, 2, 3].flatMap((bucket) => [
			[
				`同指距离 ${bucket === 3 ? "≥3" : bucket}`,
				(id: (typeof ids)[number]) =>
					buckets("same_finger_hits", id, bucket) / macro(id, track).hits,
				"percent",
				"越低通常越好",
			] as const,
			[
				`同手异指距离 ${bucket === 3 ? "≥3" : bucket}`,
				(id: (typeof ids)[number]) =>
					buckets("diff_finger_hits", id, bucket) / macro(id, track).hits,
				"percent",
				"路径分布；非独立分数",
			] as const,
		]),
		[
			"扩展键击数",
			(id) => macro(id, track).extendedKeyHits,
			"number",
			"越低表示越少使用 []\\'",
		],
		[
			"相对全拼得分倍数",
			(id) => macro(id, track).fullPinyinScoreRatio,
			"number",
			"同轨越高越好",
		],
	]);
};

const pairRows: Array<Array<string | number>> = [];
for (const contract of Object.keys(pairMetrics.values[ids[0]])) {
	if (contract.startsWith("_")) continue;
	for (const model of Object.keys(
		pairMetrics.values[ids[0]][contract],
	)) {
		pairRows.push([
			contract,
			model,
			...ids.map((id) => {
				const value = pairMetrics.values[id][contract][model];
				return [
					"within",
					"iid",
					"space1IID",
					"space1CostPerChar",
					"supportedPairWeight",
				]
					.map(
						(key) =>
							`${key}=${key === "supportedPairWeight" ? percent(value[key]) : number(value[key], 5)}`,
					)
					.join("<br>");
			}),
		]);
	}
}
const pairTable = table(
	["合同", "键对模型", ...ids.map((id) => markdownLabels[id])],
	pairRows,
);

const snapshots = Object.fromEntries(
	ids.map((id) => [
		id,
		{
			label: labels[id],
			entry: {
				id: entries[id].id,
				name: entries[id].name,
				capacity: entries[id].capacity,
				actual: entries[id].actual,
				memoryAuditR2: entries[id].memoryAuditR2,
				logicUniformity: entries[id].logicUniformity,
				sound: entries[id].sound,
			},
			eligibility: eligibilityByScheme[id],
			loadSummary: loadSummaries[id],
			pairMetrics: pairMetrics.values[id],
			macroxue: data.macroxue.values[id],
			fairCKT: data.fairCKT.values[id],
			cktTracks: data.ckt.tracks[id],
			ensembleV4: data.ensembleV4.values[id],
			ensembleV5: data.ensembleV5.values[id],
			ensembleV6: data.ensembleV6.values[id],
		},
	]),
);
const macroxuePolicy = Object.fromEntries(
	Object.entries(data.macroxue.policy).map(([key, value]) => [
		key.replace(/^[Rr]\d+/, "").replace(/^./, (letter) => letter.toLowerCase()),
		value,
	]),
);
const json = {
	source: "benchmark HTML payload",
	payloadVersion: data.version,
	comparisonPolicy: {
		commonSupport: "Common399 and the same frozen 20 contracts",
		target: ids[0],
		baselines: ids.slice(1),
		boundary:
			"B04 is a same-environment 26×26 baseline, not a same-domain 21×21 baseline",
	},
	metricDefinitions: {
		loadPolicy: pairMetrics.policy,
		macroxuePolicy,
		fairCKTPolicy: data.fairCKT.policy,
		ensembleV6: {
			tauMs: data.ensembleV6.tauMs,
			status: data.ensembleV6.status,
			exclusions: data.ensembleV6.exclusions,
		},
	},
	schemes: snapshots,
};

const report = `# 神韵 R9：公平对比

数据取自 ${markdownLink("双拼布局 Benchmark", benchmarkUrl)} 的 HTML payload。目标方案为 ${markdownLink("R9-21X21-M40-02", benchmarkUrl)}；${markdownLink("S005", s005Url)} 是同为 21×21 的原键道基线，${markdownLink("B04 首道", shoudaoUrl)}是 26×26 的同环境基线。三者共用 ${markdownLink("Common399", common399Url)}、冻结 20 合同、字词与形码资料及模型；${markdownLink("B04", shoudaoUrl)} 不能被称为“同键域”比较。

完整原始字段保存在 [shenyun-r9-comparison.json](shenyun-r9-comparison.json)。报告没有把 ${markdownLink("MX34", mx34Url)} 当作端到端输入速度：它不含声调、形辅、空格和选重；v6-CW150 也排除抽象 S2，150ms 是工程情景而非实测校准。

## 总览

${overview}

## 补充负载与键区指标

${loadTable}

## 消歧、音形与选重敏感性

${fairnessTable}

## ${markdownLink("系综当量 v6-CW150", benchmarkUrl)} 及敏感性

${v6Table}

## 结论

- 对同键域 ${markdownLink("S005", s005Url)}，神韵 R9 的核心优势集中在裸 S2 ${markdownLink("CKT", cktUrl)}、同指连击、主键区覆盖和 ${markdownLink("MX34", mx34Url)} 文稿路径；代价是 26 个加权非首选音节、规则补全额外键、部分含形辅合同的峰值负载，以及规则一致性并非每项占优。
- 对 26×26 的 ${markdownLink("B04 首道", shoudaoUrl)}，神韵 R9 不能宣称全指标支配。它用更小的 21×21 键域换取较好的若干裸码路径指标，但 ${markdownLink("B04", shoudaoUrl)} 在 399 唯一码、零 S2 消歧、部分小指/行区负载及若干综合分上有明确优势。
- 补充指标把“快”拆成了不同边界：冻结合同 ${markdownLink("CKT", cktUrl)}、v4/v5/v6、20 合同峰值、${markdownLink("MX34", mx34Url)} 文稿移动手回放与选重敏感性必须分开读。神韵 R9 是综合折中前沿，不是每一列都最优。
- 日常八场景 ${markdownLink("MX34", mx34Url)} 曾参与来源报告的搜索目标；原站默认说明轨道是未用于该轮目标的敏感性对照。两者都仍是模型值而非真人测速。

## 冻结 20 合同逐项对比

每个方案依次列主键区、左小指、右小指、${markdownLink("CKT", cktUrl)}（ms/项）与非首选权重。

${contractTable}

## ${markdownLink("MX34", mx34Url)} 四轨完整指标

${macroTracks
	.map(([track, title]) => `### ${title}\n\n${macroMetricRows(track)}`)
	.join("\n\n")}

## 键对模型逐合同明细

每格依次给出合同内键对成本、IID 键对成本、追加一次空格的 IID、含空格每字成本，以及被该模型原生支持的键对权重。不同模型量纲与支持范围不同，只能在同一合同、同一模型内横向比较。

${pairTable}
`;

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, report, "utf8");
writeFileSync(jsonPath, `${JSON.stringify(json, null, 2)}\n`, "utf8");
console.log(`${reportPath}\n${jsonPath}`);
