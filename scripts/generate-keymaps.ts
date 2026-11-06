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
};

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDirectory, "..");
const outputDirectory = join(root, "lua", "snow", "keymaps");
const check = process.argv.includes("--check");
const rows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const rowOffsets = [20, 45, 95];
const width = 1040;
const height = 590;
const keyWidth = 92;
const keyHeight = 130;
const keyStep = 100;
const rowY = [78, 218, 358];

const semanticPatterns = `<defs><pattern id="nf4-both" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#fbfaf7"/></pattern><pattern id="nf4-ionly" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#e3eef4"/><path d="M2 0V9M7 0V9" stroke="#7399ad" stroke-opacity=".18"/></pattern><pattern id="nf4-ronly" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#f6ebd6"/><circle cx="3" cy="3" r="1.15" fill="#b39253" fill-opacity=".3"/></pattern><pattern id="nf4-none" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#eeece8"/><path d="M0 10L10 0" stroke="#aaa6a4" stroke-opacity=".14"/></pattern><pattern id="nf4-multi" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#f8efe2"/><path d="M-2 2L2-2M0 9L9 0M7 11L11 7" stroke="#9a784e" stroke-width="1.6" stroke-opacity=".27"/></pattern><pattern id="nf4-anchor" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M-3 3L3-3M0 12L12 0M9 15L15 9" stroke="#a05b37" stroke-width="2.5" stroke-opacity=".48"/></pattern></defs>`;

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
			.filter((value) => value !== key.toLowerCase())
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
	B: ["b"],
	P: ["p"],
	M: ["m"],
	F: ["f", "ØI"],
	D: ["d"],
	T: ["t"],
	N: ["n"],
	L: ["l"],
	G: ["g"],
	K: ["k", "ØÜ"],
	H: ["h"],
	J: ["j"],
	Q: ["q"],
	X: ["x"],
	Z: ["z"],
	C: ["c"],
	S: ["s", "ØU"],
	R: ["r", "ØA/E/O"],
	W: ["zh"],
	Y: ["ch"],
	V: ["sh"],
};

const diagrams: Diagram[] = [
	{
		filename: "snow_sipin",
		title: "冰雪四拼",
		subtitle: "声码 · 韵腹 / 韵尾 / 声调 · 五笔画（独立按 E 显隐）",
		auxiliary: sipinAuxiliary,
	},
	{
		filename: "snow_sanpin",
		title: "冰雪弎拼 · 无飞键道(U357)",
		subtitle: "21×21 声韵与声调映射（独立按 V 显隐）",
		mapping: u357,
		auxiliary: toneNotes(u357.toneKeysByTone),
	},
	{
		filename: "snow_jiandao",
		title: "冰雪健道 · 无飞键道(U357)",
		subtitle: "21×21 声韵与形笔字根映射（独立按 V 显隐）",
		mapping: u357,
		auxiliary: shapeNotes(u357.shapeKeysByMeaning),
	},
	{
		filename: "snow_jiandao_classic",
		title: "冰雪键道",
		subtitle: "经典 21×21 声韵与形笔字根映射（独立按 V 显隐）",
		mapping: classic,
		auxiliary: shapeNotes(classic.shapeKeysByMeaning),
	},
	{
		filename: "snow_sanpin_classic",
		title: "冰雪三拼 · 经典键道",
		subtitle: "21×21 声韵与声调映射（独立按 V 显隐）",
		mapping: classic,
		auxiliary: toneNotes(classic.toneKeysByTone),
	},
	{
		filename: "snow_shenyun_tone",
		title: "冰雪散拼 · 神韵(Overall-17)",
		subtitle: "21×26 声韵与声调映射（独立按 E 显隐）",
		mapping: overall17,
		auxiliary: toneNotes(overall17.toneKeysByTone),
	},
	{
		filename: "snow_shenyun_shape",
		title: "冰雪简道 · 神韵(Overall-17)",
		subtitle: "21×26 声韵与形笔字根映射（独立按 E 显隐）",
		mapping: overall17,
		auxiliary: shapeNotes(overall17.shapeKeysByMeaning),
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

function semanticColor(final: string) {
	if (/ng$/u.test(final)) return "#8f879f";
	if (/n$/u.test(final)) return "#9f8f76";
	if (/^[vü]/u.test(final)) return "#a17f91";
	if (/^i/u.test(final)) return "#748f9e";
	if (/^u/u.test(final)) return "#929967";
	if (/^a/u.test(final)) return "#ad8178";
	if (/^e/u.test(final)) return "#899985";
	if (/^o/u.test(final)) return "#a7966c";
	return "#748d82";
}

function displayInitialLabels(key: string, roles: string[]) {
	return roles
		.filter((role) => role !== key.toLowerCase())
		.map((role) => {
			if (["A", "E", "O", "W", "Y", "YU"].includes(role)) {
				return `Ø${role}`;
			}
			return role;
		});
}

function render(diagram: Diagram) {
	const rawInitials = diagram.mapping
		? invert(diagram.mapping.initialMap)
		: new Map(Object.entries(sipinInitials));
	const initials = diagram.mapping
		? initialLabels(diagram.mapping)
		: new Map(
				[...rawInitials].map(([key, roles]) => [
					key,
					displayInitialLabels(key, roles),
				]),
			);
	const finals = diagram.mapping ? invert(diagram.mapping.finalMap) : new Map();
	const groups: string[] = [];
	for (let row = 0; row < rows.length; row++) {
		for (let column = 0; column < rows[row].length; column++) {
			const key = rows[row][column];
			const x = rowOffsets[row] + column * keyStep;
			const y = rowY[row];
			const initialRoles = rawInitials.get(key) ?? [];
			const initial = initials.get(key) ?? [];
			const final = finals.get(key) ?? [];
			const auxiliary = diagram.auxiliary?.[key];
			const hasInitial = initialRoles.length > 0;
			const hasRhyme =
				final.length > 0 ||
				(diagram.filename === "snow_sipin" && auxiliary !== undefined);
			const occupancy = hasInitial
				? hasRhyme
					? "both"
					: "ionly"
				: hasRhyme
					? "ronly"
					: "none";
			const role = hasInitial
				? hasRhyme
					? auxiliary
						? "sound-auxiliary"
						: "sound"
					: auxiliary
						? "initial-auxiliary"
						: "initial-only"
				: hasRhyme
					? auxiliary
						? "rhyme-auxiliary"
						: "rhyme-only"
					: auxiliary
						? "auxiliary-only"
						: "unused";
			const multi = final.length > 1;
			const stroke = multi
				? "#9a784e"
				: {
						both: "#b8b7af",
						ionly: "#7399ad",
						ronly: "#b39253",
						none: auxiliary ? "#77a08c" : "#aaa6a4",
					}[occupancy];
			const dash = {
				both: "",
				ionly: "8 4",
				ronly: "2 4",
				none: "7 5",
			}[occupancy];
			const strokeWidth = multi ? 3.2 : occupancy === "both" ? 2.2 : 1.8;
			const fill =
				occupancy === "both"
					? "#fbfaf7"
					: occupancy === "none" && auxiliary
						? "#e4f1e9"
						: `url(#nf4-${occupancy})`;
			const clip = `${diagram.filename}-clip-${row}-${column}`;
			const directInitial = initialRoles.some(
				(value) => value === key.toLowerCase(),
			);
			const titleInitials = initialRoles.join(" / ") || "—";
			const titleFinals = final.join(" / ") || "—";
			const items = [
				`<g data-key="${key}" data-role="${role}"${multi ? ' data-multi="true"' : ""}>`,
				`<title>${key}｜声码 ${escapeXml(titleInitials)}｜韵码 ${escapeXml(titleFinals)}${auxiliary ? `｜辅键 ${escapeXml([auxiliary.primary, auxiliary.secondary, auxiliary.tertiary].filter(Boolean).join(" / "))}` : ""}</title>`,
				`<clipPath id="${clip}"><rect x="${x + 3}" y="${y + 3}" width="${keyWidth - 6}" height="${keyHeight - 6}" rx="7"/></clipPath>`,
				`<rect x="${x}" y="${y}" width="${keyWidth}" height="${keyHeight}" rx="9" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`,
				...(multi
					? [
							`<rect x="${x + 4}" y="${y + 4}" width="${keyWidth - 8}" height="${keyHeight - 8}" rx="6" fill="none" stroke="${stroke}" stroke-opacity=".38"/>`,
						]
					: []),
				...(["F", "J"].includes(key)
					? [
							`<rect x="${x + 2}" y="${y + 2}" width="${keyWidth - 4}" height="${keyHeight - 4}" rx="8" fill="url(#nf4-anchor)" pointer-events="none"/>`,
						]
					: []),
				`<g clip-path="url(#${clip})">`,
				text(x + 10, y + 23, key, {
					size: 21,
					fill: directInitial ? "#4d4050" : "#4f5962",
					weight: directInitial ? 800 : 680,
				}),
			];

			const ordinary = initial.filter((value) => !value.startsWith("Ø"));
			const zero = initial.filter((value) => value.startsWith("Ø"));
			const ordinaryText = ordinary.join("/");
			const zeroText =
				zero.length > 0
					? `Ø ${zero.map((value) => value.slice(1)).join("/")}`
					: "";
			if (ordinaryText) {
				const ordinaryY = zeroText ? y + 45 : y + 52;
				const size = Math.min(20, 76 / Math.max(1, ordinaryText.length * 0.58));
				items.push(
					`<text x="${x + keyWidth / 2}" y="${ordinaryY}" text-anchor="middle" font-family="Microsoft YaHei UI, Noto Sans CJK SC, sans-serif" font-size="${size}" font-weight="700" text-decoration="underline" fill="#66506a">${escapeXml(ordinaryText)}</text>`,
				);
			}
			if (zeroText) {
				const zeroY = ordinaryText ? y + 73 : y + 52;
				const size = Math.min(20, 70 / Math.max(1, zeroText.length * 0.58));
				const zeroWidth = Math.min(
					80,
					Math.max(35, zeroText.length * size * 0.52 + 10),
				);
				items.push(
					`<rect x="${x + keyWidth / 2 - zeroWidth / 2}" y="${zeroY - size - 1}" width="${zeroWidth}" height="${size + 6}" rx="7" fill="#f1e4e1" stroke="#ad8178" stroke-dasharray="4 2"/>`,
					`<text x="${x + keyWidth / 2}" y="${zeroY}" text-anchor="middle" font-family="Microsoft YaHei UI, Noto Sans CJK SC, sans-serif" font-size="${size}" font-weight="700" font-style="italic" fill="#765b5c">${escapeXml(zeroText)}</text>`,
				);
			}

			if (auxiliary) {
				const auxiliaryOnly = !hasInitial && !hasRhyme;
				const sipinDetail = diagram.filename === "snow_sipin";
				if (auxiliaryOnly || sipinDetail) {
					const lines = [
						auxiliary.primary,
						auxiliary.secondary,
						auxiliary.tertiary,
					].filter((value): value is string => value !== undefined);
					const cardY = y + (lines.length === 1 ? 46 : 34);
					const cardHeight = lines.length === 1 ? 52 : 86;
					items.push(
						`<rect x="${x + 6}" y="${cardY}" width="${keyWidth - 12}" height="${cardHeight}" rx="10" fill="#e4f1e9" stroke="#77a08c" stroke-width="1.2"/>`,
					);
					lines.forEach((line, index) => {
						items.push(
							text(
								x + keyWidth / 2,
								cardY + (lines.length === 1 ? 31 : 24 + index * 23),
								line,
								{
									size: line.length > 14 ? 8.5 : index === 0 ? 11 : 9.5,
									fill: "#426b59",
									anchor: "middle",
									weight: index === 0 ? 750 : 650,
								},
							),
						);
					});
				} else {
					items.push(
						`<rect x="${x + 40}" y="${y + 5}" width="47" height="21" rx="6" fill="#e4f1e9" stroke="#77a08c"/>`,
						text(x + 63.5, y + 19, auxiliary.primary, {
							size: auxiliary.primary.length > 8 ? 7.5 : 8.5,
							fill: "#426b59",
							anchor: "middle",
							weight: 750,
						}),
					);
					if (auxiliary.secondary) {
						items.push(
							text(x + keyWidth / 2, y + 50, auxiliary.secondary, {
								size: auxiliary.secondary.length > 14 ? 7.5 : 9,
								fill: "#426b59",
								anchor: "middle",
								weight: 650,
							}),
						);
					}
				}
			}

			if (final.length > 0) {
				const layers =
					(ordinaryText ? 1 : 0) +
					(zeroText ? 1 : 0) +
					(auxiliary?.secondary ? 1 : 0);
				const count = Math.min(final.length, 3);
				const first =
					count <= 1
						? layers >= 2
							? 113
							: layers === 1
								? 105
								: 94
						: layers >= 2
							? 100
							: layers === 1
								? count === 2
									? 88
									: 78
								: count === 2
									? 82
									: 70;
				const step = count > 1 ? (119 - first) / (count - 1) : 0;
				const rowCap = count > 1 ? Math.max(13, step * 0.69) : 28;
				final.slice(0, 3).forEach((value, index) => {
					const label = value.replaceAll("v", "ü");
					const direct = value.toUpperCase() === key;
					const size = Math.min(
						28,
						rowCap,
						78 / Math.max(1, label.length * 0.54),
					);
					items.push(
						text(x + keyWidth / 2, y + first + index * step, label, {
							size,
							fill: semanticColor(value),
							anchor: "middle",
							weight: direct ? 800 : multi ? 650 : 540,
						}),
					);
				});
				if (final.length > 3) {
					items.push(
						text(x + 84, y + 124, `+${final.length - 3}`, {
							size: 9,
							fill: "#675f57",
							anchor: "end",
						}),
					);
				}
			}
			items.push("</g></g>");
			groups.push(items.join(""));
		}
	}
	return `<svg xmlns="http://www.w3.org/2000/svg" class="keysvg nf4-keysvg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">${semanticPatterns}<title id="title">${escapeXml(diagram.title)}键位映射图</title><desc id="desc">${escapeXml(diagram.subtitle)}</desc><rect width="${width}" height="${height}" rx="14" fill="#f5f2ec"/>${text(24, 34, diagram.title, { size: 23, fill: "#445650", weight: 760 })}${text(24, 58, diagram.subtitle, { size: 13, fill: "#767a73" })}${groups.join("")}${text(24, 535, "声韵占用、五辅键与多韵键使用独立的莫兰迪背景、纹理和边框。", { size: 14, fill: "#5f5862" })}${text(24, 559, "Morandi semantic map · 韵母前景色按 i/u/ü/a/e/o/*n/*ng 音系族分组", { size: 12, fill: "#74717a" })}</svg>\n`;
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

console.log(
	check ? "七份键位图均为最新。" : `已生成七份键位图：${outputDirectory}`,
);
