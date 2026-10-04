import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { load } from "js-yaml";
import { applyAlgebra, parseAlgebraRules } from "../algebra";

const root = new URL("../../../", import.meta.url);
const commonSource = readFileSync(
	new URL("snow_shenyun_common.yaml", root),
	"utf8",
);
const rules = parseAlgebraRules(
	commonSource,
	"shenyun_algebra",
);

function encode(syllable: string): string | null {
	return applyAlgebra(`${syllable}1`, rules).canonical;
}

test("冰雪神韵·形/调共用冻结的 21×28 均衡映射", () => {
	assert.equal(encode("bin"), "b,");
	assert.equal(encode("gui"), "g,");
	assert.equal(encode("ban"), "b.");
	assert.equal(encode("zhang"), "wn");
	assert.equal(encode("chang"), "vn");
	assert.equal(encode("shang"), "xn");
	assert.equal(encode("xia"), "fp");
	assert.equal(encode("an"), "j.");
	assert.equal(encode("yu"), "yb");
	assert.equal(encode("yuan"), "yx");
	assert.equal(encode("wu"), "qu");
	assert.equal(encode("wo"), "qo");
});

test("Common399 在 21×28 声韵空间无重", () => {
	const frozen = JSON.parse(
		readFileSync(new URL("docs/shenyun-r9-mapping.json", root), "utf8"),
	) as { codes: Record<string, string | null> };
	const layout = JSON.parse(
		readFileSync(new URL("config/shenyun-21x28-mapping.json", root), "utf8"),
	) as { excludedFromCommon399: string[] };
	const excluded = new Set(layout.excludedFromCommon399);
	const common399 = Object.keys(frozen.codes).filter(
		(syllable) => !excluded.has(syllable),
	);
	assert.equal(common399.length, 399);
	const encoded = common399.map((syllable) => {
		const code = encode(syllable);
		assert.match(code ?? "", /^[a-z,.]{2}$/u, syllable);
		return code;
	});
	assert.equal(new Set(encoded).size, 399);
});

test("A、U、B 键类和标点约束保持冻结", () => {
	const initialKeys = new Set("bpmfdtnlgkhjqwvxrzcsy");
	const auxiliaryKeys = new Set("aeuio");
	assert.equal(initialKeys.size, 21);
	assert.equal([...auxiliaryKeys].some((key) => initialKeys.has(key)), false);
	assert.equal(",.".split("").some((key) => auxiliaryKeys.has(key)), false);
});

test(",/. 只在合法 U 位置进入编码，其他位置恢复标点顶功", () => {
	const common = load(commonSource) as {
		speller: {
			alphabet: string;
			popping: Array<{ match: string; accept: string; strategy: string }>;
		};
	};
	assert.equal(common.speller.alphabet.endsWith(",."), true);
	assert.deepEqual(common.speller.popping[0], {
		match: ".+",
		accept: "[abcdefghijklmnopqrstuvwxyz,.]",
		strategy: "conditional",
	});
	const popping = readFileSync(new URL("lua/snow/popping.lua", root), "utf8");
	assert.match(popping, /input == "\." and not env\.period_is_code/u);
});

test("两个原型使用间隔号显示名并随部署带上共用配置", () => {
	for (const [file, name] of [
		["snow_shenyun_shape.schema.yaml", "冰雪神韵·形"],
		["snow_shenyun_tone.schema.yaml", "冰雪神韵·调"],
	] as const) {
		const schema = load(readFileSync(new URL(file, root), "utf8")) as {
			schema: { name: string };
		};
		assert.equal(schema.schema.name, name);
	}
	const tasks = readFileSync(new URL("scripts/tasks.ts", root), "utf8");
	assert.match(tasks, /"snow_shenyun_common\.yaml"/u);
});
