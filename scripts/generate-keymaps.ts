import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import {
	KEYMAP_LINK_COLOR_CONTRACT,
	resolveMappingLinkColors,
} from "./lib/keymap-link-colors";

type Mapping = {
	initialMap: Record<string, string>;
	finalMap: Record<string, string>;
	shapeKeysByMeaning: string;
	toneKeysByTone: string;
};

type ShapeKeyNote = {
	stroke: string;
	singleRoot: string;
	doubleRoot: string;
};

type ToneKeyNote = {
	stroke: string;
	tone: string;
	toneMark: string;
};

type SipinKeyNote = {
	abdomen: string[];
	tail?: string;
	tone: string;
	toneMark: string;
	stroke: string;
};

type KeyNote = ShapeKeyNote | ToneKeyNote | SipinKeyNote;

type AuxiliaryKind =
	| "stroke"
	| "single-root"
	| "double-root"
	| "tone"
	| "abdomen"
	| "tail";

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
const u357First = JSON.parse(
	readFileSync(
		join(root, "config", "shenyun-21x21-first-mapping.json"),
		"utf8",
	),
) as Mapping;
const overall17First = JSON.parse(
	readFileSync(
		join(root, "config", "shenyun-21x26-first-mapping.json"),
		"utf8",
	),
) as Mapping;

const classic: Mapping = {
	shapeKeysByMeaning: "AVUIO",
	toneKeysByTone: "IVUAO",
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
		"uang*": "X",
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

function toneNotes(mapping: Mapping): Record<string, ToneKeyNote> {
	const tones = [
		{ tone: "一声", toneMark: "ˉ" },
		{ tone: "二声", toneMark: "ˊ" },
		{ tone: "三声", toneMark: "ˇ" },
		{ tone: "四声", toneMark: "ˋ" },
		{ tone: "轻声", toneMark: "·" },
	];
	const shapes = shapeNotes(mapping.shapeKeysByMeaning);
	return Object.fromEntries(
		[...mapping.toneKeysByTone].map((key, index) => [
			key.toUpperCase(),
			{
				stroke: shapes[key.toUpperCase()].stroke,
				...tones[index],
			},
		]),
	);
}

function shapeNotes(keys: string): Record<string, ShapeKeyNote> {
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
		[physical.a]: {
			stroke: "折 ㇕",
			singleRoot: "水",
			doubleRoot: `贝 ${code("ao")}`,
		},
		[physical.v]: {
			stroke: "横 一",
			singleRoot: "木",
			doubleRoot: `土/士 ${code("vo")}`,
		},
		[physical.u]: {
			stroke: "撇 丿",
			singleRoot: "月",
			doubleRoot: `十 ${code("uo")}`,
		},
		[physical.i]: {
			stroke: "竖 丨",
			singleRoot: "人",
			doubleRoot: `艹 ${code("ii")} · 手 ${code("iu")} · 金 ${code("io")}`,
		},
		[physical.o]: {
			stroke: "点 丶",
			singleRoot: "口",
			doubleRoot: `日 ${code("oi")}`,
		},
	};
}

const sipinAuxiliary: Record<string, SipinKeyNote> = {
	A: {
		abdomen: ["腹 a/ü"],
		tail: "尾 m",
		tone: "四声",
		toneMark: "ˋ",
		stroke: "折 ㇕",
	},
	E: {
		abdomen: ["腹 e/ie"],
		tail: "尾 ng",
		tone: "二声",
		toneMark: "ˊ",
		stroke: "横 一",
	},
	U: {
		abdomen: ["腹 u/ia/ue"],
		tone: "三声",
		toneMark: "ˇ",
		stroke: "撇 丿",
	},
	I: {
		abdomen: ["腹 i/ua/er"],
		tone: "一声",
		toneMark: "ˉ",
		stroke: "竖 丨",
	},
	O: {
		abdomen: ["腹 o/üa/üe", "腹 io/uo"],
		tail: "尾 n",
		tone: "轻声",
		toneMark: "·",
		stroke: "点 丶",
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
		title: "冰雪弎拼 · QZ-e8f37a",
		subtitle: "21×21 声韵与声调映射（独立按 V 显隐）",
		mapping: u357,
		auxiliary: toneNotes(u357),
	},
	{
		filename: "snow_jiandao",
		title: "冰雪健道 · QZ-e8f37a",
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
		auxiliary: toneNotes(classic),
	},
	{
		filename: "snow_shenyun_tone",
		title: "冰雪散拼 · D3/V1",
		subtitle: "21×26 声韵与声调映射（独立按 E 显隐）",
		mapping: overall17,
		auxiliary: toneNotes(overall17),
	},
	{
		filename: "snow_shenyun_shape",
		title: "冰雪简道 · D3/V1",
		subtitle: "21×26 声韵与形笔字根映射（独立按 E 显隐）",
		mapping: overall17,
		auxiliary: shapeNotes(overall17.shapeKeysByMeaning),
	},
];

function text(
	x: number,
	y: number,
	value: string,
	options: {
		size: number;
		fill: string;
		anchor?: string;
		weight?: number;
		auxKind?: AuxiliaryKind;
		auxMark?: "tone";
		final?: string;
		fontFamily?: string;
		keyLabel?: boolean;
		textLength?: number;
		embolden?: number;
	},
) {
	const auxiliaryKind = options.auxKind
		? ` data-aux-kind="${options.auxKind}"`
		: "";
	const auxiliaryMark = options.auxMark
		? ` data-aux-mark="${options.auxMark}"`
		: "";
	const fittedLength = options.textLength
		? ` textLength="${options.textLength}" lengthAdjust="spacingAndGlyphs"`
		: "";
	const final = options.final
		? ` data-final="${escapeXml(options.final)}"`
		: "";
	const keyLabel = options.keyLabel ? ' data-key-label="true"' : "";
	const embolden = options.embolden
		? ` paint-order="stroke" stroke="${options.fill}" stroke-width="${options.embolden}" stroke-linejoin="round"`
		: "";
	const fontFamily =
		options.fontFamily ?? "Microsoft YaHei UI, Noto Sans CJK SC, sans-serif";
	return `<text x="${x}" y="${y}" font-family="${fontFamily}" font-size="${options.size}" fill="${options.fill}" text-anchor="${options.anchor ?? "start"}" font-weight="${options.weight ?? 500}"${auxiliaryKind}${auxiliaryMark}${final}${keyLabel}${fittedLength}${embolden}>${escapeXml(value)}</text>`;
}

function isShapeKeyNote(note: KeyNote): note is ShapeKeyNote {
	return "singleRoot" in note;
}

function isToneKeyNote(note: KeyNote): note is ToneKeyNote {
	return "tone" in note && !("abdomen" in note);
}

function isSipinKeyNote(note: KeyNote): note is SipinKeyNote {
	return "abdomen" in note;
}

function auxiliaryLabels(note: KeyNote) {
	if (isShapeKeyNote(note)) {
		return [note.stroke, note.singleRoot, note.doubleRoot];
	}
	if (isToneKeyNote(note)) {
		return [`${note.tone} ${note.toneMark}`, note.stroke];
	}
	return [
		...note.abdomen,
		note.tail,
		`${note.tone} ${note.toneMark}`,
		note.stroke,
	].filter((value): value is string => value !== undefined);
}

function renderStrokeBadge(stroke: string, x: number, y: number) {
	return `<g data-aux-badge="stroke"><rect x="${x + 40}" y="${y + 4}" width="47" height="22" rx="6" fill="#e4f1e9" stroke="#77a08c"/>${text(
		x + 63.5,
		y + 19,
		stroke,
		{
			size: 15,
			fill: "#426b59",
			anchor: "middle",
			weight: 750,
			auxKind: "stroke",
		},
	)}</g>`;
}

function renderToneLine(
	tone: string,
	toneMark: string,
	x: number,
	y: number,
	nameSize: number,
) {
	const center = x + keyWidth / 2;
	const toneNameFontFamily =
		"LXGW WenKai GB, LXGW WenKai, Kaiti SC, STKaiti, KaiTi, AR PL KaitiM GB, serif";
	const nameX = center - nameSize / 2;
	const markX = center + nameSize;
	const markY = y - 7;
	const markPaths: Record<string, string> = {
		ˉ: '<path d="M-8 0H8"/>',
		ˊ: '<path d="M-7 5L7-5"/>',
		ˇ: '<path d="M-7-4L0 5L7-4"/>',
		ˋ: '<path d="M-7-5L7 5"/>',
		"·": '<circle cx="0" cy="0" r="3.4" fill="#a05b37" stroke="none"/>',
	};
	const mark = markPaths[toneMark];
	return [
		text(nameX, y, tone, {
			size: nameSize,
			fill: "#a05b37",
			anchor: "middle",
			weight: 800,
			auxKind: "tone",
			fontFamily: toneNameFontFamily,
		}),
		`<g transform="translate(${markX} ${markY})" data-aux-mark="tone" data-tone-mark="${toneMark}" data-mark-x="${markX}" data-mark-y="${markY}" data-mark-size="18" fill="none" stroke="#a05b37" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${mark}</g>`,
	];
}

function renderShapeAuxiliary(
	note: ShapeKeyNote,
	x: number,
	y: number,
	auxiliaryOnly: boolean,
) {
	const center = x + keyWidth / 2;
	const rows: Array<{
		kind: AuxiliaryKind;
		value: string;
		size: number;
		fill: string;
		weight: number;
	}> = [
		{
			kind: "stroke",
			value: note.stroke,
			size: 14,
			fill: "#426b59",
			weight: 750,
		},
		{
			kind: "single-root",
			value: note.singleRoot,
			size: 17,
			fill: "#a05b37",
			weight: 800,
		},
		{
			kind: "double-root",
			value: note.doubleRoot,
			size: 15,
			fill: "#66506a",
			weight: 800,
		},
	];
	const rootRows = auxiliaryOnly ? [69, 99] : [46, 68];
	return [
		renderStrokeBadge(note.stroke, x, y),
		text(center, y + rootRows[0], note.singleRoot, {
			size: rows[1].size,
			fill: rows[1].fill,
			anchor: "middle",
			weight: rows[1].weight,
			auxKind: rows[1].kind,
			embolden: 0.4,
		}),
		text(center, y + rootRows[1], note.doubleRoot, {
			size: rows[2].size,
			fill: rows[2].fill,
			anchor: "middle",
			weight: rows[2].weight,
			auxKind: rows[2].kind,
			textLength: note.doubleRoot.length > 14 ? 76 : undefined,
			embolden: 0.4,
		}),
	];
}

function renderToneAuxiliary(
	note: ToneKeyNote,
	x: number,
	y: number,
	auxiliaryOnly: boolean,
) {
	return [
		renderStrokeBadge(note.stroke, x, y),
		...renderToneLine(
			note.tone,
			note.toneMark,
			x,
			y + (auxiliaryOnly ? 82 : 50),
			18,
		),
	];
}

function renderSipinAuxiliary(note: SipinKeyNote, x: number, y: number) {
	const rows = [
		...note.abdomen.map((value) => ({
			kind: "abdomen" as const,
			value,
			fill: "#6f8198",
		})),
		...(note.tail
			? [{ kind: "tail" as const, value: note.tail, fill: "#76506a" }]
			: []),
	];
	const layout =
		rows.length === 3
			? { first: 75, step: 22, tone: 52 }
			: rows.length === 2
				? { first: 82, step: 27, tone: 56 }
				: { first: 104, step: 0, tone: 62 };
	return [
		renderStrokeBadge(note.stroke, x, y),
		...rows.map((row, index) =>
			text(
				x + keyWidth / 2,
				y + layout.first + index * layout.step,
				row.value,
				{
					size: 14,
					fill: row.fill,
					anchor: "middle",
					weight: 700,
					auxKind: row.kind,
					textLength: row.value.length > 12 ? 76 : undefined,
				},
			),
		),
		...renderToneLine(note.tone, note.toneMark, x, y + layout.tone, 18),
	];
}

function semanticColor(final: string) {
	const normalized = final.replace(/\*$/u, "");
	if (/ng$/u.test(normalized)) return "#8f879f";
	if (/n$/u.test(normalized)) return "#9f8f76";
	if (/^[vü]/u.test(normalized)) return "#a17f91";
	if (/^i/u.test(normalized)) return "#748f9e";
	if (/^u/u.test(normalized)) return "#929967";
	if (/^a/u.test(normalized)) return "#ad8178";
	if (/^e/u.test(normalized)) return "#899985";
	if (/^o/u.test(normalized)) return "#a7966c";
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
	const hasShapeAuxiliary = Object.values(diagram.auxiliary ?? {}).some(
		isShapeKeyNote,
	);
	const hasToneAuxiliary = Object.values(diagram.auxiliary ?? {}).some(
		isToneKeyNote,
	);
	const semanticLegend =
		diagram.filename === "snow_sipin"
			? "四拼前景：韵腹蓝 · 韵尾紫 · 声调棕 · 笔画绿框；背景、纹理和边框表示声韵占用。"
			: hasShapeAuxiliary
				? "形辅前景：笔画绿框 · 单辅键码根棕 · 双辅键码根紫；背景、纹理和边框表示声韵占用。"
				: hasToneAuxiliary
					? "调辅前景：笔画绿框 · 声调棕；背景、纹理和边框表示声韵占用。"
					: "声韵占用与多韵键使用独立的莫兰迪背景、纹理和边框。";
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
			const titleInitials = initialRoles.join(" / ") || "—";
			const titleFinals = final.join(" / ") || "—";
			const items = [
				`<g data-key="${key}" data-role="${role}"${multi ? ' data-multi="true"' : ""}>`,
				`<title>${key}｜声码 ${escapeXml(titleInitials)}｜韵码 ${escapeXml(titleFinals)}${auxiliary ? `｜辅键 ${escapeXml(auxiliaryLabels(auxiliary).join(" / "))}` : ""}</title>`,
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
					fill: "#4f5962",
					weight: 800,
					keyLabel: true,
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
				if (isShapeKeyNote(auxiliary)) {
					items.push(...renderShapeAuxiliary(auxiliary, x, y, auxiliaryOnly));
				} else if (isToneKeyNote(auxiliary)) {
					items.push(...renderToneAuxiliary(auxiliary, x, y, auxiliaryOnly));
				} else if (isSipinKeyNote(auxiliary)) {
					items.push(...renderSipinAuxiliary(auxiliary, x, y));
				}
			}

			if (final.length > 0) {
				const layers =
					(ordinaryText ? 1 : 0) +
					(zeroText ? 1 : 0) +
					(auxiliary
						? isShapeKeyNote(auxiliary)
							? 2
							: isToneKeyNote(auxiliary)
								? 1
								: 0
						: 0);
				const count = Math.min(final.length, 3);
				let first =
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
				if (!ordinaryText && !zeroText && auxiliary && count > 1) {
					if (isShapeKeyNote(auxiliary)) {
						first = count === 2 ? 91 : 80;
					} else if (isToneKeyNote(auxiliary)) {
						first = count === 2 ? 88 : 78;
					}
				}
				const step = count > 1 ? (119 - first) / (count - 1) : 0;
				const rowCap = count > 1 ? Math.max(13, step * 0.69) : 28;
				final.slice(0, 3).forEach((value, index) => {
					const label = value.replaceAll("v", "ü");
					const calculatedSize = Math.min(
						28,
						rowCap,
						78 / Math.max(1, label.length * 0.54),
					);
					const readableShenyunFinal =
						["snow_shenyun_shape", "snow_shenyun_tone"].includes(
							diagram.filename,
						) && ["er", "u"].includes(value);
					const size = readableShenyunFinal
						? Math.max(20, calculatedSize)
						: calculatedSize;
					const weight = size < 24 ? 800 : 600;
					items.push(
						text(x + keyWidth / 2, y + first + index * step, label, {
							size,
							fill: semanticColor(value),
							anchor: "middle",
							weight,
							final: value,
							embolden: size < 24 ? 0.35 : undefined,
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
	return `<svg xmlns="http://www.w3.org/2000/svg" class="keysvg nf4-keysvg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">${semanticPatterns}<title id="title">${escapeXml(diagram.title)}键位映射图</title><desc id="desc">${escapeXml(diagram.subtitle)}</desc><rect width="${width}" height="${height}" rx="14" fill="#f5f2ec"/>${text(24, 34, diagram.title, { size: 23, fill: "#445650", weight: 760 })}${text(24, 58, diagram.subtitle, { size: 13, fill: "#767a73" })}${groups.join("")}${text(24, 535, semanticLegend, { size: 14, fill: "#5f5862" })}${text(24, 559, "Morandi semantic map · 韵母前景色按 i/u/ü/a/e/o/*n/*ng 音系族分组", { size: 12, fill: "#74717a" })}</svg>\n`;
}

function styleInitialLinks(svg: string, mapping?: Mapping) {
	const resolved = mapping
		? resolveMappingLinkColors(mapping.initialMap)
		: undefined;
	const colors = resolved?.colors ?? KEYMAP_LINK_COLOR_CONTRACT;
	return svg.replace(
		/<g data-key="([A-Z])"[\s\S]*?(?=<g data-key=|<text x="24" y="535")/gu,
		(group, key: string) => {
			const source = key.toLowerCase();
			const movedInitial = resolved?.state.ordinaryMoved[source] ?? false;
			const movedZeroCarrier = (["W", "Y"] as const).find(
				(carrier) => carrier === key && resolved?.state.zeroMoved[carrier],
			);
			const sourceColor = movedInitial
				? colors.initialLinkInk[source]
				: movedZeroCarrier
					? colors.zeroLinkStyle[movedZeroCarrier].ink
					: colors.defaultKeycapInk;
			let styled = group.replace(
				/<text\b[^>]*data-key-label="true"[^>]*>/u,
				(keycap) =>
					keycap
						.replace(
							/font-weight="(?:500|800)"/u,
							`font-weight="${movedInitial || movedZeroCarrier ? 500 : 800}"`,
						)
						.replace(/fill="#[0-9a-fA-F]{6}"/u, `fill="${sourceColor}"`),
			);
			if (resolved) {
				const incomingInitial = [...colors.traditionalInitials].find(
					(initial) =>
						resolved.state.ordinaryMoved[initial] &&
						resolved.state.ordinaryTargets[initial].includes(key),
				);
				styled = styled.replace(
					/<text\b[^>]*font-weight="700"[^>]*text-decoration="underline"[^>]*>/u,
					(initialLabel) =>
						initialLabel.replace(
							/fill="#[0-9a-fA-F]{6}"/u,
							`fill="${incomingInitial ? colors.initialLinkInk[incomingInitial] : colors.defaultInitialInk}"`,
						),
				);

				const incomingZeroCarrier = (["W", "Y"] as const).find(
					(carrier) =>
						resolved.state.zeroMoved[carrier] &&
						resolved.state.zeroTargets[carrier].includes(key),
				);
				const zeroStyle = incomingZeroCarrier
					? colors.zeroLinkStyle[incomingZeroCarrier]
					: {
							ink: colors.defaultZeroInitialInk,
							fill: "#f1e4e1",
							stroke: "#ad8178",
						};
				styled = styled
					.replace(/<rect\b[^>]*stroke-dasharray="4 2"[^>]*>/u, (zeroCard) =>
						zeroCard
							.replace(/fill="#[0-9a-fA-F]{6}"/u, `fill="${zeroStyle.fill}"`)
							.replace(
								/stroke="#[0-9a-fA-F]{6}"/u,
								`stroke="${zeroStyle.stroke}"`,
							),
					)
					.replace(/<text\b[^>]*font-style="italic"[^>]*>/u, (zeroLabel) =>
						zeroLabel.replace(
							/fill="#[0-9a-fA-F]{6}"/u,
							`fill="${zeroStyle.ink}"`,
						),
					);
			}
			return styled;
		},
	);
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
	const svg = styleInitialLinks(render(diagram), diagram.mapping);
	update(join(outputDirectory, `${diagram.filename}.svg`), svg);
	const png = new Resvg(svg, { fitTo: { mode: "width", value: 1100 } })
		.render()
		.asPng();
	update(join(outputDirectory, `${diagram.filename}.png`), png);
}

for (const [filename, mapping] of [
	["snow_jiandao_first", u357First],
	["snow_sanpin_first", u357First],
	["snow_shenyun_shape_first", overall17First],
	["snow_shenyun_tone_first", overall17First],
] as const) {
	const svgPath = join(outputDirectory, `${filename}.svg`);
	const svg = styleInitialLinks(
		readFileSync(svgPath, "utf8").replace(/\r\n?/gu, "\n"),
		mapping,
	);
	update(svgPath, svg);
	const png = new Resvg(svg, { fitTo: { mode: "width", value: 1100 } })
		.render()
		.asPng();
	update(join(outputDirectory, `${filename}.png`), png);
}

console.log(
	check
		? "七份活动／经典键位图与四份初代键位图均为最新。"
		: `已生成七份活动／经典键位图与四份初代键位图：${outputDirectory}`,
);
