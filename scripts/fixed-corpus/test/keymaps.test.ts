import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import { makeHamsterSkin } from "../../skin/hamster";
import { withKeymaps } from "../../skin/keymaps";
import { makeTrimeSkin } from "../../skin/trime";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const schemes = [
	["snow_sipin.schema.yaml", "e", "snow_sipin.svg"],
	["snow_sanpin.schema.yaml", "v", "snow_sanpin.svg"],
	["snow_jiandao.schema.yaml", "v", "snow_jiandao.svg"],
	["snow_sanpin_classic.schema.yaml", "v", "snow_sanpin_classic.svg"],
	["snow_jiandao_classic.schema.yaml", "v", "snow_jiandao_classic.svg"],
	["snow_shenyun_shape.schema.yaml", "e", "snow_shenyun_shape.svg"],
	["snow_shenyun_tone.schema.yaml", "e", "snow_shenyun_tone.svg"],
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

test("runtime keymaps include every configured SVG and PNG resource", () => {
	for (const [, , image] of schemes) {
		const svg = readFileSync(join(root, "lua", "snow", "keymaps", image));
		assert.match(svg.toString("utf8"), /^<svg[\s>]/u);
		const png = readFileSync(
			join(root, "lua", "snow", "keymaps", image.replace(".svg", ".png")),
		);
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

test("mobile skins expose all keymaps without stealing normal letter taps", () => {
	const keyboards = withKeymaps({
		pinyin: {
			colorful: false,
			label: true,
			keyInfos: [[{ action: "e" }, { action: "v" }]],
		},
	});
	assert.equal(Object.keys(keyboards).length, 9);
	assert.equal(keyboards.keymaps.keyInfos.flat().length, 7);
	const mobileImageKey = keyboards.keymap_snow_sipin.keyInfos[0][0] as {
		action: string;
		up?: string;
		hold?: string;
		image?: string;
	};
	assert.equal(mobileImageKey.image, "snow_sipin");
	assert.equal(mobileImageKey.action, "#空操作");
	assert.equal(mobileImageKey.up, "!pinyin");
	assert.equal(mobileImageKey.hold, "#空操作");

	const hamster = makeHamsterSkin({
		...keyboards.keymap_snow_sipin,
		dark: false,
		keymapMenu: "keymaps",
	});
	assert.deepEqual(hamster.snow_sipin_imageImage, {
		buttonStyleType: "fileImage",
		contentMode: "scaleAspectFit",
		normalImage: { file: "snow_sipin", image: "snow_sipin" },
	});
	assert.equal(
		(hamster.snow_sipin_image as { action?: unknown }).action,
		undefined,
	);
	assert.deepEqual(
		(hamster.snow_sipin_image as { repeatAction?: unknown }).repeatAction,
		undefined,
	);
	assert.deepEqual(
		(hamster.pinyin as { swipeUpAction: unknown }).swipeUpAction,
		{ keyboardType: "keymaps" },
	);

	const trime = makeTrimeSkin("test", keyboards);
	assert.equal(
		trime.tool_bar.buttons.find(
			(button) => button.action === "Snow_keyboard_pinyin",
		)?.long_press_action,
		"Snow_keyboard_keymaps",
	);
	assert.equal(
		trime.preset_keyboards.keymap_snow_sipin.keys[0].key_back_color,
		"snow_sipin.png",
	);
	const trimeImageKey = trime.preset_keyboards.keymap_snow_sipin.keys[0];
	assert.equal(trime.preset_keys[trimeImageKey.click].send, undefined);
	assert.equal(trime.preset_keys[trimeImageKey.click].select, undefined);
	assert.ok(trimeImageKey.long_click);
	assert.equal(trime.preset_keys[trimeImageKey.long_click].select, undefined);
	const sipinSelector = trime.preset_keyboards.keymaps.keys[0].click;
	assert.equal(trime.preset_keys[sipinSelector].label, "冰雪四拼");
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

test("shape diagrams distinguish stroke and single-key and two-key roots", () => {
	const expectedMinimumSize = {
		stroke: 14,
		"single-root": 15,
		"double-root": 13,
	} as const;
	for (const image of [
		"snow_jiandao.svg",
		"snow_jiandao_classic.svg",
		"snow_shenyun_shape.svg",
	]) {
		const svg = read(`lua/snow/keymaps/${image}`);
		const colors = new Map<string, string>();
		for (const [kind, minimumSize] of Object.entries(expectedMinimumSize)) {
			const tags = [
				...svg.matchAll(
					new RegExp(`<text\\b[^>]*data-aux-kind="${kind}"[^>]*>`, "gu"),
				),
			].map(([tag]) => tag);
			assert.equal(tags.length, 5, `${image} should label five ${kind} rows`);
			const kindColors = new Set<string>();
			for (const tag of tags) {
				const size = Number(tag.match(/font-size="([^"]+)"/u)?.[1]);
				const fill = tag.match(/fill="([^"]+)"/u)?.[1];
				assert.ok(size >= minimumSize, `${image} ${kind} font is too small`);
				assert.ok(fill, `${image} ${kind} should define a foreground color`);
				kindColors.add(fill);
			}
			assert.equal(
				kindColors.size,
				1,
				`${image} ${kind} color should be stable`,
			);
			colors.set(kind, [...kindColors][0]);
		}
		assert.equal(
			new Set(colors.values()).size,
			3,
			`${image} auxiliary colors must be pairwise distinct`,
		);
		assert.match(svg, /形辅前景：笔画绿框 · 单辅键码根棕 · 双辅键码根紫/u);
		assert.match(
			svg,
			/<text\b(?=[^>]*data-aux-kind="stroke")[^>]*>横 一<\/text>/u,
		);
		assert.match(
			svg,
			/<text\b(?=[^>]*data-aux-kind="single-root")[^>]*>木<\/text>/u,
		);
	}
	assert.match(
		read("lua/snow/keymaps/snow_jiandao_classic.svg"),
		/<text\b(?=[^>]*data-aux-kind="double-root")[^>]*>土\/士 vo<\/text>/u,
	);
	assert.match(
		read("lua/snow/keymaps/snow_shenyun_shape.svg"),
		/<text\b(?=[^>]*data-aux-kind="double-root")[^>]*>土\/士 eo<\/text>/u,
	);
});

test("all diagrams reserve upper-right framed badges for the five stroke auxiliaries", () => {
	for (const [, , image] of schemes) {
		const svg = read(`lua/snow/keymaps/${image}`);
		assert.equal(
			[...svg.matchAll(/<g data-aux-badge="stroke">/gu)].length,
			5,
			`${image} should contain five framed stroke badges`,
		);
		assert.equal(
			[...svg.matchAll(/data-aux-kind="stroke"/gu)].length,
			5,
			`${image} should label five stroke auxiliaries`,
		);
		for (const [tag] of svg.matchAll(
			/<text\b[^>]*data-aux-kind="stroke"[^>]*>/gu,
		)) {
			const size = Number(tag.match(/font-size="([^"]+)"/u)?.[1]);
			assert.ok(size >= 15, `${image} stroke auxiliary font is too small`);
		}
		assert.doesNotMatch(
			svg,
			/<rect\b[^>]*height="86"[^>]*fill="#e4f1e9"/u,
			`${image} should not put center auxiliaries inside a large card`,
		);
	}
});

test("tone auxiliaries are centered and no smaller than shape roots", () => {
	for (const image of [
		"snow_sanpin.svg",
		"snow_sanpin_classic.svg",
		"snow_shenyun_tone.svg",
	]) {
		const svg = read(`lua/snow/keymaps/${image}`);
		const tags = [
			...svg.matchAll(/<text\b[^>]*data-aux-kind="tone"[^>]*>/gu),
		].map(([tag]) => tag);
		assert.equal(tags.length, 5, `${image} should label five tone auxiliaries`);
		for (const tag of tags) {
			const size = Number(tag.match(/font-size="([^"]+)"/u)?.[1]);
			assert.ok(size >= 15, `${image} tone auxiliary font is too small`);
		}
	}
});

test("tone marks stay inline with an independently lowered baseline", () => {
	for (const image of [
		"snow_sipin.svg",
		"snow_sanpin.svg",
		"snow_sanpin_classic.svg",
		"snow_shenyun_tone.svg",
	]) {
		const svg = read(`lua/snow/keymaps/${image}`);
		const nameTags = [
			...svg.matchAll(
				/<text\b[^>]*data-aux-kind="tone"[^>]*>([^<]+)<\/text>/gu,
			),
		];
		const markTags = [
			...svg.matchAll(
				/<text\b[^>]*data-aux-mark="tone"[^>]*>([^<]+)<\/text>/gu,
			),
		];
		assert.equal(nameTags.length, 5, `${image} should render five tone names`);
		assert.equal(markTags.length, 5, `${image} should render five tone marks`);
		for (let index = 0; index < markTags.length; index++) {
			const [nameTag] = nameTags[index];
			const [tag] = markTags[index];
			const size = Number(tag.match(/font-size="([^"]+)"/u)?.[1]);
			const family = tag.match(/font-family="([^"]+)"/u)?.[1] ?? "";
			const nameFamily = nameTag.match(/font-family="([^"]+)"/u)?.[1] ?? "";
			const nameSize = Number(nameTag.match(/font-size="([^"]+)"/u)?.[1]);
			const weight = Number(tag.match(/font-weight="([^"]+)"/u)?.[1]);
			const nameX = Number(nameTag.match(/\bx="([^"]+)"/u)?.[1]);
			const nameY = Number(nameTag.match(/\by="([^"]+)"/u)?.[1]);
			const markX = Number(tag.match(/\bx="([^"]+)"/u)?.[1]);
			const markY = Number(tag.match(/\by="([^"]+)"/u)?.[1]);
			assert.ok(size >= 42, `${image} tone mark is too small`);
			assert.match(
				family,
				/Noto Sans Mono CJK SC/u,
				`${image} tone mark needs the requested Noto CJK font`,
			);
			assert.ok(weight >= 700, `${image} tone mark should use a bold face`);
			assert.doesNotMatch(
				nameFamily,
				/Sans|Mono/u,
				`${image} Chinese tone name should use a distinct Chinese font`,
			);
			assert.match(nameFamily, /LXGW WenKai/u);
			assert.equal(nameSize, 18, `${image} Chinese tone name height changed`);
			assert.ok(
				Math.abs(markX - nameX - nameSize * 1.5) < 0.1,
				`${image} should reserve one ideographic-space column`,
			);
			assert.ok(markY > nameY, `${image} tone mark baseline should be lower`);
			assert.ok(markY - nameY <= 18, `${image} tone mark should stay inline`);
		}
	}
});

test("both Shenyun diagrams keep the crowded er and u finals readable", () => {
	for (const image of ["snow_shenyun_shape.svg", "snow_shenyun_tone.svg"]) {
		const svg = read(`lua/snow/keymaps/${image}`);
		for (const final of ["er", "u"]) {
			const tag = svg.match(
				new RegExp(`<text\\b[^>]*data-final="${final}"[^>]*>`, "u"),
			)?.[0];
			assert.ok(tag, `${image} is missing ${final} final`);
			const size = Number(tag.match(/font-size="([^"]+)"/u)?.[1]);
			assert.ok(size >= 20, `${image} ${final} final is too small`);
		}
	}
});

test("all diagrams use one weight for uppercase keycap labels", () => {
	const weights = new Set<number>();
	for (const [, , image] of schemes) {
		const svg = read(`lua/snow/keymaps/${image}`);
		const tags = [
			...svg.matchAll(/<text\b[^>]*data-key-label="true"[^>]*>/gu),
		].map(([tag]) => tag);
		assert.equal(tags.length, 26, `${image} should label all keycaps`);
		for (const tag of tags) {
			weights.add(Number(tag.match(/font-weight="([^"]+)"/u)?.[1]));
		}
	}
	assert.deepEqual([...weights], [800]);
});

test("KeyTao final e does not inherit keycap emphasis", () => {
	const svg = read("lua/snow/keymaps/snow_jiandao_classic.svg");
	const tag = svg.match(/<text\b[^>]*data-final="e"[^>]*>/u)?.[0];
	assert.ok(tag, "KeyTao should show final e");
	const weight = Number(tag.match(/font-weight="([^"]+)"/u)?.[1]);
	assert.ok(weight <= 650, "KeyTao final e should use the normal final weight");
});

test("Four-Code separates abdomen tail tone and stroke foreground semantics", () => {
	const svg = read("lua/snow/keymaps/snow_sipin.svg");
	const colors = new Map<string, string>();
	for (const kind of ["abdomen", "tail", "tone", "stroke"]) {
		const tags = [
			...svg.matchAll(
				new RegExp(`<text\\b[^>]*data-aux-kind="${kind}"[^>]*>`, "gu"),
			),
		].map(([tag]) => tag);
		assert.ok(tags.length > 0, `missing Four-Code ${kind} labels`);
		const kindColors = new Set<string>();
		for (const tag of tags) {
			const size = Number(tag.match(/font-size="([^"]+)"/u)?.[1]);
			const fill = tag.match(/fill="([^"]+)"/u)?.[1];
			assert.ok(size >= 13, `Four-Code ${kind} font is too small`);
			assert.ok(fill, `Four-Code ${kind} should define a foreground color`);
			kindColors.add(fill);
		}
		assert.equal(
			kindColors.size,
			1,
			`Four-Code ${kind} color should be stable`,
		);
		colors.set(kind, [...kindColors][0]);
	}
	assert.equal(new Set(colors.values()).size, 4);
	assert.equal(colors.get("abdomen"), "#6f8198");
	assert.equal(colors.get("tail"), "#76506a");
});

test("seven diagrams share the benchmark Morandi semantic vocabulary", () => {
	for (const [, , image] of schemes) {
		const svg = read(`lua/snow/keymaps/${image}`);
		assert.match(svg, /class="keysvg nf4-keysvg"/u, image);
		assert.match(svg, /aria-labelledby="title desc"/u, image);
		assert.match(svg, /<title id="title">/u, image);
		assert.match(svg, /<desc id="desc">/u, image);
		assert.match(
			svg,
			/<pattern id="nf4-ionly"[^<]*<rect[^<]*<path[^>]*stroke-opacity="\.18"/u,
			image,
		);
		assert.match(
			svg,
			/<pattern id="nf4-ronly"[^<]*<rect[^<]*<circle[^>]*fill-opacity="\.3"/u,
			image,
		);
		assert.match(
			svg,
			/<pattern id="nf4-none"[^<]*<rect[^<]*<path[^>]*stroke-opacity="\.14"/u,
			image,
		);
		assert.match(
			svg,
			/<pattern id="nf4-multi"[^<]*<rect[^<]*<path[^>]*stroke-opacity="\.27"/u,
			image,
		);
		assert.doesNotMatch(svg, /data:image\/png;base64/u, image);
	}
});

test("semantic key roles drive fills, borders, and auxiliary treatment", () => {
	const sipin = read("lua/snow/keymaps/snow_sipin.svg");
	assert.match(sipin, /<g data-key="W" data-role="initial-only">/u);
	assert.match(sipin, /<g data-key="A" data-role="rhyme-auxiliary">/u);
	assert.match(sipin, /<g data-key="Q" data-role="initial-only">/u);

	const sanpin = read("lua/snow/keymaps/snow_sanpin.svg");
	assert.match(sanpin, /<g data-key="A" data-role="auxiliary-only">/u);
	assert.match(sanpin, /<g data-key="E" data-role="sound" data-multi="true">/u);

	const shenyun = read("lua/snow/keymaps/snow_shenyun_shape.svg");
	assert.match(shenyun, /<g data-key="A" data-role="rhyme-auxiliary">/u);
	assert.match(shenyun, /fill="#748f9e"[^>]*>i<\/text>/u);
	assert.match(shenyun, /fill="#929967"[^>]*>u<\/text>/u);
	assert.match(shenyun, /fill="#a17f91"[^>]*>ü<\/text>/u);
	assert.match(shenyun, /fill="#9f8f76"[^>]*>ün<\/text>/u);
	assert.match(shenyun, /fill="#8f879f"[^>]*>ang<\/text>/u);
	assert.match(shenyun, />Ø Y\/YU<\/text>/u);
});

test("ice KeyTao is generated as searchable native SVG", () => {
	const jiandao = read("lua/snow/keymaps/snow_jiandao_classic.svg");
	assert.match(jiandao, /<title id="title">冰雪键道键位映射图<\/title>/u);
	assert.match(jiandao, />zh<\/text>/u);
	assert.match(jiandao, />土\/士 vo<\/text>/u);
	assert.doesNotMatch(jiandao, /<image\b/u);
});

test("the desktop helper stays dormant outside an idle Chinese composition", () => {
	const processor = read("lua/snow/keymap.lua");
	assert.match(processor, /context:get_option\("ascii_mode"\)/u);
	assert.match(processor, /context\.input ~= ""/u);
	assert.match(processor, /key_event:release\(\)/u);
	assert.match(processor, /key_event\.modifier ~= 0/u);
	assert.doesNotMatch(processor, /powershell/iu);
	assert.match(processor, /snow-keymap-windows\.exe/u);
	assert.match(processor, /write_command\(env, "follow"\)/u);
	assert.match(processor, /write_command\(env, "toggle"\)/u);
	assert.match(
		read("lua/snow/statistics.lua"),
		/snow\.keymap_keys\[env\.schema_id\]/u,
	);
});
