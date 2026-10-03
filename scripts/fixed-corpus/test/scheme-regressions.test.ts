import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("the shared key binder does not alias Ctrl+B/F to arrow keys", () => {
	const schema = load(read("snow_pinyin.schema.yaml")) as {
		key_binder: { bindings: Array<{ accept?: string }> };
	};
	const acceptedKeys = schema.key_binder.bindings.flatMap((binding) =>
		binding.accept ? [binding.accept] : [],
	);
	assert.ok(!acceptedKeys.includes("Control+b"));
	assert.ok(!acceptedKeys.includes("Control+f"));
});

test("Three-Code and KeyTao share the Four-Code 23890 selection layout", () => {
	for (const schema of [
		"snow_sanpin.schema.yaml",
		"snow_jiandao.schema.yaml",
	]) {
		assert.match(read(schema), /menu\/alternative_select_keys: "_23890"/u);
	}
	const history = read("lua/snow/history.lua");
	assert.doesNotMatch(history, /char == "[456]"/u);
	for (const key of ["2", "3", "8", "9", "0"])
		assert.match(history, new RegExp(`char == "${key}"`, "u"));
});

test("Three-Code uses v, not e, for the horizontal-stroke assist code", () => {
	const filter = read("lua/snow/shape_filter.lua");
	assert.match(
		filter,
		/local sanpin_stroke_map = \{ \["一"\] = "v", \["丨"\] = "i", \["丿"\] = "u", \["丶"\] = "o", \["乙"\] = "a" \}/u,
	);
	assert.match(
		filter,
		/elseif id == "snow_sanpin"[\s\S]+stroke_match\(text, shape_input, env, sanpin_stroke_map\)/u,
	);
	assert.equal("hshh".replaceAll("h", "v").replaceAll("s", "i"), "vivv");
});

test("word-initial and word-final selection runs before popping", () => {
	const processor = read("lua/snow/select_character.lua");
	assert.match(processor, /or "bracketleft"/u);
	assert.match(processor, /or "bracketright"/u);
	for (const schema of [
		"snow_sipin.schema.yaml",
		"snow_sanpin.schema.yaml",
		"snow_jiandao.schema.yaml",
		"snow_qingyun.schema.yaml",
	]) {
		const source = read(schema);
		const selectCharacter = source.indexOf(
			"lua_processor@*snow.select_character",
		);
		const popping = source.indexOf("lua_processor@*snow.popping");
		assert.ok(selectCharacter >= 0, `${schema} 缺少以词定字处理器`);
		assert.ok(popping > selectCharacter, `${schema} 的顶功处理过早`);
	}
});

test("default traditional source entries are postponed before conversion and deduplication", () => {
	assert.match(read("lua/snow/simplified.lua"), /Opencc\("t2s\.json"\)/u);
	assert.match(
		read("lua/snow/simplified.lua"),
		/table\.insert\(postponed, candidate\)/u,
	);
	for (const schema of [
		"snow_sanpin.schema.yaml",
		"snow_jiandao.schema.yaml",
	]) {
		const source = read(schema);
		const filter = source.indexOf("lua_filter@*snow.simplified");
		const simplifier = source.indexOf("    - simplifier", filter);
		const uniquifier = source.indexOf("    - uniquifier", simplifier);
		assert.ok(filter >= 0 && simplifier > filter && uniquifier > simplifier);
	}
});

test("reported phrase codes follow the frozen Shenyun mapping", () => {
	const fixture = JSON.parse(read("docs/shenyun-r8-mapping.json")) as {
		codes: Record<string, string>;
	};
	assert.equal(fixture.codes.na + fixture.codes.yang, "nwym");
	assert.notEqual(fixture.codes.na + fixture.codes.yang, "nnff");
});

test("all current schemes keep the legacy two-position jump on Ctrl+P", () => {
	assert.match(
		read("snow_pinyin.schema.yaml"),
		/\{ accept: "Control\+p", send_sequence: "\{Home\}\{Right\}\{Right\}", when: composing \}/u,
	);
	for (const schema of [
		"snow_jiandao.schema.yaml",
		"snow_sanpin.schema.yaml",
		"snow_sipin.schema.yaml",
		"snow_qingyun.schema.yaml",
	]) {
		assert.match(read(schema), /__include: snow_pinyin\.schema\.yaml:\//u);
	}
});

test("Clear Rhyme shares code navigation and frees Ctrl+U for it", () => {
	const schema = read("snow_qingyun.schema.yaml");
	assert.match(schema, /lua_processor@\*snow\.code_navigator/u);
	assert.match(
		schema,
		/\{ when: always, accept: "Control\+q", toggle: unicode \}/u,
	);
	assert.doesNotMatch(schema, /accept: "Control\+u", toggle: unicode/u);
	const navigator = read("lua/snow/code_navigator.lua");
	assert.match(
		navigator,
		/schema_id == "snow_sipin" or schema_id == "snow_qingyun"/u,
	);
});

test("Three-Code supports the shared fixed-candidate controls", () => {
	const schema = read("snow_sanpin.schema.yaml");
	assert.match(schema, /lua_processor@\*snow\.user_dict/u);
	assert.match(schema, /translator\/enable_schema_user_dict: true/u);
	const processor = read("lua/snow/user_dict.lua");
	for (const key of [
		"Control+comma",
		"Control+apostrophe",
		"Control+bracketleft",
		"Control+bracketright",
		"Control+backslash",
	]) {
		assert.ok(processor.includes(`KeyEvent("${key}")`));
	}
});

test("Clear Rhyme history only changes the trigger key", () => {
	const schema = read("snow_qingyun.schema.yaml");
	assert.match(schema, /history\/input: "`"/u);
	assert.doesNotMatch(schema, /history\/initial_quality:/u);
	assert.match(schema, /recognizer\/patterns\/history: "\^`\$"/u);
	assert.match(schema, /menu\/alternative_select_keys: "_23890"/u);
	assert.match(schema, /menu\/page_size: 6/u);
	assert.match(schema, /lua_processor@\*snow\.history/u);
	assert.match(schema, /lua_translator@\*snow\.history/u);
	assert.match(
		read("lua/snow/qingyun.lua"),
		/if candidate\.type == "history" then[\s\S]+yield\(candidate\)[\s\S]+goto continue/u,
	);
});
