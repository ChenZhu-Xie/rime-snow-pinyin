import { readFileSync, writeFileSync } from "node:fs";
import { rootPath } from "./lib/paths";

// 冻结研究布局；referenceTonedCodes 独立记录页面实际编码，测试逐条比对。
const mapping = JSON.parse(
	readFileSync(rootPath("config/snow-jiandao-toned-mapping.json"), "utf8"),
) as {
	id: string;
	firstKeys: Record<string, string>;
	toneRegions: Record<string, string>;
	rhymeGroups: Array<{ finals: string[]; keys: Record<string, string> }>;
};
const yw: Record<string, string> = {
	yi: "i",
	ya: "ia",
	yao: "iao",
	ye: "ie",
	you: "iou",
	yan: "ian",
	yin: "in",
	yang: "iang",
	ying: "ing",
	yong: "iong",
	yo: "io",
	yu: "v",
	yue: "ve",
	yuan: "van",
	yun: "vn",
	wu: "u",
	wa: "ua",
	wai: "uai",
	wei: "uei",
	wan: "uan",
	wen: "uen",
	wang: "uang",
	weng: "ueng",
	wo: "uo",
};
const rules = [
	`  # ${mapping.id}；由 scripts/generate-jiandao-toned.ts 生成。`,
	"  - erase/^(hm|hng|m|n|ng|ê)\\d$/",
	"  - xform/(^| )r5(?= |$)/$1er5/",
	...Object.entries(yw)
		.sort(([a], [b]) => b.length - a.length || a.localeCompare(b))
		.map(
			([syllable, final]) =>
				`  - xform/(^| )${syllable}(?=\\d)/$1${mapping.firstKeys[`zero-${syllable[0].toUpperCase()}`]}${final}/`,
		),
	"  - xform/([jqx])u/$1v/",
	"  - xform/ue(?=\\d)/ve/",
	"  - xform/ui(?=\\d)/uei/",
	"  - xform/iu(?=\\d)/iou/",
	"  - xform/un(?=\\d)/uen/",
	...["A", "E", "O"].map(
		(head) =>
			`  - xform/(^| )(?=${head.toLowerCase()})/$1${mapping.firstKeys[`zero-${head}`]}/`,
	),
	...Object.entries(mapping.firstKeys)
		.filter(([head]) => !head.startsWith("zero-"))
		.sort(([a], [b]) => b.length - a.length || a.localeCompare(b))
		.map(([head, key]) => `  - xform/(^| )${head}/$1${key}/`),
	...mapping.rhymeGroups
		.flatMap((group) =>
			group.finals.map((final) => ({ final, keys: group.keys })),
		)
		.sort(
			(a, b) =>
				b.final.length - a.final.length || a.final.localeCompare(b.final),
		)
		.flatMap(({ final, keys }) =>
			Object.entries(mapping.toneRegions).map(
				([tone, region]) => `  - xform/${final}${tone}(?= |$)/${keys[region]}/`,
			),
		),
	"  - xlit/QWERTYUIOPASDFGHJKLZXCVBNM/qwertyuiopasdfghjklzxcvbnm/",
];
const path = rootPath("snow_jiandao_toned_common.yaml");
const output = `# Rime schema fragment\n# encoding: utf-8\n\n# 声调合入第二码；后续仅使用冰雪兰道的形笔辅。\njiandao_toned_algebra:\n${rules.join("\n")}\n`;
if (process.argv.includes("--check")) {
	if (readFileSync(path, "utf8").replace(/\r\n/gu, "\n") !== output)
		throw new Error("冰雪莲道带调代数需要重新生成。");
} else writeFileSync(path, output);
console.log(
	`${mapping.id}：带调声韵代数${process.argv.includes("--check") ? "校验" : "生成"}完成。`,
);
