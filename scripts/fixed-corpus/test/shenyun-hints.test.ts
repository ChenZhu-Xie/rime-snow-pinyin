import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { rootPath } from "../../lib/paths";
import { readShenyunHints } from "../../lib/shenyun-hints";

const data = readShenyunHints();

test("声声提示不包含尾字键可构造的二字词", () => {
	for (const result of [data, readShenyunHints(true)])
		for (const entries of Object.values(result.hints))
			for (const entry of entries)
				assert.doesNotMatch(entry.text, /[的了是]$/u);
});

test("21×26 单键提示覆盖全部 129 个声声空桶，每桶只保留首选代表词", () => {
	assert.equal(data.vacant.length, 142);
	assert.equal(data.vacantAA.length, 129);
	for (const entries of Object.values(data.hints)) {
		assert.equal(entries.length, 129);
		assert.deepEqual(
			entries.map(({ code }) => code).sort(),
			[...data.vacantAA].sort(),
		);
		assert.equal(new Set(entries.map(({ code }) => code)).size, 129);
		assert.ok(entries.every(({ text }) => [...text].length === 2));
		assert.ok(
			!entries.some(({ code }) => ["sm", "ve", "se", "gi"].includes(code)),
		);
		for (const initial of data.initialKeys) {
			const weights = entries
				.filter(({ code }) => code[0] === initial)
				.map(({ weight }) => weight);
			assert.deepEqual(
				weights,
				[...weights].sort((left, right) => right - left),
			);
		}
	}
});

test("有固顶的桶沿用实际首选，无固顶的桶补入系统高频首选，超过五桶继续顺延", () => {
	for (const entries of Object.values(data.hints)) {
		assert.deepEqual(
			entries
				.filter(({ code }) => code[0] === "s")
				.map(({ code, text }) => [code, text]),
			[
				["sx", "支持"],
				["sw", "这样"],
				["sz", "正在"],
				["sv", "这时"],
				["sr", "转让"],
				["sb", "这边"],
			],
		);
		assert.equal(entries.find(({ code }) => code === "cw")?.text, "采用");
	}
});

test("s 单字的系统字频基线与真实候选回归的先后顺序一致", () => {
	const singles = data.characters
		.filter(({ code }) => code[0] === "s")
		.sort((left, right) => right.weight - left.weight);
	assert.deepEqual(
		singles.slice(0, 6).map(({ text }) => text),
		["这", "中", "着", "真", "只", "找"],
	);
	assert.equal(singles.find(({ text }) => text === "中")?.code, "sm");
});

test("两个 21×26 方案使用独立空桶提示，原有 21×21 方案继续使用 630 提示", () => {
	const common = readFileSync(rootPath("snow_shenyun_common.yaml"), "utf8");
	assert.match(common, /lua_filter@\*snow\.shenyun_hint/u);
	assert.doesNotMatch(common, /lua_filter@\*snow\.hint\b/u);
	for (const schema of [
		"snow_landao",
		"snow_lanpin",
		"snow_jiandao",
		"snow_sanpin",
	]) {
		assert.match(
			readFileSync(rootPath(`${schema}.schema.yaml`), "utf8"),
			/lua_filter@\*snow\.hint\b/u,
		);
	}
});
