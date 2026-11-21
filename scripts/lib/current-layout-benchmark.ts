import { createHash } from "node:crypto";
import {
	appendFileSync,
	existsSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { gunzipSync } from "node:zlib";
import { rootPath } from "./paths";

// biome-ignore-all lint/suspicious/noExplicitAny: 外部 benchmark 的各代合同是异构 JSON；冻结原始字段并逐项核对生产合同。
export type BenchmarkSnapshot = Record<string, any>;
export type BenchmarkLanguage = "zh" | "en" | "zht";
export type BenchmarkRow = readonly [
	string,
	Record<BenchmarkLanguage, string>,
	Record<BenchmarkLanguage, string>,
	string,
];

export const currentLayoutIds = {
	RC26: "RC26-39a5bfdc045342cd",
	OC21: "UED-3158ce08b5bc",
	Overall17First: "SNOW-SHENYUN-21X26-PRODUCTION",
	U357First: "gen0107-p5-f1h-11_13-d2-f25_26-d3-f4_22-d4-f11_13",
	S005: "S005",
	B04: "B04",
	Liandao: "CR-REF-7e650f7a4c",
	Zhudao: "T2126-V52-M4-ec60a3637a99",
} as const;

export const currentLayoutLabels: Record<string, string> = {
	RC26: "RC26-39a5bfdc045342cd 21×26",
	OC21: "UED-3158ce08b5bc 21×21",
	Overall17First: "Overall-17·初代 21×26",
	U357First: "U357·初代 21×21",
	S005: "原键道 S005",
	B04: "首道 B04",
	Liandao: "冰雪莲道 CR-REF-7e650f7a4c 21×21",
	Zhudao: "冰雪鹮道 T2126-V52-M4-ec60a3637a99 21×26",
};

const kinds = ["character", "word2", "word3", "word4"] as const;
const weights = { character: 1, word2: 3, word3: 1, word4: 1 };
const hash = (value: string | Buffer) =>
	createHash("sha256").update(value).digest("hex");
const average = (modes: any, field: string) => {
	const tracks = Object.values(modes) as any[];
	return (
		tracks.reduce(
			(sum, mode) =>
				sum +
				kinds.reduce(
					(n, kind) =>
						n +
						weights[kind] *
							(field === "cognitiveMs"
								? mode[kind].effectiveMs - mode[kind].motorUpperMs
								: (mode[kind][field] ?? 0)),
					0,
				),
			0,
		) /
		(6 * tracks.length)
	);
};

// 与页面 tonedGeneralizedScore 一致；每条轨分别相对 S005，不能先平均耗时再相除。
export function normalizedCostScore(
	modes: any,
	reference: any,
	multiplier = 1,
) {
	let sum = 0;
	let total = 0;
	for (const [mode, tracks] of Object.entries(modes) as [string, any][]) {
		for (const kind of kinds) {
			const cost = (track: any) =>
				track.motorUpperMs +
				multiplier * (track.effectiveMs - track.motorUpperMs);
			sum +=
				weights[kind] * (cost(tracks[kind]) / cost(reference[mode][kind])) ** 4;
			total += weights[kind];
		}
	}
	return 10 * (sum / total) ** 0.25;
}

function adaptedCompletionScore(
	candidate: any,
	reference: any,
	cognitive?: any,
) {
	let sum = 0;
	for (const mode of ["keytao", "sanpin"]) {
		for (const kind of kinds) {
			const time = (track: any) => {
				const first = track.firstAuxRate ?? 1 - track.stageWeight[0];
				const second =
					track.secondAuxRate ??
					Math.max(
						0,
						track.meanKeys -
							(kind === "character" ? 2 : kind === "word3" ? 3 : 4) -
							first,
					);
				const miss = track.selectionRate ?? track.p2;
				return (
					(track.motorUpperMs ?? track.completionUpperMs) +
					600 * miss +
					300 * (first + second) +
					(cognitive
						? cognitive.selectionActionMs * miss +
							cognitive.scanPerCandidateMs *
								(track.meanRejectedCandidates ?? 0) +
							cognitive.pageActionMs * (track.meanPageActions ?? 0)
						: 0)
				);
			};
			sum +=
				weights[kind] *
				(time(candidate[mode][kind]) / time(reference[mode][kind])) ** 4;
		}
	}
	return 10 * (sum / 12) ** 0.25;
}

function numeric(value: unknown, label: string): number {
	if (typeof value !== "number" || !Number.isFinite(value))
		throw new Error(`${label} 缺少有限数值`);
	return value;
}

// 页面 filterRowsPacked 冻结的是实际停止补辅后的终局码。按原生四轨
// 1:3:1:1 汇总期望键数及码内键对，沿用页面 aggregateCodes 的计数口径。
function tonedTerminalErgonomics(tone: any, payload: any) {
	const sums = Object.fromEntries(
		kinds.map((kind) => [
			kind,
			{
				weight: 0,
				keys: {} as Record<string, number>,
				pairs: {} as Record<string, number>,
			},
		]),
	);
	const add = (row: any[]) => {
		const [, , , rawCode, weight, kind] = row;
		const code = rawCode.toUpperCase();
		const sum = sums[kind as keyof typeof sums];
		sum.weight += weight;
		for (const key of code) sum.keys[key] = (sum.keys[key] ?? 0) + weight;
		for (let i = 1; i < code.length; i++) {
			const pair = code.slice(i - 1, i + 1);
			sum.pairs[pair] = (sum.pairs[pair] ?? 0) + weight;
		}
	};
	if (tone.filterRows) for (const row of tone.filterRows) add(row);
	else
		for (const row of tone.filterRowsPacked.rows) {
			const [text, reading, weight, kind] =
				payload.tonedFilterRowPool.rows[row[0]];
			add([text, reading, row[1], row[2], weight, kind]);
		}
	const keys: Record<string, number> = {},
		pairs: Record<string, number> = {};
	for (const kind of kinds) {
		const sum = sums[kind];
		const mean =
			Object.values(sum.keys).reduce((a, b) => a + b, 0) / sum.weight;
		if (Math.abs(mean - tone.ckt.v52.tracks[kind].meanKeys) > 1e-9)
			throw new Error(`${tone.id}/${kind} 终局按键数不一致`);
		for (const [source, target] of [
			[sum.keys, keys],
			[sum.pairs, pairs],
		])
			for (const [key, count] of Object.entries(source))
				target[key] =
					(target[key] ?? 0) + (weights[kind] * count) / (6 * sum.weight);
	}
	const meanKeys = Object.values(keys).reduce((a, b) => a + b, 0);
	const meanPairs = Object.values(pairs).reduce((a, b) => a + b, 0);
	const groups = [
		"QAZ",
		"WSX",
		"EDC",
		"RFVTGB",
		"YHNUJM",
		"IK,",
		"OL.",
		"P;/[]\\'",
	];
	const finger = (key: string) => {
		const index = groups.findIndex((group) => group.includes(key));
		if (index < 0) throw new Error(`未知终局按键 ${key}`);
		return index;
	};
	const share = (group: string) =>
		[...group].reduce((n, key) => n + (keys[key] ?? 0), 0) / meanKeys;
	const fingers = groups.map(share);
	let sameFinger = 0,
		differentKeySameFinger = 0,
		sameHand = 0;
	for (const [pair, mass] of Object.entries(pairs)) {
		if (finger(pair[0]) === finger(pair[1])) {
			sameFinger += mass;
			if (pair[0] !== pair[1]) differentKeySameFinger += mass;
		}
		if (finger(pair[0]) < 4 === finger(pair[1]) < 4) sameHand += mass;
	}
	return {
		meanKeys,
		home: share("ASDFGHJKL;'"),
		upper: share("QWERTYUIOP[]\\"),
		lower: share("ZXCVBNM,./"),
		leftPinky: fingers[0],
		rightPinky: fingers[7],
		maxFinger: Math.max(...fingers),
		leftShare: fingers.slice(0, 4).reduce((a, b) => a + b, 0),
		differentKeySameFinger: differentKeySameFinger / meanPairs,
		sameFinger: sameFinger / meanPairs,
		sameHand: sameHand / meanPairs,
		alternation: 1 - sameHand / meanPairs,
		sufficientStatistics: { keys, pairs, meanKeys, meanPairs },
		source:
			"filterRowsPacked; native shape-only 1:3:1:1; within-code pairs; no spaces, selection/page keys or corrected-error strokes",
	};
}

export function buildCurrentBenchmark(
	payload: any,
	sourceSha256: string,
	historical: any,
): BenchmarkSnapshot {
	const metrics: Record<string, any> = {};
	const contracts: Record<string, any> = {};
	const native: Record<string, any> = {};
	const details: Record<string, any> = {};
	const put = (key: string, scheme: string, value: unknown) => {
		metrics[key] ??= {};
		metrics[key][scheme] = value ?? null;
	};
	for (const [scheme, id] of Object.entries(currentLayoutIds)) {
		const toned = scheme === "Liandao" || scheme === "Zhudao";
		const entry = payload.entries.find((entry: any) => entry.id === id);
		const tone =
			payload.toned?.[id] ??
			payload.tonedContractBenchmark?.schemes.research[id];
		const v52 = payload.cktV52.schemes[id];
		const columns = tone?.columns;
		const production = entry?.productionCandidateMetrics;
		if (toned && !tone) throw new Error(`缺少带调布局 ${id}`);
		if (!toned && !entry) throw new Error(`缺少无调布局 ${id}`);
		const modes =
			v52?.v52.modes ??
			(scheme === "S005" ? payload.cktV52.references.v52 : null);
		const aggregate = modes
			? Object.fromEntries(
					[
						"motorUpperMs",
						"effectiveMs",
						"cognitiveMs",
						"firstAuxRate",
						"secondAuxRate",
						"thirdAuxRate",
						"selectionRate",
						"meanRejectedCandidates",
						"meanPageActions",
						"meanKeys",
					].map((field) => [field, average(modes, field)]),
				)
			: null;
		contracts[scheme] = v52?.contract ?? {
			source: "historical",
			policies:
				historical.comparisonPolicy.cktV51.auxiliaryOrders[
					scheme === "Overall17First"
						? "Overall17"
						: scheme === "U357First"
							? "U357"
							: scheme
				],
		};
		if (toned) {
			native[scheme] = {
				memory: tone.memory,
				inventory: tone.inventory,
				contract: tone.contract,
				policy: tone.publication?.wordAuxiliaryPolicy,
				columnsPolicy: columns.policy,
			};
			put("M-R2", scheme, `${tone.memory.lower} / ${tone.memory.guard} (M-T1)`);
			put(
				"initialDisorderAIDV",
				scheme,
				`D=${tone.memory.D} / V=${columns.rules.V}`,
			);
			put("flyingKeyComponents", scheme, [0, 0, 0]);
			put("logicAuditFA1", scheme, columns.rules.fa.score);
			put("logicUniformityLUv1r", scheme, columns.rules.lu.score);
			const buckets = new Map<string, number>();
			for (const code of (
				Object.values(tone.tonedCodes) as (string | null)[][]
			).flat()) {
				if (code !== null) buckets.set(code, (buckets.get(code) ?? 0) + 1);
			}
			if (
				buckets.size !== tone.inventory.occupiedBuckets ||
				[...buckets.values()].reduce((a, b) => a + b, 0) !==
					tone.inventory.legalTonedSyllables
			)
				throw new Error(`${id} 带调音节域与码桶清点不一致`);
			const collision = [...buckets.values()].filter((n) => n > 1);
			put("common399UniqueCodes", scheme, tone.inventory.occupiedBuckets);
			put(
				"common399UniqueRate",
				scheme,
				tone.inventory.occupiedBuckets / tone.inventory.legalTonedSyllables,
			);
			put("common399CollisionBuckets", scheme, collision.length);
			put(
				"common399AffectedSyllables",
				scheme,
				collision.reduce((a, b) => a + b, 0),
			);
			put(
				"common399AffectedRate",
				scheme,
				collision.reduce((a, b) => a + b, 0) /
					tone.inventory.legalTonedSyllables,
			);
			put("s2FrequencyWeightedMiss", scheme, columns.tracks.S2.miss);
			put("s2CompletionMeanKeys", scheme, columns.sound.meanKeys);
			put("s2CompletionCenterMs", scheme, columns.sound.upperMs);
			put("s2DifferentKeySameFingerRate", scheme, columns.tracks.S2.sfb);
			put(
				"cktV3",
				scheme,
				adaptedCompletionScore(
					columns.completion.independent.v3,
					payload.completionBV3.schemes.S005.modes,
				),
			);
			put(
				"cktV4",
				scheme,
				adaptedCompletionScore(
					columns.completion.modern,
					payload.completionBV4.schemes.S005.modes,
					payload.completionBV4.cognitiveDefaults,
				),
			);
			put("cktV5", scheme, tone.ckt.v5.score);
			put("cktV51", scheme, tone.ckt.v51.score);
			for (const version of [3, 4, 5])
				put(`ensembleV${version}`, scheme, columns.ensemble[`v${version}`]);
			put("ensembleV6CW150", scheme, columns.ensemble.v6);
			for (const [key, field] of Object.entries({
				leftPinkyQAZPeak20Contracts: "leftPinkyMax20",
				rightPinkyPeak20Contracts: "rightPinkyMax20",
				maxFingerPeak20Contracts: "maxFinger20",
				indexFingerTYBPeak20Contracts: "indexFingerTYBMax20",
				homeFloor20Contracts: "homeFloor",
				homeShareS2: "homeS2",
			}))
				put(key, scheme, columns.load[field]);
			details[scheme] = {
				adaptedV4: columns.completion.modern,
				collision: columns.collision,
				nativeErgonomics: tone.ergonomics,
			};
		} else {
			// 只在新快照中重取当前 HTML 的指标，绝不覆盖旧报告字段。
			const legacyKey =
				scheme === "Overall17First"
					? "Overall17"
					: scheme === "U357First"
						? "U357"
						: scheme;
			for (const [key, metric] of Object.entries(
				historical.nextGenerationComparison.metrics,
			) as [string, any][])
				put(key, scheme, metric[scheme]);
			if (scheme === "RC26" || scheme === "OC21") {
				for (const version of [3, 4, 5, 51])
					put(`cktV${version}`, scheme, production[`replayedCktV${version}`]);
			}
			put("M-R2", scheme, entry.memoryAuditR2.M);
			put("logicAuditFA1", scheme, entry.logicAudit.score);
			put("logicUniformityLUv1r", scheme, entry.logicUniformity.score);
			const collision = Object.values(
				entry.memoryAuditR2.collisionBuckets,
			) as string[][];
			put("common399UniqueCodes", scheme, entry.memoryAuditR2.unique);
			put("common399UniqueRate", scheme, entry.memoryAuditR2.unique / 399);
			put("common399CollisionBuckets", scheme, collision.length);
			put(
				"common399AffectedSyllables",
				scheme,
				collision.reduce((sum, bucket) => sum + bucket.length, 0),
			);
			put(
				"common399AffectedRate",
				scheme,
				metrics.common399AffectedSyllables[scheme] / 399,
			);
			const fair = payload.fairCKT.values[id];
			put("s2FrequencyWeightedMiss", scheme, fair.S2miss);
			put("s2CompletionMeanKeys", scheme, fair.S2Completion.meanKeys);
			put("s2CompletionCenterMs", scheme, fair.S2Completion.centerMs);
			put(
				"s2DifferentKeySameFingerRate",
				scheme,
				payload.ckt.tracks[id].S2.sfb,
			);
			for (const version of [3, 4, 5, 6])
				put(
					version === 6 ? "ensembleV6CW150" : `ensembleV${version}`,
					scheme,
					payload[`ensembleV${version}`].values[id].score,
				);
			const load = payload.r11LoadSummaries[id];
			for (const [key, field] of Object.entries({
				rightPinkyPeak20Contracts: "rightPinkyMax20",
				maxFingerPeak20Contracts: "maxFinger20",
				homeFloor20Contracts: "homeFloor",
				homeShareS2: "homeS2",
			}))
				put(key, scheme, load[field]);
			for (const [key, group] of [
				["leftPinkyQAZPeak20Contracts", "QAZ"],
				["indexFingerTYBPeak20Contracts", "TYB"],
			]) {
				put(
					key,
					scheme,
					Math.max(
						...Object.values(payload.ckt.tracks[id]).map((track: any) =>
							[...group].reduce(
								(sum, char) => sum + track.load[payload.ckt.keys.indexOf(char)],
								0,
							),
						),
					),
				);
			}
			details[scheme] = {
				adaptedV4: payload.completionBV4.schemes[id].modes,
				legacyKey,
				terminalErgonomics: production?.cktV52Ergonomics,
				collisionRates: production?.cktV52CollisionRates,
			};
		}
		const macro = (toned ? tone.macro : payload.macroxue.values[id])[
			"daily|native-punctuation"
		];
		if (toned)
			native[scheme].dailyHeat = {
				hits: macro.hits,
				heat_map: macro.heat_map,
				toneSource: macro.toneSource,
				strokeSha256: macro.strokeSha256,
				shapeIncluded: macro.shapeIncluded,
				spaceIncluded: macro.spaceIncluded,
				selectionIncluded: macro.selectionIncluded,
			};
		if (
			macro.hits !== 2149 ||
			Object.values(macro.heat_map).reduce((a: number, b: any) => a + b, 0) !==
				2149
		)
			throw new Error(`${id} 日常语料键频不完整`);
		put("dailyLeftRightLoad", scheme, {
			left: macro.left_load,
			right: macro.right_load,
			leftShare: macro.left_load / macro.hits,
		});
		put("dailySameHandRate", scheme, macro.same_hand_rate);
		put("dailyMeanEffectiveDistance", scheme, macro.avg_effective_distance);
		put("dailyEightScenarioMovingHand", scheme, macro.score);
		put(
			"legalSyllables",
			scheme,
			toned ? tone.inventory.legalTonedSyllables : 399,
		);
		put(
			"staticVacancies",
			scheme,
			toned
				? tone.inventory.emptyBuckets
				: entry.capacity[0] * entry.capacity[1] - entry.memoryAuditR2.unique,
		);
		if (modes) {
			const expected = scheme === "S005" ? 10 : v52.v52.score;
			const actual = normalizedCostScore(modes, payload.cktV52.references.v52);
			if (Math.abs(expected - actual) > 1e-9)
				throw new Error(
					`${id} CKT v5.2 逐轨归一化不一致：${actual} != ${expected}`,
				);
			put("cktV52", scheme, actual);
			for (const [multiplier, field] of [
				[2, "Doubled"],
				[3, "Tripled"],
				[5, "Quintupled"],
			] as const)
				put(
					`cktV52Cost${field}`,
					scheme,
					normalizedCostScore(modes, payload.cktV52.references.v52, multiplier),
				);
			for (const [field, value] of Object.entries(aggregate!))
				put(`v52${field[0].toUpperCase()}${field.slice(1)}`, scheme, value);
			details[scheme].v52 = modes;
			details[scheme].v52Scores = v52?.v52.trackScores;
		}
		const ergonomic = toned
			? tonedTerminalErgonomics(tone, payload)
			: production?.cktV52Ergonomics;
		if (toned) details[scheme].terminalErgonomics = ergonomic;
		for (const [field, key] of Object.entries({
			home: "terminalHome",
			upper: "terminalUpper",
			lower: "terminalLower",
			leftPinky: "terminalLeftPinky",
			rightPinky: "terminalRightPinky",
			maxFinger: "terminalMaxFinger",
			leftShare: "terminalLeftShare",
			differentKeySameFinger: "terminalDifferentKeySameFinger",
			sameFinger: "terminalSameFinger",
			sameHand: "terminalSameHand",
			alternation: "terminalAlternation",
		}))
			put(key, scheme, ergonomic?.[field]);
		const collision = toned ? columns.collision : entry?.fourCodeCollision;
		details[scheme].fourCodeCollision = collision ?? null;
		put(
			"fourCodeCrossAffected",
			scheme,
			collision?.fiveCutAverageCrossAffectedRate,
		);
		put(
			"fourCodeCrossFirstChoiceLoss",
			scheme,
			collision?.fiveCutAverageCrossFirstChoiceLossRate,
		);
		put(
			"v52PointOptimalDefault",
			scheme,
			production?.cktV52DefaultPointOptimal?.score,
		);
		put(
			"v52PointOptimalDoubled",
			scheme,
			production?.cktV52DoubledPointOptimal?.score,
		);
		if (toned) {
			for (const [field, key] of Object.entries({
				homeFloor4NativeTracks: "nativeHomeFloor",
				leftPinkyQAZPeak4NativeTracks: "nativeLeftPinkyPeak",
				rightPinkyPeak4NativeTracks: "nativeRightPinkyPeak",
				maxFingerPeak4NativeTracks: "nativeMaxFingerPeak",
				indexFingerTYBPeak4NativeTracks: "nativeTYBPeak",
			})) {
				const value = tone.ergonomics[field];
				put(key, scheme, typeof value === "number" ? value : value?.value);
			}
		}
	}
	// 缺测是显式 null，不用上一代分数填补 v5.2。
	for (const row of Object.values(metrics))
		for (const scheme of Object.keys(currentLayoutIds)) row[scheme] ??= null;
	const mappingFiles = [
		"config/shenyun-21x26-mapping.json",
		"config/shenyun-21x21-mapping.json",
		"config/snow-jiandao-toned-mapping.json",
		"config/snow-zhudao-mapping.json",
	];
	const inputs = Object.fromEntries(
		mappingFiles.map((file) => [file, hash(readFileSync(rootPath(file)))]),
	);
	return {
		version: "current-layout-benchmark-v1",
		date: "2026-11-21",
		sourceSha256,
		inputs,
		layoutIds: currentLayoutIds,
		contracts,
		native,
		metrics,
		details,
		legacyDetails: historical.nextGenerationComparison,
		v52Definition: payload.cktV52.definition,
		references: payload.cktV52.references,
		sourcePolicy:
			"a7_CKT_R11.html 原列公式适配；带调主码＋纯形辅与无调形/调辅系综跨合同列示；S005 v5.2 为逐轨归一化锚点10；缺测保留null",
	};
}

function row(
	key: string,
	zh: string,
	en: string,
	zht: string,
	format = "six",
	good = "min",
): BenchmarkRow {
	const directions = {
		max: { zh: "越高越好", en: "Higher", zht: "越高越好" },
		min: { zh: "越低越好", en: "Lower", zht: "越低越好" },
		observe: {
			zh: "观察分布，不单独判优",
			en: "Distribution only",
			zht: "觀察分布，不單獨判優",
		},
		balance: {
			zh: "越接近 50% 越平衡",
			en: "Closer to 50%",
			zht: "越接近 50% 越平衡",
		},
	};
	return [
		key,
		{ zh, en, zht },
		directions[good as keyof typeof directions],
		format,
	];
}

export const additionalBenchmarkRows: BenchmarkRow[] = [
	row(
		"legalSyllables",
		"音节域大小（无调／带调）",
		"Inventory size (untoned / toned)",
		"音節域大小（無調／帶調）",
		"integer",
		"observe",
	),
	row(
		"staticVacancies",
		"静态空码（399／1407 音节域）",
		"Static vacancies (399 / 1407 inventory)",
		"靜態空碼（399／1407 音節域）",
		"integer",
		"max",
	),
	row(
		"cktV52",
		"综合补全 CKT v5.2",
		"CKT v5.2 completion",
		"綜合補全 CKT v5.2",
	),
	row(
		"cktV52CostDoubled",
		"CKT v5.2 认知成本 ×2",
		"CKT v5.2 cognitive costs ×2",
		"CKT v5.2 認知成本 ×2",
	),
	row(
		"cktV52CostTripled",
		"CKT v5.2 认知成本 ×3",
		"CKT v5.2 cognitive costs ×3",
		"CKT v5.2 認知成本 ×3",
	),
	row(
		"cktV52CostQuintupled",
		"CKT v5.2 认知成本 ×5",
		"CKT v5.2 cognitive costs ×5",
		"CKT v5.2 認知成本 ×5",
	),
	row(
		"v52MotorUpperMs",
		"v5.2 加权运动耗时（ms）",
		"v5.2 weighted motor time (ms)",
		"v5.2 加權運動耗時（ms）",
		"three",
	),
	row(
		"v52CognitiveMs",
		"v5.2 加权认知耗时（ms）",
		"v5.2 weighted cognitive time (ms)",
		"v5.2 加權認知耗時（ms）",
		"three",
	),
	row(
		"v52EffectiveMs",
		"v5.2 加权有效耗时（ms）",
		"v5.2 weighted effective time (ms)",
		"v5.2 加權有效耗時（ms）",
		"three",
	),
	row(
		"v52FirstAuxRate",
		"v5.2 第一辅键率",
		"v5.2 first auxiliary rate",
		"v5.2 第一輔鍵率",
		"percent",
	),
	row(
		"v52SecondAuxRate",
		"v5.2 第二辅键率",
		"v5.2 second auxiliary rate",
		"v5.2 第二輔鍵率",
		"percent",
	),
	row(
		"v52ThirdAuxRate",
		"v5.2 第三辅键率",
		"v5.2 third auxiliary rate",
		"v5.2 第三輔鍵率",
		"percent",
	),
	row(
		"v52SelectionRate",
		"v5.2 终局选重率",
		"v5.2 terminal selection rate",
		"v5.2 終局選重率",
		"percent",
	),
	row(
		"v52MeanRejectedCandidates",
		"v5.2 平均扫描排除候选数",
		"v5.2 mean rejected candidates",
		"v5.2 平均掃描排除候選數",
	),
	row(
		"v52MeanPageActions",
		"v5.2 平均翻页次数",
		"v5.2 mean page actions",
		"v5.2 平均翻頁次數",
	),
	row(
		"v52MeanKeys",
		"v5.2 平均编码按键数",
		"v5.2 mean code keys",
		"v5.2 平均編碼按鍵數",
	),
	row(
		"v52PointOptimalDefault",
		"v5.2 单倍成本点最优（非生产辅序）",
		"v5.2 point optimum ×1 (not production)",
		"v5.2 單倍成本點最優（非生產輔序）",
	),
	row(
		"v52PointOptimalDoubled",
		"v5.2 加倍成本点最优（非生产辅序）",
		"v5.2 point optimum ×2 (not production)",
		"v5.2 加倍成本點最優（非生產輔序）",
	),
	row(
		"terminalHome",
		"v5.2 终局主键区占比",
		"v5.2 terminal home-row share",
		"v5.2 終局主鍵區占比",
		"percent",
		"max",
	),
	row(
		"terminalUpper",
		"v5.2 终局上排占比",
		"v5.2 terminal upper-row share",
		"v5.2 終局上排占比",
		"percent",
		"observe",
	),
	row(
		"terminalLower",
		"v5.2 终局下排占比",
		"v5.2 terminal lower-row share",
		"v5.2 終局下排占比",
		"percent",
		"observe",
	),
	row(
		"terminalLeftPinky",
		"v5.2 终局左小指负载",
		"v5.2 terminal left-pinky load",
		"v5.2 終局左小指負載",
		"percent",
	),
	row(
		"terminalRightPinky",
		"v5.2 终局右小指负载",
		"v5.2 terminal right-pinky load",
		"v5.2 終局右小指負載",
		"percent",
	),
	row(
		"terminalMaxFinger",
		"v5.2 终局最大单指负载",
		"v5.2 terminal maximum finger load",
		"v5.2 終局最大單指負載",
		"percent",
	),
	row(
		"terminalLeftShare",
		"v5.2 终局左手占比",
		"v5.2 terminal left-hand share",
		"v5.2 終局左手占比",
		"percent",
		"balance",
	),
	row(
		"terminalDifferentKeySameFinger",
		"v5.2 终局异键同指率",
		"v5.2 terminal different-key same-finger rate",
		"v5.2 終局異鍵同指率",
		"percent",
	),
	row(
		"terminalSameFinger",
		"v5.2 终局同指率",
		"v5.2 terminal same-finger rate",
		"v5.2 終局同指率",
		"percent",
	),
	row(
		"terminalSameHand",
		"v5.2 终局同手率",
		"v5.2 terminal same-hand rate",
		"v5.2 終局同手率",
		"percent",
	),
	row(
		"terminalAlternation",
		"v5.2 终局交替率",
		"v5.2 terminal hand alternation",
		"v5.2 終局交替率",
		"percent",
		"max",
	),
	row(
		"nativeHomeFloor",
		"带调原生四轨主键区下限",
		"Toned native four-track home-row floor",
		"帶調原生四軌主鍵區下限",
		"percent",
		"max",
	),
	row(
		"nativeLeftPinkyPeak",
		"带调原生四轨左小指峰值",
		"Toned native four-track left-pinky peak",
		"帶調原生四軌左小指峰值",
		"percent",
	),
	row(
		"nativeRightPinkyPeak",
		"带调原生四轨右小指峰值",
		"Toned native four-track right-pinky peak",
		"帶調原生四軌右小指峰值",
		"percent",
	),
	row(
		"nativeMaxFingerPeak",
		"带调原生四轨最大单指峰值",
		"Toned native four-track maximum finger peak",
		"帶調原生四軌最大單指峰值",
		"percent",
	),
	row(
		"nativeTYBPeak",
		"带调原生四轨 TYB 峰值",
		"Toned native four-track TYB peak",
		"帶調原生四軌 TYB 峰值",
		"percent",
	),
	row(
		"fourCodeCrossAffected",
		"四码五截面平均跨词长受影响率",
		"Four-code five-cut mean cross-length affected rate",
		"四碼五截面平均跨詞長受影響率",
		"percent",
	),
	row(
		"fourCodeCrossFirstChoiceLoss",
		"四码五截面平均跨词长首选损失率",
		"Four-code five-cut mean cross-length first-choice loss",
		"四碼五截面平均跨詞長首選損失率",
		"percent",
	),
];

export function latestCurrentBenchmark(): BenchmarkSnapshot | undefined {
	const report = JSON.parse(
		readFileSync(rootPath("reports/shenyun-comparison.json"), "utf8"),
	);
	return report.currentLayoutComparisons?.at(-1);
}

function supplementReplay(snapshot: BenchmarkSnapshot) {
	const path = rootPath("reports/current-layout-replay.json");
	if (!existsSync(path)) return;
	const replay = JSON.parse(readFileSync(path, "utf8"));
	if (replay.sourceSha256 !== snapshot.sourceSha256)
		throw new Error(
			"补充复算与 HTML 来源摘要不一致，请重新运行 replay-current-layout-benchmark.ts",
		);
	for (const [scheme, result] of Object.entries(replay.schemes) as [
		string,
		any,
	][]) {
		const modes = result.v52.modes;
		snapshot.details[scheme].v52 = modes;
		snapshot.details[scheme].v52Scores = result.v52.trackScores;
		snapshot.details[scheme].terminalErgonomics = result.ergonomics;
		snapshot.contracts[scheme].policies = { candidate: result.policies };
		snapshot.contracts[scheme].routes = result.routes;
		for (const [multiplier, key] of [
			[1, "cktV52"],
			[2, "cktV52CostDoubled"],
			[3, "cktV52CostTripled"],
			[5, "cktV52CostQuintupled"],
		] as const)
			snapshot.metrics[key][scheme] = normalizedCostScore(
				modes,
				snapshot.references.v52,
				multiplier,
			);
		if (scheme === "S005")
			for (const key of [
				"cktV52",
				"cktV52CostDoubled",
				"cktV52CostTripled",
				"cktV52CostQuintupled",
			]) {
				if (Math.abs(snapshot.metrics[key][scheme] - 10) > 1e-9)
					throw new Error("S005 补充复算与参考不一致");
				snapshot.metrics[key][scheme] = 10;
			}
		for (const [field, value] of Object.entries(result.v52.aggregate))
			snapshot.metrics[`v52${field[0].toUpperCase()}${field.slice(1)}`][
				scheme
			] = value;
		for (const [field, key] of Object.entries({
			home: "terminalHome",
			upper: "terminalUpper",
			lower: "terminalLower",
			leftPinky: "terminalLeftPinky",
			rightPinky: "terminalRightPinky",
			maxFinger: "terminalMaxFinger",
			leftShare: "terminalLeftShare",
			differentKeySameFinger: "terminalDifferentKeySameFinger",
			sameFinger: "terminalSameFinger",
			sameHand: "terminalSameHand",
			alternation: "terminalAlternation",
		}))
			snapshot.metrics[key][scheme] = result.ergonomics[field];
	}
	snapshot.version = "current-layout-benchmark-v2-complete-replay";
	snapshot.supplement = {
		file: "current-layout-replay.json",
		sha256: hash(readFileSync(path)),
		sourceHashes: replay.sourceHashes,
		scope: replay.scope,
	};
}

export function currentBenchmarkAnchor(snapshot: BenchmarkSnapshot) {
	return `current-layout-${hash(JSON.stringify(snapshot)).slice(0, 12)}`;
}

export function formatCurrentMetric(
	snapshot: BenchmarkSnapshot,
	key: string,
	scheme: string,
	format: string,
	language: BenchmarkLanguage = "zh",
): string {
	const value = snapshot.metrics[key]?.[scheme];
	if (value === null || value === undefined) {
		let label = "—";
		if (key.startsWith("native") && scheme !== "Liandao" && scheme !== "Zhudao")
			label = { zh: "不适用", en: "N/A", zht: "不適用" }[language];
		else if (key.startsWith("v52PointOptimal"))
			label = {
				zh: "未重选辅序",
				en: "Policy search not repeated",
				zht: "未重選輔序",
			}[language];
		return `${label}[^${language}-benchmark-missing]`;
	}
	const toned = scheme === "Liandao" || scheme === "Zhudao";
	let text: string;
	if (typeof value === "string") text = value;
	else if (format === "flying" || format === "disorder")
		text = value.join(" / ");
	else if (format === "left-right")
		text = `${value.left}:${value.right} / ${(100 * value.leftShare).toFixed(3)}%`;
	else if (format === "unique" || format === "affected")
		text = `${value} / ${(100 * snapshot.metrics[format === "unique" ? "common399UniqueRate" : "common399AffectedRate"][scheme]).toFixed(3)}%`;
	else if (format === "percent")
		text = `${(100 * numeric(value, key)).toFixed(3)}%`;
	else
		text = numeric(value, key).toFixed(
			format === "integer" ? 0 : format === "three" ? 3 : 6,
		);
	if (toned) text += `[^${language}-benchmark-toned]`;
	return text;
}

export function decorateCurrentValues(
	values: { scheme: string; display: string; score: number | null }[],
) {
	const valid = values.filter(
		(value) => value.score !== null && Number.isFinite(value.score),
	);
	const toned = (scheme: string) => scheme === "Liandao" || scheme === "Zhudao";
	const best = Math.min(...valid.map((value) => value.score!));
	return values.map((value) => {
		if (value.score === null || !Number.isFinite(value.score))
			return value.display;
		const pool = valid.filter((other) =>
			toned(value.scheme)
				? toned(other.scheme)
				: !toned(other.scheme) && other.scheme !== "B04",
		);
		const rank =
			1 + pool.filter((other) => other.score! < value.score! - 1e-12).length;
		let display = value.display;
		if (pool.some((other) => other.scheme === value.scheme) && rank <= 2) {
			const at = display.indexOf("[^");
			display =
				at >= 0
					? `**${display.slice(0, at)}**${display.slice(at)}`
					: `**${display}**`;
			display += toned(value.scheme)
				? rank === 1
					? " 🔷"
					: " 🔹"
				: rank === 1
					? " ★★"
					: " ★";
		}
		if (Math.abs(value.score! - best) <= 1e-12) display += " 🥇";
		return display;
	});
}

export function benchmarkRankingLegend(language: BenchmarkLanguage) {
	return {
		zh: "★★／★：仅在本表全部无调方案中评价，首道 B04 除外，分别标记第一／第二名；🔷／🔹：仅在两套带调方案中评价，分别标记第一／第二名；🥇：比较本表所有有有效数值的方案（含首道与带调）。三个范围独立，可同时标记；并列采用竞赛排名，缺测／不适用不参评，分布说明项不判优。跨合同的金牌是所列模型值的比较，边界见脚注。",
		en: "★★/★ rank all untoned layouts shown except Shoudao B04; 🔷/🔹 independently rank the two toned layouts, marking first/second place. 🥇 compares every valid value, including B04 and toned layouts. Groups are independent, ties use competition ranking, and missing/inapplicable values and distribution-only rows do not compete. Cross-contract medals compare the stated model values; see footnotes.",
		zht: "★★／★：僅評本表全部無調方案，首道 B04 除外，分別標第一／第二名；🔷／🔹：僅評兩套帶調方案，分別標第一／第二名；🥇：比較所有有效數值，包含首道與帶調。三組獨立，可同時標記；並列採競賽排名，缺測／不適用不參評，分布說明項不判優。跨合同金牌的邊界見腳註。",
	}[language];
}

function rankedMetricCells(
	snapshot: BenchmarkSnapshot,
	key: string,
	format: string,
	schemes: string[],
	language: BenchmarkLanguage,
	better: string,
) {
	return decorateCurrentValues(
		schemes.map((scheme) => {
			const value = snapshot.metrics[key]?.[scheme];
			let score: number | null =
				value === null || value === undefined || better === "Distribution only"
					? null
					: typeof value === "number"
						? value
						: Array.isArray(value)
							? (key === "initialDisorderAIDV" ? value.slice(2) : value).reduce(
									(a, b) => a + b,
									0,
								)
							: typeof value === "string"
								? key === "initialDisorderAIDV"
									? [...value.matchAll(/\d+/g)].reduce(
											(n, x) => n + Number(x[0]),
											0,
										)
									: Number.parseFloat(value)
								: Math.abs(value.leftShare - 0.5);
			if (
				score !== null &&
				(better === "Higher" ||
					[
						"logicAuditFA1",
						"logicUniformityLUv1r",
						"common399UniqueCodes",
						"dailyEightScenarioMovingHand",
						"homeShareS2",
						"homeFloor20Contracts",
					].includes(key))
			)
				score = -score;
			if (score !== null && key === "terminalLeftShare")
				score = Math.abs(score - 0.5);
			return {
				scheme,
				display: formatCurrentMetric(snapshot, key, scheme, format, language),
				score,
			};
		}),
	);
}

export function renderCurrentOverview(
	snapshot: BenchmarkSnapshot,
	rows: readonly BenchmarkRow[],
	language: BenchmarkLanguage,
	schemes = ["RC26", "OC21", "S005", "B04", "Liandao", "Zhudao"],
): string {
	const headers = {
		zh: ["指标", "何为好"],
		en: ["Metric", "Better"],
		zht: ["指標", "何者為佳"],
	}[language];
	const allRows = [...rows, ...additionalBenchmarkRows];
	const lines = [
		table(
			[
				headers[0],
				...schemes.map((scheme) => currentLayoutLabels[scheme]),
				headers[1],
			],
			allRows.map(([key, labels, better, format]) => [
				labels[language] +
					(key === "cktV52" ? `[^${language}-benchmark-v52]` : ""),
				...rankedMetricCells(
					snapshot,
					key,
					format,
					schemes,
					language,
					better.en,
				),
				better[language],
			]),
		),
		benchmarkRankingLegend(language),
		currentBenchmarkNotes(language),
	];
	return lines.join("\n\n");
}

export function currentBenchmarkNotes(language: BenchmarkLanguage) {
	const notes = {
		zh: [
			"带调列为页面原列公式的带调适配：声调在双拼主码内贡献，后置只有纯形笔辅；无调列是形辅／调辅两个成员的八轨系综，带调 v5～v5.2 是形辅四轨，词长权重均为 1:3:1:1。数值可以观察任务成本与取舍，不能作为相同编码合同下的布局或辅码消融排名。记忆项为 M-T1 下限／守门，与 M-R2 定义不同；D 可对照，带调 V 统计任一声调的普通元音偏移，A/I 未定义。Common399 对应列在带调方案中改用实际 1407 带调音节，『唯一码』指占用码位而非无碰撞音节数，分母与碰撞数不能直接横比。FA/LU、S2、A7E 与 20 合同负载均使用页面的带调适配；主码已包含的声调不重复击键，S2 补全使用各自五键枚举后缀，时间列的带调值为页面 sound.upperMs。CKT v3/v4 使用页面 τ=600、首辅=300、次辅=300 ms 的适配八轨，v5 以后使用原生纯形四轨；20 合同负载与原生四轨终局负载分别列示。",
			"当前 v5.2 默认、×2／×3／×5、分轨耗时、前三辅率、选重及终局负载已覆盖全部八列：六个无调布局使用同一冻结语料和错误模型复算，两套带调布局使用其原生形辅四轨。S005 的 v5.2 行是页面参考辅序（形 12/213/24、调 12/213/23），旧版行保留各自历史辅序。『不适用』表示不存在该生产合同（例如无调方案的带调原生四轨属性）；『未重选辅序』表示未另外搜索该方案的成本点最优值，不能用生产稳健辅序分数代填；其余『—』为来源未发布的审计量。以上均不等于 0，不参评。",
			"CKT v5.2 保留 v5.1 的主码、辅序、候选池及词长权重，对长码采用分块成功／错误成本；认知成本 ×2／×3／×5 时同时缩放候选与同模式 S005 参考的全部认知项，保留运动项及生产辅序，再逐轨取四次幂均值。S005 v5.2 归一化为 10；不是实际用户输入速度或 5000 字实测码长。",
		],
		en: [
			"Toned columns adapt the page's original formulas: tone contributes inside the two-key main code, followed only by shape auxiliaries. Untoned layouts use eight shape/tone ensemble tracks; toned v5–v5.2 use four shape-only tracks, with 1:3:1:1 length weights. Values describe task costs across contracts, not a controlled layout/auxiliary ablation ranking. M-T1 lower/guard differs from M-R2; D is comparable, toned V counts a vowel displaced in any tone, and A/I are undefined. The Common399 cells use 1407 legal toned syllables for toned layouts; distinct codes mean occupied buckets, so denominators and collision counts differ. FA/LU, S2, A7E and 20-contract loads use the page's tone-aware adaptations without repeating embedded tone strokes. S2 completion uses each five-key enumeration suffix; toned time is sound.upperMs. CKT v3/v4 use the page's adapted eight tracks with τ=600 and first/second auxiliary costs of 300 ms; v5 onwards use native four-track shape-only contracts. Twenty-contract and native terminal loads are reported separately.",
			"All eight columns now participate in v5.2 default/scaled costs, timing, auxiliary/selection rates and terminal loads. Six untoned layouts are replayed against the same frozen corpus and error model; toned layouts retain four native shape tracks. S005 v5.2 uses the frozen reference policies; earlier rows retain historical policies. N/A denotes a different/inapplicable contract. Policy search not repeated means no separate point-optimal policy search; production robust-policy scores are not substituted. Remaining dashes denote unpublished audit counts, not zero, and do not compete.",
			"CKT v5.2 preserves v5.1 routing, policies, pools and length weights while applying block success/error costs to long codes. Cost multipliers scale all cognitive terms for both candidate and same-mode S005 reference, keeping motor costs and production policies fixed, before trackwise fourth-power normalization. S005 v5.2 is 10. These are model costs, not human speed or 5000-character measured code lengths.",
		],
		zht: [
			"帶調欄為頁面原欄公式的帶調適配：聲調在雙拼主碼內貢獻，後置只有純形筆輔；無調欄為形輔／調輔八軌系綜，帶調 v5～v5.2 為形輔四軌，詞長權重均為 1:3:1:1。可觀察任務成本及取捨，不可視為相同編碼合同的消融排名。M-T1 下限／守門與 M-R2 定義不同；D 可對照，帶調 V 計任一聲調的普通元音偏移，A/I 未定義。Common399 對應欄在帶調方案使用 1407 個實際帶調音節，『唯一碼』指占用碼位，分母及碰撞數不能直接橫比。FA/LU、S2、A7E 與 20 合同負載依頁面帶調適配，主碼已含聲調不重複擊鍵；S2 補全使用各自五鍵枚舉後綴，帶調時間為 sound.upperMs。CKT v3/v4 採 τ=600、首輔=300、次輔=300 ms 的適配八軌，v5 以後使用原生純形四軌；20 合同與原生四軌終局負載分列。",
			"目前 v5.2 預設、×2／×3／×5、分軌耗時、前三輔率、選重與終局負載已涵蓋全部八欄：六個無調布局以同一凍結語料與錯誤模型複算，兩套帶調布局使用原生形輔四軌。S005 的 v5.2 行採頁面參考輔序（形 12/213/24、調 12/213/23），舊版行保留各自歷史輔序。『不適用』表示不存在該生產合同；『未重選輔序』表示未另行搜尋成本點最優輔序，不以生產穩健輔序分數代填；其餘『—』表示來源未發布的審計量。以上均不等於 0，不參評。",
			"CKT v5.2 保留 v5.1 主碼、輔序、候選池及詞長權重，對長碼採分塊成功／錯誤成本。成本 ×2／×3／×5 同時縮放候選與同模式 S005 參考的全部認知項，保留運動項與生產輔序，再逐軌取四次冪均值；S005 v5.2 歸一化為 10。這些是模型成本，不是實際輸入速度或 5000 字實測碼長。",
		],
	}[language];
	return [
		`[^${language}-benchmark-toned]: ${notes[0]}`,
		`[^${language}-benchmark-missing]: ${notes[1]}`,
		`[^${language}-benchmark-v52]: ${notes[2]}`,
	].join("\n\n");
}

export function table(headers: string[], rows: string[][]) {
	return [
		`| ${headers.join(" | ")} |`,
		`| ${headers.map(() => "---").join(" | ")} |`,
		...rows.map((row) => `| ${row.join(" | ")} |`),
	].join("\n");
}

export function appendCurrentBenchmark(
	htmlPath: string,
	rows: readonly BenchmarkRow[],
) {
	const source = readFileSync(htmlPath);
	const match = source
		.toString("utf8")
		.match(/<script id="payload"[^>]*>([\s\S]*?)<\/script>/u);
	if (!match) throw new Error("HTML 缺少 benchmark payload");
	const payload = JSON.parse(
		gunzipSync(Buffer.from(match[1].trim(), "base64")).toString("utf8"),
	);
	const jsonPath = rootPath("reports/shenyun-comparison.json");
	const jsonSource = readFileSync(jsonPath, "utf8");
	const historical = JSON.parse(jsonSource);
	const snapshot = buildCurrentBenchmark(payload, hash(source), historical);
	supplementReplay(snapshot);
	validateProductionContracts(snapshot);
	const previous: BenchmarkSnapshot[] =
		historical.currentLayoutComparisons ?? [];
	const identity = hash(JSON.stringify(snapshot));
	const duplicate = previous.some(
		(old) => hash(JSON.stringify(old)) === identity,
	);
	const schemes = Object.keys(currentLayoutIds);
	const section = renderCurrentReport(snapshot, rows, schemes, identity);
	const reportPath = rootPath("reports/shenyun-comparison.md");
	if (duplicate) {
		if (
			!readFileSync(reportPath, "utf8").includes(
				`<!-- current-layout-benchmark:${identity} -->`,
			)
		)
			throw new Error("快照已有而追加报告缺失");
		console.log("当前布局快照与追加报告均已存在，无需重复追加。");
		return;
	}
	// 保留 JSON 所有旧值；只向版本数组追加，Markdown 则逐字节保留原前缀。
	if (previous.length === 0) {
		const end = jsonSource.lastIndexOf("}");
		writeFileSync(
			jsonPath,
			`${jsonSource.slice(0, end).trimEnd()},\n  "currentLayoutComparisons": ${JSON.stringify([snapshot], null, 2)}\n}\n`,
		);
	} else {
		const arrayEnd = /\]\s*}\s*$/.exec(jsonSource)?.index;
		if (
			arrayEnd === undefined ||
			Object.keys(historical).at(-1) !== "currentLayoutComparisons"
		)
			throw new Error("当前布局快照数组应为 JSON 最后一项，拒绝重写旧报告");
		writeFileSync(
			jsonPath,
			`${jsonSource.slice(0, arrayEnd).trimEnd()},\n${JSON.stringify(snapshot, null, 2)}\n${jsonSource.slice(arrayEnd)}`,
		);
	}
	appendFileSync(reportPath, `\n${section}\n`);
	console.log(
		`已追加当前布局快照：${snapshot.date} / ${identity.slice(0, 12)}`,
	);
}

export function validateProductionContracts(snapshot: BenchmarkSnapshot) {
	const expected: Record<string, string[]> = {
		RC26: ["12/12/24", "12/21/13"],
		OC21: ["12/231/23", "12/213/23"],
		Liandao: ["21/231/14"],
		Zhudao: ["21/12/23"],
	};
	for (const [scheme, orders] of Object.entries(expected)) {
		const contract = snapshot.contracts[scheme];
		const policies = contract.policies?.candidate ?? {
			keytao: contract.wordAuxiliaryPolicy,
		};
		const actual = Object.values(policies).map((policy: any) =>
			[policy.word2, policy.word3, policy.word4].join("/"),
		);
		if (JSON.stringify(actual) !== JSON.stringify(orders))
			throw new Error(`${scheme} 发布辅序不一致：${actual}`);
		const semantics = contract.auxiliarySemantics ?? contract;
		if (semantics.toneDigitsByShapeMeaning !== "42310")
			throw new Error(`${scheme} 五辅语义错误`);
	}
}

function renderCurrentReport(
	snapshot: BenchmarkSnapshot,
	rows: readonly BenchmarkRow[],
	schemes: string[],
	identity: string,
) {
	const sections = [
		`<!-- current-layout-benchmark:${identity} -->`,
		`<a id="${currentBenchmarkAnchor(snapshot)}"></a>`,
		`## ${snapshot.date} 当前四布局／六生产方案追加比较（含 CKT v5.2）`,
		"以上各代报告及数值保留原样；本节使用同一冻结语料和 v5.2 模型补齐全部无调布局的逐轨成本及终局按键负载。当前四个无调生产方案归为 RC26、UED 两列，带调方案为冰雪莲道、冰雪鹮道，另保留初代与外部参考；历史布局使用其冻结辅序，S005 在 v5.2 使用页面归一化参考辅序。复算来源见 current-layout-replay.json。",
		`来源为用户指定的 a7_CKT_R11.html，SHA-256：\`${snapshot.sourceSha256}\`。机器可读记录追加在 [shenyun-comparison.json](shenyun-comparison.json) 的 \`currentLayoutComparisons\`，包括输入摘要、定义、参考轨、辅序与各轨原始测值。`,
		"### 布局与生产合同",
		table(
			["属性", ...schemes.map((s) => currentLayoutLabels[s])],
			[
				[
					"声调与后置辅码",
					...schemes.map((s) =>
						s === "Liandao" || s === "Zhudao"
							? "主码带调＋纯形辅[^zh-benchmark-toned]"
							: "无调主码＋形／调辅系综",
					),
				],
				[
					"二／三／四字辅序（形；调）",
					...schemes.map((s) => {
						const c = snapshot.contracts[s];
						const p =
							c.policies?.candidate ??
							(c.wordAuxiliaryPolicy
								? { keytao: c.wordAuxiliaryPolicy }
								: c.policies);
						return (
							Object.values(p ?? {})
								.map((x: any) => [x.word2, x.word3, x.word4].join("/"))
								.join("；") || "历史合同"
						);
					}),
				],
			],
		),
		"### Benchmark 总览",
		renderCurrentOverview(snapshot, rows, "zh", schemes),
		"### v5.2 逐轨模型耗时与辅键贡献[^zh-benchmark-v52]",
		"同一行比较同词长和编码轨。带调方案没有生产调辅轨，其对应格明确标为不适用；不复制形辅轨来凑八轨。单元格为「运动 ms／有效 ms／平均编码按键」。",
		table(
			["编码轨", "词长", ...schemes.map((s) => currentLayoutLabels[s])],
			["keytao", "sanpin"].flatMap((mode) =>
				kinds.map((kind) => [
					mode === "keytao" ? "形辅" : "调辅",
					kind,
					...schemes.map((s) => {
						const t = snapshot.details[s].v52?.[mode]?.[kind];
						return t
							? `${t.motorUpperMs.toFixed(3)} / ${t.effectiveMs.toFixed(3)} / ${t.meanKeys.toFixed(6)}${s === "Liandao" || s === "Zhudao" ? "[^zh-benchmark-toned]" : ""}`
							: "—[^zh-benchmark-missing]";
					}),
				]),
			),
		),
		"### v5.2 逐级辅键率与终局选重",
		"单元格为「第一辅／第二辅／第三辅／终局选重」，均为频率加权百分比。第三辅为零表示合同不存在第三辅或该语料无需第三辅，与缺测不同；不把第一辅键率当作裸码非首选率（21×26 还存在三键至四键补主码阶段）。",
		table(
			["编码轨", "词长", ...schemes.map((s) => currentLayoutLabels[s])],
			["keytao", "sanpin"].flatMap((mode) =>
				kinds.map((kind) => [
					mode === "keytao" ? "形辅" : "调辅",
					kind,
					...schemes.map((s) => {
						const t = snapshot.details[s].v52?.[mode]?.[kind];
						return t
							? [
									t.firstAuxRate,
									t.secondAuxRate,
									t.thirdAuxRate ?? 0,
									t.selectionRate,
								]
									.map((n) => `${(100 * n).toFixed(3)}%`)
									.join(" / ")
							: "—[^zh-benchmark-missing]";
					}),
				]),
			),
		),
		"### CKT v4 成本分解（原列带调适配）",
		"本表继续原报告的八轨观察面；带调的 sanpin 是页面移除已内含声调重复击键后的研究适配轨，不代表新增了带调调辅生产方案。单元格为「运动 ms／第一辅率／第二辅率／终局选重率」。",
		table(
			["编码轨", "词长", ...schemes.map((s) => currentLayoutLabels[s])],
			["keytao", "sanpin"].flatMap((mode) =>
				kinds.map((kind) => [
					mode,
					kind,
					...schemes.map((s) => {
						const t = snapshot.details[s].adaptedV4[mode][kind];
						return `${t.motorUpperMs.toFixed(3)} / ${[t.firstAuxRate, t.secondAuxRate, t.selectionRate].map((n) => `${(100 * n).toFixed(3)}%`).join(" / ")}${s === "Liandao" || s === "Zhudao" ? "[^zh-benchmark-toned]" : ""}`;
					}),
				]),
			),
		),
		"### 当前结果的读法",
		`日常纯双拼移动手分数可按同一 2149 击键文稿对照：RC26 ${snapshot.metrics.dailyEightScenarioMovingHand.RC26.toFixed(3)}、UED ${snapshot.metrics.dailyEightScenarioMovingHand.OC21.toFixed(3)}、冰雪莲道 ${snapshot.metrics.dailyEightScenarioMovingHand.Liandao.toFixed(3)}、冰雪鹮道 ${snapshot.metrics.dailyEightScenarioMovingHand.Zhudao.toFixed(3)}。冰雪鹮道的 v5.2 任务分数低于 RC26，冰雪莲道低于 UED，但这种差异同时包含主码声调信息、形辅合同和候选池贡献，不能单独归因于双拼键位更优。`,
		"500／5000 字逐键实战报告仍是各自日期的历史结果；本次不把页面模型值当作重新部署后的候选实测值。当前布局的完整候选及性能验证仅由 GitHub Actions 完成。",
	];
	// 原报告的所有详细观察面都追加两个带调列；缺少原始桶审计时明确留空。
	const modes = ["keytao", "sanpin"];
	const old = snapshot.legacyDetails;
	const percent = (n: number) => `${(100 * n).toFixed(3)}%`;
	const isToned = (s: string) => s === "Liandao" || s === "Zhudao";
	const note = (s: string) => (isToned(s) ? "[^zh-benchmark-toned]" : "");
	const headers = [
		"编码轨",
		"词长",
		...schemes.map((s) => currentLayoutLabels[s]),
	];
	const beforeReading = sections.indexOf("### 当前结果的读法");
	sections.splice(
		beforeReading,
		0,
		"### 冻结语料加权非首选率（v4 终局两辅观察面）",
		table(
			headers,
			modes.flatMap((mode) =>
				kinds.map((kind) => [
					mode,
					kind,
					...schemes.map(
						(s) =>
							percent(
								isToned(s)
									? snapshot.details[s].adaptedV4[mode][kind].selectionRate
									: old.weightedNonfirstRates[mode][
											kind === "character" ? "char" : kind
										][s],
							) + note(s),
					),
				]),
			),
		),
		"### 逐级辅键后的加权残余非首选率（v4）",
		"保持历史零／一／二辅观察面；带调列取页面适配轨的第一辅率、第二辅率和终局选重率，声调已在主码内的阶段不重复追加。v5.2 的三辅行为以上方原生逐轨表为准。",
		table(
			["编码轨", "词长", "阶段", ...schemes.map((s) => currentLayoutLabels[s])],
			modes.flatMap((mode) =>
				kinds.flatMap((kind) =>
					["afterZeroAux", "afterOneAux", "afterTwoAux"].map((stage, index) => [
						mode,
						kind,
						["零辅后", "一辅后", "二辅后"][index],
						...schemes.map(
							(s) =>
								percent(
									isToned(s)
										? snapshot.details[s].adaptedV4[mode][kind][
												["firstAuxRate", "secondAuxRate", "selectionRate"][
													index
												]
											]
										: old.stagedResidualNonfirstRates[mode][
												kind === "character" ? "char" : kind
											][stage][s],
								) + note(s),
						),
					]),
				),
			),
		),
		"### 二／三／四字词终局碰撞桶（v4）",
		"单元格为「碰撞桶／残余条目／跨词长桶／最大桶」。带调适配包未发布该组终局桶计数，不能用四码截面的桶数代填；下面另列已发布的四码截面，继续尝试对照跨词长贡献。",
		table(
			headers,
			modes.flatMap((mode) =>
				kinds
					.filter((kind) => kind !== "character")
					.map((kind) => [
						mode,
						kind,
						...schemes.map((s) => {
							if (isToned(s)) return "—[^zh-benchmark-missing]";
							const b = old.terminalWordCollisionBuckets[mode][kind][s];
							return [
								b.buckets,
								b.residualEntries,
								b.crossLengthBuckets,
								b.maxBucketSize,
							].join(" / ");
						}),
					]),
			),
		),
		"### 四码五截面碰撞对照",
		"按各词长 Top 500／1000／2000／5000／10000 的标准四码截面，单元格为「跨词长受影响率／首选损失率／碰撞桶／跨词长桶」。它衡量主码的跨词长贡献，不等于补辅后的终局选重率。",
		table(
			["每类词条截面", ...schemes.map((s) => currentLayoutLabels[s])],
			[500, 1000, 2000, 5000, 10000].map((cut) => [
				String(cut),
				...schemes.map((s) => {
					const c = snapshot.details[s].fourCodeCollision?.cuts?.[cut];
					return c
						? `${percent(c.crossAffectedRate)} / ${percent(c.crossFirstChoiceLossRate)} / ${c.collisionBuckets} / ${c.crossBuckets}${note(s)}`
						: "—[^zh-benchmark-missing]";
				}),
			]),
		),
	);
	return decorateReportPercentTables(sections.join("\n\n"), schemes).replace(
		/\[\^zh-benchmark-(toned|missing|v52)\]/g,
		`[^zh-benchmark-$1-${identity.slice(0, 12)}]`,
	);
}

function decorateReportPercentTables(markdown: string, schemes: string[]) {
	return markdown.replace(
		/\|[^\n]+\n\|[\s:|-]+\n(?:\|[^\n]+\n?)+/g,
		(block) => {
			const lines = block.trimEnd().split("\n");
			const headers = lines[0].split("|").map((cell) => cell.trim());
			const indices = schemes.map((scheme) =>
				headers.indexOf(currentLayoutLabels[scheme]),
			);
			if (indices.some((index) => index < 0)) return block;
			for (let i = 2; i < lines.length; i++) {
				if (/[★🔷🔹🥇]/u.test(lines[i])) continue;
				const cells = lines[i].split("|").map((cell) => cell.trim());
				const values = schemes.map((scheme, index) => {
					const display = cells[indices[index]];
					const plain = display.replace(/\[\^[^\]]+\]/g, "");
					return {
						scheme,
						display,
						score: /^\d+(?:\.\d+)?%$/.test(plain)
							? Number.parseFloat(plain)
							: null,
					};
				});
				if (!values.some((value) => value.score !== null)) continue;
				if (
					values.some(
						(value) =>
							value.score === null &&
							!value.display.includes("benchmark-missing"),
					)
				)
					continue;
				const decorated = decorateCurrentValues(values);
				indices.forEach((index, j) => {
					cells[index] = decorated[j];
				});
				lines[i] = `| ${cells.slice(1, -1).join(" | ")} |`;
			}
			return lines.join("\n") + (block.endsWith("\n") ? "\n" : "");
		},
	);
}
