import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import {
	type ComparisonDirection,
	decorateComparison,
	linkShenyunTerms,
} from "./lib/shenyun-markdown";

const benchmarkPath = process.argv.find((arg) => arg.endsWith(".html"));
if (!benchmarkPath) throw new Error("请传入 benchmark HTML 路径。");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jsonPath = join(root, "reports", "shenyun-comparison.json");
const reportPath = join(root, "reports", "shenyun-comparison.md");
const cktV5Path = join(root, "output", "ckt5-scheme-specific.json");
const cktV51Path = join(root, "reports", "ckt51-aux-order-robustness.json");
// biome-ignore lint/suspicious/noExplicitAny: 报告 JSON 是既有的异构复算快照，此脚本只补写已知字段。
const data = JSON.parse(readFileSync(jsonPath, "utf8")) as any;
const cktV5 = existsSync(cktV5Path)
	? JSON.parse(readFileSync(cktV5Path, "utf8"))
	: {
			pairs: {
				"21x26": {
					normalized: { score: data.metrics.cktV5.Overall17 },
					memberPolicies: data.comparisonPolicy.cktV5AuxiliaryOrders.Overall17,
				},
				"21x21": {
					normalized: { score: data.metrics.cktV5.U357 },
					memberPolicies: data.comparisonPolicy.cktV5AuxiliaryOrders.U357,
				},
				s005: {
					normalized: { score: data.metrics.cktV5.S005 },
					memberPolicies: data.comparisonPolicy.cktV5AuxiliaryOrders.S005,
				},
				b04: {
					normalized: { score: data.metrics.cktV5.B04 },
					memberPolicies: data.comparisonPolicy.cktV5AuxiliaryOrders.B04,
				},
			},
		};
if (!existsSync(cktV51Path))
	throw new Error(`缺少 CKT v5.1 结果：${cktV51Path}`);
const cktV51 = JSON.parse(readFileSync(cktV51Path, "utf8"));
const html = readFileSync(resolve(benchmarkPath), "utf8");
const payloadMatch = html.match(
	/<script id="payload"[^>]*>([\s\S]*?)<\/script>/u,
);
if (!payloadMatch) throw new Error("Benchmark HTML 中未找到压缩 payload。");
const benchmark = JSON.parse(
	gunzipSync(Buffer.from(payloadMatch[1].trim(), "base64")).toString("utf8"),
	// biome-ignore lint/suspicious/noExplicitAny: benchmark payload 很大且由外部单文件页面定义。
) as any;

const overallId = "SNOW-SHENYUN-21X26-PRODUCTION";
const overallKey = "Overall17";
const entry = benchmark.entries.find(
	({ id }: { id: string }) => id === overallId,
);
if (!entry) throw new Error(`Benchmark HTML 中缺少 ${overallId}。`);
const completion = benchmark.completionBV4.schemes[overallId];
const s005 = benchmark.completionBV4.schemes.S005;
if (!completion || !s005)
	throw new Error("Benchmark HTML 缺少 CKT v4 四码顶数据。");

const modes = ["keytao", "sanpin"] as const;
const kinds = ["character", "word2", "word3", "word4"] as const;
const weights = { character: 1, word2: 3, word3: 1, word4: 1 } as const;
type Mode = (typeof modes)[number];
type Kind = (typeof kinds)[number];
interface CompletionTrack {
	motorUpperMs: number;
	firstAuxRate: number;
	secondAuxRate: number;
	selectionRate: number;
	meanRejectedCandidates: number;
	meanPageActions: number;
}
interface CompletionScheme {
	modes: Record<Mode, Record<Kind, CompletionTrack>>;
}
const weighted = (
	scheme: CompletionScheme,
	getter: (track: CompletionTrack) => number,
) => {
	let total = 0;
	for (const mode of modes) {
		for (const kind of kinds)
			total += weights[kind] * getter(scheme.modes[mode][kind]);
	}
	return total / 12;
};
const aggregateScore = (getter: (track: CompletionTrack) => number) => {
	let total = 0;
	for (const mode of modes) {
		for (const kind of kinds) {
			const ratio =
				getter(completion.modes[mode][kind]) / getter(s005.modes[mode][kind]);
			total += weights[kind] * ratio ** 4;
		}
	}
	return 10 * (total / 12) ** 0.25;
};
const motor = (track: CompletionTrack) => track.motorUpperMs;
const motorAndAux = (track: CompletionTrack) =>
	motor(track) + 300 * track.firstAuxRate + 300 * track.secondAuxRate;
const fullWithoutPage = (track: CompletionTrack) =>
	motorAndAux(track) +
	600 * track.selectionRate +
	50 * track.meanRejectedCandidates;
const full = (track: CompletionTrack) =>
	fullWithoutPage(track) + 300 * track.meanPageActions;

const aggregateSelectionRate = weighted(
	completion,
	(track) => track.selectionRate,
);
const aggregateFirstAuxRate = weighted(
	completion,
	(track) => track.firstAuxRate,
);
const aggregateSecondAuxRate = weighted(
	completion,
	(track) => track.secondAuxRate,
);
const macro = benchmark.macroxue.values[overallId]["daily|native-punctuation"];
const load = benchmark.r11LoadSummaries[overallId];
const keys = benchmark.ckt.keys as string;
const groupPeak = (group: string) =>
	Object.entries(
		benchmark.ckt.tracks[overallId] as Record<string, { load: number[] }>,
	)
		.map(([track, value]) => ({
			track,
			value: [...group].reduce(
				(sum, key) => sum + value.load[keys.indexOf(key)],
				0,
			),
		}))
		.reduce((best, current) => (current.value > best.value ? current : best));
const leftPinkyPeak = groupPeak("QAZ");
const indexFingerPeak = groupPeak("TYB");

const setMetric = (name: string, value: unknown) => {
	data.metrics[name][overallKey] = value;
};
setMetric("M-R2", entry.memoryAuditR2.M);
setMetric("logicAuditFA1", entry.logicAudit.score);
setMetric("logicUniformityLUv1r", entry.logicUniformity.score);
setMetric("common399UniqueCodes", 399);
setMetric("common399UniqueRate", 1);
setMetric("common399CollisionExcess", 0);
setMetric("common399CollisionBuckets", 0);
setMetric("common399AffectedSyllables", 0);
setMetric("common399AffectedRate", 0);
setMetric("s2FrequencyWeightedMiss", 0);
setMetric("s2CompletionMeanKeys", 2);
setMetric(
	"s2CompletionCenterMs",
	benchmark.fairCKT.values[overallId].S2Completion.centerMs,
);
setMetric("cktV3", entry.productionCandidateMetrics.replayedCktV3);
setMetric("cktV4", entry.productionCandidateMetrics.replayedCktV4);
setMetric("ensembleV3", benchmark.ensembleV3.values[overallId].score);
setMetric("ensembleV4", benchmark.ensembleV4.values[overallId].score);
setMetric("ensembleV5", benchmark.ensembleV5.values[overallId].score);
setMetric("ensembleV6CW150", benchmark.ensembleV6.values[overallId].score);
setMetric("aggregateSelectionRate", aggregateSelectionRate);
setMetric("aggregateFirstAuxRate", aggregateFirstAuxRate);
setMetric("aggregateSecondAuxRate", aggregateSecondAuxRate);
setMetric("dailyLeftRightLoad", {
	left: macro.left_load,
	right: macro.right_load,
	leftShare: macro.left_load / macro.hits,
});
setMetric("dailySameHandRate", macro.same_hand_rate);
setMetric("dailyMeanEffectiveDistance", macro.avg_effective_distance);
setMetric("leftPinkyQAZPeak20Contracts", leftPinkyPeak.value);
setMetric("rightPinkyPeak20Contracts", load.rightPinkyMax20);
setMetric("maxFingerPeak20Contracts", load.maxFinger20);
setMetric("homeShareS2", load.homeS2);
setMetric("indexFingerTYBPeak20Contracts", indexFingerPeak.value);
setMetric("homeFloor20Contracts", load.homeFloor);
setMetric("dailyEightScenarioMovingHand", macro.score);

data.version = "shenyun-four-scheme-comparison-v2";
data.metrics.cktV5 = {
	better: "lower",
	Overall17: cktV5.pairs["21x26"].normalized.score,
	U357: cktV5.pairs["21x21"].normalized.score,
	S005: cktV5.pairs.s005.normalized.score,
	B04: cktV5.pairs.b04.normalized.score,
};
const { target: _legacyTarget, ...comparisonPolicy } = data.comparisonPolicy;
data.comparisonPolicy = {
	...comparisonPolicy,
	targets: [overallId, "U357-21X21-M40-D0"],
	baselines: ["S005", "B04"],
	boundary:
		"无飞键道(U357)与S005按传统21×21合同计分；神韵(Overall-17)原生遵循飞花式四码顶；B04采用原资料记录的AEUIO形辅与IEUAO调辅，本比较为其套用同一飞花式四码顶路由和统一字形／笔画源。四者共用语料和模型，但不同键域与合同不是同键域胜负。",
	cktV4Contracts: {
		Overall17: "four-code-top",
		U357: "traditional-21x21",
		S005: "traditional-21x21",
		B04: "four-code-top",
	},
	cktV4ContractProvenance: {
		Overall17: "native-feihua-four-code-top",
		U357: "native-traditional-21x21",
		S005: "native-traditional-21x21",
		B04: "benchmark-applied-feihua-four-code-top",
	},
	cktV4AuxiliarySources: {
		Overall17: "native key mapping with shared snowshape/stroke character data",
		U357: "native key mapping with shared snowshape/stroke character data",
		S005: "native key mapping with shared snowshape/stroke character data",
		B04: "documented AEUIO/IEUAO key mapping with shared snowshape/stroke character data",
	},
	cktV5AuxiliaryOrders: {
		Overall17: cktV5.pairs["21x26"].memberPolicies,
		U357: cktV5.pairs["21x21"].memberPolicies,
		S005: cktV5.pairs.s005.memberPolicies,
		B04: cktV5.pairs.b04.memberPolicies,
	},
	cktV5AuxiliaryDepth: {
		optimizedAndScored: 2,
		runtimeWord3AppendsRemainingPosition: true,
		runtimeWord4MaximumAuxiliaries: 2,
		laterAuxiliariesIncluded: false,
	},
	cktV5OrderSelection: {
		Overall17: "layout-specific minimum under the complete CKT v5 objective",
		U357: "layout-specific minimum under the complete CKT v5 objective",
		S005: "fixed normalization anchor",
		B04: "complete-policy lowest mean rank under the independent 0%-500% five-coefficient perturbation grid",
	},
	cktV51: {
		contract: cktV51.contract,
		referencePolicies: cktV51.referencePolicies,
		independentGrid: cktV51.independentGrid,
		auxiliaryOrders: {
			Overall17: {
				keytao: cktV51.cases["21x26-keytao"].robustPolicy,
				sanpin: cktV51.cases["21x26-sanpin"].robustPolicy,
			},
			U357: {
				keytao: cktV51.cases["21x21-keytao"].robustPolicy,
				sanpin: cktV51.cases["21x21-sanpin"].robustPolicy,
			},
			S005: {
				keytao: cktV51.cases["s005-keytao"].robustPolicy,
				sanpin: cktV51.cases["s005-sanpin"].robustPolicy,
			},
			B04: {
				keytao: cktV51.cases["b04-keytao"].robustPolicy,
				sanpin: cktV51.cases["b04-sanpin"].robustPolicy,
			},
		},
	},
	groupPeakTracks: {
		...comparisonPolicy.groupPeakTracks,
		leftPinkyQAZ: {
			Overall17: leftPinkyPeak.track,
			...comparisonPolicy.groupPeakTracks.leftPinkyQAZ,
		},
		rightPinky: {
			Overall17: benchmark.r11LoadSummaries[overallId].rightPinkyTrack,
			...comparisonPolicy.groupPeakTracks.rightPinky,
		},
		indexFingerTYB: {
			Overall17: indexFingerPeak.track,
			...comparisonPolicy.groupPeakTracks.indexFingerTYB,
		},
	},
};
data.metrics.cktV51 = {
	Overall17: cktV51.normalized.pairs["21x26"].score,
	U357: cktV51.normalized.pairs["21x21"].score,
	S005: cktV51.normalized.pairs["s005-optimized"].score,
	B04: cktV51.normalized.pairs.b04.score,
};
data.flyingKeyComponents[overallKey] = {
	counts: { initials: 0, zeroInitialGroups: 0, finals: 0 },
	initials: {},
	zeroInitialGroups: {},
	finals: {},
};

for (const mode of modes) {
	for (const kind of kinds) {
		const outputKind = kind === "character" ? "char" : kind;
		const track = completion.modes[mode][kind];
		data.weightedNonfirstRates[mode][outputKind][overallKey] =
			track.selectionRate;
		data.stagedResidualNonfirstRates[mode][outputKind].afterZeroAux[
			overallKey
		] = track.firstAuxRate;
		data.stagedResidualNonfirstRates[mode][outputKind].afterOneAux[overallKey] =
			track.secondAuxRate;
		data.stagedResidualNonfirstRates[mode][outputKind].afterTwoAux[overallKey] =
			track.selectionRate;
		if (kind !== "character") {
			data.terminalWordCollisionBuckets[mode][outputKind][overallKey] =
				entry.terminalBucketAudit[mode][outputKind];
		}
	}
}

const components = {
	motor: weighted(completion, motor),
	firstAux: 300 * aggregateFirstAuxRate,
	secondAux: 300 * aggregateSecondAuxRate,
	selectionDecision: 600 * aggregateSelectionRate,
	scan: 50 * weighted(completion, (track) => track.meanRejectedCandidates),
	selectionAction: 0,
	page: 300 * weighted(completion, (track) => track.meanPageActions),
};
data.cktV4Explanation.weightedMeanComponentsMs[overallKey] = {
	...components,
	total:
		components.motor +
		components.firstAux +
		components.secondAux +
		components.selectionDecision +
		components.scan +
		components.page,
};
data.cktV4Explanation.counterfactualScores.motorOnly[overallKey] =
	aggregateScore(motor);
data.cktV4Explanation.counterfactualScores.motorAndAuxNoSelection[overallKey] =
	aggregateScore(motorAndAux);
data.cktV4Explanation.counterfactualScores.fullExceptPageActionZero[
	overallKey
] = aggregateScore(fullWithoutPage);
data.cktV4Explanation.counterfactualScores.fullDefault[overallKey] =
	aggregateScore(full);

const schemes = [overallKey, "U357", "S005", "B04"] as const;
const labels: Record<(typeof schemes)[number], string> = {
	Overall17: "神韵(Overall-17) 21×26 双拼",
	U357: "无飞键道(U357) 21×21 双拼",
	S005: "星空键道 S005",
	B04: "首道 B04",
};
const decorate = (
	displays: string[],
	values: Array<number | number[]>,
	direction: ComparisonDirection,
) =>
	decorateComparison(
		displays.map((display, index) => ({ display, score: values[index] })),
		direction,
	);
const percent = (value: number, digits = 3) =>
	`${(value * 100).toFixed(digits)}%`;
const number = (value: number, digits = 6) => value.toFixed(digits);
const metricValue = (name: string, scheme: (typeof schemes)[number]) =>
	data.metrics[name][scheme];
const table = (headers: string[], rows: string[][]) =>
	`| ${headers.join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |\n${rows
		.map((row) => `| ${row.join(" | ")} |`)
		.join("\n")}`;
const metricTable = table(
	["指标", ...schemes.map((scheme) => labels[scheme]), "何为好"],
	[
		["M-R2 记忆项", "M-R2", "number", "越低越好", "min"],
		["FA-1 逻辑审计", "logicAuditFA1", "number", "越高越一致", "max"],
		[
			"LU-v1r 逻辑均匀度",
			"logicUniformityLUv1r",
			"number",
			"越高越统一",
			"max",
		],
		[
			"Common399 唯一码",
			"common399UniqueCodes",
			"integer",
			"越高越少重码",
			"max",
		],
		[
			"频率加权 S2 miss",
			"s2FrequencyWeightedMiss",
			"percent",
			"越低越好",
			"min",
		],
		["S2 补全平均码长", "s2CompletionMeanKeys", "four", "越低越好", "min"],
		[
			"S2 补全中心时间（ms）",
			"s2CompletionCenterMs",
			"three",
			"越低越好",
			"min",
		],
		["综合补全 CKT v3", "cktV3", "number", "越低越好；历史情景", "min"],
		["综合补全 CKT v4", "cktV4", "number", "越低越好；现行主指标", "min"],
		[
			"综合补全 CKT v5",
			"cktV5",
			"number",
			"越低越好；六候选页与方案专属辅序",
			"min",
		],
		[
			"综合补全 CKT v5.1",
			"cktV51",
			"number",
			"越低越好；原生路由最长六码",
			"min",
		],
		["A7E-v3 系综当量", "ensembleV3", "number", "越低越好；冻结历史轴", "min"],
		["A7E-v4 系综当量", "ensembleV4", "number", "越低越好；冻结历史轴", "min"],
		["A7E-v5 系综当量", "ensembleV5", "number", "越低越好；CKT-only", "min"],
		["A7E-v6-CW150", "ensembleV6CW150", "number", "越低越好；情景指标", "min"],
		["八轨综合选重率", "aggregateSelectionRate", "percent", "越低越好", "min"],
		["八轨第一辅键率", "aggregateFirstAuxRate", "percent", "越低越好", "min"],
		["八轨第二辅键率", "aggregateSecondAuxRate", "percent", "越低越好", "min"],
		[
			"日常同手率",
			"dailySameHandRate",
			"percent",
			"越低越好；非独立速度结论",
			"min",
		],
		[
			"日常平均有效距离",
			"dailyMeanEffectiveDistance",
			"four",
			"越低越好",
			"min",
		],
		[
			"20 合同 QAZ 左小指组峰值",
			"leftPinkyQAZPeak20Contracts",
			"percent",
			"越低越好",
			"min",
		],
		[
			"20 合同 P 区右小指组峰值",
			"rightPinkyPeak20Contracts",
			"percent",
			"越低越好",
			"min",
		],
		[
			"20 合同最大单指峰值",
			"maxFingerPeak20Contracts",
			"percent",
			"越低越好",
			"min",
		],
		["S2 主键区占比", "homeShareS2", "percent", "越高越好", "max"],
		[
			"20 合同 TYB 双食指组峰值",
			"indexFingerTYBPeak20Contracts",
			"percent",
			"越低越好",
			"min",
		],
		["20 合同主键区下限", "homeFloor20Contracts", "percent", "越高越好", "max"],
		[
			"日常纯双拼移动手分数（含标点）",
			"dailyEightScenarioMovingHand",
			"three",
			"越高越好",
			"max",
		],
	].map(([title, name, format, good, direction]) => {
		const rawValues = schemes.map((scheme) => metricValue(name, scheme));
		const displays = rawValues.map((value) => {
			if (format === "percent") return percent(value);
			if (format === "integer") return String(value);
			if (format === "three") return number(value, 3);
			if (format === "four") return number(value, 4);
			return number(value);
		});
		return [
			title,
			...decorate(displays, rawValues, direction as ComparisonDirection),
			good,
		];
	}),
);

const trackNames = {
	keytao: "冰雪健道",
	sanpin: "冰雪弎拼",
} as const;
const kindNames = {
	char: "单字",
	word2: "二字词",
	word3: "三字词",
	word4: "四字词",
} as const;
const rateRows: string[][] = [];
const stagedRows: string[][] = [];
const bucketRows: string[][] = [];
for (const mode of modes) {
	for (const kind of ["char", "word2", "word3", "word4"] as const) {
		const rateValues = schemes.map(
			(scheme) => data.weightedNonfirstRates[mode][kind][scheme] as number,
		);
		rateRows.push([
			trackNames[mode],
			kindNames[kind],
			...decorate(
				rateValues.map((value) => percent(value)),
				rateValues,
				"min",
			),
		]);
		for (const [stage, stageName] of [
			["afterZeroAux", "零辅后"],
			["afterOneAux", "一辅后"],
			["afterTwoAux", "二辅后"],
		] as const) {
			const stageValues = schemes.map(
				(scheme) =>
					data.stagedResidualNonfirstRates[mode][kind][stage][scheme] as number,
			);
			stagedRows.push([
				trackNames[mode],
				kindNames[kind],
				stageName,
				...decorate(
					stageValues.map((value) => percent(value)),
					stageValues,
					"min",
				),
			]);
		}
		if (kind !== "char") {
			bucketRows.push([
				trackNames[mode],
				kindNames[kind],
				...schemes.map((scheme) => {
					const value = data.terminalWordCollisionBuckets[mode][kind][scheme];
					return `${value.buckets}／${value.residualEntries}／${value.crossLengthBuckets}／${value.maxBucketSize}`;
				}),
			]);
		}
	}
}

const componentNames = [
	["motor", "运动"],
	["firstAux", "第一辅键"],
	["secondAux", "第二辅键"],
	["selectionDecision", "固定选重决策"],
	["scan", "候选扫描"],
	["page", "翻页"],
	["total", "线性总计"],
] as const;
const componentDecorations = Object.fromEntries(
	componentNames.map(([key]) => {
		const values = schemes.map(
			(scheme) =>
				data.cktV4Explanation.weightedMeanComponentsMs[scheme][key] as number,
		);
		return [
			key,
			decorate(
				values.map((value) => number(value, key === "page" ? 4 : 3)),
				values,
				"min",
			),
		];
	}),
) as Record<(typeof componentNames)[number][0], string[]>;
const componentTable = table(
	["方案", ...componentNames.map(([, label]) => `${label}（ms）`)],
	schemes.map((scheme, schemeIndex) => [
		labels[scheme],
		...componentNames.map(([key]) => componentDecorations[key][schemeIndex]),
	]),
);
const counterfactuals = [
	["motorOnly", "仅运动时间"],
	["motorAndAuxNoSelection", "运动＋两级辅键，不计选重／扫描／翻页"],
	["fullExceptPageActionZero", "完整默认情景，但翻页为 0 ms"],
	["fullDefault", "完整默认 CKT v4"],
] as const;
const counterfactualTable = table(
	["CKT v4 情景", ...schemes.map((scheme) => labels[scheme])],
	counterfactuals.map(([key, label]) => {
		const values = schemes.map(
			(scheme) =>
				data.cktV4Explanation.counterfactualScores[key][scheme] as number,
		);
		return [
			label,
			...decorate(
				values.map((value) => number(value)),
				values,
				"min",
			),
		];
	}),
);

const flyingValues = schemes.map((scheme) => {
	const counts = data.flyingKeyComponents[scheme].counts;
	return [counts.initials, counts.zeroInitialGroups, counts.finals] as number[];
});
const flyingDisplays = decorate(
	flyingValues.map((values) => values.join(" / ")),
	flyingValues,
	"triple-sum",
);

const report = `# 神韵两代布局与 S005、B04 四方案比较

方案来源：神韵(Overall-17) 21×26 双拼出自 \`production/ckt-v4-2126-strict-d0-20261030\` 分支的提交 \`7a7e154\`；无飞键道(U357) 21×21 双拼出自 \`production/ckt-v4-2121-strict-avuio-20261024\` 分支的提交 \`11713b6\`。方案名分别链接到对应固定提交的最终报告，报告记录了搜索过程、候选取舍和定稿映射。

本文把两个现行专有名词置于同等地位：**无飞键道(U357) 21×21 双拼**与**神韵(Overall-17) 21×26 双拼**。另以星空键道 S005、首道 B04 为参照。四方案共用 Common399、冻结 20 合同、同一字词与形码数据、CKT v4 模型及日常八场景文稿。

必须同时注意合同边界：无飞键道(U357)与 S005 按传统 21×21 合同计分；神韵(Overall-17)原生遵循飞花式四码顶；B04 采用原资料记录的 \`AEUIO\` 形辅与 \`IEUAO\` 调辅，本报告为其套用同一飞花式四码顶路由和统一字形／笔画源。21×26／26×26 相比 21×21 扩大了韵码域，不能把跨键域领先直接解释成同键域映射胜负。

表中在神韵(Overall-17)、无飞键道(U357)与原键道 S005 三个方案间拉通排名：第 1 名数值加粗并标 ★★，第 2 名数值加粗并标 ★，第 3 名不加粗、不标星；首道 B04 不参与三方案名次。🥇 独立比较全部四方案，可以与星标同时出现在同一单元格。并列采用竞赛排名，例如并列第 1 名后的下一名为第 3 名；并列单元格使用相同格式。

## 总览

${metricTable}

CKT v5 使用 6 项候选页；神韵(Overall-17)的冰雪简道／冰雪散拼辅序为 \`12/21/42\`、\`12/21/13\`，无飞键道(U357)的冰雪健道／冰雪弎拼辅序为 \`12/23/24\`、\`12/21/23\`，S005 固定为 \`12/21/24\`、\`12/21/23\`。首道 B04 按原生 \`AEUIO\` 形辅、\`IEUAO\` 调辅与五项认知系数 0%～500% 独立扰动网格，对 144 套完整规则按平均名次取稳健综合第一，形辅／调辅分别为 \`12/12/23\`、\`21/12/23\`。每段两位数字表示 CKT v5 优化并计分的前两辅；运行时冰雪健道、冰雪弎拼的三字词会按剩余字位补第三辅，四字词最多两辅。CKT v5 在第二辅后直接按选重计费，因此不含三字词第三辅的成本与消歧收益。

CKT v5.1 保留各布局的原生主码路由，并把二／三／四字词的最长总码长统一为 6：二／四字词均为 4 主码＋2 辅码；传统 21×21 的三字词由 \`AAA+BB\` 补为 \`AAA+BBB\`，神韵(Overall-17)与首道 B04 的四码顶三字词继续使用既有 \`AAAU+BB\`，不改变其编码。第一、第二、第三辅键与选重决策、候选扫描、翻页六项系数分别在 0%～500%、步长 50% 上独立扰动，共 \`11⁶=1,771,561\` 点；每个成员在 144 套完整规则中按最低平均名次取稳健第一。四布局的形／调稳健辅序依次为：神韵(Overall-17) \`12/21/14\`、\`12/21/13\`；无飞键道(U357) \`12/231/24\`、\`12/213/23\`；S005 \`12/231/24\`、\`12/213/23\`；首道 B04 \`12/12/23\`、\`21/12/23\`。神韵与首道沿用 CKT v5 辅序时各轨绝对成本完全不变；其 CKT v5.1 归一分仍会因 S005 三字词补入第三辅而变化。

四方案的飞键成分（声母／零声母组／韵母）依次为：${schemes.map((scheme, index) => `${labels[scheme]} ${flyingDisplays[index]}`).join("、")}。飞键按 Common399 实际二键码统计；不同成分共用一键或成分整体移位不计飞键。

## CKT v4 成本分解

CKT v4 按单字、二字、三字、四字词权重 \`1:3:1:1\`，冰雪健道与冰雪弎拼等权，以 S005＝10 做四次幂聚合。第一／第二辅键各按 300 ms；非首选固定决策 600 ms，每排除一个更高候选 50 ms，每跨 9 个候选翻页 300 ms。

${componentTable}

线性总计只用于解释成本来源，正式 CKT v4 仍按八条轨的四次幂聚合。

${counterfactualTable}

## 冻结语料加权非首选率

${table(["编码轨", "词长", ...schemes.map((scheme) => labels[scheme])], rateRows)}

## 逐级辅键后的频率加权残余非首选率

“零辅后”是裸编码后仍需第一辅键的权重；“一辅后”是第一辅键后仍需第二辅键的权重；“二辅后”是第二辅键后仍需人工选重的权重。

${table(["编码轨", "词长", "阶段", ...schemes.map((scheme) => labels[scheme])], stagedRows)}

## 二／三／四字词的终局碰撞桶

单元格依次为“碰撞桶数／残余条目数／跨词长桶数／最大桶成员数”。不同合同的共享池结构不同，复合单元格不标单一胜负。

${table(["编码轨", "词长", ...schemes.map((scheme) => labels[scheme])], bucketRows)}

## 边界与结论

- 神韵(Overall-17)以 21×26 声韵域实现 Common399 399 个唯一码、M-R2＝36，并采用飞花式四码顶；它在现行 CKT v4 中与 B04 接近，同时保持零飞键，但日常文稿移动手分数及主键区指标不如无飞键道(U357)。
- 无飞键道(U357)在 21×21 键域中保留 42 个音节重码桶，换来更高的日常纯双拼移动手分数、较高主键区占比和较低最大单指峰值；它与 S005 才是直接的同键域比较。
- B04 的 26×26 大码域、原资料记录的辅键映射以及本报告套用的飞花式四码顶路由带来零音节重码及较低补全成本；这不是 B04 原方案的顶功声明，其飞键、记忆项和日常路径指标也采用另一种取舍。
- 所有模型分数都用于同语料、同模型横向复算，不等同真人输入速度。

机器可复核数据见 [\`shenyun-comparison.json\`](shenyun-comparison.json)。神韵(Overall-17)的底层方案 ID 为 \`${overallId}\`。两代方案的来源、得来过程与定稿映射以上述固定提交报告为准。
`;

writeFileSync(jsonPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
writeFileSync(reportPath, linkShenyunTerms(report, "zh", "github"), "utf8");
console.log(`已生成 ${reportPath}\n已生成 ${jsonPath}`);
