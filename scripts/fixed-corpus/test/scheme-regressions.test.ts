import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import { applyAlgebra, parseAlgebraRules } from "../algebra";
import { makeMiraDefaultCustomization } from "../../lib/mira-default-custom";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const firstGenerationSchemes = [
	[
		"snow_jiandao",
		"冰雪健道·初代",
		"cbbc1691ccbef0e02f6d408fd288051ea70f96d6be9ff2eadb70f81a97028bb9",
	],
	[
		"snow_sanpin",
		"冰雪弎拼·初代",
		"20b01fef6ab389ccb9601f8b445a54337bdf8f1a9364b53ec6e586e5c893f92f",
	],
	[
		"snow_shenyun_shape",
		"冰雪简道·初代",
		"29d201dfeb529fbff22cbcb5d761b32ec5b886cf695ec0fc5dd8c91c44e5cb2d",
	],
	[
		"snow_shenyun_tone",
		"冰雪散拼·初代",
		"a5b9d46296a4cfb59f0c85a98c054d8b858a23658837530200be502a7369ff51",
	],
] as const;

test("first-generation U357 and Overall-17 schemes are complete frozen copies", () => {
	const menu = read("lua/snow/schema_menu.lua");
	const release = read(".github/workflows/release.yml");
	const miraDefault = read("spec/fixtures/default.yaml");
	for (const [base, name, expectedFixedHash] of firstGenerationSchemes) {
		const id = `${base}_first`;
		const schema = load(read(`${id}.schema.yaml`)) as {
			schema: { schema_id: string; name: string };
			keymap: { image: string };
		};
		assert.equal(schema.schema.schema_id, id);
		assert.equal(schema.schema.name, name);
		assert.equal(schema.keymap.image, `${id}.svg`);
		assert.equal(
			createHash("sha256")
				.update(readFileSync(join(root, `${id}.fixed.txt`)))
				.digest("hex"),
			expectedFixedHash,
			`${id}.fixed.txt`,
		);
		assert.match(
			menu,
			new RegExp(`schema_id = "${id}"[\\s\\S]+name = "${name}"`, "u"),
		);
		assert.ok(release.includes(`schema: ${id}`), id);
		assert.ok(miraDefault.includes(`schema: ${id}`), id);
	}
	assert.ok(
		read("snow_jiandao_first.schema.yaml").includes(
			"snow_sanpin_first.schema.yaml:/sanpin_algebra",
		),
	);
	assert.ok(
		read("snow_jiandao_jianpin_first.schema.yaml").includes(
			"snow_sanpin_first.schema.yaml:/sanpin_algebra",
		),
	);
	assert.ok(
		read("snow_shenyun_shape_first.schema.yaml").includes(
			"snow_shenyun_first_common.yaml:/",
		),
	);
	assert.ok(
		read("snow_shenyun_tone_first.schema.yaml").includes(
			"snow_shenyun_first_common.yaml:/",
		),
	);
	assert.doesNotMatch(
		read("snow_shenyun_first_common.yaml"),
		/prism: snow_shenyun$/mu,
	);
	assert.match(
		read("snow_shenyun_first_common.yaml"),
		/learned_priority:\s+memory_namespace: shenyun\s/mu,
	);
});

test("next-generation mappings preserve complete first-generation snapshots", () => {
	const firstSnapshots = [
		[
			"config/shenyun-21x21-first-mapping.json",
			"c09f4bf08573c5e1261c75839f6a53fd09a132b8ba9ae99e1f6da5e881fc83b1",
		],
		[
			"config/shenyun-21x26-first-mapping.json",
			"53209e90c08d67e145b998e59cfbf93227d0a34cb76641c5ec487577629d1429",
		],
		[
			"lua/snow/radical_jiandao_first.txt",
			"86434ea69c623aa24d6c67f83a6c8139037eb8f3b6757744133d74e62994041d",
		],
		[
			"lua/snow/radical_sanpin_first.txt",
			"26fce5fa28f7a67863c3f56f7d3b3c514bef063c97485d7ec3bc1fc5c6086535",
		],
		[
			"snow_shenyun_first_common.yaml",
			"5f0e17c0ff6a5862ee0b35c372f62797d5e46e3434da8a35d2a62b7da010c965",
		],
	] as const;
	for (const [file, expected] of firstSnapshots) {
		assert.equal(existsSync(join(root, file)), true, `${file} must exist`);
		assert.equal(
			createHash("sha256")
				.update(readFileSync(join(root, file)))
				.digest("hex"),
			expected,
			file,
		);
	}
});

test("double-pinyin schemes isolate fixed-code databases while sharing snow_pinyin learning", () => {
	const fixedDatabases = new Map([
		["snow_jiandao.schema.yaml", "snow_jiandao_qz_e8f37a"],
		["snow_sanpin.schema.yaml", "snow_sanpin_qz_e8f37a"],
		["snow_shenyun_shape.schema.yaml", "snow_shenyun_shape_d3v1"],
		["snow_shenyun_tone.schema.yaml", "snow_shenyun_tone_d3v1"],
		["snow_jiandao_first.schema.yaml", "snow_jiandao"],
		["snow_sanpin_first.schema.yaml", "snow_sanpin"],
		["snow_shenyun_shape_first.schema.yaml", "snow_shenyun_shape"],
		["snow_shenyun_tone_first.schema.yaml", "snow_shenyun_tone"],
		["snow_jiandao_classic.schema.yaml", "snow_jiandao_classic"],
		["snow_sanpin_classic.schema.yaml", "snow_sanpin_classic"],
	]);
	assert.equal(new Set(fixedDatabases.values()).size, fixedDatabases.size);
	for (const [file, database] of fixedDatabases) {
		assert.match(
			read(file),
			new RegExp(`translator/user_dict_name: ${database}(?:\\r?\\n|$)`, "u"),
			file,
		);
	}
	for (const file of [
		"snow_jiandao.schema.yaml",
		"snow_sanpin.schema.yaml",
		"snow_jiandao_first.schema.yaml",
		"snow_sanpin_first.schema.yaml",
		"snow_jiandao_classic.schema.yaml",
		"snow_sanpin_classic.schema.yaml",
	]) {
		assert.match(read(file), /dictionary: snow_pinyin/u, file);
	}
	for (const file of [
		"snow_shenyun_common.yaml",
		"snow_shenyun_first_common.yaml",
	]) {
		assert.match(read(file), /__include: snow_pinyin\.schema\.yaml:\//u, file);
	}
});

test("active 21x21 mapping is QZ-e8f37a with QZ and ZQ vacant", () => {
	const mapping = JSON.parse(read("config/shenyun-21x21-mapping.json")) as {
		id: string;
		stateKey: string;
		sourceBranch: string;
		sourceCommit: string;
		capacity: [number, number];
		commonSyllables: number;
		uniqueCommonCodes: number;
		collisionBuckets: number;
		affectedSyllables: number;
		vacantCodes: number;
		memory: number;
		ordinaryInitialDisplacements: number;
		vowelDisplacements: number;
		shapeKeysByMeaning: string;
		toneKeysByTone: string;
		shapeAuxiliaryOrder: string;
		toneAuxiliaryOrder: string;
		requiredVacantCodes: string[];
		cktV51: number;
		initialMap: Record<string, string>;
		finalMap: Record<string, string>;
	};
	assert.equal(mapping.id, "QZ-e8f37a0998f9");
	assert.equal(
		mapping.stateKey,
		"1515010f0c0503130d04060f070910170a120b111902121102111618180f0d0c1819120b031309050b090f1002110a0701060b16071017040211060a03130406081514000e",
	);
	assert.equal(
		mapping.sourceBranch,
		"production/ckt-v4-2121-strict-avuio-20261024",
	);
	assert.equal(
		mapping.sourceCommit,
		"f2473559b275bca59ad134c0fbdb42fa4c562aa8",
	);
	assert.deepEqual(mapping.capacity, [21, 21]);
	assert.equal(mapping.commonSyllables, 399);
	assert.equal(mapping.uniqueCommonCodes, 345);
	assert.equal(mapping.collisionBuckets, 54);
	assert.equal(mapping.affectedSyllables, 108);
	assert.equal(mapping.vacantCodes, 96);
	assert.equal(mapping.memory, 42);
	assert.equal(mapping.ordinaryInitialDisplacements, 2);
	assert.equal(mapping.vowelDisplacements, 5);
	assert.equal(mapping.shapeKeysByMeaning, "AVUIO");
	assert.equal(mapping.toneKeysByTone, "IVUAO");
	assert.equal(mapping.shapeAuxiliaryOrder, "12/213/24");
	assert.equal(mapping.toneAuxiliaryOrder, "12/213/23");
	assert.deepEqual(mapping.requiredVacantCodes, ["qz", "zq"]);
	assert.equal(mapping.cktV51, 9.56789806405906);
	assert.deepEqual(mapping.initialMap, {
		b: "B",
		p: "P",
		m: "M",
		f: "F",
		d: "D",
		t: "T",
		n: "N",
		l: "E",
		g: "G",
		k: "P",
		h: "H",
		j: "J",
		q: "Q",
		x: "X",
		zh: "K",
		ch: "S",
		sh: "L",
		r: "R",
		z: "Z",
		c: "C",
		s: "S",
		A: "R",
		E: "C",
		O: "R",
		W: "W",
		Y: "Y",
		YU: "Y",
	});
	assert.deepEqual(mapping.finalMap, {
		a: "P",
		ai: "N",
		an: "M",
		ang: "Y",
		ao: "Z",
		e: "S",
		ei: "L",
		en: "D",
		eng: "T",
		er: "J",
		i: "F",
		ia: "L",
		ian: "J",
		iang: "P",
		iao: "Q",
		ie: "C",
		in: "R",
		ing: "K",
		iong: "H",
		iu: "B",
		o: "G",
		ong: "L",
		ou: "W",
		u: "H",
		ua: "Q",
		uai: "X",
		uan: "E",
		uang: "C",
		ui: "R",
		un: "G",
		uo: "K",
		v: "D",
		van: "T",
		ve: "E",
		vn: "G",
	});
});

test("the searchable schema menu owns F4 and Ctrl+grave in every released scheme", () => {
	for (const source of [
		read("snow_schema_menu_default_patch.yaml"),
		makeMiraDefaultCustomization("snow_yipin"),
	]) {
		const customization = load(source) as {
			patch: Record<string, unknown>;
		};
		assert.deepEqual(customization.patch["switcher/hotkeys"], [
			"Control+Shift+grave",
		]);
	}

	const shared = load(read("snow_pinyin.schema.yaml")) as {
		recognizer: { patterns: Record<string, string> };
		schema_menu: { tag: string; prefix: string; tips: string };
	};
	assert.equal(shared.recognizer.patterns.schema_menu, "^~~'[a-z]*$");
	assert.deepEqual(shared.schema_menu, {
		tag: "schema_menu",
		prefix: "~~",
		sentinel: "'",
		tips: "〔方案〕",
	});

	for (const schema of [
		"snow_sipin.schema.yaml",
		"snow_sanpin.schema.yaml",
		"snow_yipin.schema.yaml",
		"snow_jiandao.schema.yaml",
		"snow_qingyun.schema.yaml",
		"snow_shenyun_common.yaml",
		"snow_jiandao_classic.schema.yaml",
		"snow_sanpin_classic.schema.yaml",
	]) {
		const content = load(read(schema)) as {
			engine: {
				processors: string[];
				segmentors: string[];
				translators: string[];
			};
		};
		const processors = content.engine.processors;
		const menuProcessor = "lua_processor@*snow.schema_menu*processor";
		if (schema === "snow_yipin.schema.yaml") {
			assert.ok(
				processors.indexOf("ascii_composer") <
					processors.indexOf(menuProcessor),
				schema,
			);
			assert.ok(
				processors.indexOf(menuProcessor) <
					processors.indexOf("chord_composer"),
				schema,
			);
		} else {
			assert.ok(
				processors.indexOf("recognizer") < processors.indexOf(menuProcessor),
				schema,
			);
		}
		assert.ok(
			processors.indexOf(menuProcessor) < processors.indexOf("key_binder"),
			schema,
		);
		assert.ok(
			content.engine.segmentors.includes("affix_segmentor@schema_menu"),
			schema,
		);
		assert.ok(
			content.engine.translators.includes(
				"lua_translator@*snow.schema_menu*translator",
			),
			schema,
		);
	}
});

test("the shared key binder does not alias Ctrl+F to an arrow key", () => {
	const schema = load(read("snow_pinyin.schema.yaml")) as {
		key_binder: { bindings: Array<{ accept?: string }> };
	};
	const acceptedKeys = schema.key_binder.bindings.flatMap((binding) =>
		binding.accept ? [binding.accept] : [],
	);
	assert.ok(!acceptedKeys.includes("Control+f"));
});

test("the shared key binder uses the current navigation shortcuts", () => {
	const schema = read("snow_pinyin.schema.yaml");
	assert.match(schema, /accept: "Control\+b", toggle: buffered/u);
	assert.match(schema, /accept: "Control\+n", send: Home/u);
	assert.match(schema, /accept: "Control\+m", send: Page_Up/u);
	assert.match(schema, /accept: "Control\+comma", send: Page_Down/u);
	for (const removed of [
		"Control+a",
		"Control+g",
		"Control+bracketleft",
		"Control+v",
		"Alt+v",
	]) {
		assert.ok(!schema.includes(`accept: "${removed}"`));
	}
});

test("history selection only accepts Ctrl-number shortcuts", () => {
	const processor = read("lua/snow/history.lua");
	assert.match(processor, /if key:ctrl\(\) then/u);
	assert.doesNotMatch(processor, /key:ctrl\(\) or key:alt\(\)/u);
});

test("serial schemes expose o while all schemes inherit Ctrl+B", () => {
	for (const schema of [
		"snow_sipin.schema.yaml",
		"snow_sanpin.schema.yaml",
		"snow_jiandao.schema.yaml",
		"snow_shenyun_common.yaml",
	]) {
		assert.match(read(schema), /lua_translator@\*snow\.buffered/u);
	}
	for (const schema of ["snow_yipin.schema.yaml", "snow_qingyun.schema.yaml"]) {
		assert.doesNotMatch(read(schema), /lua_translator@\*snow\.buffered/u);
	}
	const combined = [
		"snow_sipin.schema.yaml",
		"snow_sanpin.schema.yaml",
		"snow_yipin.schema.yaml",
		"snow_jiandao.schema.yaml",
		"snow_qingyun.schema.yaml",
	]
		.map(read)
		.join("\n");
	assert.doesNotMatch(combined, /(?:toggle|set_option): buffered/u);
	assert.match(
		read("snow_yipin.schema.yaml"),
		/xform\/\^jio\$\/\{Control\+b\}\//u,
	);
	const translator = read("lua/snow/buffered.lua");
	assert.match(translator, /env\.target = not ctx:get_option\("buffered"\)/u);
});

test("all released schemes expose manual word addition with a visible state", () => {
	for (const schema of [
		"snow_sipin.schema.yaml",
		"snow_sanpin.schema.yaml",
		"snow_yipin.schema.yaml",
		"snow_jiandao.schema.yaml",
		"snow_qingyun.schema.yaml",
		"snow_shenyun_common.yaml",
	]) {
		const content = read(schema);
		assert.match(content, /name: add\s+states: \[\s*结束,\s*加词中\s*\]/u);
	}
	for (const schema of [
		"snow_sipin.schema.yaml",
		"snow_sanpin.schema.yaml",
		"snow_yipin.schema.yaml",
		"snow_jiandao.schema.yaml",
		"snow_qingyun.schema.yaml",
		"snow_shenyun_common.yaml",
	]) {
		const content = read(schema);
		assert.match(content, /lua_processor@\*snow\.user_dict/u);
		assert.match(content, /enable_schema_user_dict: true/u);
	}
});

test("fixed-candidate filtering streams through codes without custom entries", () => {
	const filter = read("lua/snow/fix.lua");
	assert.match(filter, /if #fixed_phrases == 0 then/u);
	assert.match(
		filter,
		/if seen_candidates >= env\.page_size and unresolved_fixed == 0/u,
	);
	assert.doesNotMatch(filter, /collectgarbage\(\)/u);
});

test("Clear Rhyme stops ordinary short codes while preserving buffered readings", () => {
	const filter = read("lua/snow/qingyun.lua");
	assert.match(
		filter,
		/yield\(c\)\s+if not buffered then\s+return\s+end\s+goto continue/u,
	);
	assert.match(filter, /if is_short_code and not buffered then\s+return/u);
	assert.match(filter, /env\.chaifen_cache\[candidate\.text\]/u);
});

test("postponement streams the first code when no earlier choice can move", () => {
	assert.match(
		read("lua/snow/postpone.lua"),
		/if next\(env\.known_candidates\) == nil then[\s\S]+yield\(candidate\)[\s\S]+return/u,
	);
});

test("Shenyun merges translator routes lazily with their iterator state", () => {
	const translator = read("lua/snow/shenyun.lua");
	assert.match(translator, /stream\.iterator\(stream\.translation\)/u);
	assert.match(
		translator,
		/candidate = snow\.prepare\(candidate, stream\.route\.proxy\)/u,
	);
	assert.match(translator, /consumed_length == stream\.route\.main_length/u);
	assert.match(translator, /add_route\(routes, "AA"/u);
	assert.match(translator, /vacancy\.is_empty\(first_pair/u);
	assert.match(translator, /not first_vacant and all_in\(input, 3, B\)/u);
	assert.match(translator, /if first_vacant and all_in/u);
	assert.match(translator, /add_route\(routes, "AAA\+B"/u);
	assert.match(
		translator,
		/stream\.route\.family == "AA"[\s\S]+goto continue/u,
	);
	assert.doesNotMatch(translator, /table\.sort\(found/u);
});

test("statistics falls back when librime-lua lacks get_time_ms", () => {
	assert.match(read("lua/snow/define.lua"), /get_time_ms\?/u);
	assert.match(
		read("lua/snow/statistics.lua"),
		/rime_api\.get_time_ms and rime_api\.get_time_ms\(\) or os\.time\(\) \* 1000/u,
	);
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

test("Three-Code derives stroke assist codes from AVUIO shape meanings", () => {
	const filter = read("lua/snow/shape_filter.lua");
	assert.match(filter, /sanpin_semantics = auxiliary_semantics\["21x21"\]/u);
	assert.match(
		filter,
		/elseif state\.id == "snow_sanpin"[\s\S]+stroke_match\(text, shape_input, env, sanpin_reverse_stroke_map, sanpin_direct_stroke_map\)/u,
	);
	const semantics = read("lua/snow/auxiliary_semantics.lua");
	assert.match(semantics, /stroke_keys_by_stroke = "viuoa"/u);
	assert.equal("hshh".replaceAll("h", "v").replaceAll("s", "i"), "vivv");
});

test("all released schemes run word selection before popping", () => {
	const processor = read("lua/snow/select_character.lua");
	assert.match(processor, /or "bracketleft"/u);
	assert.match(processor, /or "bracketright"/u);
	for (const [schema, processorSource, poppingName] of [
		["snow_sipin.schema.yaml", "snow_sipin.schema.yaml", "popping"],
		["snow_sanpin.schema.yaml", "snow_sanpin.schema.yaml", "popping"],
		["snow_yipin.schema.yaml", "snow_yipin.schema.yaml", "combo_popping"],
		["snow_jiandao.schema.yaml", "snow_jiandao.schema.yaml", "popping"],
		["snow_qingyun.schema.yaml", "snow_qingyun.schema.yaml", "popping"],
		["snow_shenyun_shape.schema.yaml", "snow_shenyun_common.yaml", "popping"],
		["snow_shenyun_tone.schema.yaml", "snow_shenyun_common.yaml", "popping"],
		[
			"snow_jiandao_classic.schema.yaml",
			"snow_jiandao_classic.schema.yaml",
			"popping",
		],
		[
			"snow_sanpin_classic.schema.yaml",
			"snow_sanpin_classic.schema.yaml",
			"popping",
		],
	] as const) {
		const source = read(processorSource);
		const selectCharacter = source.indexOf(
			"lua_processor@*snow.select_character",
		);
		const popping = source.indexOf(`lua_processor@*snow.${poppingName}`);
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
		"Control+slash",
		"Control+period",
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
		3: "sj",
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

test("U357 Three-Code fills every 630 slot with a unique fixed candidate", () => {
	const fixed = read("snow_sanpin.fixed.txt");
	const section = fixed.match(/# 630\r?\n([\s\S]*?)\r?\n# 单字/u)?.[1];
	assert.ok(section);
	const rows = section
		.split(/\r?\n/u)
		.filter(Boolean)
		.map((line) => line.split("\t"));
	const codes = rows.map(([code]) => code);
	const words = rows.map(([, word]) => word);
	const expectedCodes = [..."bpmfdtnlgkhjqxzcsrwye"].flatMap((initial) => [
		...[..."ivuao"].map((tone) => initial + tone),
		...[..."ivuao"].flatMap((secondTone) =>
			[..."ivuao"].map((targetTone) => initial + secondTone + targetTone),
		),
	]);
	assert.equal(rows.length, 630);
	assert.deepEqual(new Set(codes), new Set(expectedCodes));
	assert.equal(new Set(words).size, 630);
});

test("U357 KeyTao fills every 630 auxiliary slot exactly once", () => {
	const section = read("snow_jiandao.fixed.txt")
		.split(/^# 630\r?$/mu)[1]
		?.split(/^#/mu)[0];
	assert.ok(section);
	const codes = section
		.split(/\r?\n/u)
		.filter((line) => line.includes("\t"))
		.map((line) => line.split("\t", 1)[0]);
	const expected = [..."bpmfdtnlgkhjqxzcsrwye"].flatMap((initial) => [
		...[..."ivuao"].map((auxiliary) => initial + auxiliary),
		...[..."ivuao"].flatMap((secondAuxiliary) =>
			[..."ivuao"].map(
				(targetAuxiliary) => initial + secondAuxiliary + targetAuxiliary,
			),
		),
	]);
	assert.equal(codes.length, 630);
	assert.deepEqual(new Set(codes), new Set(expected));
});

test("U357 KeyTao and Three-Code keep letters and numbers on semantic codes", () => {
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
	const letters = [...initials, "v", "i", "u", "o", "a"];
	for (const [index, code] of letterBaseCodes.entries()) {
		const match = jiandaoCore.match(new RegExp(`^${code}\\t(.+)$`, "mu"));
		assert.ok(match, code);
		assert.deepEqual(
			match[1].split(" ").slice(-2),
			[letters[index].toUpperCase(), letters[index]],
			code,
		);
	}

	const sanpinFixed = read("snow_sanpin.fixed.txt");
	for (const [index, code] of letterFullCodes.entries()) {
		assert.match(
			sanpinFixed,
			new RegExp(
				`^${code}\\t${letters[index].toUpperCase()} ${letters[index]}$`,
				"mu",
			),
		);
	}
	for (const [code, candidates] of [
		["y", "一 1"],
		["re", "二 2"],
		["sj", "三 3"],
		["sli", "四 4"],
		["shv", "五 5"],
		["ldo", "六 6"],
		["qlv", "妻 七 7"],
		["bwu", "八 8"],
		["jdu", "九 9"],
		["elu", "十 10"],
		["ltv", "零 0"],
	]) {
		const number = candidates.split(" ").at(-1);
		assert.match(jiandaoCore, new RegExp(`^${code}\\t.* ${number}$`, "mu"));
	}
	for (const [code, candidates] of [
		["y", "一 1"],
		["re", "二 2"],
		["sj", "三 3"],
		["sla", "四 4"],
		["shu", "五 5"],
		["lda", "六 6"],
		["qli", "七 7"],
		["bwi", "八 8"],
		["jdu", "九 9"],
		["elv", "十 10"],
		["ltv", "零 0"],
	]) {
		const number = candidates.split(" ").at(-1);
		assert.match(sanpinFixed, new RegExp(`^${code}\\t.* ${number}$`, "mu"));
	}
	for (const stale of ["qj\\t强 2", "s\\t我 3", "sk\\t外 4"])
		assert.doesNotMatch(sanpinFixed, new RegExp(`^${stale}$`, "mu"));
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
	const sanpinRules = parseAlgebraRules(
		read("snow_sanpin.schema.yaml"),
		"sanpin_algebra",
	);
	const runtimeOccupied = new Set<string>();
	for (const line of read("snow_pinyin.dict.yaml").split(/\r?\n/u)) {
		const [word, spelling, rawWeight] = line.split("\t");
		if ([...(word ?? "")].length !== 1 || !spelling || Number(rawWeight) <= 1)
			continue;
		const code = applyAlgebra(spelling, sanpinRules).canonical?.replace(
			/[ivuao]$/u,
			"",
		);
		if (code?.length === 2) runtimeOccupied.add(code);
	}
	const runtimeVacant = keys
		.flatMap((first) => keys.map((second) => first + second))
		.filter((code) => !runtimeOccupied.has(code));
	assert.equal(runtimeVacant.length, 80);
	assert.equal(runtimeVacant.includes("yx"), true);
	assert.equal(runtimeVacant.includes("lk"), false);
	for (const file of ["snow_sanpin.schema.yaml", "snow_jiandao.schema.yaml"]) {
		const schema = load(read(file)) as {
			vacancy: { enable_user_dict: boolean };
		};
		assert.equal(schema.vacancy.enable_user_dict, false, file);
		assert.doesNotMatch(read(file), /vacant_initial_pattern/u);
		assert.match(
			read(file),
			/vacant: true[\s\S]+match_shape: "\^\$"[\s\S]+block: true/u,
		);
		assert.match(read(file), /status: initial_pair/u);
	}
	const vacancySource = read("lua/snow/vacancy.lua");
	assert.match(vacancySource, /translator:query\(input, segment\)/u);
	assert.match(vacancySource, /memory:decode\(entry\.code\)/u);
	assert.match(vacancySource, /spelling:sub\(1, 1\) ~= "~"/u);
	assert.match(
		vacancySource,
		/projection:apply\(spelling\):sub\(1, input:len\(\)\) == input/u,
	);
	assert.doesNotMatch(vacancySource, /entry\.weight/u);
	const shapeProcessor = read("lua/snow/shape_processor.lua");
	assert.match(shapeProcessor, /input:len\(\) ~= 2/u);
	assert.doesNotMatch(shapeProcessor, /has_candidate/u);
	for (const file of ["snow_sanpin.schema.yaml", "snow_jiandao.schema.yaml"]) {
		assert.match(
			read(file),
			/vacant: true\r?\n      match: "\^\[bpmfdtnlgkhjqxzcsrwye\]\{2\}\$"/u,
			file,
		);
		assert.match(read(file), /canonical_format:\r?\n    __include: /u, file);
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
		/translate\(input, segment, env, false/u,
	);
	assert.match(read("lua/snow/table_like.lua"), /if input:len\(\) ~= 2/u);
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
	const enforce = read("lua/snow/enforce.lua");
	assert.match(
		enforce,
		/candidate\.type == "initial_pair"[\s\S]+is_normal_spelling = true/u,
	);
	assert.doesNotMatch(enforce, /vacant_initial_pattern/u);
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

test("U357 three-character words allow a third auxiliary but four-character words stop at two", () => {
	const keytao = read("snow_jiandao.schema.yaml");
	assert.match(keytao, /\{3\}"\r?\n\s+match_shape: "\^\.\{0,2\}\$"/u);
	assert.match(keytao, /\{4,\}"\r?\n\s+match_shape: "\^\.\{0,1\}\$"/u);
	assert.match(read("lua/snow/shape_filter.lua"), /positions = \{ 2, 4 \}/u);

	const sanpin = read("snow_sanpin.schema.yaml");
	assert.match(sanpin, /\{3\}\[ivuao\]\{0,3\}/u);
	assert.match(sanpin, /\{4,\}\[ivuao\]\{0,2\}/u);
	assert.match(
		read("lua/snow/table_like.lua"),
		/length == 4 then return \{ 2, 3 \}/u,
	);
});

test("split translators preserve native user phrase priority across routes", () => {
	const priority = read("lua/snow/candidate_priority.lua");
	assert.match(priority, /genuine\.type == "user_phrase"/u);
	assert.match(priority, /memory\.user_dict:lookup_words\(code, false, 0\)/u);
	assert.match(priority, /entry\.text == candidate\.text/u);
	assert.match(priority, /function priority\.consumes_input/u);
	assert.match(
		priority,
		/candidate\._end - candidate\._start == expected_length/u,
	);
	assert.match(priority, /user_phrase_bonus/u);
	assert.match(priority, /candidate_weight > current_weight/u);

	const tableLike = read("lua/snow/table_like.lua");
	assert.match(tableLike, /require "snow\.candidate_priority"/u);
	assert.match(
		tableLike,
		/promote_exact_user_phrase\(candidate, real_input_length\)/u,
	);
	assert.match(tableLike, /main = main/u);
	const learnedPriority = read("lua/snow/learned_priority.lua");
	assert.match(learnedPriority, /candidate_priority\.user_phrase_weight/u);
	assert.match(learnedPriority, /candidate\.type == "fixed"/u);
	assert.match(learnedPriority, /comment:match\("📌"\)/u);
	assert.match(learnedPriority, /commit_notifier:connect/u);
	assert.match(learnedPriority, /not ctx:get_option\("buffered"\)/u);
	assert.match(learnedPriority, /not context:get_option\("buffered"\)/u);
	assert.match(learnedPriority, /memory:update_candidate\(candidate, 1\)/u);
	assert.match(learnedPriority, /regex_match\(input, "\^\[a-z\]\+\$"\)/u);
	assert.match(learnedPriority, /env\.cache = \{\}/u);
	for (const schema of [
		"snow_jiandao.schema.yaml",
		"snow_jiandao_classic.schema.yaml",
	]) {
		const source = read(schema);
		assert.match(
			source,
			/lua_translator@\*snow\.table_like\*main/u,
			`${schema} 的主翻译路径也必须在引擎合流前恢复用户词优先级`,
		);
		assert.match(source, /lua_filter@\*snow\.learned_priority/u);
		assert.ok(
			source.indexOf("lua_filter@*snow.postpone") <
				source.indexOf("lua_filter@*snow.learned_priority"),
			`${schema} 必须让用户学习权重覆盖软性后置规则`,
		);
	}
	for (const schema of [
		"snow_sanpin.schema.yaml",
		"snow_sanpin_classic.schema.yaml",
	]) {
		const source = read(schema);
		assert.match(source, /lua_filter@\*snow\.learned_priority/u);
		assert.ok(
			source.indexOf("lua_filter@*snow.postpone") <
				source.indexOf("lua_filter@*snow.learned_priority"),
			`${schema} 必须让用户学习权重覆盖软性后置规则`,
		);
		assert.match(source, /lua_translator@\*snow\.table_like\*t12/u);
		assert.match(source, /lua_translator@\*snow\.table_like\*jianpin/u);
	}

	const shenyun = read("lua/snow/shenyun.lua");
	assert.match(shenyun, /require "snow\.candidate_priority"/u);
	assert.match(
		shenyun,
		/candidate_priority\.better_across_routes\([\s\S]*candidate, best, env\.memory, learned_cache\)/u,
	);
});

test("latency cases follow the active U357 layout and repository fixture", () => {
	const cases = read("scripts/data/latency-cases.ts");
	for (const code of ["btxkiu", "erfaiu", "wmxsui", "btov", "kxfkG", "khrmG"])
		assert.ok(cases.includes(`keys: "${code}"`), `缺少当前 U357 用例 ${code}`);
	const qingyun = read("snow_qingyun.schema.yaml");
	assert.match(qingyun, /"punctuator\/full_shape\/`": null/u);
	assert.match(qingyun, /"punctuator\/half_shape\/`": null/u);
	for (const obsolete of ["bgxhuv", "wmxwov", "bgov", "kxfquoaaa"])
		assert.ok(!cases.includes(obsolete), `仍有旧布局用例 ${obsolete}`);
	assert.match(
		read("scripts/benchmark-latency.ts"),
		/join\(source, "spec", "fixtures", "default\.yaml"\)/u,
	);
});
