import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { load } from "js-yaml";
import { applyAlgebra, parseAlgebraRules } from "../algebra";

const root = new URL("../../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const commonSource = read("snow_shenyun_common.yaml");
const rules = parseAlgebraRules(commonSource, "shenyun_algebra");
const layout = JSON.parse(read("config/shenyun-21x26-mapping.json")) as {
	id: string;
	capacity: [number, number];
	initialMap: Record<string, string>;
	finalMap: Record<string, string>;
};

function encode(syllable: string): string | null {
	return applyAlgebra(`${syllable}1`, rules).canonical;
}

function expectedCode(syllable: string): string {
	let initial = "";
	let final = syllable;
	if (/^[aoe]/u.test(syllable)) {
		initial = syllable[0].toUpperCase();
	} else if (syllable.startsWith("yu")) {
		initial = "YU";
		final = `v${syllable.slice(2)}`;
	} else if (syllable.startsWith("y")) {
		initial = "Y";
		final = syllable.slice(1);
	} else if (syllable.startsWith("w")) {
		initial = "W";
		final = syllable === "wu" ? "u" : syllable.slice(1);
	} else {
		initial = Object.keys(layout.initialMap)
			.filter((key) => /^[a-z]/u.test(key))
			.sort((left, right) => right.length - left.length)
			.find((key) => syllable.startsWith(key)) ?? "";
		final = syllable.slice(initial.length);
		if (/^[jqx]u/u.test(syllable)) final = `v${final.slice(1)}`;
	}
	assert.ok(initial, syllable);
	assert.ok(layout.finalMap[final], `${syllable}: ${final}`);
	return `${layout.initialMap[initial]}${layout.finalMap[final]}`.toLowerCase();
}

test("冰雪神韵·形/调共用 R10 的 21×26 映射", () => {
	assert.equal(layout.id, "R10-21X26-M39-08");
	assert.deepEqual(layout.capacity, [21, 26]);
	for (const syllable of ["bin", "gui", "ban", "zhang", "chang", "shang", "xia", "an", "yu", "yuan", "wu", "wo"]) {
		assert.equal(encode(syllable), expectedCode(syllable), syllable);
	}
});

test("Common399 的实际拼写代数逐一等于 R10 映射，且留 147 个空码", () => {
	const frozen = JSON.parse(read("docs/shenyun-r9-mapping.json")) as {
		payloadCodes: Record<string, string | null>;
	};
	const common399 = Object.entries(frozen.payloadCodes)
		.filter(([, code]) => code !== null)
		.map(([syllable]) => syllable);
	assert.equal(common399.length, 399);
	const encoded = common399.map((syllable) => {
		const code = encode(syllable);
		assert.equal(code, expectedCode(syllable), syllable);
		assert.match(code ?? "", /^[a-z]{2}$/u, syllable);
		return code;
	});
	assert.equal(new Set(encoded).size, 399);
	assert.equal(21 * 26 - new Set(encoded).size, 147);
	assert.equal(21 * 28 - new Set(encoded).size, 189);
});

test("A、U、B 键类独立，逗号句号只由标点处理", () => {
	const common = load(commonSource) as {
		speller: {
			alphabet: string;
			popping: Array<{ match: string; accept: string; strategy?: string }>;
		};
		translator: { shenyun_initial_keys: string; shenyun_final_keys: string; shenyun_auxiliary_keys: string };
	};
	const { shenyun_initial_keys: initial, shenyun_final_keys: final, shenyun_auxiliary_keys: auxiliary } = common.translator;
	assert.equal(new Set(initial).size, 21);
	assert.equal(new Set(final).size, 26);
	assert.equal(new Set(auxiliary).size, 5);
	assert.equal([...auxiliary].some((key) => initial.includes(key)), false);
	assert.equal(common.speller.alphabet, "abcdefghijklmnopqrstuvwxyz");
	assert.equal(final.includes(",") || final.includes("."), false);
	assert.deepEqual(common.speller.popping[0], {
		match: "^[a-z]+$",
		accept: "[a-z]",
		strategy: "conditional",
	});
	assert.deepEqual(common.speller.popping[1], {
		match: ".*[a-z0-9]",
		accept: "[^a-z0-9 ]",
	});
});

test("调：首 B 声调、后续 B 笔画，数字 1 独立筛部首", () => {
	const tone = load(read("snow_shenyun_tone.schema.yaml")) as {
		patch: {
			"translator/shape_elements": string;
			"translator/shape_mapping": string;
			"speller/shape": Array<{ match?: string; match_shape?: string; accept: string }>;
		};
	};
	assert.equal(tone.patch["translator/shape_elements"], "snow_bushou");
	assert.equal(tone.patch["translator/shape_mapping"], "radical_sanpin.txt");
	assert.deepEqual(tone.patch["speller/shape"], [
		{ match: "^[bpmfdtnlgkhjqwvxrzcsy][a-z][aeuio]?$", accept: "1" },
		{ match_shape: "1", accept: "[a-z]" },
	]);
	const lua = read("lua/snow/shenyun.lua");
	assert.match(lua, /local tone_keys = \{ \["1"\] = "i", \["2"\] = "e", \["3"\] = "u", \["4"\] = "a", \["5"\] = "o" \}/u);
	assert.match(lua, /local stroke_keys = \{ h = "e", s = "i", p = "u", n = "o", z = "a" \}/u);
	assert.match(lua, /radical_input:sub\(1, 1\) ~= "1"/u);
});

test("两个飞花原型都随部署带上共用配置", () => {
	for (const [file, name] of [
		["snow_shenyun_shape.schema.yaml", "冰雪神韵·形"],
		["snow_shenyun_tone.schema.yaml", "冰雪神韵·调"],
	] as const) {
		const schema = load(read(file)) as { schema: { name: string } };
		assert.equal(schema.schema.name, name);
	}
	assert.match(read("scripts/tasks.ts"), /"snow_shenyun_common\.yaml"/u);
});

test("冰雪神韵·形/调 21×26 一级简码与单字候选列表完备性", () => {
	const initialKeys = "bpmfdtnlgkhjqwvxrzcsy";
	const auxiliaryKeys = "aeuio";
	const expectedFirst = {
		b: "不", p: "平", m: "没", f: "这", d: "是", t: "他", n: "你",
		l: "了", g: "个", k: "可", h: "和", j: "就", q: "在", x: "下",
		z: "人", c: "才", s: "三", r: "的", y: "一", w: "我", v: "出",
	} as Record<string, string>;

	for (const filename of ["snow_shenyun_shape.fixed.txt", "snow_shenyun_tone.fixed.txt"]) {
		const content = read(filename);
		const lines = content.split(/\r?\n/).filter((line) => line && !line.startsWith("#"));
		assert.equal(lines.length, 21, `文件 ${filename} 应恰好包含 21 个声键条目`);
		const keys = new Set<string>();

		for (const line of lines) {
			const [key, candidatesStr] = line.split("\t");
			assert.ok(key && initialKeys.includes(key), `键 ${key} 必须属于 21 声母键`);
			assert.equal(auxiliaryKeys.includes(key), false, `辅码键 ${key} 不能作为声键`);
			assert.equal(keys.has(key), false, `键 ${key} 不能重复`);
			keys.add(key);

			const candidates = candidatesStr.trim().split(/\s+/);
			assert.equal(candidates.length, 6, `键 ${key} 候选列表应为 1 首选 + 5 次选`);
			assert.equal(candidates[0], expectedFirst[key], `键 ${key} 的首选字必须为 ${expectedFirst[key]}`);
		}
		assert.equal(keys.size, 21);
	}

	const lua = read("lua/snow/shenyun.lua");
	assert.match(lua, /n == 1 and contains\(A, input\)/u, "shenyun.lua 必须支持单声母简拼路由");
});

