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
const cktV51Text = readFileSync(cktV51Path, "utf8");
const cktV51 = JSON.parse(cktV51Text);
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
const d3Id = "SNOW-SHENYUN-21X26-D3V1-BALANCED";
const qzId = "QZ-e8f37a0998f9";
const overallKey = "Overall17";
const benchmarkIds = {
	Overall17: overallId,
	U357: "gen0107-p5-f1h-11_13-d2-f25_26-d3-f4_22-d4-f11_13",
	S005: "S005",
	B04: "B04",
} as const;
const entry = benchmark.entries.find(
	({ id }: { id: string }) => id === overallId,
);
if (!entry) throw new Error(`Benchmark HTML 中缺少 ${overallId}。`);
const d3Entry = benchmark.entries.find(({ id }: { id: string }) => id === d3Id);
const qzEntry = benchmark.entries.find(({ id }: { id: string }) => id === qzId);
if (!d3Entry || !qzEntry)
	throw new Error(`Benchmark HTML 中缺少 ${d3Id} 或 ${qzId}。`);
const displacement = (id: string) => {
	const scheme = benchmark.entries.find(
		({ id: entryId }: { id: string }) => entryId === id,
	);
	if (!scheme) throw new Error(`Benchmark HTML 中缺少 ${id}。`);
	const initials =
		scheme.mappingAudit?.ordinaryInitialDisplacements ??
		scheme.memoryAuditR2?.ordinaryDisplacedCount;
	const explicitFinals = scheme.mappingAudit?.baseFinalDisplacements;
	const finalLinks = scheme.memoryAuditR2?.finalLinkKeys ?? {};
	const finals =
		explicitFinals ??
		[..."aeiou"].filter(
			(final) =>
				finalLinks[final]?.length !== 1 ||
				finalLinks[final][0] !== final.toUpperCase(),
		).length;
	if (!Number.isInteger(initials) || !Number.isInteger(finals))
		throw new Error(`Benchmark HTML 中 ${id} 的 D/V 不完整。`);
	return [initials, finals] as [number, number];
};
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
const weightedFor = (
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
const weighted = (getter: (track: CompletionTrack) => number) =>
	weightedFor(completion, getter);
const aggregateScoreFor = (
	scheme: CompletionScheme,
	getter: (track: CompletionTrack) => number,
) => {
	let total = 0;
	for (const mode of modes) {
		for (const kind of kinds) {
			const ratio =
				getter(scheme.modes[mode][kind]) / getter(s005.modes[mode][kind]);
			total += weights[kind] * ratio ** 4;
		}
	}
	return 10 * (total / 12) ** 0.25;
};
const aggregateScore = (getter: (track: CompletionTrack) => number) =>
	aggregateScoreFor(completion, getter);
const motor = (track: CompletionTrack) => track.motorUpperMs;
const motorAndAux = (track: CompletionTrack) =>
	motor(track) + 300 * track.firstAuxRate + 300 * track.secondAuxRate;
const fullWithoutPage = (track: CompletionTrack) =>
	motorAndAux(track) +
	600 * track.selectionRate +
	50 * track.meanRejectedCandidates;
const full = (track: CompletionTrack) =>
	fullWithoutPage(track) + 300 * track.meanPageActions;

const aggregateSelectionRate = weighted((track) => track.selectionRate);
const aggregateFirstAuxRate = weighted((track) => track.firstAuxRate);
const aggregateSecondAuxRate = weighted((track) => track.secondAuxRate);
const macro = benchmark.macroxue.values[overallId]["daily|native-punctuation"];
const load = benchmark.r11LoadSummaries[overallId];
const keys = benchmark.ckt.keys as string;
const groupPeakFor = (schemeId: string, group: string) =>
	Object.entries(
		benchmark.ckt.tracks[schemeId] as Record<string, { load: number[] }>,
	)
		.map(([track, value]) => ({
			track,
			value: [...group].reduce(
				(sum, key) => sum + value.load[keys.indexOf(key)],
				0,
			),
		}))
		.reduce((best, current) => (current.value > best.value ? current : best));
const groupPeak = (group: string) => groupPeakFor(overallId, group);
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
data.metrics.soundRhymeDisorder = {
	better: "lower",
	...Object.fromEntries(
		Object.entries(benchmarkIds).map(([key, id]) => [key, displacement(id)]),
	),
};
data.metrics.s2DifferentKeySameFingerRate = {
	better: "lower",
	...Object.fromEntries(
		Object.entries(benchmarkIds).map(([key, id]) => [
			key,
			benchmark.ckt.tracks[id].S2.sfb,
		]),
	),
};

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
	motor: weighted(motor),
	firstAux: 300 * aggregateFirstAuxRate,
	secondAux: 300 * aggregateSecondAuxRate,
	selectionDecision: 600 * aggregateSelectionRate,
	scan: 50 * weighted((track) => track.meanRejectedCandidates),
	selectionAction: 0,
	page: 300 * weighted((track) => track.meanPageActions),
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
		[
			"[M-R2](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md) 记忆项",
			"M-R2",
			"number",
			"越低越好",
			"min",
		],
		[
			"声母／韵母乱序度 D/V",
			"soundRhymeDisorder",
			"pair",
			"越低越接近字母原键",
			"sum",
		],
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
		[
			"S2 异键同指率",
			"s2DifferentKeySameFingerRate",
			"percent",
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
			if (format === "pair") return value.join(" / ");
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

const nextSchemes = [
	"D3V1",
	"QZ",
	"Overall17First",
	"U357First",
	"B04",
] as const;
type NextScheme = (typeof nextSchemes)[number];
const nextLabels: Record<NextScheme, string> = {
	D3V1: "D3/V1 21×26",
	QZ: "QZ-e8f37a 21×21",
	Overall17First: "Overall-17·初代 21×26",
	U357First: "U357·初代 21×21",
	B04: "首道 B04",
};
const requiredNumber = (value: unknown, label: string) => {
	if (typeof value !== "number" || !Number.isFinite(value))
		throw new Error(`Benchmark HTML 中 ${label} 不是有限数字。`);
	return value;
};
const d3Production = d3Entry.productionCandidateMetrics;
const qzReadme = qzEntry.readmeBenchmarkMetrics;
if (!d3Production || !qzReadme)
	throw new Error("Benchmark HTML 缺少 D3/V1 或 QZ 的定稿指标。");
const nextEntries = { D3V1: d3Entry, QZ: qzEntry } as const;
const nextIds = { D3V1: d3Id, QZ: qzId } as const;
const nextCompletions = {
	D3V1: benchmark.completionBV4.schemes[d3Id] as CompletionScheme,
	QZ: benchmark.completionBV4.schemes[qzId] as CompletionScheme,
} as const;
for (const scheme of ["D3V1", "QZ"] as const) {
	if (!nextCompletions[scheme])
		throw new Error(
			`Benchmark HTML 缺少 ${nextIds[scheme]} 的 CKT v4 逐轨数据。`,
		);
}
const collisionStats = (scheme: "D3V1" | "QZ") => {
	const audit = nextEntries[scheme].memoryAuditR2;
	const buckets = Object.values(audit?.collisionBuckets ?? {}) as string[][];
	return {
		unique: requiredNumber(
			audit?.unique,
			`${nextIds[scheme]} Common399 唯一码`,
		),
		excess: requiredNumber(
			audit?.collisionExcess,
			`${nextIds[scheme]} Common399 重码盈余`,
		),
		buckets: buckets.length,
		affected: buckets.reduce((sum, values) => sum + values.length, 0),
	};
};
const nextCollision = {
	D3V1: collisionStats("D3V1"),
	QZ: collisionStats("QZ"),
};
const nextFair = {
	D3V1: benchmark.fairCKT.values[d3Id],
	QZ: benchmark.fairCKT.values[qzId],
};
const nextMacro = {
	D3V1: benchmark.macroxue.values[d3Id]["daily|native-punctuation"],
	QZ: benchmark.macroxue.values[qzId]["daily|native-punctuation"],
};
const nextLoad = {
	D3V1: benchmark.r11LoadSummaries[d3Id],
	QZ: benchmark.r11LoadSummaries[qzId],
};
const nextAggregate = (
	scheme: "D3V1" | "QZ",
	getter: (track: CompletionTrack) => number,
) => weightedFor(nextCompletions[scheme], getter);
const nextGroupPeak = (scheme: "D3V1" | "QZ", group: string) =>
	groupPeakFor(nextIds[scheme], group).value;
const nextValue = (name: string, d3Value: unknown, qzValue: unknown) => ({
	D3V1: d3Value,
	QZ: qzValue,
	Overall17First: data.metrics[name].Overall17,
	U357First: data.metrics[name].U357,
	B04: data.metrics[name].B04,
});
const nextMetrics = {
	"M-R2": {
		better: "lower",
		...nextValue(
			"M-R2",
			requiredNumber(d3Entry.memoryAuditR2?.M, `${d3Id} M-R2`),
			requiredNumber(qzReadme["M-R2"], `${qzId} M-R2`),
		),
	},
	logicAuditFA1: {
		better: "higher",
		...nextValue(
			"logicAuditFA1",
			d3Entry.logicAudit.score,
			qzEntry.logicAudit.score,
		),
	},
	logicUniformityLUv1r: {
		better: "higher",
		...nextValue(
			"logicUniformityLUv1r",
			d3Entry.logicUniformity.score,
			qzEntry.logicUniformity.score,
		),
	},
	soundRhymeDisorder: {
		better: "lower-sum",
		...nextValue("soundRhymeDisorder", displacement(d3Id), displacement(qzId)),
	},
	common399UniqueCodes: {
		better: "higher",
		...nextValue(
			"common399UniqueCodes",
			requiredNumber(d3Entry.memoryAuditR2?.unique, `${d3Id} Common399 唯一码`),
			requiredNumber(qzReadme.common399UniqueCodes, `${qzId} Common399 唯一码`),
		),
	},
	common399CollisionBuckets: {
		better: "lower",
		...nextValue(
			"common399CollisionBuckets",
			nextCollision.D3V1.buckets,
			nextCollision.QZ.buckets,
		),
	},
	common399UniqueRate: {
		better: "higher",
		...nextValue(
			"common399UniqueRate",
			nextCollision.D3V1.unique / 399,
			nextCollision.QZ.unique / 399,
		),
	},
	common399CollisionExcess: {
		better: "lower",
		...nextValue(
			"common399CollisionExcess",
			nextCollision.D3V1.excess,
			nextCollision.QZ.excess,
		),
	},
	common399AffectedSyllables: {
		better: "lower",
		...nextValue(
			"common399AffectedSyllables",
			nextCollision.D3V1.affected,
			nextCollision.QZ.affected,
		),
	},
	common399AffectedRate: {
		better: "lower",
		...nextValue(
			"common399AffectedRate",
			nextCollision.D3V1.affected / 399,
			nextCollision.QZ.affected / 399,
		),
	},
	s2FrequencyWeightedMiss: {
		better: "lower",
		...nextValue(
			"s2FrequencyWeightedMiss",
			nextFair.D3V1.S2miss,
			nextFair.QZ.S2miss,
		),
	},
	s2CompletionMeanKeys: {
		better: "lower",
		...nextValue(
			"s2CompletionMeanKeys",
			nextFair.D3V1.S2Completion.meanKeys,
			nextFair.QZ.S2Completion.meanKeys,
		),
	},
	s2CompletionCenterMs: {
		better: "lower",
		...nextValue(
			"s2CompletionCenterMs",
			nextFair.D3V1.S2Completion.centerMs,
			nextFair.QZ.S2Completion.centerMs,
		),
	},
	s2DifferentKeySameFingerRate: {
		better: "lower",
		...nextValue(
			"s2DifferentKeySameFingerRate",
			benchmark.ckt.tracks[d3Id].S2.sfb,
			benchmark.ckt.tracks[qzId].S2.sfb,
		),
	},
	cktV3: {
		better: "lower",
		...nextValue(
			"cktV3",
			requiredNumber(d3Production.replayedCktV3, `${d3Id} CKT v3`),
			requiredNumber(qzReadme.cktV3, `${qzId} CKT v3`),
		),
	},
	cktV4: {
		better: "lower",
		...nextValue(
			"cktV4",
			requiredNumber(d3Production.replayedCktV4, `${d3Id} CKT v4`),
			requiredNumber(qzReadme.cktV4, `${qzId} CKT v4`),
		),
	},
	cktV5: {
		better: "lower",
		...nextValue(
			"cktV5",
			requiredNumber(d3Production.replayedCktV5, `${d3Id} CKT v5`),
			requiredNumber(qzReadme.cktV5, `${qzId} CKT v5`),
		),
	},
	cktV51: {
		better: "lower",
		...nextValue(
			"cktV51",
			requiredNumber(d3Production.replayedCktV51, `${d3Id} CKT v5.1`),
			requiredNumber(qzReadme.cktV51, `${qzId} CKT v5.1`),
		),
	},
	ensembleV3: {
		better: "lower",
		...nextValue(
			"ensembleV3",
			benchmark.ensembleV3.values[d3Id].score,
			benchmark.ensembleV3.values[qzId].score,
		),
	},
	ensembleV4: {
		better: "lower",
		...nextValue(
			"ensembleV4",
			benchmark.ensembleV4.values[d3Id].score,
			benchmark.ensembleV4.values[qzId].score,
		),
	},
	ensembleV5: {
		better: "lower",
		...nextValue(
			"ensembleV5",
			benchmark.ensembleV5.values[d3Id].score,
			benchmark.ensembleV5.values[qzId].score,
		),
	},
	ensembleV6CW150: {
		better: "lower",
		...nextValue(
			"ensembleV6CW150",
			benchmark.ensembleV6.values[d3Id].score,
			benchmark.ensembleV6.values[qzId].score,
		),
	},
	aggregateSelectionRate: {
		better: "lower",
		...nextValue(
			"aggregateSelectionRate",
			nextAggregate("D3V1", (track) => track.selectionRate),
			nextAggregate("QZ", (track) => track.selectionRate),
		),
	},
	aggregateFirstAuxRate: {
		better: "lower",
		...nextValue(
			"aggregateFirstAuxRate",
			nextAggregate("D3V1", (track) => track.firstAuxRate),
			nextAggregate("QZ", (track) => track.firstAuxRate),
		),
	},
	aggregateSecondAuxRate: {
		better: "lower",
		...nextValue(
			"aggregateSecondAuxRate",
			nextAggregate("D3V1", (track) => track.secondAuxRate),
			nextAggregate("QZ", (track) => track.secondAuxRate),
		),
	},
	dailyLeftRightLoad: {
		better: "left-share-closer-to-0.5",
		...nextValue(
			"dailyLeftRightLoad",
			{
				left: nextMacro.D3V1.left_load,
				right: nextMacro.D3V1.right_load,
				leftShare: nextMacro.D3V1.left_load / nextMacro.D3V1.hits,
			},
			{
				left: nextMacro.QZ.left_load,
				right: nextMacro.QZ.right_load,
				leftShare: nextMacro.QZ.left_load / nextMacro.QZ.hits,
			},
		),
	},
	dailySameHandRate: {
		better: "lower-but-not-standalone-speed",
		...nextValue(
			"dailySameHandRate",
			nextMacro.D3V1.same_hand_rate,
			nextMacro.QZ.same_hand_rate,
		),
	},
	dailyMeanEffectiveDistance: {
		better: "lower",
		...nextValue(
			"dailyMeanEffectiveDistance",
			nextMacro.D3V1.avg_effective_distance,
			nextMacro.QZ.avg_effective_distance,
		),
	},
	leftPinkyQAZPeak20Contracts: {
		better: "lower",
		...nextValue(
			"leftPinkyQAZPeak20Contracts",
			nextGroupPeak("D3V1", "QAZ"),
			nextGroupPeak("QZ", "QAZ"),
		),
	},
	rightPinkyPeak20Contracts: {
		better: "lower",
		...nextValue(
			"rightPinkyPeak20Contracts",
			nextLoad.D3V1.rightPinkyMax20,
			nextLoad.QZ.rightPinkyMax20,
		),
	},
	maxFingerPeak20Contracts: {
		better: "lower",
		...nextValue(
			"maxFingerPeak20Contracts",
			nextLoad.D3V1.maxFinger20,
			nextLoad.QZ.maxFinger20,
		),
	},
	dailyEightScenarioMovingHand: {
		better: "higher",
		...nextValue(
			"dailyEightScenarioMovingHand",
			requiredNumber(
				benchmark.macroxue.values[d3Id]?.["daily|native-punctuation"]?.score,
				`${d3Id} 日常移动手分数`,
			),
			requiredNumber(
				qzReadme.dailyEightScenarioMovingHand,
				`${qzId} 日常移动手分数`,
			),
		),
	},
	homeShareS2: {
		better: "higher",
		...nextValue(
			"homeShareS2",
			requiredNumber(
				benchmark.r11LoadSummaries[d3Id]?.homeS2,
				`${d3Id} S2 主键区占比`,
			),
			requiredNumber(qzReadme.homeShareS2, `${qzId} S2 主键区占比`),
		),
	},
	indexFingerTYBPeak20Contracts: {
		better: "lower",
		...nextValue(
			"indexFingerTYBPeak20Contracts",
			nextGroupPeak("D3V1", "TYB"),
			nextGroupPeak("QZ", "TYB"),
		),
	},
	homeFloor20Contracts: {
		better: "higher",
		...nextValue(
			"homeFloor20Contracts",
			nextLoad.D3V1.homeFloor,
			nextLoad.QZ.homeFloor,
		),
	},
};

const historicalKeys = {
	Overall17First: "Overall17",
	U357First: "U357",
	B04: "B04",
} as const;
const detailedValue = (
	scheme: NextScheme,
	newValue: (active: "D3V1" | "QZ") => unknown,
	historicalValue: (historical: "Overall17" | "U357" | "B04") => unknown,
) => {
	if (scheme === "D3V1" || scheme === "QZ") return newValue(scheme);
	return historicalValue(historicalKeys[scheme]);
};
const nextWeightedNonfirstRates = Object.fromEntries(
	modes.map((mode) => [
		mode,
		Object.fromEntries(
			(["char", "word2", "word3", "word4"] as const).map((kind) => [
				kind,
				Object.fromEntries(
					nextSchemes.map((scheme) => [
						scheme,
						detailedValue(
							scheme,
							(active) =>
								nextCompletions[active].modes[mode][
									kind === "char" ? "character" : kind
								].selectionRate,
							(historical) =>
								data.weightedNonfirstRates[mode][kind][historical],
						),
					]),
				),
			]),
		),
	]),
);
const nextStagedResidualNonfirstRates = Object.fromEntries(
	modes.map((mode) => [
		mode,
		Object.fromEntries(
			(["char", "word2", "word3", "word4"] as const).map((kind) => [
				kind,
				Object.fromEntries(
					(
						[
							["afterZeroAux", "firstAuxRate"],
							["afterOneAux", "secondAuxRate"],
							["afterTwoAux", "selectionRate"],
						] as const
					).map(([stage, field]) => [
						stage,
						Object.fromEntries(
							nextSchemes.map((scheme) => [
								scheme,
								detailedValue(
									scheme,
									(active) =>
										nextCompletions[active].modes[mode][
											kind === "char" ? "character" : kind
										][field],
									(historical) =>
										data.stagedResidualNonfirstRates[mode][kind][stage][
											historical
										],
								),
							]),
						),
					]),
				),
			]),
		),
	]),
);
const nextTerminalWordCollisionBuckets = Object.fromEntries(
	modes.map((mode) => [
		mode,
		Object.fromEntries(
			(["word2", "word3", "word4"] as const).map((kind) => [
				kind,
				Object.fromEntries(
					nextSchemes.map((scheme) => [
						scheme,
						detailedValue(
							scheme,
							(active) => nextEntries[active].terminalBucketAudit[mode][kind],
							(historical) =>
								data.terminalWordCollisionBuckets[mode][kind][historical],
						),
					]),
				),
			]),
		),
	]),
);
const componentFor = (scheme: CompletionScheme) => {
	const firstAuxRate = weightedFor(scheme, (track) => track.firstAuxRate);
	const secondAuxRate = weightedFor(scheme, (track) => track.secondAuxRate);
	const selectionRate = weightedFor(scheme, (track) => track.selectionRate);
	const result = {
		motor: weightedFor(scheme, motor),
		firstAux: 300 * firstAuxRate,
		secondAux: 300 * secondAuxRate,
		selectionDecision: 600 * selectionRate,
		scan: 50 * weightedFor(scheme, (track) => track.meanRejectedCandidates),
		selectionAction: 0,
		page: 300 * weightedFor(scheme, (track) => track.meanPageActions),
	};
	return {
		...result,
		total: Object.values(result).reduce((sum, value) => sum + value, 0),
	};
};
const counterfactualFor = (scheme: CompletionScheme) => ({
	motorOnly: aggregateScoreFor(scheme, motor),
	motorAndAuxNoSelection: aggregateScoreFor(scheme, motorAndAux),
	fullExceptPageActionZero: aggregateScoreFor(scheme, fullWithoutPage),
	fullDefault: aggregateScoreFor(scheme, full),
});
const nextCktV4Explanation = {
	weightedMeanComponentsMs: Object.fromEntries(
		nextSchemes.map((scheme) => [
			scheme,
			detailedValue(
				scheme,
				(active) => componentFor(nextCompletions[active]),
				(historical) =>
					data.cktV4Explanation.weightedMeanComponentsMs[historical],
			),
		]),
	),
	counterfactualScores: Object.fromEntries(
		(
			[
				"motorOnly",
				"motorAndAuxNoSelection",
				"fullExceptPageActionZero",
				"fullDefault",
			] as const
		).map((key) => [
			key,
			Object.fromEntries(
				nextSchemes.map((scheme) => [
					scheme,
					detailedValue(
						scheme,
						(active) => counterfactualFor(nextCompletions[active])[key],
						(historical) =>
							data.cktV4Explanation.counterfactualScores[key][historical],
					),
				]),
			),
		]),
	),
};

data.nextGenerationComparison = {
	version: "shenyun-five-scheme-detailed-comparison-v2",
	rankedLayouts: [...nextSchemes],
	normalizationAnchor: "S005",
	schemes: Object.fromEntries(
		nextSchemes.map((scheme) => [scheme, { label: nextLabels[scheme] }]),
	),
	sources: {
		D3V1: {
			benchmarkId: d3Id,
			report:
				"research/notes/2026-11-09-d3v1-ckt-v51-soft-balance-aux-order-robustness.md",
		},
		QZ: {
			benchmarkId: qzId,
			report:
				"research/notes/2026-11-09-e8f37a-ckt-v51-aux-order-robustness.md",
		},
		Overall17First: { benchmarkId: overallId },
		U357First: { benchmarkId: benchmarkIds.U357 },
		B04: { benchmarkId: benchmarkIds.B04 },
	},
	auxiliaryOrders: {
		D3V1: d3Production.cktV51AuxOrderRobustness?.selectedPolicies,
		QZ: qzEntry.productionCandidateMetrics?.cktV51AuxOrderRobustness
			?.selectedPolicies,
		Overall17First: data.comparisonPolicy.cktV51.auxiliaryOrders.Overall17,
		U357First: data.comparisonPolicy.cktV51.auxiliaryOrders.U357,
		B04: data.comparisonPolicy.cktV51.auxiliaryOrders.B04,
	},
	metrics: nextMetrics,
	weightedNonfirstRates: nextWeightedNonfirstRates,
	stagedResidualNonfirstRates: nextStagedResidualNonfirstRates,
	terminalWordCollisionBuckets: nextTerminalWordCollisionBuckets,
	cktV4Explanation: nextCktV4Explanation,
};
cktV51.nextGeneration = {
	version: "next-generation-shuangpin-aux-order-appendix-v1",
	preservedHistoricalCases: true,
	schemes: {
		D3V1: {
			benchmarkId: d3Id,
			report:
				"research/notes/2026-11-09-d3v1-ckt-v51-soft-balance-aux-order-robustness.md",
			selectedPolicies: d3Production.cktV51AuxOrderRobustness?.selectedPolicies,
			robustness: d3Production.cktV51AuxOrderRobustness,
		},
		QZ: {
			benchmarkId: qzId,
			report:
				"research/notes/2026-11-09-e8f37a-ckt-v51-aux-order-robustness.md",
			selectedPolicies:
				qzEntry.productionCandidateMetrics?.cktV51AuxOrderRobustness
					?.selectedPolicies,
			robustness: qzEntry.productionCandidateMetrics?.cktV51AuxOrderRobustness,
		},
	},
};
const appendJsonProperty = (source: string, name: string, value: unknown) => {
	const marker = `,\n  "${name}": `;
	const markerIndex = source.indexOf(marker);
	let base =
		markerIndex >= 0
			? source.slice(0, markerIndex).trimEnd()
			: source.trimEnd().slice(0, -1).trimEnd();
	if (!base.endsWith("}"))
		throw new Error(`无法在 JSON 顶层追加 ${name}：末尾结构异常。`);
	const serialized = JSON.stringify(value, null, 2).replaceAll("\n", "\n  ");
	return `${base},\n  "${name}": ${serialized}\n}\n`;
};

const nextMetricDefinitions = [
	["M-R2 记忆项", "M-R2", "number", "越低越好", "min"],
	[
		"声母／韵母乱序度 D/V",
		"soundRhymeDisorder",
		"pair",
		"按 D+V 越低越好",
		"sum",
	],
	["FA-1 逻辑审计", "logicAuditFA1", "number", "越高越一致", "max"],
	["LU-v1r 逻辑均匀度", "logicUniformityLUv1r", "number", "越高越统一", "max"],
	[
		"Common399 唯一码／唯一率",
		"common399UniqueCodes",
		"unique-rate",
		"越高越好",
		"max",
	],
	[
		"Common399 重码桶",
		"common399CollisionBuckets",
		"integer",
		"越低越好",
		"min",
	],
	[
		"Common399 受影响音节",
		"common399AffectedSyllables",
		"integer",
		"越低越好",
		"min",
	],
	["频率加权 S2 miss", "s2FrequencyWeightedMiss", "percent", "越低越好", "min"],
	["S2 补全平均码长", "s2CompletionMeanKeys", "four", "越低越好", "min"],
	["S2 补全中心时间（ms）", "s2CompletionCenterMs", "three", "越低越好", "min"],
	[
		"S2 异键同指率",
		"s2DifferentKeySameFingerRate",
		"percent",
		"越低越好",
		"min",
	],
	["综合补全 CKT v3", "cktV3", "number", "越低越好", "min"],
	["综合补全 CKT v4", "cktV4", "number", "越低越好", "min"],
	["综合补全 CKT v5", "cktV5", "number", "越低越好", "min"],
	["综合补全 CKT v5.1", "cktV51", "number", "越低越好", "min"],
	["A7E-v3 系综当量", "ensembleV3", "number", "越低越好", "min"],
	["A7E-v4 系综当量", "ensembleV4", "number", "越低越好", "min"],
	["A7E-v5 系综当量", "ensembleV5", "number", "越低越好", "min"],
	["A7E-v6-CW150", "ensembleV6CW150", "number", "越低越好", "min"],
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
	["日常平均有效距离", "dailyMeanEffectiveDistance", "four", "越低越好", "min"],
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
	[
		"日常纯双拼移动手分数（含标点）",
		"dailyEightScenarioMovingHand",
		"three",
		"越高越好",
		"max",
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
] as const;
const nextMetricTable = table(
	["指标", ...nextSchemes.map((scheme) => nextLabels[scheme]), "何为好"],
	nextMetricDefinitions.map(([title, name, format, good, direction]) => {
		const metric = nextMetrics[name];
		const rawValues = nextSchemes.map((scheme) => metric[scheme]);
		const displays = rawValues.map((value) => {
			if (format === "pair") return (value as number[]).join(" / ");
			if (format === "percent") return percent(value as number);
			if (format === "integer") return String(value);
			if (format === "unique-rate")
				return `${value} / ${percent((value as number) / 399)}`;
			if (format === "three") return number(value as number, 3);
			return number(value as number);
		});
		return [
			title,
			...decorateComparison(
				displays.map((display, index) => ({
					display,
					score: rawValues[index],
				})),
				direction,
				5,
			),
			good,
		];
	}),
);
const decorateNext = (
	displays: string[],
	values: Array<number | number[]>,
	direction: ComparisonDirection,
) =>
	decorateComparison(
		displays.map((display, index) => ({ display, score: values[index] })),
		direction,
		5,
	);
const nextRateRows: string[][] = [];
const nextStagedRows: string[][] = [];
const nextBucketRows: string[][] = [];
for (const mode of modes) {
	for (const kind of ["char", "word2", "word3", "word4"] as const) {
		const rateValues = nextSchemes.map(
			(scheme) => nextWeightedNonfirstRates[mode][kind][scheme] as number,
		);
		nextRateRows.push([
			trackNames[mode],
			kindNames[kind],
			...decorateNext(
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
			const values = nextSchemes.map(
				(scheme) =>
					nextStagedResidualNonfirstRates[mode][kind][stage][scheme] as number,
			);
			nextStagedRows.push([
				trackNames[mode],
				kindNames[kind],
				stageName,
				...decorateNext(
					values.map((value) => percent(value)),
					values,
					"min",
				),
			]);
		}
		if (kind !== "char") {
			nextBucketRows.push([
				trackNames[mode],
				kindNames[kind],
				...nextSchemes.map((scheme) => {
					const value = nextTerminalWordCollisionBuckets[mode][kind][scheme];
					return `${value.buckets}／${value.residualEntries}／${value.crossLengthBuckets}／${value.maxBucketSize}`;
				}),
			]);
		}
	}
}
const nextComponentDecorations = Object.fromEntries(
	componentNames.map(([key]) => {
		const values = nextSchemes.map(
			(scheme) =>
				nextCktV4Explanation.weightedMeanComponentsMs[scheme][key] as number,
		);
		return [
			key,
			decorateNext(
				values.map((value) => number(value, key === "page" ? 4 : 3)),
				values,
				"min",
			),
		];
	}),
) as Record<(typeof componentNames)[number][0], string[]>;
const nextComponentTable = table(
	["方案", ...componentNames.map(([, label]) => `${label}（ms）`)],
	nextSchemes.map((scheme, schemeIndex) => [
		nextLabels[scheme],
		...componentNames.map(
			([key]) => nextComponentDecorations[key][schemeIndex],
		),
	]),
);
const nextCounterfactualTable = table(
	["CKT v4 情景", ...nextSchemes.map((scheme) => nextLabels[scheme])],
	counterfactuals.map(([key, label]) => {
		const values = nextSchemes.map(
			(scheme) =>
				nextCktV4Explanation.counterfactualScores[key][scheme] as number,
		);
		return [
			label,
			...decorateNext(
				values.map((value) => number(value)),
				values,
				"min",
			),
		];
	}),
);

const historicalReport = `# 神韵两代布局与 S005、B04 四方案比较

方案来源：神韵(Overall-17) 21×26 双拼出自 \`production/ckt-v4-2126-strict-d0-20261030\` 分支的提交 \`7a7e154\`；无飞键道(U357) 21×21 双拼出自 \`production/ckt-v4-2121-strict-avuio-20261024\` 分支的提交 \`11713b6\`。方案名分别链接到对应固定提交的最终报告，报告记录了搜索过程、候选取舍和定稿映射。

本文把两个现行专有名词置于同等地位：**无飞键道(U357) 21×21 双拼**与**神韵(Overall-17) 21×26 双拼**。另以星空键道 S005、首道 B04 为参照。四方案共用 Common399、冻结 20 合同、同一字词与形码数据、CKT v4 模型及日常八场景文稿。

必须同时注意合同边界：无飞键道(U357)与 S005 按传统 21×21 合同计分；神韵(Overall-17)原生遵循飞花式四码顶；B04 采用原资料记录的 \`AEUIO\` 形辅与 \`IEUAO\` 调辅，本报告为其套用同一飞花式四码顶路由和统一字形／笔画源。21×26／26×26 相比 21×21 扩大了韵码域，不能把跨键域领先直接解释成同键域映射胜负。

表中在神韵(Overall-17)、无飞键道(U357)与原键道 S005 三个方案间拉通排名：第 1 名数值加粗并标 ★★，第 2 名数值加粗并标 ★，第 3 名不加粗、不标星；首道 B04 不参与三方案名次。🥇 独立比较全部四方案，可以与星标同时出现在同一单元格。并列采用竞赛排名，例如并列第 1 名后的下一名为第 3 名；并列单元格使用相同格式。

## 总览

${metricTable}

“声母／韵母乱序度 D/V”沿用 benchmark 的移位口径：D 统计普通声母未落在同名字母键上的数量；V 统计基础韵母 \`a/e/i/o/u\` 未落在 \`A/E/I/O/U\` 原键上的数量。两项分别列出，均越低越接近字母原键，表中按 D+V 合计排名；它与按实际二键码统计的飞键不是同一指标。

“S2 异键同指率”统计 S2 相邻键对中“两键不同、但由同一物理手指负责”的码内与边界频率权重，再除以全部键对权重；同键重复另计，不包含在此项中。

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

- 神韵(Overall-17)以 21×26 声韵域实现 Common399 399 个唯一码、[M-R2](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md)＝36，并采用飞花式四码顶；它在现行 CKT v4 中与 B04 接近，同时保持零飞键，但日常文稿移动手分数及主键区指标不如无飞键道(U357)。
- 无飞键道(U357)在 21×21 键域中保留 42 个音节重码桶，换来更高的日常纯双拼移动手分数、较高主键区占比和较低最大单指峰值；它与 S005 才是直接的同键域比较。
- B04 的 26×26 大码域、原资料记录的辅键映射以及本报告套用的飞花式四码顶路由带来零音节重码及较低补全成本；这不是 B04 原方案的顶功声明，其飞键、记忆项和日常路径指标也采用另一种取舍。
- 所有模型分数都用于同语料、同模型横向复算，不等同真人输入速度。

机器可复核数据见 [\`shenyun-comparison.json\`](shenyun-comparison.json)。神韵(Overall-17)的底层方案 ID 为 \`${overallId}\`。两代方案的来源、得来过程与定稿映射以上述固定提交报告为准。
`;

const report = `${historicalReport}
## 次世代布局追加对比

上面的历史四方案报告原样保留。本节追加当前 D3/V1 21×26 与 QZ-e8f37a 21×21，并把已经冻结的 Overall-17 与 U357 明确标为“·初代”。以下所有表格统一比较 D3/V1、QZ-e8f37a、Overall-17·初代、U357·初代与首道 B04 五个方案；S005 仅继续充当 CKT 归一化锚点，不占五方案展示列。五方案拉通排名，第 1 名标 ★★，第 2 名标 ★，全列最佳同时标 🥇。

D3/V1 的定稿与稳健辅序见 [\`2026-11-09-d3v1-ckt-v51-soft-balance-aux-order-robustness.md\`](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/research/notes/2026-11-09-d3v1-ckt-v51-soft-balance-aux-order-robustness.md)，QZ-e8f37a 的定稿与稳健辅序见 [\`2026-11-09-e8f37a-ckt-v51-aux-order-robustness.md\`](https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/research/notes/2026-11-09-e8f37a-ckt-v51-aux-order-robustness.md)。D3/V1 的冰雪简道／冰雪散拼辅序为 \`12/12/24\`、\`12/21/13\`；QZ-e8f37a 的冰雪健道／冰雪弎拼辅序为 \`12/213/24\`、\`12/213/23\`。初代方案继续使用历史报告中冻结的映射与辅序。

${nextMetricTable}

这里的全部总览值均直接取自同一份 \`a7_CKT_R11.html\` 冻结 payload；初代与 B04 数值沿用上方历史快照。五个方案跨 21×21、21×26 与 26×26 键域，表中排名用于同语料复算，不把跨键域差异解释为同键域映射的单变量胜负。

### 五方案 CKT v4 成本分解

${nextComponentTable}

${nextCounterfactualTable}

### 五方案冻结语料加权非首选率

${table(["编码轨", "词长", ...nextSchemes.map((scheme) => nextLabels[scheme])], nextRateRows)}

### 五方案逐级辅键后的频率加权残余非首选率

“零辅后”是裸编码后仍需第一辅键的权重；“一辅后”是第一辅键后仍需第二辅键的权重；“二辅后”是第二辅键后仍需人工选重的权重。本节沿用 CKT v4 的两级辅键观察面，CKT v5.1 的三字词第三辅另见稳健辅序报告。

${table(["编码轨", "词长", "阶段", ...nextSchemes.map((scheme) => nextLabels[scheme])], nextStagedRows)}

### 五方案二／三／四字词终局碰撞桶

单元格依次为“碰撞桶数／残余条目数／跨词长桶数／最大桶成员数”。不同合同的共享池结构不同，复合单元格不标单一胜负。

${table(["编码轨", "词长", ...nextSchemes.map((scheme) => nextLabels[scheme])], nextBucketRows)}
`;

writeFileSync(jsonPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
writeFileSync(
	cktV51Path,
	appendJsonProperty(cktV51Text, "nextGeneration", cktV51.nextGeneration),
	"utf8",
);
writeFileSync(reportPath, linkShenyunTerms(report, "zh", "github"), "utf8");
console.log(`已生成 ${reportPath}\n已生成 ${jsonPath}\n已生成 ${cktV51Path}`);
