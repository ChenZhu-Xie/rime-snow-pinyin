import assert from "node:assert/strict";
import test from "node:test";
import {
	candidatePools,
	FirstChoicePools,
	relevantCharacterCodes,
	minimumFirstChoices,
	physicalKeys,
	summarizeFirstChoices,
	type CharacterRoute,
} from "../../lib/character-first-choice";
import { pronunciationCodes, productionCharacterCodes } from "../../lib/benchmark-schemes";

test("四拼部件入口键本身保留候选，覆盖 CI 的滴与酒短码", () => {
	for (const [text, reading, code] of [["滴", "di1", "di1"], ["酒", "jiu3", "jo1"]]) {
		const routes = productionCharacterCodes("sipin", text, reading);
		assert.ok(routes.some(route => route.code === code), `${text}/${code}`);
	}
});

test("Top m 仅改变分母，范围外字和固定词继续占用首选", () => {
	const routes: CharacterRoute[] = [
		{ text: "甲", code: "ba", weight: 1, order: 0 },
		{ text: "乙", code: "ba", weight: 10, order: 1 },
		{ text: "甲", code: "baa", weight: 1, order: 0 },
		{ text: "甲", code: "baae", weight: 1, order: 0 },
	];
	const choices = minimumFirstChoices(
		routes,
		candidatePools(routes),
		new Map([["baa", ["固定词"]]]),
		"move",
	);
	assert.equal(choices.get("甲")?.keys, 4);
	assert.deepEqual(
		summarizeFirstChoices([{ text: "甲", frequency: 100 }], choices)
			.distribution,
		{ 4: 1 },
	);
	assert.equal(choices.get("乙")?.keys, 2);
});

test("有限竞争池与全池给出相同首选，保留范围外字、固顶与重复读音竞争", () => {
	const routes: CharacterRoute[] = [];
	for (const code of ["a", "ab", "abc", "abcd", "abce", "abcdf"])
		for (let index = 0; index < 60; index++)
			routes.push({
				text: `候选${index}`,
				code,
				weight: 100 - index,
				order: index,
				deferred: index % 4 === 0,
			});
	routes.push({ text: "候选59", code: "abcd", weight: 200, order: 200 });
	const targets = [
		{ text: "候选59", code: "abcdf", weight: 1, order: 1 },
		{ text: "候选58", code: "abce", weight: 1, order: 1 },
	];
	const fixed = new Map([["ab", ["固顶词", "候选1"]]]);
	const builder = new FirstChoicePools(relevantCharacterCodes(targets), fixed);
	for (const route of routes) builder.add(route);
	const bounded = builder.finish();
	assert.ok(
		[...bounded].every(
			([code, texts]) =>
				texts.length <= code.length + (fixed.get(code)?.length ?? 0) + 1,
		),
	);
	for (const mode of ["none", "move", "exclude"] as const) {
		const first = new Map();
		const second = new Map();
		minimumFirstChoices(
			targets,
			candidatePools(routes),
			fixed,
			mode,
			(code, text) => first.set(code, text),
		);
		minimumFirstChoices(targets, bounded, fixed, mode, (code, text) =>
			second.set(code, text),
		);
		assert.deepEqual(second, first);
	}
});

test("静态简码清空历史，动态补码的首选沿各分支独立后置", () => {
	const routes: CharacterRoute[] = [
		{ text: "甲", code: "ba", weight: 100, order: 0 },
		{ text: "甲", code: "baae", weight: 100, order: 0 },
		{ text: "乙", code: "baae", weight: 90, order: 1 },
		{ text: "甲", code: "baaee", weight: 100, order: 0 },
		{ text: "乙", code: "baaee", weight: 90, order: 1 },
		{ text: "甲", code: "baaei", weight: 100, order: 0 },
		{ text: "丙", code: "baaei", weight: 90, order: 2 },
	];
	const seen = new Map<string, string | undefined>();
	minimumFirstChoices(
		routes,
		candidatePools(routes),
		new Map(),
		"exclude",
		(code, first) => seen.set(code, first),
		(code) => code.length <= 3,
	);
	assert.equal(seen.get("baae"), "甲");
	assert.equal(seen.get("baaee"), "乙");
	assert.equal(seen.get("baaei"), "丙");
});

test("冰雪后置只查看前十项，全部已见时优先最近首选", () => {
	const rows: CharacterRoute[] = [];
	for (let length = 1; length <= 12; length++)
		for (let index = 0; index < 12; index++)
			rows.push({
				text: `字${index}`,
				code: "a".repeat(length),
				weight: 100 - index,
				order: index,
			});
	const observed = new Map();
	minimumFirstChoices(
		rows,
		candidatePools(rows),
		new Map(),
		"move",
		(code, text) => observed.set(code.length, text),
	);
	assert.equal(observed.get(10), "字9");
	assert.equal(observed.get(11), "字9");
	assert.equal(observed.get(12), "字9");
});

test("未获首选不能伪装成总体均键，Shift 和频次加权另外核算", () => {
	assert.equal(physicalKeys("abC"), 4);
	const cohort = [
		{ text: "甲", frequency: 100 },
		{ text: "乙", frequency: 1 },
	];
	const choices = new Map([["甲", { code: "a", keys: 1 }]]);
	const stat = summarizeFirstChoices(cohort, choices);
	assert.equal(stat.mean, null);
	assert.equal(stat.coveredMean, 1);
	assert.deepEqual(stat.missing, ["乙"]);
	choices.set("乙", { code: "bbb", keys: 3 });
	assert.equal(summarizeFirstChoices(cohort, choices).mean, 2);
	assert.equal(
		summarizeFirstChoices(cohort, choices).frequencyWeightedCoveredMean,
		103 / 101,
	);
});

test("单字全笔画枚举不受赛文默认四辅截面限制，原默认保持不变", () => {
	const regular = pronunciationCodes("oc21-tone", "曦", ["xi1"]);
	const full = pronunciationCodes("oc21-tone", "曦", ["xi1"], {
		singleAuxiliaryLimit: Infinity,
	});
	assert.ok(regular.every(({ auxiliaryLength }) => auxiliaryLength <= 4));
	assert.ok(full.some(({ auxiliaryLength }) => auxiliaryLength > 4));
	assert.ok(
		regular.every(({ code }) => full.some((value) => value.code === code)),
	);
});
