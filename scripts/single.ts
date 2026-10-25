import { readFileSync, writeFileSync } from "fs";
import matter from "gray-matter";
import { VERSION } from "./version";

const 拼音词典发布页 =
	"https://github.com/hanzi-chai/characters/releases/tag/20261025";
const 拼音词典下载地址 =
	"https://github.com/hanzi-chai/characters/releases/download/20261025/pinyin.tsv";

async function 下载大字集拼音() {
	const 响应 = await fetch(拼音词典下载地址);
	if (!响应.ok) {
		throw new Error(`下载拼音词典失败：HTTP ${响应.status}`);
	}
	const [表头, ...原始数据] = (await 响应.text()).trimEnd().split(/\r?\n/);
	if (表头 !== "codepoint\tchar\tpinyin\tstatus\tblock\tsources") {
		throw new Error("拼音词典表头不符合预期");
	}
	const 处理结果: { 汉字: string; 拼音: string }[] = [];
	for (const 行 of 原始数据) {
		const [, 汉字, 拼音列表] = 行.split("\t");
		for (const 拼音 of 拼音列表.split(",")) {
			// 缺音和一字多音节读音不进入单音节词典，数字声调和 v、ê 沿用原表。
			if (拼音 === "?" || 拼音.includes("-")) continue;
			处理结果.push({ 汉字, 拼音 });
		}
	}
	return 处理结果;
}

const 通用规范拼音 = readFileSync("scripts/tygf.txt", "utf-8")
	.trim()
	.split("\n");
const 大字集拼音 = await 下载大字集拼音();

const 已知拼音 = new Map<string, string[]>();

const 文件内容 = [
	"# Rime dictionary",
	"# encoding: utf-8",
	"#",
	"# Snow Pinyin - 冰雪拼音",
	"# 《通用规范汉字表》内读音依据《通用规范汉字字典》，收录了 8105 个汉字，共 8773 音",
	`# 其他汉字的读音依据 ${拼音词典发布页}`,
	"#",
	"",
];

文件内容.push(
	matter.stringify(
		"",
		{
			name: "snow_pinyin",
			version: VERSION,
			sort: "by_weight",
			use_preset_vocabulary: false,
		},
		{ delimiters: ["---", "..."] },
	),
);
文件内容.push("# 字母");
文件内容.push(
	"# 用 ~ 和 ~~ 作为特殊音节的标记，具体如何输入可以由方案自行决定，不影响简拼",
);
for (const letter of "abcdefghijklmnopqrstuvwxyz") {
	文件内容.push(`${letter}\t~${letter}\t10000`);
}
文件内容.push("");
for (const letter of "abcdefghijklmnopqrstuvwxyz") {
	文件内容.push(`${letter.toUpperCase()}\t~~${letter}\t10000`);
}
文件内容.push("");
文件内容.push("# 数字");
for (const [index, number] of [
	"ling2",
	"yi1",
	"er4",
	"san1",
	"si4",
	"wu3",
	"liu4",
	"qi1",
	"ba1",
	"jiu3",
	"shi2",
].entries()) {
	文件内容.push(`${index}\t${number}\t1000`);
}
文件内容.push("");
文件内容.push("#《通用规范汉字字典》");
for (const line of 通用规范拼音) {
	let [char, pinyin, frequency] = line.split("\t");
	if (parseInt(frequency) < 2) {
		frequency = "2";
	}
	文件内容.push(`${char}\t${pinyin}\t${frequency}`);
	已知拼音.set(char, (已知拼音.get(char) || []).concat(pinyin));
}
文件内容.push("");
文件内容.push("# 大字集");
let 增补拼音总数 = 0;
for (const { 汉字, 拼音 } of 大字集拼音) {
	if (已知拼音.has(汉字)) {
		if (已知拼音.get(汉字)!.includes(拼音)) continue;
		增补拼音总数++;
		console.log(`增补拼音: ${汉字} ${拼音}`);
	}
	let 编码 = 汉字.codePointAt(0) ?? 0;
	let 权重 = 0x4e00 <= 编码 && 编码 <= 0x9fff ? 1 : 0;
	文件内容.push(`${汉字}\t${拼音}\t${权重}`);
}
writeFileSync("snow_pinyin.dict.yaml", 文件内容.join("\n"));

console.log(`增补拼音总数: ${增补拼音总数}`);
