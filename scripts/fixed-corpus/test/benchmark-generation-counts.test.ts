import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { exact500Articles } from "../../exact_500_articles";
import type { BenchmarkWordStatistics } from "../../lib/benchmark-word-statistics";

const root = new URL("../../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const report = (count: "十" | "十一" | "十二") =>
	JSON.parse(read(`reports/5000字_当前${count}方案最优切分实测结果.json`)) as {
		schemes: Record<string, unknown>;
	};

test("当前 500 与 5000 字报告按十、十一、十二方案逐级扩展", () => {
	const internalIds = Object.keys(report("十").schemes);
	assert.equal(internalIds.length, 10);
	assert.ok(
		read("reports/冰雪当前十方案_500字_最短键码实战测评.txt").startsWith(
			"冰雪当前十方案",
		),
	);
	assert.deepEqual(Object.keys(report("十一").schemes), [
		...internalIds,
		"sbxh",
	]);
	assert.deepEqual(Object.keys(report("十二").schemes), [
		...internalIds,
		"sbxh",
		"flypy",
	]);
});

test("当前十、十一、十二方案各保留十篇同序逐键回放", () => {
	for (const count of ["十", "十一", "十二"] as const) {
		const directory = new URL(
			`reports/十篇五百字_当前${count}方案逐键对齐回放/`,
			root,
		);
		assert.ok(existsSync(directory));
		const files = readdirSync(directory)
			.filter((name) => name.endsWith(".md"))
			.sort();
		assert.equal(files.length, 10);
		assert.deepEqual(
			files.map((name) => name.match(/^篇(\d{2})_/u)?.[1]),
			["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"],
		);
	}
});

test("5500 字十二方案确已计入第十一场景的额外 500 字", () => {
	const current = report("十二");
	const extended = JSON.parse(
		read("reports/5500字_当前十二方案最优切分实测结果.json"),
	);
	assert.deepEqual(Object.keys(extended.schemes), Object.keys(current.schemes));
	for (const [id, value] of Object.entries(current.schemes)) {
		const scheme = value as {
			total: { keys: number };
			articles: Array<{ keys: number }>;
		};
		assert.equal(
			extended.schemes[id].total.keys,
			scheme.total.keys + scheme.articles[9].keys,
			id,
		);
	}
	const scenes = readdirSync(
		new URL("reports/十一场景_5500字_当前十二方案逐键对齐回放/", root),
	);
	assert.equal(scenes.filter((name) => name.endsWith(".md")).length, 11);
	assert.ok(scenes.includes("场景11_独立赛文_500字.md"));
	const lines = JSON.parse(
		read("scripts/data/benchmark-article10.json"),
	) as string[];
	assert.deepEqual(lines, exact500Articles[9].lines);
	assert.equal(
		[...lines.join("")].filter((char) => /\p{Script=Han}/u.test(char)).length,
		500,
	);
});

test("5500 字统一表与原切分词次、码长加权和、选重及总按键逐项相符", () => {
	const baseline = JSON.parse(
		read("reports/5000字_当前十二方案最优切分实测结果.json"),
	);
	const extended = JSON.parse(
		read("reports/5500字_当前十二方案最优切分实测结果.json"),
	);
	const wordKeys = ["c1", "c2", "c3", "c4", "c5plus"];
	for (const [id, value] of Object.entries(extended.schemes)) {
		const scheme = value as {
			total: {
				keys: number;
				spaces: number;
				shifts: number;
				selections: number;
			};
			wordStatistics: BenchmarkWordStatistics;
		};
		const stats = scheme.wordStatistics;
		assert.equal(stats.total.hanCharacters, 5500, id);
		assert.equal(stats.total.selections, scheme.total.selections, id);
		assert.equal(
			stats.total.inputKeys + extended.corpus.punctuationCharacters,
			scheme.total.keys,
			id,
		);
		assert.equal(
			stats.total.tokens,
			stats.groups.reduce((sum, group) => sum + group.tokens, 0),
			id,
		);
		assert.equal(
			stats.total.codeKeys,
			stats.groups.reduce((sum, group) => sum + group.codeKeys, 0),
			id,
		);
		assert.equal(
			stats.total.inputKeys,
			stats.groups.reduce((sum, group) => sum + group.inputKeys, 0),
			id,
		);
		assert.equal(
			stats.total.selections,
			stats.groups.reduce((sum, group) => sum + group.selections, 0),
			id,
		);
		assert.equal(
			stats.total.codeKeys +
				extended.corpus.punctuationCharacters +
				scheme.total.spaces +
				scheme.total.shifts +
				scheme.total.selections,
			scheme.total.keys,
			id,
		);
		for (const [index, group] of stats.groups.entries()) {
			const expected =
				baseline.schemes[id].total.tokens[wordKeys[index]] +
				baseline.schemes[id].articles[9].tokenCounts[wordKeys[index]];
			assert.equal(
				group.tokens,
				expected,
				`${id}/${group.label}/复用原切分计数`,
			);
			assert.equal(
				Object.values(group.codeLengths).reduce(
					(sum, bucket) => sum + bucket.count,
					0,
				),
				group.tokens,
				id,
			);
			assert.equal(
				Object.entries(group.codeLengths).reduce(
					(sum, [length, bucket]) => sum + Number(length) * bucket.count,
					0,
				),
				group.codeKeys,
				id,
			);
			assert.equal(group.tokenRate, group.tokens / stats.total.tokens, id);
			assert.equal(
				group.averageCodeLength,
				group.tokens ? group.codeKeys / group.tokens : 0,
				id,
			);
			assert.equal(
				group.selectionRate,
				group.tokens ? group.selections / group.tokens : 0,
				id,
			);
			for (const bucket of Object.values(group.codeLengths))
				assert.equal(bucket.rate, bucket.count / group.tokens, id);
			assert.equal(
				Object.values(group.keyLengths).reduce(
					(sum, bucket) => sum + bucket.count,
					0,
				),
				group.tokens,
				id,
			);
			assert.equal(
				Object.entries(group.keyLengths).reduce(
					(sum, [length, bucket]) => sum + Number(length) * bucket.count,
					0,
				),
				group.inputKeys,
				id,
			);
			assert.equal(
				group.averageKeyLength,
				group.tokens ? group.inputKeys / group.tokens : 0,
				id,
			);
			for (const bucket of Object.values(group.keyLengths))
				assert.equal(bucket.rate, bucket.count / group.tokens, id);
		}
	}
	const markdown = read("reports/十一场景_5500字_当前十二方案对比评测.md");
	assert.equal((markdown.match(/\| \*\*合计\*\* \|/gu) ?? []).length, 12);
});
