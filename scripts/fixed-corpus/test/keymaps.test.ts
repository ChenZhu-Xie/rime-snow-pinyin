import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const schemes = [
	["snow_sipin.schema.yaml", "e", "snow_sipin.png"],
	["snow_sanpin.schema.yaml", "v", "snow_sanpin.png"],
	["snow_jiandao.schema.yaml", "v", "snow_jiandao.png"],
	["snow_sanpin_classic.schema.yaml", "v", "snow_sanpin_classic.png"],
	["snow_jiandao_classic.schema.yaml", "v", "snow_jiandao_classic.png"],
	["snow_shenyun_shape.schema.yaml", "e", "snow_shenyun_shape.png"],
	["snow_shenyun_tone.schema.yaml", "e", "snow_shenyun_tone.png"],
] as const;

test("seven released schemes bind only their vacant standalone key to a keymap", () => {
	for (const [schema, key, image] of schemes) {
		const content = read(schema);
		assert.match(
			content,
			new RegExp(
				`keymap:\\s+key: ${key}\\s+image: ${image.replace(".", "\\.")}`,
				"u",
			),
		);
	}
	for (const schema of [
		"snow_sipin.schema.yaml",
		"snow_sanpin.schema.yaml",
		"snow_jiandao.schema.yaml",
		"snow_sanpin_classic.schema.yaml",
		"snow_jiandao_classic.schema.yaml",
		"snow_shenyun_common.yaml",
	]) {
		assert.match(
			read(schema),
			/- recognizer\s+- lua_processor@\*snow\.keymap/u,
		);
	}
});

test("keymap configuration does not swallow engine pipeline sections", () => {
	for (const schema of schemes.slice(0, 5).map(([path]) => path)) {
		const document = load(read(schema)) as {
			engine: {
				segmentors: string[];
				translators: string[];
				filters: string[];
			};
			keymap: { key: string; image: string };
		};
		assert.ok(Array.isArray(document.engine.segmentors), schema);
		assert.ok(Array.isArray(document.engine.translators), schema);
		assert.ok(Array.isArray(document.engine.filters), schema);
		assert.deepEqual(Object.keys(document.keymap).sort(), ["image", "key"]);
	}
});

test("runtime keymaps are real PNG files", () => {
	for (const [, , image] of schemes) {
		const png = readFileSync(join(root, "lua", "snow", "keymaps", image));
		assert.deepEqual(
			[...png.subarray(0, 8)],
			[137, 80, 78, 71, 13, 10, 26, 10],
		);
		assert.ok(png.readUInt32BE(16) >= 1000, `${image} should remain legible`);
		assert.ok(
			png.readUInt32BE(20) >= 300,
			`${image} should contain the keyboard`,
		);
	}
});

test("tone and shape diagrams keep their auxiliary semantics separate", () => {
	const sanpin = read("lua/snow/keymaps/snow_sanpin.svg");
	const jiandao = read("lua/snow/keymaps/snow_jiandao.svg");
	const tone = read("lua/snow/keymaps/snow_shenyun_tone.svg");
	const shape = read("lua/snow/keymaps/snow_shenyun_shape.svg");
	assert.match(sanpin, /一声 ˉ/u);
	assert.doesNotMatch(sanpin, /土\/士/u);
	assert.match(jiandao, /土\/士 vo/u);
	assert.doesNotMatch(jiandao, /一声 ˉ/u);
	assert.match(tone, /一声 ˉ/u);
	assert.doesNotMatch(tone, /土\/士/u);
	assert.match(shape, /土\/士 eo/u);
	assert.doesNotMatch(shape, /一声 ˉ/u);
	assert.match(read("lua/snow/keymaps/snow_sipin.svg"), /腹 o\/üa\/üe/u);
});

test("the Windows helper stays dormant outside an idle Chinese composition", () => {
	const processor = read("lua/snow/keymap.lua");
	assert.match(processor, /context:get_option\("ascii_mode"\)/u);
	assert.match(processor, /context\.input ~= ""/u);
	assert.match(processor, /key_event:release\(\)/u);
	assert.match(processor, /key_event\.modifier ~= 0/u);
	assert.match(
		read("lua/snow/statistics.lua"),
		/snow\.keymap_keys\[env\.schema_id\]/u,
	);
});
