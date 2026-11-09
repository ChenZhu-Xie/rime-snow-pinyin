import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { ALL_BENCHMARK_SCHEMES } from "../../lib/benchmark-schemes";

const root = new URL("../../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const report = (count: "十二" | "十三" | "十四") =>
	JSON.parse(read(`reports/5000字_${count}方案最优切分实测结果.json`)) as {
		schemes: Record<string, unknown>;
	};

test("500 与 5000 字报告按十二、十三、十四方案逐级扩展", () => {
	const internalIds = ALL_BENCHMARK_SCHEMES.map(({ id }) => id);
	assert.equal(internalIds.length, 12);
	assert.ok(
		read("reports/冰雪十二方案_500字_最短键码实战测评.txt").startsWith(
			"冰雪十二方案",
		),
	);
	assert.deepEqual(Object.keys(report("十二").schemes), internalIds);
	assert.deepEqual(Object.keys(report("十三").schemes), [
		...internalIds,
		"sbxh",
	]);
	assert.deepEqual(Object.keys(report("十四").schemes), [
		...internalIds,
		"sbxh",
		"flypy",
	]);
});

test("十二、十三、十四方案各保留十篇同序逐键回放", () => {
	for (const count of ["十二", "十三", "十四"] as const) {
		const directory = new URL(
			`reports/十篇五百字_${count}方案逐键对齐回放/`,
			root,
		);
		assert.ok(existsSync(directory), `${count}方案回放目录不存在`);
		const files = readdirSync(directory)
			.filter((filename) => filename.endsWith(".md"))
			.sort((left, right) => left.localeCompare(right, "zh-CN"));
		assert.equal(files.length, 10);
		assert.deepEqual(
			files.map((filename) => filename.match(/^篇(\d{2})_/u)?.[1]),
			["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"],
		);
		assert.ok(
			files.every((filename) => filename.includes(`${count}方案逐键对齐`)),
		);
	}
});

test("旧八、九、十方案核心产物保持逐字不变", () => {
	const expected = {
		"reports/冰雪八方案_500字_最短键码实战测评.txt":
			"ea8f5173db23f749007fd06183739cc4ebfee2b8950ceb82681e615336152ffd",
		"reports/5000字_八方案最优切分实测结果.json":
			"12c9a6a965d04f6f291872c298c52da3047691db5f9e9bcf735e65e86075852c",
		"reports/5000字_九方案最优切分实测结果.json":
			"bfb3104d8b0fb7a74e09b0ea4fdd35801ef83382ace7809bd78d3a5f62098159",
		"reports/5000字_十方案最优切分实测结果.json":
			"ab930f24c3f068c53db2e90029b50fbd51f46b254d4696a0c8eab62c8ffae8e7",
	} as const;
	for (const [path, hash] of Object.entries(expected)) {
		const actual = createHash("sha256").update(read(path)).digest("hex");
		assert.equal(actual, hash, path);
	}
});
