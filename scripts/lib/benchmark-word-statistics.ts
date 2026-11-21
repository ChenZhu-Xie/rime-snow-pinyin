import assert from "node:assert/strict";
import { countBenchmarkKeys } from "./benchmark-key-counts";
import type { BenchmarkLineReplay } from "./benchmark-replay";

export interface BenchmarkWordCounts {
	label: string;
	tokens: number;
	tokenRate: number;
	hanCharacters: number;
	codeKeys: number;
	averageEncodingLength: number;
	codeLengths: Record<string, { count: number; rate: number }>;
	inputKeys: number;
	averageCodeLength: number;
	keyLengths: Record<string, { count: number; rate: number }>;
	selections: number;
	selectionRate: number;
}

export interface BenchmarkWordStatistics {
	total: BenchmarkWordCounts;
	groups: BenchmarkWordCounts[];
}

function emptyCounts(label: string): BenchmarkWordCounts {
	return {
		label,
		tokens: 0,
		tokenRate: 0,
		hanCharacters: 0,
		codeKeys: 0,
		averageEncodingLength: 0,
		codeLengths: {},
		inputKeys: 0,
		averageCodeLength: 0,
		keyLengths: {},
		selections: 0,
		selectionRate: 0,
	};
}

/** 从最优路径的实际输出段统计词次；保留略码与附加字，不重新分词。 */
export function benchmarkWordStatistics(
	lines: ReadonlyArray<{ text: string; replay: BenchmarkLineReplay }>,
): BenchmarkWordStatistics {
	const total = emptyCounts("合计");
	const groups = ["单字", "二字", "三字", "四字", "五字及以上"].map(
		emptyCounts,
	);
	for (const { text, replay } of lines) {
		const characters = [...text];
		assert.equal(replay[0]?.[0] ?? 0, 0, "回放必须从原文起点开始");
		for (const [index, [start, code]] of replay.entries()) {
			const end = replay[index + 1]?.[0] ?? characters.length;
			assert.ok(start >= 0 && start < end && end <= characters.length);
			const word = characters.slice(start, end).join("");
			if (!/\p{Script=Han}/u.test(word)) continue;
			assert.match(word, /^\p{Script=Han}+$/u, "汉字段不能混入标点");
			const counts = countBenchmarkKeys([code]);
			const codeKeys =
				counts.keys - counts.spaces - counts.shifts - counts.selections;
			assert.ok(codeKeys > 0, "汉字段必须有编码键");
			assert.ok(counts.selections <= 1, "每个输出段最多一次选重");
			const length = end - start;
			for (const group of [total, groups[Math.min(length, 5) - 1]]) {
				group.tokens++;
				group.hanCharacters += length;
				group.codeKeys += codeKeys;
				group.inputKeys += counts.keys;
				group.selections += counts.selections;
				const bucket = (group.codeLengths[codeKeys] ??= { count: 0, rate: 0 });
				bucket.count++;
				const keyBucket = (group.keyLengths[counts.keys] ??= {
					count: 0,
					rate: 0,
				});
				keyBucket.count++;
			}
		}
	}
	for (const group of [total, ...groups]) {
		group.tokenRate = total.tokens ? group.tokens / total.tokens : 0;
		group.averageEncodingLength = group.tokens
			? group.codeKeys / group.tokens
			: 0;
		group.averageCodeLength = group.tokens ? group.inputKeys / group.tokens : 0;
		group.selectionRate = group.tokens ? group.selections / group.tokens : 0;
		for (const bucket of Object.values(group.codeLengths))
			bucket.rate = bucket.count / group.tokens;
		for (const bucket of Object.values(group.keyLengths))
			bucket.rate = bucket.count / group.tokens;
	}
	assert.equal(
		total.hanCharacters,
		lines.reduce(
			(sum, { text }) =>
				sum + [...text].filter((c) => /\p{Script=Han}/u.test(c)).length,
			0,
		),
	);
	return { total, groups };
}

const percent = (rate: number) => `${(rate * 100).toFixed(2)}%`;

export function renderBenchmarkWordStatistics(
	schemes: ReadonlyArray<{
		name: string;
		totalKeys: number;
		statistics: BenchmarkWordStatistics;
	}>,
): string {
	const maxCodeLength = Math.max(
		0,
		...schemes.flatMap(({ statistics }) =>
			Object.keys(statistics.total.keyLengths).map(Number),
		),
	);
	const codeLengths = Array.from({ length: maxCodeLength }, (_, i) => i + 1);
	const lines = [
		`| 方案 | 总按键 | 总均码／字 | 词长 | 输出段数／占比 | ${codeLengths.map((n) => `${n}键`).join(" | ")} | 均码／段 | 选重次数／率 |`,
		`| --- | ---: | ---: | --- | ---: | ${codeLengths.map(() => "---:").join(" | ")} | ---: | ---: |`,
	];
	for (const { name, totalKeys, statistics } of [...schemes].sort(
		(a, b) => a.totalKeys - b.totalKeys,
	)) {
		const total = statistics.total;
		lines.push(
			`| **${name}** | **${totalKeys}** | **${total.hanCharacters ? (totalKeys / total.hanCharacters).toFixed(4) : "—"}** | **合计** | **${total.tokens}／${percent(total.tokenRate)}** | ${codeLengths.map(() => "").join(" | ")} | **${total.averageCodeLength.toFixed(3)}** | **${total.selections}／${percent(total.selectionRate)}** |`,
		);
		for (const group of statistics.groups) {
			const distribution = codeLengths.map((length) => {
				const bucket = group.keyLengths[length];
				return bucket ? `${bucket.count}／${percent(bucket.rate)}` : "";
			});
			lines.push(
				`| | | | ${group.label} | ${group.tokens}／${percent(group.tokenRate)} | ${distribution.join(" | ")} | ${group.tokens ? group.averageCodeLength.toFixed(3) : "—"} | ${group.selections}／${percent(group.selectionRate)} |`,
			);
		}
	}
	return lines.join("\n");
}
