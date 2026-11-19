import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import { keymapLinkColorDistance } from "../../lib/keymap-link-colors";
import { makeHamsterSkin } from "../../skin/hamster";
import { withKeymaps } from "../../skin/keymaps";
import { makeTrimeSkin } from "../../skin/trime";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const keyGroup = (svg: string, key: string) =>
	svg.match(
		new RegExp(
			`<g data-key="${key}"[\\s\\S]*?(?=<g data-key=|<text x="24" y="535")`,
			"u",
		),
	)?.[0] ?? "";

const letterKeys = [..."QWERTYUIOPASDFGHJKLZXCVBNM"];

function textTags(group: string) {
	return group.match(/<text\b[^>]*>[^<]*<\/text>/gu) ?? [];
}

function keycapTag(group: string, key: string) {
	return textTags(group).find(
		(tag) =>
			tag.endsWith(`>${key}</text>`) &&
			(/data-key-label="true"/u.test(tag) || /font-size="21"/u.test(tag)),
	);
}

function assertEveryMovedKeycapHasOneColorLink(svg: string, image: string) {
	const groups = Object.fromEntries(
		letterKeys.map((key) => [key, keyGroup(svg, key)]),
	);
	const movedColors = new Set<string>();
	for (const source of letterKeys) {
		const sourceTag = keycapTag(groups[source], source);
		assert.ok(sourceTag, `${image} should contain source keycap ${source}`);
		if (!/font-weight="500"/u.test(sourceTag)) continue;
		const color = sourceTag.match(/fill="(#[0-9a-f]{6})"/u)?.[1];
		assert.ok(color, `${image} ${source} should have a link color`);
		assert.ok(
			!movedColors.has(color),
			`${image} should not reuse moved link color ${color}`,
		);
		movedColors.add(color);

		const target = letterKeys.find((key) =>
			textTags(groups[key]).some((tag) => {
				if (!tag.includes(`fill="${color}"`)) return false;
				if (source === "W")
					return /font-style="italic"[^>]*>Ø W<\/text>/u.test(tag);
				if (source === "Y")
					return /font-style="italic"[^>]*>Ø Y(?:\/YU)?<\/text>/u.test(tag);
				return (
					/text-decoration="underline"/u.test(tag) &&
					tag.endsWith(`>${source.toLowerCase()}</text>`)
				);
			}),
		);
		assert.ok(target, `${image} ${source} should link to one target label`);
		const targetKeycap = keycapTag(groups[target], target);
		const targetColor = targetKeycap?.match(/fill="(#[0-9a-f]{6})"/u)?.[1];
		assert.ok(targetColor, `${image} ${target} should have a keycap color`);
		assert.ok(
			keymapLinkColorDistance(color, targetColor) >= 0.18,
			`${image} ${source} link ${color} should contrast with ${target} keycap ${targetColor}`,
		);
	}
}

const schemes = [
	["snow_sipin.schema.yaml", "e", "snow_sipin.svg"],
	["snow_sanpin.schema.yaml", "v", "snow_sanpin.svg"],
	["snow_jiandao.schema.yaml", "v", "snow_jiandao.svg"],
	["snow_sanpin_classic.schema.yaml", "v", "snow_sanpin_classic.svg"],
	["snow_jiandao_classic.schema.yaml", "v", "snow_jiandao_classic.svg"],
	["snow_jiandao_toned.schema.yaml", "v", "snow_jiandao_toned.svg"],
	["snow_shenyun_shape.schema.yaml", "e", "snow_shenyun_shape.svg"],
	["snow_shenyun_tone.schema.yaml", "e", "snow_shenyun_tone.svg"],
	["snow_zhudao.schema.yaml", "e", "snow_zhudao.svg"],
] as const;

test("eight released diagrams bind only their vacant standalone key to a keymap", () => {
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
		const document = load(read(schema)) as {
			engine: { processors: string[] };
		};
		const processors = document.engine.processors;
		assert.ok(
			processors.indexOf("recognizer") <
				processors.indexOf("lua_processor@*snow.keymap"),
			schema,
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
	assert.equal(Object.keys(keyboards).length, 11);
	assert.deepEqual(
		keyboards.keymaps.keyInfos.map((row) => row.map((key) => key.label)),
		[
			["四拼", "莲道", "鹮道"],
			["键道", "兰道", "鹤道"],
			["三拼", "兰拼", "鹤拼"],
		],
	);
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
	const hamsterMenu = makeHamsterSkin({
		...keyboards.keymaps,
		dark: false,
	});
	for (const key of keyboards.keymaps.keyInfos.flat()) {
		assert.equal(
			(hamsterMenu[key.action] as { size: { width: string } }).size.width,
			"1/3",
		);
	}

	const trime = makeTrimeSkin("test", keyboards);
	assert.equal(trime.preset_keyboards.keymaps.columns, 3);
	assert.deepEqual(
		trime.preset_keyboards.keymaps.keys.map((key) => [
			trime.preset_keys[key.click].label,
			key.width,
		]),
		keyboards.keymaps.keyInfos.flat().map((key) => [key.label, 100 / 3]),
	);
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
	assert.equal(trime.preset_keys[sipinSelector].label, "四拼");
	const lastKey = trime.preset_keyboards.keymaps.keys.at(-1);
	assert.ok(lastKey);
	assert.equal(trime.preset_keys[lastKey.click].label, "鹤拼");
	assert.equal(lastKey.swipe_up, undefined);
	assert.equal(lastKey.swipe_down, undefined);
});

test("active diagrams identify OC21-e1f155973380 and RC26-39a5bfdc045342cd", () => {
	for (const [id, name] of [
		["snow_jiandao", "冰雪兰道"],
		["snow_sanpin", "冰雪兰拼"],
		["snow_shenyun_shape", "冰雪鹤道"],
		["snow_shenyun_tone", "冰雪鹤拼"],
	]) {
		const schema = load(read(`${id}.schema.yaml`)) as {
			schema: { name: string };
		};
		assert.equal(schema.schema.name, name);
		assert.ok(read(`lua/snow/keymaps/${id}.svg`).includes(`${name} · `));
	}
	for (const image of ["snow_jiandao.svg", "snow_sanpin.svg"]) {
		assert.match(read(`lua/snow/keymaps/${image}`), /OC21-e1f155973380/u);
	}
	for (const image of ["snow_shenyun_shape.svg", "snow_shenyun_tone.svg"]) {
		assert.match(read(`lua/snow/keymaps/${image}`), /RC26-39a5bfdc045342cd/u);
	}
	for (const [image, label] of [
		["docs/shenyun-oc21-e1f155973380-keyboard.svg", "OC21-e1f155973380"],
		["docs/shenyun-rc26-keyboard.svg", "RC26-39a5bfdc045342cd"],
	] as const) {
		const svg = read(image);
		assert.match(svg, new RegExp(label.replace("/", "\\/"), "u"));
		assert.equal([...svg.matchAll(/data-key="[A-Z]"/gu)].length, 26, image);
	}
});

test("README diagrams preserve source-to-target link colors from benchmark", () => {
	for (const [image, source, target, initial, color] of [
		["docs/shenyun-rc26-keyboard.svg", "Q", "F", "q", "#e83e8c"],
		["docs/shenyun-rc26-keyboard.svg", "S", "Q", "s", "#00a651"],
		["docs/shenyun-rc26-keyboard.svg", "X", "Y", "x", "#005bd8"],
		["docs/shenyun-oc21-e1f155973380-keyboard.svg", "K", "P", "k", "#00acc1"],
		["docs/shenyun-oc21-e1f155973380-keyboard.svg", "L", "E", "l", "#fb8c00"],
	] as const) {
		const svg = read(image);
		assert.match(
			keyGroup(svg, source),
			new RegExp(
				`<text\\b[^>]*fill="${color}"[^>]*font-weight="500"[^>]*>${source}<\\/text>`,
				"u",
			),
		);
		assert.match(
			keyGroup(svg, target),
			new RegExp(
				`<text\\b[^>]*font-weight="700"[^>]*text-decoration="underline"[^>]*fill="${color}"[^>]*>${initial}<\\/text>`,
				"u",
			),
		);
	}
	const d3 = read("docs/shenyun-rc26-keyboard.svg");
	assert.match(
		keyGroup(d3, "J"),
		/fill="#deedf1" stroke="#6e9eaa"[^>]*stroke-dasharray="4 2"/u,
	);
	assert.match(
		keyGroup(d3, "W"),
		/fill="#f2e5da" stroke="#b88a68"[^>]*stroke-dasharray="4 2"/u,
	);
	assert.match(
		keyGroup(d3, "Y"),
		/fill="#f1e4e1" stroke="#ad8178"[^>]*stroke-dasharray="4 2"/u,
	);
});

test("README and popup diagrams link every moved source with one distinct color", () => {
	for (const image of [
		"docs/shenyun-rc26-keyboard.svg",
		"docs/shenyun-oc21-e1f155973380-keyboard.svg",
		...schemes.map(([, , image]) => `lua/snow/keymaps/${image}`),
	]) {
		assertEveryMovedKeycapHasOneColorLink(read(image), image);
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

test("shape diagrams distinguish stroke and single-key and two-key roots", () => {
	const expectedMinimumSize = {
		stroke: 14,
		"single-root": 17,
		"double-root": 15,
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
				const weight = Number(tag.match(/font-weight="([^"]+)"/u)?.[1]);
				const fill = tag.match(/fill="([^"]+)"/u)?.[1];
				assert.ok(size >= minimumSize, `${image} ${kind} font is too small`);
				if (kind !== "stroke") {
					assert.ok(
						weight >= 800,
						`${image} shape roots should stay visibly bold`,
					);
					assert.match(
						tag,
						/paint-order="stroke"[^>]*stroke-width="0\.4"/u,
						`${image} shape roots should compensate for weak font fallback`,
					);
				}
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

test("tone marks use one optical center independent of font metrics", () => {
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
			...svg.matchAll(/<g\b[^>]*data-aux-mark="tone"[^>]*>/gu),
		].map(([tag]) => tag);
		assert.equal(nameTags.length, 5, `${image} should render five tone names`);
		assert.equal(markTags.length, 5, `${image} should render five tone marks`);
		for (let index = 0; index < markTags.length; index++) {
			const [nameTag] = nameTags[index];
			const tag = markTags[index];
			const nameFamily = nameTag.match(/font-family="([^"]+)"/u)?.[1] ?? "";
			const nameSize = Number(nameTag.match(/font-size="([^"]+)"/u)?.[1]);
			const nameX = Number(nameTag.match(/\bx="([^"]+)"/u)?.[1]);
			const nameY = Number(nameTag.match(/\by="([^"]+)"/u)?.[1]);
			const markX = Number(tag.match(/data-mark-x="([^"]+)"/u)?.[1]);
			const markY = Number(tag.match(/data-mark-y="([^"]+)"/u)?.[1]);
			const markSize = Number(tag.match(/data-mark-size="([^"]+)"/u)?.[1]);
			assert.doesNotMatch(
				nameFamily,
				/Sans|Mono/u,
				`${image} Chinese tone name should use a distinct Chinese font`,
			);
			assert.match(nameFamily, /LXGW WenKai/u);
			assert.equal(nameSize, 18, `${image} Chinese tone name height changed`);
			assert.ok(markSize >= 18, `${image} tone mark is too small`);
			assert.ok(
				Math.abs(markX - nameX - nameSize * 1.5) < 0.1,
				`${image} should reserve one ideographic-space column`,
			);
			assert.equal(
				markY,
				nameY - 7,
				`${image} tone marks should align optically`,
			);
		}
		assert.deepEqual(
			markTags.map((tag) => tag.match(/data-tone-mark="([^"]+)"/u)?.[1]).sort(),
			["·", "ˉ", "ˊ", "ˇ", "ˋ"].sort(),
		);
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

test("moved initials pair source keycaps with target labels by distinct colors", () => {
	const softenedKeys: Record<string, string> = {
		"snow_sipin.svg": "",
		"snow_sanpin.svg": "KL",
		"snow_jiandao.svg": "KL",
		"snow_jiandao_toned.svg": "KS",
		"snow_sanpin_classic.svg": "",
		"snow_jiandao_classic.svg": "",
		"snow_shenyun_shape.svg": "QWSYX",
		"snow_shenyun_tone.svg": "QWSYX",
		"snow_zhudao.svg": "QWSYX",
	};
	for (const [, , image] of schemes) {
		const svg = read(`lua/snow/keymaps/${image}`);
		for (const key of [..."QWERTYUIOPASDFGHJKLZXCVBNM"]) {
			const group = keyGroup(svg, key);
			const keycap = group.match(
				/<text\b[^>]*data-key-label="true"[^>]*>/u,
			)?.[0];
			assert.ok(keycap, `${image} should label keycap ${key}`);
			const keycapWeight = Number(keycap.match(/font-weight="([^"]+)"/u)?.[1]);
			const shouldSoften = softenedKeys[image].includes(key);
			assert.equal(
				keycapWeight,
				shouldSoften ? 500 : 800,
				`${image} ${key} should follow its same-letter traditional or W/Y zero initial`,
			);
		}
	}
	const linkCases = [
		["snow_shenyun_shape.svg", "Q", "F", "q", "#e83e8c"],
		["snow_shenyun_shape.svg", "S", "Q", "s", "#00a651"],
		["snow_shenyun_shape.svg", "X", "Y", "x", "#005bd8"],
		["snow_jiandao.svg", "K", "P", "k", "#00acc1"],
		["snow_jiandao.svg", "L", "E", "l", "#fb8c00"],
	] as const;
	for (const [image, source, target, initial, color] of linkCases) {
		const svg = read(`lua/snow/keymaps/${image}`);
		const sourceKeycap = keyGroup(svg, source).match(
			/<text\b[^>]*data-key-label="true"[^>]*>/u,
		)?.[0];
		const targetInitial = keyGroup(svg, target).match(
			new RegExp(
				`<text\\b[^>]*font-weight="700"[^>]*text-decoration="underline"[^>]*fill="([^"]+)"[^>]*>${initial}<\\/text>`,
				"u",
			),
		);
		assert.ok(sourceKeycap, `${image} should contain source ${source}`);
		assert.ok(
			targetInitial,
			`${image} should contain target ${target}/${initial}`,
		);
		assert.equal(sourceKeycap.match(/fill="([^"]+)"/u)?.[1], color);
		assert.equal(targetInitial[1], color);
		assert.match(sourceKeycap, /font-weight="500"/u);
	}
	assert.notEqual(linkCases[0][4], linkCases[1][4]);
	assert.notEqual(linkCases[0][4], linkCases[2][4]);

	const d3F = keyGroup(read("lua/snow/keymaps/snow_shenyun_shape.svg"), "F");
	const d3FKeycap = d3F.match(/<text\b[^>]*data-key-label="true"[^>]*>/u)?.[0];
	assert.ok(d3FKeycap);
	assert.match(d3FKeycap, /font-weight="800"/u);
	assert.match(d3F, />q<\/text>/u);
});

test("every moved initial contrasts strongly with the initial letter on its key", () => {
	const minimumDistance = 0.18;
	for (const [, , image] of schemes) {
		const svg = read(`lua/snow/keymaps/${image}`);
		for (const key of [..."QWERTYUIOPASDFGHJKLZXCVBNM"]) {
			const group = keyGroup(svg, key);
			const keycap = group.match(
				/<text\b[^>]*data-key-label="true"[^>]*>/u,
			)?.[0];
			assert.ok(keycap, `${image} should label keycap ${key}`);
			const keycapColor = keycap.match(/fill="(#[0-9a-f]{6})"/u)?.[1];
			assert.ok(keycapColor);
			const movedKeycap = /font-weight="500"/u.test(keycap);
			const initialLabels = group.match(
				/<text\b[^>]*(?:font-weight="700"[^>]*text-decoration="underline"|font-style="italic")[^>]*>[^<]+<\/text>/gu,
			);
			for (const label of initialLabels ?? []) {
				if (/>Ø A\/E\/O<\/text>/u.test(label)) continue;
				const labelColor = label.match(/fill="(#[0-9a-f]{6})"/u)?.[1];
				assert.ok(labelColor);
				const movedLabel = !["#66506a", "#765b5c"].includes(labelColor);
				if (!movedKeycap && !movedLabel) continue;
				const distance = keymapLinkColorDistance(keycapColor, labelColor);
				assert.ok(
					distance >= minimumDistance,
					`${image} ${key} keycap ${keycapColor} and ${labelColor} initial should differ by at least ${minimumDistance}, got ${distance.toFixed(3)}`,
				);
			}
		}
	}
});

test("moved W/Y zero initials use separate Morandi foregrounds and cards", () => {
	const svg = read("lua/snow/keymaps/snow_shenyun_shape.svg");
	for (const [source, target, label, foreground, background, border] of [
		["W", "J", "Ø W", "#3e98b0", "#deedf1", "#6e9eaa"],
		["Y", "W", "Ø Y/YU", "#b67747", "#f2e5da", "#b88a68"],
	] as const) {
		const sourceKeycap = keyGroup(svg, source).match(
			/<text\b[^>]*data-key-label="true"[^>]*>/u,
		)?.[0];
		const targetGroup = keyGroup(svg, target);
		assert.ok(sourceKeycap);
		assert.match(sourceKeycap, new RegExp(`fill="${foreground}"`, "u"));
		assert.match(sourceKeycap, /font-weight="500"/u);
		assert.match(
			targetGroup,
			new RegExp(
				`<rect\\b[^>]*fill="${background}"[^>]*stroke="${border}"[^>]*stroke-dasharray="4 2"`,
				"u",
			),
		);
		assert.match(
			targetGroup,
			new RegExp(
				`<text\\b[^>]*font-style="italic"[^>]*fill="${foreground}"[^>]*>${label}<\\/text>`,
				"u",
			),
		);
	}
	const aeoTarget = keyGroup(svg, "Y");
	assert.match(aeoTarget, /fill="#f1e4e1" stroke="#ad8178"/u);
	assert.match(
		aeoTarget,
		/font-style="italic" fill="#765b5c">Ø A\/E\/O<\/text>/u,
	);
});

test("KeyTao final e does not inherit keycap emphasis", () => {
	const svg = read("lua/snow/keymaps/snow_jiandao_classic.svg");
	const tag = svg.match(/<text\b[^>]*data-final="e"[^>]*>/u)?.[0];
	assert.ok(tag, "KeyTao should show final e");
	const weight = Number(tag.match(/font-weight="([^"]+)"/u)?.[1]);
	assert.ok(weight <= 650, "KeyTao final e should use the normal final weight");
});

test("only finals that actually shrink receive a compensating bold weight", () => {
	for (const [, , image] of schemes) {
		const svg = read(`lua/snow/keymaps/${image}`);
		for (const [tag] of svg.matchAll(
			/<text\b[^>]*data-final="[^"]+"[^>]*>/gu,
		)) {
			const size = Number(tag.match(/font-size="([^"]+)"/u)?.[1]);
			const weight = Number(tag.match(/font-weight="([^"]+)"/u)?.[1]);
			if (size < 24) {
				assert.ok(weight >= 800, `${image} reduced final should stay bold`);
				assert.match(
					tag,
					/paint-order="stroke"[^>]*stroke-width="0\.35"/u,
					`${image} reduced final should compensate for weak font fallback`,
				);
			} else {
				assert.ok(
					weight <= 650,
					`${image} full-size final should keep its normal weight`,
				);
				assert.doesNotMatch(tag, /paint-order="stroke"/u);
			}
		}
	}
});

test("classic KeyTao and Three-Code show the X-key uang fly route", () => {
	for (const image of ["snow_jiandao_classic.svg", "snow_sanpin_classic.svg"]) {
		const svg = read(`lua/snow/keymaps/${image}`);
		assert.match(keyGroup(svg, "M"), /韵码 ian \/ uang/u, image);
		assert.match(keyGroup(svg, "X"), /韵码 iang \/ uang\*/u, image);
	}
});

test("classic Three-Code uses the same IVUAO tone order as current Three-Code", () => {
	for (const image of ["snow_sanpin.svg", "snow_sanpin_classic.svg"]) {
		const svg = read(`lua/snow/keymaps/${image}`);
		for (const [key, tone] of [
			["I", "一声"],
			["V", "二声"],
			["U", "三声"],
			["A", "四声"],
			["O", "轻声"],
		] as const) {
			assert.match(keyGroup(svg, key), new RegExp(`辅键 ${tone}`, "u"), image);
		}
	}
	assert.match(
		read("snow_sanpin_classic.schema.yaml"),
		/xlit\/12345\/ivuao\//u,
	);
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

test("Four-Code puts tone rows below the key label and above every rhyme row", () => {
	const svg = read("lua/snow/keymaps/snow_sipin.svg");
	for (const key of ["A", "E", "U", "I", "O"]) {
		const group = keyGroup(svg, key);
		const toneY = Number(
			group.match(/<text\b[^>]*\by="([^"]+)"[^>]*data-aux-kind="tone"/u)?.[1],
		);
		const rhymeYs = [
			...group.matchAll(
				/<text\b[^>]*\by="([^"]+)"[^>]*data-aux-kind="(?:abdomen|tail)"/gu,
			),
		].map((match) => Number(match[1]));
		assert.ok(toneY > 0 && rhymeYs.length > 0, `Four-Code ${key} rows missing`);
		assert.ok(
			toneY < Math.min(...rhymeYs),
			`Four-Code ${key} tone should sit above its rhyme rows`,
		);
	}
});

test("eight diagrams share the benchmark Morandi semantic vocabulary", () => {
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

test("冰雪鹮道按实际带调音节显示声调区，并加深兼作韵键的五辅底色", () => {
	const svg = read("lua/snow/keymaps/snow_zhudao.svg");
	const mapping = JSON.parse(read("config/snow-zhudao-mapping.json")) as {
		referenceTonedCodes: Record<string, string>;
		shapeKeysByMeaning: string;
	};
	const tonesByKey = new Map<string, Set<string>>();
	for (const [syllable, code] of Object.entries(mapping.referenceTonedCodes)) {
		const key = code[1].toUpperCase();
		const tones = tonesByKey.get(key) ?? new Set<string>();
		tones.add(syllable.endsWith("5") ? "0" : syllable.slice(-1));
		tonesByKey.set(key, tones);
	}
	for (const [keys, tones, light, dark] of [
		["QWERTYUIOP", "23", "#dcefdc", "#c2d2c2"],
		["ASDFGHJKL", "4", "#d8e9f3", "#becdd6"],
		["ZXCVBNM", "01", "#f5e8bd", "#d8cca6"],
	]) {
		for (const key of keys) {
			const group = keyGroup(svg, key);
			const fill = mapping.shapeKeysByMeaning.includes(key) ? dark : light;
			const base = group.match(/<rect\b[^>]*width="92"[^>]*>/u)?.[0];
			assert.ok(base?.includes(`fill="${fill}"`), `鹮道 ${key} 的声调底色`);
			const actual = [...(tonesByKey.get(key) ?? [])].sort().join("");
			assert.ok(
				[...actual].every((tone) => tones.includes(tone)),
				key,
			);
			assert.ok(
				group.includes(`data-tones="${actual}"`),
				`${key} 的实际合法调值`,
			);
		}
	}
	assert.match(keyGroup(svg, "B"), /data-tones="1">1<\/text>/u);
	assert.doesNotMatch(svg, /undefined|NaN/u);
	assert.match(svg, /兼作韵键的五辅同色加深/u);
});

test("带调主码图保持跨排韵组颜色，纯形辅与无调主码图保留各自语义", () => {
	for (const name of ["snow_zhudao", "snow_jiandao_toned"]) {
		const svg = read(`lua/snow/keymaps/${name}.svg`);
		const colors = new Map<string, string>();
		for (const key of letterKeys) {
			for (const tag of textTags(keyGroup(svg, key))) {
				const final = tag.match(/data-final="([^"]+)"/u)?.[1];
				if (!final) continue;
				const color = tag.match(/fill="([^"]+)"/u)?.[1];
				assert.ok(color);
				if (colors.has(final)) assert.equal(color, colors.get(final), final);
				colors.set(final, color);
			}
		}
		assert.equal(colors.size, 10);
		assert.equal(new Set(colors.values()).size, 10);
	}
	const sword = read("lua/snow/keymaps/snow_jiandao_toned.svg");
	for (const key of "AVUIO") {
		assert.match(keyGroup(sword, key), /width="92"[^>]*fill="#e8d8f5"/u);
		assert.doesNotMatch(keyGroup(sword, key), /data-tone-region=/u);
	}
	for (const [, , image] of schemes) {
		if (["snow_zhudao.svg", "snow_jiandao_toned.svg"].includes(image)) continue;
		assert.doesNotMatch(
			read(`lua/snow/keymaps/${image}`),
			/data-tone-region=/u,
		);
	}
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

test("the Windows desktop helper identifies itself as a tool window", () => {
	const helper = read("tools/keymap-helper/src/main.rs");
	assert.match(helper, /WS_EX_TOOLWINDOW/u);
	assert.match(helper, /with_skip_taskbar\(true\)/u);
	assert.match(helper, /mark_as_tool_window\(&window\)/u);
});

test("scheme initialization reuses the desktop helper without launching a process", () => {
	const processor = read("lua/snow/keymap.lua");
	const init = processor.slice(
		processor.indexOf("function processor.init"),
		processor.indexOf("function processor.func"),
	);
	assert.match(init, /write_command\(env, "follow"\)/u);
	assert.doesNotMatch(init, /launch\(env\)/u);
	assert.match(processor, /env\.command_path \.\. "\.alive"/u);
	assert.match(processor, /not helper_alive\(env\)/u);
});
