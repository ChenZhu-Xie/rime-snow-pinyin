import { readFileSync, writeFileSync } from "node:fs";
import { rootPath } from "./lib/paths";

interface LetterEntry {
	letter: string;
	code: string;
	naturalTop3: Array<{ text: string; weight: number }>;
}

interface LetterMapping {
	status: string;
	contract: {
		candidateOrder: string[];
		vacantBucketsUsed: number;
		preservedNamespaces: { ABA: number; AAB: string; AAAB: string };
	};
	letters: LetterEntry[];
}

const mapping = JSON.parse(
	readFileSync(rootPath("config", "shenyun-21x26-letter-buckets.json"), "utf8"),
) as LetterMapping;

if (mapping.status !== "enabled") {
	throw new Error(`21×26 字母映射状态不是 enabled：${mapping.status}`);
}
if (
	JSON.stringify(mapping.contract.candidateOrder) !==
	JSON.stringify(["existing-han", "uppercase-letter", "lowercase-letter"])
) {
	throw new Error("21×26 字母候选顺序不再是汉字、大写、小写。");
}
if (mapping.contract.vacantBucketsUsed !== 0) {
	throw new Error("21×26 字母映射使用了空桶。");
}
if (
	mapping.contract.preservedNamespaces.ABA !== 2205 ||
	mapping.contract.preservedNamespaces.AAB !== "unchanged" ||
	mapping.contract.preservedNamespaces.AAAB !== "unchanged"
) {
	throw new Error("21×26 字母映射破坏了 ABA、AAB 或 AAAB 保留合同。");
}
if (
	mapping.letters.length !== 26 ||
	new Set(mapping.letters.map(({ letter }) => letter)).size !== 26 ||
	new Set(mapping.letters.map(({ code }) => code)).size !== 26
) {
	throw new Error("21×26 字母映射必须包含 26 个唯一字母与占用码。");
}

const letterLines = mapping.letters.map(({ letter, code, naturalTop3 }) => {
	const first = naturalTop3[0]?.text;
	if (!first || !/^\p{Script=Han}$/u.test(first)) {
		throw new Error(`${letter.toUpperCase()} 的 ${code} 没有汉字首选。`);
	}
	return `${code}\t${first} ${letter.toUpperCase()} ${letter}`;
});

function renderFixedFile(filename: string) {
	const path = rootPath(filename);
	const current = readFileSync(path, "utf8").replace(/\r\n/gu, "\n");
	const marker = "\n# 字母\n";
	const markerIndex = current.indexOf(marker);
	const base = (
		markerIndex >= 0 ? current.slice(0, markerIndex) : current
	).trimEnd();
	const rendered = `${base}${marker}${letterLines.join("\n")}\n`;
	if (process.argv.includes("--check")) {
		if (current !== rendered) {
			throw new Error(`${filename} 的 21×26 字母候选不是当前映射的生成结果。`);
		}
	} else {
		writeFileSync(path, rendered, "utf8");
	}
}

for (const filename of [
	"snow_shenyun_shape.fixed.txt",
	"snow_shenyun_tone.fixed.txt",
]) {
	renderFixedFile(filename);
}

console.log("21×26 字母候选：26 个占用桶均为汉字首选、大写第 2、小写第 3。");
