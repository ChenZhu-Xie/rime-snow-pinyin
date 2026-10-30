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

test("all current schemes leave Ctrl+B/N unbound", () => {
	for (const schema of [
		"snow_pinyin.schema.yaml",
		"snow_sipin.schema.yaml",
		"snow_sanpin.schema.yaml",
		"snow_yipin.schema.yaml",
		"snow_jiandao.schema.yaml",
		"snow_qingyun.schema.yaml",
	]) {
		assert.doesNotMatch(
			read(schema),
			/accept:\s*["']?Control\+(?:b|n)\b/iu,
			`${schema} must not bind Ctrl+B/N`,
		);
	}
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

test("Three-Code uses its ivuao tone-key order for stroke assist codes", () => {
	const filter = read("lua/snow/shape_filter.lua");
	assert.match(
		filter,
		/local sanpin_stroke_map = \{ \["一"\] = "i", \["丨"\] = "v", \["丿"\] = "u", \["丶"\] = "a", \["乙"\] = "o" \}/u,
	);
	assert.match(
		filter,
		/elseif id == "snow_sanpin"[\s\S]+stroke_match\(text, shape_input, env, sanpin_stroke_map\)/u,
	);
	assert.equal("hshh".replaceAll("h", "i").replaceAll("s", "v"), "ivii");
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

test("reported phrase codes follow the active Shenyun U357 mapping", () => {
	const fixture = JSON.parse(read("docs/shenyun-u357-mapping.json")) as {
		scheme: string;
		payloadCodes: Record<string, string | null>;
		codes: Record<string, string>;
	};
	assert.equal(fixture.scheme, "U357-21X21-M40-D0");
	assert.equal(fixture.codes.na + fixture.codes.yang, "nwyn");
	assert.notEqual(fixture.codes.na + fixture.codes.yang, "nnff");
	assert.equal(fixture.codes.ben, "bm");
	assert.equal(fixture.codes.bo, "bd");
	assert.equal(fixture.codes.duan, "dx");
	assert.equal(fixture.codes.jun, "je");
	assert.equal(fixture.codes.yun, "ye");
	assert.equal(fixture.codes.yo, "yd");

	const summarize = (values: Array<string | null>) => {
		const codes = values.filter((code): code is string => code !== null);
		const unique = new Set(codes).size;
		const collisionBuckets = new Map<string, number>();
		for (const code of codes)
			collisionBuckets.set(code, (collisionBuckets.get(code) ?? 0) + 1);
		return {
			encoded: codes.length,
			unique,
			collisionBuckets: [...collisionBuckets.values()].filter(
				(count) => count > 1,
			).length,
			vacant: 21 * 21 - unique,
		};
	};
	const expectedU357Space = {
		common: { encoded: 399, unique: 357, collisionBuckets: 42, vacant: 84 },
		extended: { encoded: 416, unique: 366, collisionBuckets: 50, vacant: 75 },
	};
	assert.deepEqual(
		summarize(Object.values(fixture.payloadCodes)),
		expectedU357Space.common,
	);
	assert.deepEqual(
		summarize(Object.values(fixture.codes)),
		expectedU357Space.extended,
	);
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

test("Clear Rhyme keeps history separate from the double-backtick Lua trigger", () => {
	const schema = read("snow_qingyun.schema.yaml");
	assert.match(schema, /history\/input: "`"/u);
	assert.match(schema, /history\/initial_quality: 100/u);
	assert.match(schema, /lua\/input: "``"/u);
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

test("Three-Code keeps two-syllable full codes ahead of colliding initial abbreviations", () => {
	const schema = read("snow_sanpin.schema.yaml");
	assert.match(schema, /translator\/t12_preserve_proxy_quality: true/u);
	const translator = read("lua/snow/table_like.lua");
	assert.match(
		translator,
		/get_bool\("translator\/t12_preserve_proxy_quality"\)/u,
	);
	assert.match(
		translator,
		/candidate\.quality = candidate\.quality \+ proxy_bonus/u,
	);
});

test("U357 KeyTao letter and number candidates follow the active schema", () => {
	const lines = new Map(
		read("snow_jiandao.fixed.txt")
			.split(/\r?\n/u)
			.filter((line) => line.includes("\t"))
			.map((line) => line.split("\t", 2) as [string, string]),
	);
	for (const key of "bpmfdtnlgkhjqxzcsrywe") {
		assert.deepEqual(lines.get(`${key}c`)?.split(" ").slice(1), [
			key.toUpperCase(),
			key,
		]);
	}
	for (const [key, code] of Object.entries({
		a: "xw",
		i: "xl",
		o: "xd",
		u: "xh",
		v: "xg",
	})) {
		const aliases = lines.get(code)?.split(" ") ?? [];
		assert.ok(
			aliases.includes(key.toUpperCase()) && aliases.includes(key),
			`${key}: ${code}`,
		);
	}
	for (const [number, code] of Object.entries({
		0: "ltv",
		1: "y",
		2: "re",
		3: "s",
		4: "sli",
		5: "shv",
		6: "ldo",
		7: "qlv",
		8: "bwu",
		9: "jdu",
		10: "elu",
	})) {
		assert.ok(
			lines.get(code)?.split(" ").includes(number),
			`${number}: ${code}`,
		);
	}
	assert.ok(lines.get("re")?.split(" ").includes("2"));
	assert.ok(lines.get("xh")?.split(" ").includes("U"));
});

test("U357 KeyTao and Three-Code share letter bases with measured full-code collisions", () => {
	const jiandao = read("snow_jiandao.schema.yaml");
	const sanpin = read("snow_sanpin.schema.yaml");
	assert.match(jiandao, /prism: snow_jiandao_jianpin/u);
	assert.match(sanpin, /prism: snow_jiandao_jianpin/u);
	assert.match(
		jiandao,
		/xform\/~\{1,2\}\(\[bpmfdtnlgkhjqxzcsrywe\]\)\/\$1c\//u,
	);
	assert.match(
		sanpin,
		/xform\/~\{1,2\}\(\[bpmfdtnlgkhjqxzcsrywe\]\)\/\$1co\//u,
	);
	const prism = read("snow_jiandao_jianpin.schema.yaml");
	assert.match(prism, /xform\/~\{1,2\}a\/xw\//u);

	const initials = [..."bpmfdtnlgkhjqxzcsrwye"];
	const vowelBases = ["xg", "xl", "xh", "xd", "xw"];
	const letterBaseCodes = [
		...initials.map((initial) => `${initial}c`),
		...vowelBases,
	];
	const letterFullCodes = [
		...initials.map((initial) => `${initial}co`),
		...vowelBases.map((base) => `${base}o`),
	];
	assert.equal(new Set(letterBaseCodes).size, 26);
	assert.equal(new Set(letterFullCodes).size, 26);
	const mapping = JSON.parse(read("docs/shenyun-u357-mapping.json")) as {
		codes: Record<string, string>;
	};
	const occupiedBaseCodes = new Set(Object.values(mapping.codes));
	assert.deepEqual(
		letterBaseCodes.filter((code) => !occupiedBaseCodes.has(code)),
		["zc", "cc", "sc", "yc", "xh", "xw"],
	);
	const toneKeys: Record<string, string> = {
		"1": "i",
		"2": "v",
		"3": "u",
		"4": "a",
		"5": "o",
	};
	const occupiedFullCodes = new Set<string>();
	for (const dictionary of [
		"snow_pinyin.dict.yaml",
		"snow_pinyin.base.dict.yaml",
		"snow_pinyin.ext.dict.yaml",
		"snow_pinyin.tencent.dict.yaml",
		"snow_pinyin.user.dict.yaml",
	]) {
		for (const line of read(dictionary).split(/\r?\n/u)) {
			if (line.startsWith("#") || !line.includes("\t")) continue;
			for (const syllable of (line.split("\t")[1] ?? "").split(" ")) {
				const matched = syllable.match(/^([a-z]+)([1-5])$/u);
				if (!matched) continue;
				const base = mapping.codes[matched[1]];
				const tone = toneKeys[matched[2]];
				if (base && tone) occupiedFullCodes.add(base + tone);
			}
		}
	}
	assert.deepEqual(
		letterFullCodes.filter((code) => occupiedFullCodes.has(code)),
		["tco", "hco", "xgo", "xlo"],
	);
	const sanpinCore = read("snow_sanpin.fixed.txt").split("# 字母")[0];
	for (const code of letterFullCodes) {
		assert.doesNotMatch(sanpinCore, new RegExp(`^${code}\\t`, "mu"));
	}
	const jiandaoCore = read("snow_jiandao.fixed.txt");
	for (const code of letterBaseCodes) {
		assert.match(jiandaoCore, new RegExp(`^${code}\\t`, "mu"));
	}

	const fixed = read("snow_sanpin.fixed.txt");
	for (const [code, candidates] of [
		["shu", "五 5"],
		["lda", "六 6"],
		["qli", "七 7"],
		["bwi", "八 8"],
		["jdu", "九 9"],
		["elv", "十 10"],
		["ltv", "零 0"],
	]) {
		assert.match(fixed, new RegExp(`^${code}\\t${candidates}$`, "mu"));
	}
});

test("U357 KeyTao and Three-Code keep their processors in a compatible order", () => {
	for (const file of ["snow_jiandao.schema.yaml", "snow_sanpin.schema.yaml"]) {
		const schema = load(read(file)) as { engine: { processors: string[] } };
		const processors = schema.engine.processors;
		const position = (name: string) =>
			processors.indexOf(`lua_processor@*snow.${name}`);
		for (const name of [
			"shape_processor",
			"select_character",
			"popping",
			"code_navigator",
			"user_dict",
			"history",
		]) {
			assert.ok(position(name) >= 0, `${file}: ${name}`);
		}
		assert.equal(position("abbreviation"), -1, file);
		assert.ok(position("select_character") < position("popping"), file);
		assert.ok(position("code_navigator") < position("user_dict"), file);
	}
});

test("vacant AA codes receive exactly one scheme-specific auxiliary", () => {
	const fixture = JSON.parse(read("docs/shenyun-u357-mapping.json")) as {
		codes: Record<string, string | null>;
	};
	const keys = [..."bpmfdtnlgkhjqxzcsrwye"];
	const occupied = new Set(Object.values(fixture.codes));
	const vacant = keys
		.flatMap((first) => keys.map((second) => first + second))
		.filter((code) => !occupied.has(code));
	assert.equal(vacant.length, 75);
	for (const file of ["snow_sanpin.schema.yaml", "snow_jiandao.schema.yaml"]) {
		const schema = load(read(file)) as {
			patch: {
				"translator/vacant_initial_pattern": string;
				"translator/reserved_letter_pattern"?: string;
			};
		};
		const pattern = new RegExp(
			schema.patch["translator/vacant_initial_pattern"],
			"u",
		);
		assert.deepEqual(
			vacant.filter((code) => pattern.test(code)),
			vacant,
			file,
		);
		assert.match(read(file), /match_shape: "\^\$"[\s\S]+block: true/u);
		assert.match(read(file), /status: initial_pair/u);
	}
	const sanpin = load(read("snow_sanpin.schema.yaml")) as {
		patch: { "translator/reserved_letter_pattern": string };
	};
	const reservedLetters = new RegExp(
		sanpin.patch["translator/reserved_letter_pattern"],
		"u",
	);
	assert.deepEqual(
		["zco", "cco", "sco", "yco", "xho", "xwo"].filter((code) =>
			reservedLetters.test(code),
		),
		["zco", "cco", "sco", "yco", "xho", "xwo"],
	);
	assert.match(read("lua/snow/fix.lua"), /shape_status ~= "initial_pair"/u);
	assert.match(
		read("snow_jiandao.schema.yaml"),
		/lua_translator@\*snow\.table_like\*initial_pair/u,
	);
	assert.match(read("lua/snow/table_like.lua"), /local initial_pair = \{\}/u);
	assert.match(
		read("lua/snow/table_like.lua"),
		/candidate\.type = "initial_pair"/u,
	);
	assert.match(
		read("lua/snow/table_like.lua"),
		/Component\.Translator\(env\.engine, "initial_pair", "script_translator"\)/u,
	);
	assert.match(
		read("snow_jiandao.schema.yaml"),
		/initial_pair:\r?\n  __include: \/jianpin\r?\n  tag: abc/u,
	);
	assert.match(
		read("snow_jiandao.schema.yaml"),
		/translator\/reserved_initial_pair_pattern: "\^\(\?:xh\|xw\)\$"/u,
	);
	assert.match(read("lua/snow/enforce.lua"), /candidate\.type == "initial_pair"/u);
	const shapeFilter = read("lua/snow/shape_filter.lua");
	assert.match(shapeFilter, /sanpin_initial_pair_match/u);
	assert.match(shapeFilter, /snow\.sub\(text, 2, 2\)/u);
});

test("Three-Code and KeyTao reserve uppercase finals for three-or-more-character jianpin", () => {
	for (const file of ["snow_sanpin.schema.yaml", "snow_jiandao.schema.yaml"]) {
		const source = read(file);
		assert.doesNotMatch(source, /lua_processor@\*snow\.abbreviation/u);
		assert.match(source, /strategy: append_raw/u);
		assert.match(source, /\[bpmfdtnlgkhjqxzcsrywe\]\[A-Z\]\?/u);
	}
	const translator = read("lua/snow/table_like.lua");
	assert.match(
		translator,
		/sound_input:gmatch\("\[bpmfdtnlgkhjqxzcsrywe\]\[A-Z\]\?"\)/u,
	);
	assert.match(translator, /local initial_count = #groups/u);
});

test("KeyTao keeps three-initial jianpin on the abc segment", () => {
	const schema = read("snow_jiandao.schema.yaml");
	assert.match(schema, /lua_translator@\*snow\.table_like\*jianpin/u);
	assert.match(schema, /translator\/jianpin_pattern:/u);
	assert.doesNotMatch(schema, /affix_segmentor@jianpin/u);
	assert.doesNotMatch(schema, /script_translator@jianpin/u);
	assert.doesNotMatch(schema, /recognizer\/patterns\/jianpin/u);
	assert.match(read("lua/snow/shape_filter.lua"), /jiandao_shape_cache/u);
});
