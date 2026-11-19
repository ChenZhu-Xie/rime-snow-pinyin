import { readFileSync, writeFileSync } from "node:fs";
import { rootPath } from "./lib/paths";

// 冻结布局的规则分解；referenceTonedCodes 独立保存页面的 1,407 条实际带调音节。
const mapping = JSON.parse(
	readFileSync(rootPath("config/snow-zhudao-mapping.json"), "utf8"),
) as {
	id: string;
	initialMap: Record<string, string>;
	toneRowsByTone: Record<string, number>;
	rhymeGroups: Array<{ finals: string[]; keys: string[] }>;
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
	`  # ${mapping.id}；由 scripts/generate-zhudao.ts 生成。`,
	// hm 是鼻音感叹词，没有本方案十韵组中的韵母，与其他独立鼻音一起排除。
	"  - erase/^(hm|hng|m|n|ng|ê)\\d$/",
	"  - xform/(^| )r5(?= |$)/$1er5/",
	...Object.entries(yw)
		.sort(([a], [b]) => b.length - a.length || a.localeCompare(b))
		.map(
			([syllable, final]) =>
				`  - xform/(^| )${syllable}(?=\\d)/$1${mapping.initialMap[syllable[0].toUpperCase()]}${final}/`,
		),
	"  - xform/([jqx])u/$1v/",
	"  - xform/ue(?=\\d)/ve/",
	"  - xform/ui(?=\\d)/uei/",
	"  - xform/iu(?=\\d)/iou/",
	"  - xform/un(?=\\d)/uen/",
	...["A", "E", "O"].map(
		(head) =>
			`  - xform/(^| )(?=${head.toLowerCase()})/$1${mapping.initialMap[head]}/`,
	),
	...Object.entries(mapping.initialMap)
		.filter(([head]) => head === head.toLowerCase())
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
			Object.entries(mapping.toneRowsByTone).map(
				([tone, row]) => `  - xform/${final}${tone}(?= |$)/${keys[row]}/`,
			),
		),
	"  - xlit/QWERTYUIOPASDFGHJKLZXCVBNM/qwertyuiopasdfghjklzxcvbnm/",
];
const path = rootPath("snow_zhudao.schema.yaml");
const source = readFileSync(path, "utf8").replace(/\r\n/gu, "\n");
const rendered = source.replace(
	/^shenyun_algebra:\n[\s\S]*?(?=\n[^ #\n])/mu,
	`shenyun_algebra:\n${rules.join("\n")}\n`,
);
if (process.argv.includes("--check")) {
	if (source !== rendered) throw new Error("冰雪鹮道带调代数需要重新生成。");
} else writeFileSync(path, rendered);
console.log(
	`${mapping.id}：带调声韵代数${process.argv.includes("--check") ? "校验" : "生成"}完成。`,
);
