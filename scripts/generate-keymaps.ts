import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

type Mapping = {
	initialMap: Record<string, string>;
	finalMap: Record<string, string>;
	shapeKeysByMeaning: string;
	toneKeysByTone: string;
};

type KeyNote = {
	primary: string;
	secondary?: string;
	tertiary?: string;
};

type Diagram = {
	filename: string;
	title: string;
	subtitle: string;
	mapping?: Mapping;
	auxiliary?: Record<string, KeyNote>;
	trigger: "E" | "V";
};

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDirectory, "..");
const outputDirectory = join(root, "lua", "snow", "keymaps");
const check = process.argv.includes("--check");
const rows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const rowOffsets = [20, 70, 120];
const width = 1100;
const height = 470;
const keyWidth = 98;
const keyHeight = 118;
const gap = 8;
const rowY = [82, 208, 334];

const u357 = JSON.parse(
	readFileSync(join(root, "config", "shenyun-21x21-mapping.json"), "utf8"),
) as Mapping;
const overall17 = JSON.parse(
	readFileSync(join(root, "config", "shenyun-21x26-mapping.json"), "utf8"),
) as Mapping;

const classic: Mapping = {
	shapeKeysByMeaning: "AVUIO",
	toneKeysByTone: "VIUOA",
	initialMap: {
		A: "X",
		E: "X",
		O: "X",
		b: "B",
		p: "P",
		m: "M",
		f: "F",
		d: "D",
		t: "T",
		n: "N",
		l: "L",
		g: "G",
		k: "K",
		h: "H",
		j: "J",
		q: "Q",
		x: "X",
		zh: "F",
		"zh*": "Q",
		ch: "W",
		"ch*": "J",
		sh: "E",
		r: "R",
		z: "Z",
		c: "C",
		s: "S",
		w: "W",
		y: "Y",
	},
	finalMap: {
		a: "S",
		ia: "S",
		ai: "H",
		an: "F",
		ang: "P",
		ao: "Z",
		e: "E",
		ei: "W",
		en: "N",
		eng: "R",
		er: "J",
		i: "K",
		ian: "M",
		iang: "X",
		iao: "C",
		ie: "D",
		in: "B",
		ing: "G",
		iong: "Y",
		iu: "Q",
		o: "L",
		ong: "Y",
		ou: "D",
		u: "J",
		ua: "Q",
		uai: "G",
		uan: "T",
		uang: "M",
		ui: "B",
		un: "W",
		uo: "L",
		v: "L",
		ve: "H",
	},
};

function escapeXml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

function invert(mapping: Record<string, string>) {
	const result = new Map<string, string[]>();
	for (const [value, key] of Object.entries(mapping)) {
		const normalized = key.toUpperCase();
		const values = result.get(normalized) ?? [];
		values.push(value);
		result.set(normalized, values);
	}
	return result;
}

function initialLabels(mapping: Mapping) {
	const result = invert(mapping.initialMap);
	for (const [key, values] of result) {
		const labels = values
			.filter((value) => value.toLowerCase() !== key.toLowerCase())
			.map((value) => {
				if (["A", "E", "O", "W", "Y", "YU"].includes(value)) {
					return `Ø${value}`;
				}
				return value;
			});
		const zero = labels.filter((value) => value.startsWith("Ø"));
		const ordinary = labels.filter((value) => !value.startsWith("Ø"));
		result.set(
			key,
			zero.length > 0
				? [...ordinary, `Ø${zero.map((value) => value.slice(1)).join("/")}`]
				: ordinary,
		);
	}
	return result;
}

function toneNotes(keys: string) {
	const tones = ["一声 ˉ", "二声 ˊ", "三声 ˇ", "四声 ˋ", "轻声 ·"];
	return Object.fromEntries(
		[...keys].map((key, index) => [
			key.toUpperCase(),
			{ primary: tones[index] },
		]),
	);
}

function shapeNotes(keys: string) {
	const meaningKeys = [...keys.toUpperCase()];
	const physical = {
		a: meaningKeys[0],
		v: meaningKeys[1],
		u: meaningKeys[2],
		i: meaningKeys[3],
		o: meaningKeys[4],
	};
	const code = (abstract: string) =>
		[...abstract]
			.map((key) => physical[key as keyof typeof physical])
			.join("")
			.toLowerCase();
	return {
		[physical.a]: { primary: "折 ㇕ · 水", secondary: `贝 ${code("ao")}` },
		[physical.v]: {
			primary: "横 一 · 木",
			secondary: `土/士 ${code("vo")}`,
		},
		[physical.u]: { primary: "撇 丿 · 月", secondary: `十 ${code("uo")}` },
		[physical.i]: {
			primary: "竖 丨 · 人",
			secondary: `艹 ${code("ii")} · 手 ${code("iu")} · 金 ${code("io")}`,
		},
		[physical.o]: { primary: "点 丶 · 口", secondary: `日 ${code("oi")}` },
	};
}

const sipinAuxiliary: Record<string, KeyNote> = {
	A: { primary: "腹 a/ü", secondary: "尾 m · 四声 ˋ", tertiary: "折 ㇕" },
	E: { primary: "腹 e/ie", secondary: "尾 ng · 二声 ˊ", tertiary: "横 一" },
	U: { primary: "腹 u/ia/ue", secondary: "三声 ˇ", tertiary: "撇 丿" },
	I: { primary: "腹 i/ua/er", secondary: "一声 ˉ", tertiary: "竖 丨" },
	O: {
		primary: "腹 o/üa/üe",
		secondary: "腹 io/uo · 尾 n",
		tertiary: "轻声 · · 点 丶",
	},
};

const sipinInitials: Record<string, string[]> = {
	W: ["zh"],
	Y: ["ch"],
	V: ["sh"],
	R: ["ØA/E/O"],
	F: ["ØI"],
	S: ["ØU"],
	K: ["ØÜ"],
};

const diagrams: Diagram[] = [
	{
		filename: "snow_sipin",
		title: "冰雪四拼",
		subtitle: "声码 · 韵腹 / 韵尾 / 声调 · 五笔画（独立按 E 显隐）",
		auxiliary: sipinAuxiliary,
		trigger: "E",
	},
	{
		filename: "snow_sanpin",
		title: "冰雪弎拼 · 无飞键道(U357)",
		subtitle: "21×21 声韵与声调映射（独立按 V 显隐）",
		mapping: u357,
		auxiliary: toneNotes(u357.toneKeysByTone),
		trigger: "V",
	},
	{
		filename: "snow_jiandao",
		title: "冰雪健道 · 无飞键道(U357)",
		subtitle: "21×21 声韵与形笔字根映射（独立按 V 显隐）",
		mapping: u357,
		auxiliary: shapeNotes(u357.shapeKeysByMeaning),
		trigger: "V",
	},
	{
		filename: "snow_sanpin_classic",
		title: "冰雪三拼 · 经典键道",
		subtitle: "21×21 声韵与声调映射（独立按 V 显隐）",
		mapping: classic,
		auxiliary: toneNotes(classic.toneKeysByTone),
		trigger: "V",
	},
	{
		filename: "snow_shenyun_tone",
		title: "冰雪散拼 · 神韵(Overall-17)",
		subtitle: "21×26 声韵与声调映射（独立按 E 显隐）",
		mapping: overall17,
		auxiliary: toneNotes(overall17.toneKeysByTone),
		trigger: "E",
	},
	{
		filename: "snow_shenyun_shape",
		title: "冰雪简道 · 神韵(Overall-17)",
		subtitle: "21×26 声韵与形笔字根映射（独立按 E 显隐）",
		mapping: overall17,
		auxiliary: shapeNotes(overall17.shapeKeysByMeaning),
		trigger: "E",
	},
];

function text(
	x: number,
	y: number,
	value: string,
	options: { size: number; fill: string; anchor?: string; weight?: number },
) {
	return `<text x="${x}" y="${y}" font-family="Microsoft YaHei UI, Noto Sans CJK SC, sans-serif" font-size="${options.size}" fill="${options.fill}" text-anchor="${options.anchor ?? "start"}" font-weight="${options.weight ?? 500}">${escapeXml(value)}</text>`;
}

function render(diagram: Diagram) {
	const initials = diagram.mapping ? initialLabels(diagram.mapping) : new Map();
	const finals = diagram.mapping ? invert(diagram.mapping.finalMap) : new Map();
	const groups: string[] = [];
	for (let row = 0; row < rows.length; row++) {
		for (let column = 0; column < rows[row].length; column++) {
			const key = rows[row][column];
			const x = rowOffsets[row] + column * (keyWidth + gap);
			const y = rowY[row];
			const initial =
				diagram.filename === "snow_sipin"
					? (sipinInitials[key] ?? [])
					: (initials.get(key) ?? []);
			const final = finals.get(key) ?? [];
			const auxiliary = diagram.auxiliary?.[key];
			const isTrigger = key === diagram.trigger;
			const fill = auxiliary ? "#edf5ef" : "#fffdf9";
			const stroke = isTrigger ? "#c55c4f" : auxiliary ? "#719484" : "#aaa9a3";
			const strokeWidth = isTrigger ? 4 : auxiliary ? 2.6 : 1.8;
			const items = [
				`<g data-key="${key}">`,
				`<rect x="${x}" y="${y}" width="${keyWidth}" height="${keyHeight}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`,
				text(x + 10, y + 28, key, { size: 24, fill: "#4d4b52", weight: 760 }),
			];
			if (initial.length > 0) {
				items.push(
					text(x + keyWidth - 9, y + 27, initial.join("/"), {
						size: initial.join("/").length > 9 ? 11 : 14,
						fill: "#9b5365",
						anchor: "end",
						weight: 700,
					}),
				);
			}
			if (auxiliary) {
				items.push(
					text(x + keyWidth / 2, y + 55, auxiliary.primary, {
						size: auxiliary.primary.length > 15 ? 10 : 12,
						fill: "#426b59",
						anchor: "middle",
						weight: 680,
					}),
				);
				if (auxiliary.secondary) {
					items.push(
						text(x + keyWidth / 2, y + 75, auxiliary.secondary, {
							size: auxiliary.secondary.length > 18 ? 8.5 : 11,
							fill: "#526c78",
							anchor: "middle",
							weight: 620,
						}),
					);
				}
				if (auxiliary.tertiary) {
					items.push(
						text(x + keyWidth / 2, y + 94, auxiliary.tertiary, {
							size: 10.5,
							fill: "#526c78",
							anchor: "middle",
							weight: 620,
						}),
					);
				}
			}
			if (final.length > 0) {
				const label = final.join(" · ").replaceAll("v", "ü");
				const parts =
					label.length > 15
						? [
								final.slice(0, Math.ceil(final.length / 2)),
								final.slice(Math.ceil(final.length / 2)),
							]
						: [final];
				parts.forEach((part, index) => {
					items.push(
						text(
							x + keyWidth / 2,
							y + 99 + index * 15,
							part.join(" · ").replaceAll("v", "ü"),
							{
								size: part.join(" · ").length > 14 ? 10 : 13,
								fill: "#536f9a",
								anchor: "middle",
								weight: 650,
							},
						),
					);
				});
			}
			items.push("</g>");
			groups.push(items.join(""));
		}
	}
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img"><title>${escapeXml(diagram.title)}键位映射图</title><desc>${escapeXml(diagram.subtitle)}</desc><rect width="${width}" height="${height}" rx="18" fill="#f4f1eb"/>${text(24, 35, diagram.title, { size: 24, fill: "#3f514b", weight: 760 })}${text(24, 62, diagram.subtitle, { size: 14, fill: "#6d746e" })}${groups.join("")}</svg>\n`;
}

function update(path: string, content: Uint8Array | string) {
	const expected =
		typeof content === "string" ? Buffer.from(content) : Buffer.from(content);
	if (check) {
		if (!existsSync(path) || !readFileSync(path).equals(expected)) {
			throw new Error(`键位图已过期：${path}`);
		}
		return;
	}
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, expected);
}

for (const diagram of diagrams) {
	const svg = render(diagram);
	update(join(outputDirectory, `${diagram.filename}.svg`), svg);
	const png = new Resvg(svg, { fitTo: { mode: "width", value: 1100 } })
		.render()
		.asPng();
	update(join(outputDirectory, `${diagram.filename}.png`), png);
}

const classicSource = join(
	scriptDirectory,
	"assets",
	"keymaps",
	"xkjd-qwerty.png",
);
if (!existsSync(classicSource))
	throw new Error(`缺少经典键道原图：${classicSource}`);
const classicPng = readFileSync(classicSource);
const classicWidth = classicPng.readUInt32BE(16);
const classicHeight = classicPng.readUInt32BE(20);
update(join(outputDirectory, "snow_jiandao_classic.png"), classicPng);
update(
	join(outputDirectory, "snow_jiandao_classic.svg"),
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${classicWidth} ${classicHeight}" role="img"><title>冰雪键道键位图</title><image width="${classicWidth}" height="${classicHeight}" href="data:image/png;base64,${classicPng.toString("base64")}"/></svg>\n`,
);

console.log(
	check ? "七份键位图均为最新。" : `已生成七份键位图：${outputDirectory}`,
);
