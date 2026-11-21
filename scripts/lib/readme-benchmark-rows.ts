import type { BenchmarkRow } from "./current-layout-benchmark";

export const readmeBenchmarkRows = [
	[
		"M-R2",
		{ zh: "M-R2 记忆项", en: "M-R2 memory items", zht: "M-R2 記憶項" },
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"integer",
	],
	[
		"initialDisorderAIDV",
		{
			zh: "全声母／字母声母／传统声母／韵母乱序度 A/I/D/V",
			en: "All/written/traditional-initial/final disorder A/I/D/V",
			zht: "全聲母／字母聲母／傳統聲母／韻母亂序度 A/I/D/V",
		},
		{
			zh: "A、I 为诊断；仍按 D+V 越低越好",
			en: "A/I diagnostic; ranking remains lower D+V",
			zht: "A、I 為診斷；仍按 D+V 越低越好",
		},
		"disorder",
	],
	[
		"flyingKeyComponents",
		{
			zh: "飞键成分（声母／零声母组／韵母）",
			en: "Flying-key components (initials/zero-initial groups/finals)",
			zht: "飛鍵成分（聲母／零聲母組／韻母）",
		},
		{ zh: "越少越好", en: "Lower", zht: "越少越好" },
		"flying",
	],
	[
		"logicAuditFA1",
		{ zh: "FA-1 逻辑审计", en: "FA-1 logic audit", zht: "FA-1 邏輯稽核" },
		{ zh: "越高越一致", en: "Higher", zht: "越高越一致" },
		"six",
	],
	[
		"logicUniformityLUv1r",
		{
			zh: "LU-v1r 逻辑均匀度",
			en: "LU-v1r logic uniformity",
			zht: "LU-v1r 邏輯均勻度",
		},
		{ zh: "越高越统一", en: "Higher", zht: "越高越統一" },
		"six",
	],
	[
		"common399UniqueCodes",
		{
			zh: "Common399 唯一码／唯一率",
			en: "Common399 unique codes/rate",
			zht: "Common399 唯一碼／唯一率",
		},
		{ zh: "越高越好", en: "Higher", zht: "越高越好" },
		"unique",
	],
	[
		"common399CollisionBuckets",
		{
			zh: "Common399 重码桶",
			en: "Common399 collision buckets",
			zht: "Common399 重碼桶",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"integer",
	],
	[
		"common399AffectedSyllables",
		{
			zh: "Common399 受影响音节／占比",
			en: "Common399 affected syllables/rate",
			zht: "Common399 受影響音節／占比",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"affected",
	],
	[
		"s2FrequencyWeightedMiss",
		{
			zh: "频率加权 S2 miss",
			en: "Frequency-weighted S2 miss",
			zht: "頻率加權 S2 miss",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"percent",
	],
	[
		"s2CompletionMeanKeys",
		{
			zh: "S2 补全平均码长",
			en: "S2 completion mean code length",
			zht: "S2 補全平均碼長",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"six",
	],
	[
		"s2CompletionCenterMs",
		{
			zh: "S2 补全中心时间（ms）",
			en: "S2 completion center time (ms)",
			zht: "S2 補全中心時間（ms）",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"three",
	],
	[
		"s2DifferentKeySameFingerRate",
		{
			zh: "S2 异键同指率",
			en: "S2 different-key same-finger rate",
			zht: "S2 異鍵同指率",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"percent",
	],
	[
		"cktV3",
		{ zh: "综合补全 CKT v3", en: "CKT v3 completion", zht: "綜合補全 CKT v3" },
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"six",
	],
	[
		"cktV4",
		{ zh: "综合补全 CKT v4", en: "CKT v4 completion", zht: "綜合補全 CKT v4" },
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"six",
	],
	[
		"cktV5",
		{ zh: "综合补全 CKT v5", en: "CKT v5 completion", zht: "綜合補全 CKT v5" },
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"six",
	],
	[
		"cktV51",
		{
			zh: "综合补全 CKT v5.1",
			en: "CKT v5.1 completion",
			zht: "綜合補全 CKT v5.1",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"six",
	],
	[
		"ensembleV3",
		{
			zh: "A7E-v3 系综当量",
			en: "A7E-v3 ensemble equivalent",
			zht: "A7E-v3 系綜當量",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"six",
	],
	[
		"ensembleV4",
		{
			zh: "A7E-v4 系综当量",
			en: "A7E-v4 ensemble equivalent",
			zht: "A7E-v4 系綜當量",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"six",
	],
	[
		"ensembleV5",
		{
			zh: "A7E-v5 系综当量",
			en: "A7E-v5 ensemble equivalent",
			zht: "A7E-v5 系綜當量",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"six",
	],
	[
		"ensembleV6CW150",
		{ zh: "A7E-v6-CW150", en: "A7E-v6-CW150", zht: "A7E-v6-CW150" },
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"six",
	],
	[
		"aggregateSelectionRate",
		{
			zh: "八轨综合选重率",
			en: "Eight-track aggregate selection rate",
			zht: "八軌綜合選重率",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"percent",
	],
	[
		"aggregateFirstAuxRate",
		{
			zh: "八轨第一辅键率",
			en: "Eight-track first-auxiliary rate",
			zht: "八軌第一輔鍵率",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"percent",
	],
	[
		"aggregateSecondAuxRate",
		{
			zh: "八轨第二辅键率",
			en: "Eight-track second-auxiliary rate",
			zht: "八軌第二輔鍵率",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"percent",
	],
	[
		"dailyLeftRightLoad",
		{
			zh: "日常左右手负载／左手占比",
			en: "Daily left/right load and left share",
			zht: "日常左右手負載／左手占比",
		},
		{ zh: "越接近 50% 越平衡", en: "Closer to 50%", zht: "越接近 50% 越平衡" },
		"left-right",
	],
	[
		"dailySameHandRate",
		{ zh: "日常同手率", en: "Daily same-hand rate", zht: "日常同手率" },
		{
			zh: "越低越好；非独立速度结论",
			en: "Lower; not a standalone speed claim",
			zht: "越低越好；非獨立速度結論",
		},
		"percent",
	],
	[
		"dailyMeanEffectiveDistance",
		{
			zh: "日常平均有效距离",
			en: "Daily mean effective distance",
			zht: "日常平均有效距離",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"six",
	],
	[
		"leftPinkyQAZPeak20Contracts",
		{
			zh: "20 合同 QAZ 左小指组峰值",
			en: "20-contract QAZ left-pinky peak",
			zht: "20 合同 QAZ 左小指組峰值",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"percent",
	],
	[
		"rightPinkyPeak20Contracts",
		{
			zh: "20 合同 P 区右小指组峰值",
			en: "20-contract P-area right-pinky peak",
			zht: "20 合同 P 區右小指組峰值",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"percent",
	],
	[
		"maxFingerPeak20Contracts",
		{
			zh: "20 合同最大单指峰值",
			en: "20-contract maximum single-finger peak",
			zht: "20 合同最大單指峰值",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"percent",
	],
	[
		"dailyEightScenarioMovingHand",
		{
			zh: "日常纯双拼移动手分数（含标点）",
			en: "Daily pure-double-pinyin moving-hand score (punctuation included)",
			zht: "日常純雙拼移動手分數（含標點）",
		},
		{ zh: "越高越好", en: "Higher", zht: "越高越好" },
		"three",
	],
	[
		"homeShareS2",
		{ zh: "S2 主键区占比", en: "S2 home-zone share", zht: "S2 主鍵區占比" },
		{ zh: "越高越好", en: "Higher", zht: "越高越好" },
		"percent",
	],
	[
		"indexFingerTYBPeak20Contracts",
		{
			zh: "20 合同 TYB 双食指组峰值",
			en: "20-contract TYB index-finger peak",
			zht: "20 合同 TYB 雙食指組峰值",
		},
		{ zh: "越低越好", en: "Lower", zht: "越低越好" },
		"percent",
	],
	[
		"homeFloor20Contracts",
		{
			zh: "20 合同主键区下限",
			en: "20-contract home-zone floor",
			zht: "20 合同主鍵區下限",
		},
		{ zh: "越高越好", en: "Higher", zht: "越高越好" },
		"percent",
	],
] as const satisfies readonly BenchmarkRow[];
