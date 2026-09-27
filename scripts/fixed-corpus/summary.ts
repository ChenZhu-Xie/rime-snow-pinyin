import type { CorpusRecord } from "./types";

export interface SourceCollectionSummary {
	id: string;
	name: string;
	family: string;
	resolution: string;
	recordCount: number;
	fileCount: number;
}

export interface WordCoverage {
	word: string;
	sourceCount: number;
	familyCount: number;
	sources: string[];
	families: string[];
}

export interface CorpusSummary {
	schemaVersion: 1;
	recordCount: number;
	uniqueWordCount: number;
	sourceCount: number;
	familyCount: number;
	categoryCounts: Record<string, number>;
	sources: SourceCollectionSummary[];
	wordCoverage: WordCoverage[];
}

export function summarizeCorpus(
	records: CorpusRecord[],
	sources: SourceCollectionSummary[],
): CorpusSummary {
	const coverage = new Map<string, { sources: Set<string>; families: Set<string> }>();
	const categoryCounts: Record<string, number> = {};
	for (const record of records) {
		const entry = coverage.get(record.word) ?? {
			sources: new Set<string>(),
			families: new Set<string>(),
		};
		entry.sources.add(record.sourceId);
		entry.families.add(record.family);
		coverage.set(record.word, entry);
		categoryCounts[record.category] = (categoryCounts[record.category] ?? 0) + 1;
	}
	const wordCoverage = [...coverage.entries()]
		.map(([word, entry]) => ({
			word,
			sourceCount: entry.sources.size,
			familyCount: entry.families.size,
			sources: [...entry.sources].sort(),
			families: [...entry.families].sort(),
		}))
		.sort(
			(a, b) =>
				b.familyCount - a.familyCount ||
				b.sourceCount - a.sourceCount ||
				a.word.localeCompare(b.word, "zh-CN"),
		);
	return {
		schemaVersion: 1,
		recordCount: records.length,
		uniqueWordCount: coverage.size,
		sourceCount: sources.length,
		familyCount: new Set(sources.map((source) => source.family)).size,
		categoryCounts: Object.fromEntries(
			Object.entries(categoryCounts).sort(([a], [b]) => a.localeCompare(b)),
		),
		sources,
		wordCoverage,
	};
}

export function renderSummaryMarkdown(summary: CorpusSummary): string {
	const lines = [
		"# 固顶候选语料摘要",
		"",
		`- 记录：${summary.recordCount.toLocaleString("zh-CN")}`,
		`- 去重字词：${summary.uniqueWordCount.toLocaleString("zh-CN")}`,
		`- 已解析来源：${summary.sourceCount}`,
		`- 独立家族：${summary.familyCount}`,
		"",
		"## 来源",
		"",
		"| 来源 | 家族 | 解析方式 | 文件 | 记录 |",
		"|---|---|---:|---:|---:|",
	];
	for (const source of summary.sources) {
		lines.push(
			`| ${source.name}（${source.id}） | ${source.family} | ${source.resolution} | ${source.fileCount} | ${source.recordCount.toLocaleString("zh-CN")} |`,
		);
	}
	lines.push("", "## 多来源覆盖最高的字词", "", "| 字词 | 来源数 | 家族数 |", "|---|---:|---:|");
	for (const entry of summary.wordCoverage.slice(0, 50)) {
		lines.push(`| ${entry.word.replace(/\|/gu, "\\|")} | ${entry.sourceCount} | ${entry.familyCount} |`);
	}
	return `${lines.join("\n")}\n`;
}

