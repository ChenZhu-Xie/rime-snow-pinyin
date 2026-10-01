import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

type Key = {
	key: string;
	initial?: string;
	finals?: string;
	auxiliary?: string;
};

const rows: Key[][] = [
	[
		{ key: "Q", initial: "q · ØAOE", finals: "o · uan" },
		{ key: "W", initial: "ch", finals: "a · vn" },
		{ key: "E", initial: "sh", finals: "en · van" },
		{ key: "R", initial: "r", finals: "ui · v" },
		{ key: "T", initial: "t", finals: "uai · iu" },
		{ key: "Y", initial: "ØY", finals: "uo · ve" },
		{ key: "U", auxiliary: "三声 · 撇" },
		{ key: "I", auxiliary: "一声 · 竖" },
		{ key: "O", auxiliary: "轻声 · 点" },
		{ key: "P", initial: "p", finals: "ian · ong" },
	],
	[
		{ key: "A", auxiliary: "四声 · 折" },
		{ key: "S", initial: "s", finals: "e" },
		{ key: "D", initial: "d", finals: "ing · uang" },
		{ key: "F", initial: "f · zh", finals: "ou · iang" },
		{ key: "G", initial: "g", finals: "in · un" },
		{ key: "H", initial: "h", finals: "ai" },
		{ key: "J", initial: "j · ØW", finals: "u · er" },
		{ key: "K", initial: "k", finals: "i" },
		{ key: "L", initial: "l", finals: "an · ia" },
	],
	[
		{ key: "Z", initial: "z", finals: "ao" },
		{ key: "X", initial: "x", finals: "ei" },
		{ key: "C", initial: "c", finals: "iao · ua" },
		{ key: "V", auxiliary: "二声 · 横" },
		{ key: "B", initial: "b", finals: "ie · uai" },
		{ key: "N", initial: "n", finals: "eng · iong" },
		{ key: "M", initial: "m", finals: "ang" },
	],
];

const escape = (text: string) =>
	text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const keyWidth = 128;
const keyHeight = 118;
const gap = 10;
const offsets = [24, 93, 231];
const top = 98;

const keys = rows
	.map((row, rowIndex) =>
		row
			.map((item, columnIndex) => {
				const x = offsets[rowIndex] + columnIndex * (keyWidth + gap);
				const y = top + rowIndex * (keyHeight + gap);
				const auxiliary = Boolean(item.auxiliary);
				const body = auxiliary
					? `<text class="aux" x="${x + keyWidth / 2}" y="${y + 70}" text-anchor="middle">${escape(item.auxiliary!)}</text>`
					: `<text class="initial" x="${x + 14}" y="${y + 61}">${escape(item.initial!)}</text><text class="final" x="${x + 14}" y="${y + 91}">${escape(item.finals!)}</text>`;
				return `<g><rect class="key ${auxiliary ? "aux-key" : "sound-key"}" x="${x}" y="${y}" width="${keyWidth}" height="${keyHeight}" rx="12"/><text class="letter" x="${x + 14}" y="${y + 29}">${item.key}</text>${body}</g>`;
			})
			.join(""),
	)
	.join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1420" height="530" viewBox="0 0 1420 530" role="img" aria-labelledby="title desc">
<title id="title">零飞键道·神韵 v2 双拼键盘图</title>
<desc id="desc">R8-21X21-M40-01 的 21 键声韵映射及 AVUIO 五个声调与形码辅键。</desc>
<style>
  text{font-family:"Microsoft YaHei","Noto Sans CJK SC",sans-serif;fill:#20362d}
  .title{font-size:30px;font-weight:700}.subtitle{font-size:16px;fill:#60736a}
  .key{stroke-width:2}.sound-key{fill:#f3f7f2;stroke:#789487}.aux-key{fill:#f4f0f8;stroke:#9383a3}
  .letter{font-size:23px;font-weight:800}.initial{font-size:17px;font-weight:650;fill:#335f50}.final{font-size:18px;fill:#766779}.aux{font-size:17px;font-weight:650;fill:#695479}
  .legend{font-size:15px;fill:#5d6d65}.badge{fill:#e7efe9;stroke:#9caf9f}
</style>
<rect width="1420" height="530" fill="#faf9f4"/>
<text class="title" x="24" y="42">零飞键道·神韵 v2</text>
<text class="subtitle" x="24" y="70">R8-21X21-M40-01 · 21×21 声韵键域 · M=40 · AVUIO 五辅键</text>
<rect class="badge" x="1050" y="27" width="346" height="43" rx="21"/>
<text class="legend" x="1223" y="54" text-anchor="middle">ØAOE→Q　ØY→Y　ØW→J</text>
${keys}
<text class="legend" x="24" y="510">绿色：声母 / 韵母　　紫色：声调 / 形码　　声调 I/V/U/A/O＝一/二/三/四/轻；形码 A/V/U/I/O＝折/横/撇/竖/点</text>
</svg>`;

const output = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"docs",
	"shenyun-v2-keyboard.svg",
);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, svg, "utf8");
console.log(output);
