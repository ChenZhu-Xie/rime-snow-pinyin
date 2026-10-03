import type { CollisionMeasurement, CollisionMetric } from "./collisions";

export type CollisionVariantId =
	| "shenyun-canonical"
	| "original-canonical"
	| "original-accepted";

export interface CollisionVariantReport {
	id: CollisionVariantId;
	name: string;
	measurement: CollisionMeasurement;
}

export interface CollisionCutoffReport {
	requested: number | null;
	label: string;
	actualTwo: number;
	actualFour: number;
	variants: CollisionVariantReport[];
}

export interface CollisionComparisonReport {
	schemaVersion: 1;
	dictionaries: string[];
	diagnosticCount: number;
	cutoffs: CollisionCutoffReport[];
}

const classes = [
	["withinTwo", "二字内部"],
	["withinFour", "四字内部"],
	["crossLength", "二字↔四字"],
] as const;

function percent(value: number): string {
	return `${(value * 100).toFixed(2)}%`;
}

function points(value: number): string {
	const amount = value * 100;
	return `${amount >= 0 ? "+" : ""}${amount.toFixed(2)} pp`;
}

function coverage(
	measurement: CollisionMeasurement,
	key: (typeof classes)[number][0],
): string {
	if (key === "withinTwo") {
		return `${measurement.coverage.two.encodableWordCount}/${measurement.coverage.two.inputWordCount}`;
	}
	if (key === "withinFour") {
		return `${measurement.coverage.four.encodableWordCount}/${measurement.coverage.four.inputWordCount}`;
	}
	const encoded =
		measurement.coverage.two.encodableWordCount +
		measurement.coverage.four.encodableWordCount;
	const input =
		measurement.coverage.two.inputWordCount +
		measurement.coverage.four.inputWordCount;
	return `${encoded}/${input}`;
}

function escapeCell(value: string): string {
	return value.replace(/\|/gu, "\\|").replace(/\r?\n/gu, " ");
}

function metricRows(cutoff: CollisionCutoffReport): string[] {
	const rows = [
		"| 方案 | 类别 | 可编码/输入 | 重码桶 | 受影响词 | 受影响率 | 词频质量 | 唯一码率 | 最大桶 |",
		"|---|---|---:|---:|---:|---:|---:|---:|---:|",
	];
	for (const variant of cutoff.variants) {
		for (const [key, name] of classes) {
			const metric = variant.measurement[key];
			rows.push(
				`| ${variant.name} | ${name} | ${coverage(variant.measurement, key)} | ${metric.bucketCount.toLocaleString("en-US")} | ${metric.affectedWordCount.toLocaleString("en-US")} | ${percent(metric.affectedWordRate)} | ${percent(metric.weightedMassRate)} | ${percent(metric.uniqueCodeRate)} | ${metric.maxBucketSize} |`,
			);
		}
	}
	return rows;
}

function requireVariant(
	cutoff: CollisionCutoffReport,
	id: CollisionVariantId,
): CollisionVariantReport {
	const variant = cutoff.variants.find((candidate) => candidate.id === id);
	if (!variant) throw new Error(`报告缺少布局：${id}`);
	return variant;
}

function deltaRows(cutoff: CollisionCutoffReport): string[] {
	const shenyun = requireVariant(cutoff, "shenyun-canonical");
	const comparisons = [
		requireVariant(cutoff, "original-canonical"),
		requireVariant(cutoff, "original-accepted"),
	];
	const rows = [
		"| 对照（神韵减对照） | 类别 | 受影响率差 | 词频质量差 | 重码桶差 |",
		"|---|---|---:|---:|---:|",
	];
	for (const comparison of comparisons) {
		for (const [key, name] of classes) {
			const current = shenyun.measurement[key];
			const baseline = comparison.measurement[key];
			const bucketDelta = current.bucketCount - baseline.bucketCount;
			rows.push(
				`| ${comparison.name} | ${name} | ${points(current.affectedWordRate - baseline.affectedWordRate)} | ${points(current.weightedMassRate - baseline.weightedMassRate)} | ${bucketDelta >= 0 ? "+" : ""}${bucketDelta.toLocaleString("en-US")} |`,
			);
		}
	}
	return rows;
}

function bucketLine(
	variant: string,
	category: string,
	metric: CollisionMetric,
): string[] {
	return metric.buckets.slice(0, 2).map((bucket) => {
		const members = bucket.members
			.slice(0, 8)
			.map(
				(member) =>
					`${member.word}〔${member.readings.join("/")}；${member.weight}〕`,
			)
			.join("、");
		const omitted =
			bucket.members.length > 8 ? `，另 ${bucket.members.length - 8} 项` : "";
		return `- ${variant} · ${category} · \`${bucket.code}\`（${bucket.members.length} 词）：${escapeCell(members)}${omitted}`;
	});
}

export function renderCollisionMarkdown(
	report: CollisionComparisonReport,
): string {
	const lines = [
		"# 神韵与原冰雪键道双拼碰撞对比",
		"",
		"> 结论解读与双拼设计启发见[《神韵 R9 与原键道碰撞解读及双拼设计启发》](shenyun-collision-design-notes.md)。",
		"",
		"## 测量口径",
		"",
		"- 三种布局口径使用完全相同的字词、读音、权重和词频截断；同词同读音跨词典取最大权重，多音读法保留。",
		"- 二字词使用每音节完整两键码，四字词使用每音节首键，二者都是四码，因而可以测量跨词长碰撞。",
		"- “原键道规范码”只走主变换路径；“原键道可接受码”同时展开 `derive` 分支。多码词可进入多个真实桶，但受影响词数与词频质量只计一次。",
		"- 受影响率按可编码的不同字词计；词频质量按这些字词的合并权重计。二/四字内部的唯一码率指单成员码桶占比；跨词长唯一码率指未同时被二字词和四字词占用的码占比。",
		`- 词典：${report.dictionaries.join("、") || "（测试夹具）"}；解析诊断：${report.diagnosticCount.toLocaleString("en-US")}。`,
	];
	for (const cutoff of report.cutoffs) {
		lines.push(
			"",
			`## ${cutoff.label}（实际二字 ${cutoff.actualTwo.toLocaleString("en-US")}、四字 ${cutoff.actualFour.toLocaleString("en-US")}）`,
			"",
			...metricRows(cutoff),
			"",
			"### 神韵差值",
			"",
			...deltaRows(cutoff),
			"",
			"### 严重碰撞示例",
			"",
		);
		const examples = cutoff.variants.flatMap((variant) =>
			classes.flatMap(([key, name]) =>
				bucketLine(variant.name, name, variant.measurement[key]),
			),
		);
		lines.push(...(examples.length > 0 ? examples : ["- 本档位无碰撞。"]));
	}
	return `${lines.join("\n")}\n`;
}
