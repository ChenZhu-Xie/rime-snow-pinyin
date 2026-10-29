import { readFileSync } from "node:fs";

export interface FixedLayout {
	id: string;
	mainKeys: readonly string[];
	auxiliaryKeys: readonly string[];
	toneKeys: Readonly<Record<string, string>>;
	syllableCodes: Readonly<Record<string, string | null>>;
	shapeElementKeys: Readonly<Record<string, string>>;
}

export interface DictionaryEntry {
	word: string;
	syllables: string[];
	weight: number;
}

export interface Candidate extends DictionaryEntry {
	legacy: boolean;
	score: number;
}

export interface FixedSections {
	erjian: Map<string, string>;
	sixThirty: Map<string, string>;
	single: Map<string, string>;
}

export function assertLayout(layout: FixedLayout) {
	if (layout.mainKeys.length !== 21)
		throw new Error(`${layout.id}: 主码键必须恰好为 21 个。`);
	if (layout.auxiliaryKeys.length !== 5)
		throw new Error(`${layout.id}: 辅码键必须恰好为 5 个。`);
	const allKeys = [...layout.mainKeys, ...layout.auxiliaryKeys];
	if (new Set(allKeys).size !== allKeys.length)
		throw new Error(`${layout.id}: 21 个主码键与 5 个辅码键必须互斥。`);
	const toneKeys = Object.values(layout.toneKeys);
	if (
		new Set(toneKeys).size !== 5 ||
		toneKeys.some((key) => !layout.auxiliaryKeys.includes(key))
	) {
		throw new Error(`${layout.id}: 五个声调必须一一映射到五个辅码键。`);
	}
	for (const [syllable, code] of Object.entries(layout.syllableCodes)) {
		if (code === null) continue;
		if (
			code.length !== 2 ||
			![...code].every((key) => layout.mainKeys.includes(key))
		) {
			throw new Error(
				`${layout.id}: ${syllable} 的音节码 ${code} 不在 21×21 主码域。`,
			);
		}
	}
}

export function readDictionary(path: string): DictionaryEntry[] {
	const entries: DictionaryEntry[] = [];
	for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
		if (!line.includes("\t") || line.startsWith("#")) continue;
		const [word, reading, weightText] = line.split("\t");
		if (!word || !reading || reading.startsWith("~")) continue;
		entries.push({
			word,
			syllables: reading.split(" "),
			weight: Number(weightText) || 0,
		});
	}
	return entries;
}

export function mergeDictionaries(entries: DictionaryEntry[]) {
	const merged = new Map<string, DictionaryEntry>();
	for (const entry of entries) {
		const key = `${entry.word}\t${entry.syllables.join(" ")}`;
		const previous = merged.get(key);
		if (!previous || entry.weight > previous.weight) merged.set(key, entry);
	}
	return [...merged.values()];
}

export function wordLength(word: string) {
	return [...word].length;
}

export function isHanWord(word: string, minimum: number, maximum: number) {
	const length = wordLength(word);
	return (
		length >= minimum && length <= maximum && /^\p{Script=Han}+$/u.test(word)
	);
}

export function plainSyllable(syllable: string) {
	return syllable.replace(/[1-5]$/, "").toLowerCase();
}

export function toneOf(syllable: string) {
	return syllable.match(/[1-5]$/)?.[0] ?? null;
}

export function soundCode(layout: FixedLayout, syllable: string) {
	return layout.syllableCodes[plainSyllable(syllable)] ?? null;
}

export function firstKey(layout: FixedLayout, syllable: string) {
	return soundCode(layout, syllable)?.[0] ?? null;
}

export function encodeShape(
	elements: string,
	shapeElementKeys: Readonly<Record<string, string>>,
) {
	let result = "";
	for (const element of elements) result += shapeElementKeys[element] ?? "";
	return result;
}

export function readShapeCodes(
	dictionaryPath: string,
	shapeElementKeys: Readonly<Record<string, string>>,
) {
	const result = new Map<string, string>();
	for (const line of readFileSync(dictionaryPath, "utf8").split(/\r?\n/)) {
		if (!line.includes("\t") || line.startsWith("#")) continue;
		const [character, elements] = line.split("\t");
		if (!character || !elements) continue;
		result.set(character, encodeShape(elements, shapeElementKeys));
	}
	return result;
}

export function parseLegacyFixed(content: string) {
	const sections = new Map<string, Map<string, string[]>>();
	let section = "";
	for (const line of content.split(/\r?\n/)) {
		if (!line) continue;
		if (line.startsWith("#")) {
			section = line;
			sections.set(section, new Map());
			continue;
		}
		const [code, wordsText] = line.split("\t");
		if (!code || !wordsText || !section) continue;
		sections.get(section)?.set(code, wordsText.split(" "));
	}
	return sections;
}

export function readLegacyFixed(path: string) {
	return parseLegacyFixed(readFileSync(path, "utf8"));
}

export function wordsInSection(
	sections: Map<string, Map<string, string[]>>,
	section: string,
) {
	return new Set([...(sections.get(section)?.values() ?? [])].flat());
}

export function makeCandidate(
	entry: DictionaryEntry,
	legacyWords: ReadonlySet<string>,
	bonus = 0,
): Candidate {
	const legacy = legacyWords.has(entry.word);
	return {
		...entry,
		legacy,
		score: (legacy ? 1_000_000_000_000 : 0) + bonus + entry.weight,
	};
}

export function addCandidate(
	pools: Map<string, Candidate[]>,
	code: string,
	candidate: Candidate,
) {
	const pool = pools.get(code) ?? [];
	const duplicate = pool.find(
		(value) =>
			value.word === candidate.word &&
			value.syllables.join(" ") === candidate.syllables.join(" "),
	);
	if (!duplicate) pool.push(candidate);
	else if (candidate.score > duplicate.score)
		Object.assign(duplicate, candidate);
	pools.set(code, pool);
}

export function sortCandidates(candidates: Candidate[]) {
	return [...candidates].sort(
		(a, b) =>
			b.score - a.score ||
			b.weight - a.weight ||
			a.word.localeCompare(b.word, "zh-CN"),
	);
}

export function chooseCandidate(
	candidates: Candidate[],
	usedWords: ReadonlySet<string>,
	minimumWeight = 0,
) {
	return sortCandidates(candidates).find(
		(candidate) =>
			!usedWords.has(candidate.word) &&
			(candidate.legacy || candidate.weight >= minimumWeight),
	);
}

export function renderFixedTable(sections: FixedSections) {
	const lines: string[] = [];
	for (const [heading, entries] of [
		["# 二简词", sections.erjian],
		["# 630", sections.sixThirty],
		["# 单字", sections.single],
	] as const) {
		lines.push(heading);
		for (const [code, word] of [...entries].sort(([a], [b]) =>
			a.localeCompare(b),
		)) {
			lines.push(`${code}\t${word}`);
		}
	}
	return `${lines.join("\n")}\n`;
}

// 键道与三拼共享字母二键基码：辅音使用 c 列，元音使用 x 载体；
// 三拼再统一追加轻声键 o。数字放在对应汉字的本地固顶码后。
// 与上游一样，这些候选不参与固顶选优，也不新增占用的码位。
export const jiandaoSupplementalCandidates = new Map<string, string[]>();
for (const key of "bpmfdtnlgkhjqxzcsrywe") {
	jiandaoSupplementalCandidates.set(`${key}c`, [key.toUpperCase(), key]);
}
for (const [code, letter] of [
	["xg", "v"],
	["xl", "i"],
	["xh", "u"],
	["xd", "o"],
	["xw", "a"],
] as const) {
	jiandaoSupplementalCandidates.set(code, [letter.toUpperCase(), letter]);
}
for (const [code, words] of [
	["y", "1"],
	["re", "二 2"],
	// “三”的 U357 完整音码 sj 已占用 AA 单字位；这里只追加数字，避免 s/sj 父子码重复。
	["s", "3"],
	["sli", "四 4"],
	["shv", "五 5"],
	["ldo", "六 6"],
	["qlv", "七 7"],
	["bwu", "8"],
	["jdu", "九 9"],
	["elu", "十 10"],
	["ltv", "零 0"],
] as const) {
	jiandaoSupplementalCandidates.set(code, [
		...words.split(" "),
		...(jiandaoSupplementalCandidates.get(code) ?? []),
	]);
}

export function renderJiandaoFixedTable(sections: FixedSections) {
	const found = new Set<string>();
	const lines = renderFixedTable(sections)
		.trimEnd()
		.split("\n")
		.map((line) => {
			const [code, candidates = ""] = line.split("\t", 2);
			const aliases = jiandaoSupplementalCandidates.get(code);
			if (!aliases) return line;
			found.add(code);
			const existing = new Set(candidates.split(" "));
			const appended = aliases.filter((candidate) => !existing.has(candidate));
			return appended.length > 0 ? `${line} ${appended.join(" ")}` : line;
		});
	for (const code of jiandaoSupplementalCandidates.keys()) {
		if (!found.has(code)) throw new Error(`键道字母或数字码位不存在：${code}`);
	}
	return `${lines.join("\n")}\n`;
}

// 三拼上游表中还保留了数字备选和拉丁字母入口。它们不参与
// 神韵固顶选优，但必须由同一生成器输出，避免下次生成时被覆盖。
export const sanpinSingleAliases = new Map([
	["qj", "2"],
	["s", "3"],
	["sk", "4"],
	["y", "1"],
]);

export const sanpinLetterEntries = [
	["bco", "B b"],
	["pco", "P p"],
	["mco", "M m"],
	["fco", "F f"],
	["dco", "D d"],
	["tco", "T t"],
	["nco", "N n"],
	["lco", "L l"],
	["gco", "G g"],
	["kco", "K k"],
	["hco", "H h"],
	["jco", "J j"],
	["qco", "Q q"],
	["xco", "X x"],
	["zco", "Z z"],
	["cco", "C c"],
	["sco", "S s"],
	["rco", "R r"],
	["yco", "Y y"],
	["wco", "W w"],
	["eco", "E e"],
	["xgo", "V v"],
	["xlo", "I i"],
	["xho", "U u"],
	["xdo", "O o"],
	["xwo", "A a"],
] as const;

// 上游统计功能用这些三音节全码同时提供中文数字与阿拉伯数字候选。
// 码位按当前 U357 神韵的声、韵、调键重新编码，均不占用固顶区已有条目。
export const sanpinTemporaryNumberEntries = [
	["shu", "五 5"],
	["lda", "六 6"],
	["qli", "七 7"],
	["bwi", "八 8"],
	["jdu", "九 9"],
	["elv", "十 10"],
	["ltv", "零 0"],
] as const;

export function renderSanpinFixedTable(sections: FixedSections) {
	const core = renderFixedTable(sections)
		.trimEnd()
		.split("\n")
		.map((line) => {
			const [code] = line.split("\t", 1);
			const alias = code && sanpinSingleAliases.get(code);
			return alias ? `${line} ${alias}` : line;
		});
	return `${core.join("\n")}\n# 字母\n${sanpinLetterEntries
		.map(([code, candidates]) => `${code}\t${candidates}`)
		.join("\n")}\n# 临时数字\n${sanpinTemporaryNumberEntries
		.map(([code, candidates]) => `${code}\t${candidates}`)
		.join("\n")}\n`;
}

export function assertOneCandidatePerCode(sections: FixedSections) {
	const seen = new Map<string, string>();
	for (const [section, entries] of Object.entries(sections)) {
		for (const [code, word] of entries) {
			const owner = seen.get(code);
			if (owner) throw new Error(`${code} 同时属于 ${owner} 与 ${section}。`);
			if (word.includes(" "))
				throw new Error(`${code} 含多个固顶候选：${word}`);
			seen.set(code, section);
		}
	}
}

export function assertNoPrefixWordRepeats(sections: FixedSections) {
	const entries = [
		...sections.erjian,
		...sections.sixThirty,
		...sections.single,
	];
	for (const [shortCode, shortWord] of entries) {
		for (const [longCode, longWord] of entries) {
			if (
				shortCode !== longCode &&
				longCode.startsWith(shortCode) &&
				shortWord === longWord
			) {
				throw new Error(
					`固顶父子码重复：${shortCode}、${longCode} 均为“${shortWord}”。`,
				);
			}
		}
	}
}
