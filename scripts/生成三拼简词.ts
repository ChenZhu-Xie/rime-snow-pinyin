import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	mergeDictionaries,
	plainSyllable,
	readDictionary,
	wordLength,
} from "./固顶编译器";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = join(root, "snow_sanpin.fixed.630.txt");
const maximumWordsPerCode = 10;
const toneKeys: Readonly<Record<string, string>> = {
	"1": "i",
	"2": "v",
	"3": "u",
	"4": "a",
	"5": "o",
};
const mainKeys = [..."bpmfdtnlgkhjqxzcsrwye"];
const auxiliaryKeys = [..."ivuao"];
const dictionaries = [
	"snow_pinyin.dict.yaml",
	"snow_pinyin.base.dict.yaml",
	"snow_pinyin.ext.dict.yaml",
	"snow_pinyin.tencent.dict.yaml",
	"snow_pinyin.user.dict.yaml",
];
const mapping = JSON.parse(
	readFileSync(join(root, "docs", "shenyun-r9-mapping.json"), "utf8"),
) as { scheme: string; codes: Record<string, string | null> };

interface Candidate {
	word: string;
	weight: number;
}

const groups = new Map<string, Map<string, Candidate>>();
const addCandidate = (code: string, candidate: Candidate) => {
	const group = groups.get(code) ?? new Map<string, Candidate>();
	const previous = group.get(candidate.word);
	if (!previous || candidate.weight > previous.weight)
		group.set(candidate.word, candidate);
	groups.set(code, group);
};

const entries = mergeDictionaries(
	dictionaries.flatMap((file) => readDictionary(join(root, file))),
).filter(
	(entry) =>
		wordLength(entry.word) === 2 &&
		entry.syllables.length === 2 &&
		/^\p{Script=Han}{2}$/u.test(entry.word),
);

for (const entry of entries) {
	const [firstSyllable, secondSyllable] = entry.syllables;
	const firstSound = mapping.codes[plainSyllable(firstSyllable)];
	const secondSound = mapping.codes[plainSyllable(secondSyllable)];
	const firstTone = toneKeys[firstSyllable.match(/[1-5]$/)?.[0] ?? ""];
	const secondTone = toneKeys[secondSyllable.match(/[1-5]$/)?.[0] ?? ""];
	if (!firstSound || !secondSound || !firstTone || !secondTone) continue;
	const candidate = { word: entry.word, weight: entry.weight };
	addCandidate(firstSound[0] + secondTone, candidate);
	addCandidate(firstSound[0] + secondTone + firstTone, candidate);
}

const codes = [
	...mainKeys.flatMap((main) => auxiliaryKeys.map((tone) => main + tone)),
	...mainKeys.flatMap((main) =>
		auxiliaryKeys.flatMap((secondTone) =>
			auxiliaryKeys.map((firstTone) => main + secondTone + firstTone),
		),
	),
];
const lines = [
	`# ${mapping.scheme} 三拼二字词二、三码候选（每码最多 ${maximumWordsPerCode} 项）`,
];
let populatedCodes = 0;
for (const code of codes) {
	const candidates = [...(groups.get(code)?.values() ?? [])]
		.sort(
			(a, b) => b.weight - a.weight || a.word.localeCompare(b.word, "zh-CN"),
		)
		.slice(0, maximumWordsPerCode);
	if (candidates.length === 0) continue;
	lines.push(`${code}\t${candidates.map(({ word }) => word).join(" ")}`);
	populatedCodes += 1;
}
const output = `${lines.join("\n")}\n`;

if (process.argv.includes("--check")) {
	if (readFileSync(outputPath, "utf8").replace(/\r\n/g, "\n") !== output)
		throw new Error("snow_sanpin.fixed.630.txt 不是当前神韵映射的生成结果。");
	console.log(
		`三拼二字词各级简码校验通过：${populatedCodes}/${codes.length} 个码位有候选。`,
	);
} else {
	writeFileSync(outputPath, output, "utf8");
	console.log(
		`三拼二字词各级简码生成完成：${populatedCodes}/${codes.length} 个码位有候选（二码 ${mainKeys.length * auxiliaryKeys.length}，三码 ${mainKeys.length * auxiliaryKeys.length ** 2}）。`,
	);
}
