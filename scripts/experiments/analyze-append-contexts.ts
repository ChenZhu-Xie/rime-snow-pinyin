// 依赖 compare-append-characters.ts / query-append-characters.ts 保存的冻结源码与本地观测。
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
	appendProbeInput,
	retargetBenchmarkAppend,
	type AppendPrefixObservation,
} from "../lib/benchmark-append-experiment";
import { countBenchmarkKeys } from "../lib/benchmark-key-counts";
import type {
	BenchmarkAlternative,
	BenchmarkPathResult,
} from "../lib/benchmark-paths";
import { rootPath } from "../lib/paths";

const directory = rootPath("output/append-generalization");
const experiment = rootPath("output/append-characters");
const source = join(
	experiment,
	"source-27019df92c87dbdbed52da18f9ded7d8bf5ac031",
);
const load = (path: string) => import(pathToFileURL(join(source, path)).href);
const { exact500Articles } = await load("scripts/exact_500_articles.ts");
const { corpusArticles } = await load("scripts/benchmark_corpus.ts");
const { buildBenchmarkCorpus, buildAlternatives } = await load(
	"scripts/generate_full_benchmark_reports.ts",
);
const { optimizeBenchmarkLine } = await load("scripts/lib/benchmark-paths.ts");
const baseline = JSON.parse(
	readFileSync(
		join(source, "reports/5000字_当前十方案最优切分实测结果.json"),
		"utf8",
	),
);
const rows = new Map<string, AppendPrefixObservation>(
	readFileSync(join(baseline.candidateCache, "snow_landao.jsonl"), "utf8")
		.trim()
		.split(/\r?\n/u)
		.map((line) => {
			const row = JSON.parse(line);
			return [row.code, row];
		}),
);
const get = (input: string) => {
	const row = rows.get(input);
	assert.ok(row, input);
	return row;
};
const observations = new Map<string, AppendPrefixObservation>();
for (const line of readFileSync(
	join(experiment, "native-observations/observations.jsonl"),
	"utf8",
)
	.trim()
	.split(/\r?\n/u)) {
	const row = JSON.parse(line);
	if (row.schema === "snow_landao" && row.kind === "state" && row.tail === "了")
		observations.set(row.input, row);
}
const corpus = buildBenchmarkCorpus(
	exact500Articles.flatMap((article: { lines: string[] }) => article.lines),
);
const {
	alternatives: pool,
}: { alternatives: Map<string, BenchmarkAlternative[]> } = buildAlternatives(
	corpus,
	"oc21-shape",
	(input: string) => get(input).candidates,
	(input: string) => {
		const row = get(input);
		return row.completed ? row.commit : "";
	},
);
const variants = new Map(
	["了", "与", "在"].map((tail) => {
		const result = retargetBenchmarkAppend(
			pool,
			corpus.targetWords,
			tail,
			(input) => observations.get(input) ?? rows.get(input),
		);
		assert.equal(result.missing.length, 0);
		return [tail, result.alternatives] as const;
	}),
);
const lexicon = new Set<string>();
for (const name of [
	"snow_pinyin.dict.yaml",
	"snow_pinyin.base.dict.yaml",
	"snow_pinyin.ext.dict.yaml",
	"snow_pinyin.tencent.dict.yaml",
	"snow_pinyin.user.dict.yaml",
])
	for (const line of readFileSync(join(source, name), "utf8").split(/\r?\n/u)) {
		const word = line.split("\t")[0];
		if (word?.includes("与") && /^\p{Script=Han}+$/u.test(word))
			lexicon.add(word);
	}
const scenes = [...exact500Articles, exact500Articles[9]];
const occurrences: Array<Record<string, unknown>> = [];
const genreStats: Array<Record<string, unknown>> = [];
let number = 0;
const display = (
	path: BenchmarkPathResult,
	characters: string[],
	index: number,
) => {
	const tokenIndex = path.tokens.findIndex(
		(token) => token.start <= index && token.end > index,
	);
	const token = path.tokens[tokenIndex];
	return {
		word: token.word,
		code: token.displayCode + (token.separator ? "_" : ""),
		length: [...token.word].length,
		offset: index - token.start,
		left: path.tokens[tokenIndex - 1]?.word ?? "",
		right: path.tokens[tokenIndex + 1]?.word ?? "",
		contextTokens: path.tokens
			.slice(Math.max(0, tokenIndex - 2), tokenIndex + 3)
			.map((entry) => ({
				word: entry.word,
				code: entry.displayCode + (entry.separator ? "_" : ""),
			})),
		appended: token.displayCode.includes("/") && token.word.endsWith("与"),
		appendedBase: token.displayCode.includes("/")
			? [...token.word].slice(0, -1).join("")
			: null,
		input: appendProbeInput(token.displayCode),
		localKeys: countBenchmarkKeys([
			token.displayCode + (token.separator ? "_" : ""),
		]).keys,
	};
};
for (const [sceneIndex, article] of scenes.entries()) {
	const stats: Record<string, number> = { 与: 0, 在: 0, 了: 0 };
	const keys: Record<string, number> = { 与: 0, 在: 0, 了: 0 };
	for (const [lineIndex, text] of (article.lines as string[]).entries()) {
		const characters = [...text];
		for (const character of ["与", "在", "了"])
			stats[character] += characters.filter(
				(value) => value === character,
			).length;
		const baselinePath: BenchmarkPathResult = optimizeBenchmarkLine(text, pool);
		const newPaths = Object.fromEntries(
			[...variants].map(([tail, alternatives]) => [
				tail,
				optimizeBenchmarkLine(text, alternatives),
			]),
		) as Record<string, BenchmarkPathResult>;
		for (const tail of Object.keys(keys)) keys[tail] += newPaths[tail].keys;
		for (const [index, character] of characters.entries()) {
			if (character !== "与") continue;
			const ordinal = ++number;
			const matches = Object.fromEntries(
				[2, 3, 4].map((length) => [
					length,
					Array.from({ length }, (_, offset) => index - offset)
						.filter(
							(start) => start >= 0 && start + length <= characters.length,
						)
						.map((start) => characters.slice(start, start + length).join(""))
						.filter((word) => lexicon.has(word)),
				]),
			);
			// 人工逐处审读的语法分类；不是把机器切分当作词性识别。
			const role =
				ordinal === 26
					? "固定表达「与此同时」"
					: [37, 43].includes(ordinal)
						? "介词／引入关联对象"
						: "并列连接 A与B";
			occurrences.push({
				number: ordinal,
				scene: sceneIndex + 1,
				genre: article.genre,
				line: lineIndex + 1,
				position: index,
				role,
				sentence: text,
				context:
					characters.slice(Math.max(0, index - 12), index).join("") +
					"【与】" +
					characters.slice(index + 1, index + 13).join(""),
				baseline: display(baselinePath, characters, index),
				appendYu: display(newPaths.与, characters, index),
				lexiconMatches: matches,
			});
		}
	}
	genreStats.push({
		scene: sceneIndex + 1,
		genre: article.genre,
		counts: stats,
		keys,
		netSavingYu: keys.了 - keys.与,
		netSavingZai: keys.了 - keys.在,
		originalDraftYu:
			sceneIndex < 10
				? [...corpusArticles[sceneIndex].text].filter(
						(character) => character === "与",
					).length
				: null,
	});
}
assert.equal(number, 56);
const lengthCounts: Record<string, number> = {};
const roleCounts: Record<string, number> = {};
for (const row of occurrences) {
	const base = row.baseline as { length: number };
	lengthCounts[base.length] = (lengthCounts[base.length] ?? 0) + 1;
	roleCounts[row.role as string] = (roleCounts[row.role as string] ?? 0) + 1;
}
const lexiconTypes = [2, 3, 4].map((length) => {
	const words = [...lexicon].filter((word) => [...word].length === length);
	return {
		length,
		types: words.length,
		initial: words.filter((word) => word.startsWith("与")).length,
		final: words.filter((word) => word.endsWith("与")).length,
		medial: words.filter(
			(word) => !word.startsWith("与") && !word.endsWith("与"),
		).length,
	};
});
writeFileSync(
	join(directory, "contexts5500.json"),
	JSON.stringify(
		{
			definition:
				"逐处人工审读语法角色；baseline/appendYu 为冰雪兰道输入段，不等于语言学词；字典类型数不等于语料频率",
			roleCounts,
			baselineInputLengthCounts: lengthCounts,
			lexiconTypes,
			genreStats,
			occurrences,
		},
		null,
		2,
	) + "\n",
);
writeFileSync(
	join(directory, "contexts5500.tsv"),
	[
		"序号\t场景\t文体\t人工分类\t上下文\t原输入段\t原编码\t改为与后的输入段\t新编码\t当前候选后追加的与",
		...occurrences.map((row) => {
			const a = row.baseline as ReturnType<typeof display>;
			const b = row.appendYu as ReturnType<typeof display>;
			return [
				row.number,
				row.scene,
				row.genre,
				row.role,
				row.context,
				a.word,
				a.code,
				b.word,
				b.code,
				b.appendedBase ?? "",
			].join("\t");
		}),
	].join("\n") + "\n",
);
console.log(
	JSON.stringify(
		{
			roleCounts,
			lengthCounts,
			lexiconTypes,
			genreStats,
			examples: occurrences.filter((row) =>
				[2, 15, 26, 37, 42, 43].includes(row.number as number),
			),
		},
		null,
		2,
	),
);
