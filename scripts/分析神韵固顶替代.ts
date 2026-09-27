import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findStructuralAbbreviation, FixedReplacementIndex } from "./固顶替代";
import {
	fullCodeAlreadyEasyWords,
	preferredEverydayWords,
} from "./固顶选优策略";
import { mergeDictionaries, readDictionary } from "./固顶编译器";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const baseline =
	process.argv
		.find((argument) => argument.startsWith("--baseline="))
		?.split("=", 2)[1] ?? "HEAD";
const jsonOnly = process.argv.includes("--json");
const files = ["snow_sanpin.fixed.txt", "snow_jiandao.fixed.txt"] as const;
const selectableAbbreviationBases = new Set(
	mergeDictionaries(
		[
			"snow_pinyin.dict.yaml",
			"snow_pinyin.base.dict.yaml",
			"snow_pinyin.ext.dict.yaml",
			"snow_pinyin.user.dict.yaml",
		].flatMap((file) => readDictionary(join(root, file))),
	).map((entry) => entry.word),
);

const tailKeyWords = new Map<string, ";" | "/">();
for (const entry of mergeDictionaries(
	readDictionary(join(root, "snow_pinyin.base.dict.yaml")),
)) {
	if (entry.syllables.length <= 1) continue;
	const lastCharacter = [...entry.word].at(-1);
	const lastSyllable = entry.syllables.at(-1);
	if (lastCharacter === "的" && lastSyllable === "de5")
		tailKeyWords.set(entry.word, ";");
	else if (lastCharacter === "了" && lastSyllable === "le5")
		tailKeyWords.set(entry.word, "/");
}

// 用户复核后确认不值得继续占用固顶位；词条仍可按完整编码输入。
const qualityCuratedWords = new Set(["我们的心"]);

interface FixedEntry {
	section: string;
	code: string;
	word: string;
}

function parseFixed(content: string) {
	const entries: FixedEntry[] = [];
	let section = "";
	for (const line of content.split(/\r?\n/)) {
		if (line.startsWith("#")) {
			section = line.slice(1).trim();
			continue;
		}
		const [code, word] = line.split("\t");
		if (section && code && word) entries.push({ section, code, word });
	}
	return entries;
}

function loadBaseline(file: string) {
	return execFileSync("git", ["show", `${baseline}:${file}`], {
		cwd: root,
		encoding: "utf8",
	});
}

const result: Record<string, unknown> = {
	baseline,
	suffixKeys: { ";": "的", "/": "了" },
	schemes: {},
};

for (const file of files) {
	const before = parseFixed(loadBaseline(file));
	const after = parseFixed(readFileSync(join(root, file), "utf8"));
	const afterBySlot = new Map(
		after.map((entry) => [`${entry.section}\t${entry.code}`, entry.word]),
	);
	const beforeWords = new Set(before.map(({ word }) => word));
	const afterCodesByWord = new Map<string, string[]>();
	const replacementIndex = new FixedReplacementIndex();
	for (const entry of after) {
		const codes = afterCodesByWord.get(entry.word) ?? [];
		codes.push(entry.code);
		afterCodesByWord.set(entry.word, codes);
		replacementIndex.addFixed(entry.code, entry.word);
	}

	const changed = before.filter(
		(entry) =>
			afterBySlot.get(`${entry.section}\t${entry.code}`) !== entry.word,
	);
	const moved: object[] = [];
	const replaced: object[] = [];
	const tailKeyPolicy: object[] = [];
	const qualityPolicy: object[] = [];
	const structuralPolicy: object[] = [];
	const fullCodePolicy: object[] = [];
	const utilityPolicy: object[] = [];
	const lost: object[] = [];
	for (const entry of changed) {
		const tailKey = tailKeyWords.get(entry.word);
		if (tailKey) {
			tailKeyPolicy.push({
				...entry,
				base: [...entry.word].slice(0, -1).join(""),
				tailKey,
			});
			continue;
		}
		if (qualityCuratedWords.has(entry.word)) {
			qualityPolicy.push(entry);
			continue;
		}
		const structural = findStructuralAbbreviation(entry.word, (base) =>
			selectableAbbreviationBases.has(base),
		);
		if (structural) {
			structuralPolicy.push({ ...entry, structural });
			continue;
		}
		if (fullCodeAlreadyEasyWords.has(entry.word)) {
			fullCodePolicy.push(entry);
			continue;
		}
		const movedCodes = afterCodesByWord.get(entry.word);
		if (movedCodes) {
			moved.push({ ...entry, to: movedCodes });
			continue;
		}
		const replacementWord = afterBySlot.get(`${entry.section}\t${entry.code}`);
		if (replacementWord && preferredEverydayWords.has(replacementWord)) {
			utilityPolicy.push({ ...entry, replacementWord });
			continue;
		}
		const replacement = replacementIndex.find(entry.word, entry.code.length);
		if (replacement) replaced.push({ ...entry, replacement });
		else lost.push(entry);
	}
	const added = after.filter(({ word }) => !beforeWords.has(word));
	const mechanisms = replaced.reduce<Record<string, number>>(
		(summary, value) => {
			const mechanism = (value as { replacement: { mechanism: string } })
				.replacement.mechanism;
			summary[mechanism] = (summary[mechanism] ?? 0) + 1;
			return summary;
		},
		{},
	);
	(result.schemes as Record<string, unknown>)[file] = {
		before: before.length,
		after: after.length,
		changedSlots: changed.length,
		moved,
		replaced,
		tailKeyPolicy,
		qualityPolicy,
		structuralPolicy,
		fullCodePolicy,
		utilityPolicy,
		mechanisms,
		added,
		lost,
	};
}

if (jsonOnly) console.log(JSON.stringify(result, null, 2));
else {
	console.log(`基线：${baseline}`);
	for (const [file, raw] of Object.entries(
		result.schemes as Record<string, Record<string, unknown>>,
	)) {
		const values = raw as {
			changedSlots: number;
			moved: object[];
			replaced: object[];
			tailKeyPolicy: object[];
			qualityPolicy: object[];
			structuralPolicy: object[];
			fullCodePolicy: object[];
			utilityPolicy: object[];
			mechanisms: object;
			added: object[];
			lost: object[];
		};
		console.log(
			`${file}：变化 ${values.changedSlots} 槽；尾字键策略让位 ${values.tailKeyPolicy.length}；质量复核让位 ${values.qualityPolicy.length}；结构略码让位 ${values.structuralPolicy.length}；完整码首选让位 ${values.fullCodePolicy.length}；日常语用让位 ${values.utilityPolicy.length}；等长或更短替代 ${values.replaced.length}；迁移 ${values.moved.length}；新增 ${values.added.length}；无策略丢失 ${values.lost.length}；机制 ${JSON.stringify(values.mechanisms)}`,
		);
	}
}

if (
	Object.values(result.schemes as Record<string, { lost: object[] }>).some(
		({ lost }) => lost.length > 0,
	)
) {
	process.exitCode = 1;
}
