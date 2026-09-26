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

export function readLegacyFixed(path: string) {
	const sections = new Map<string, Map<string, string[]>>();
	let section = "";
	for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
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
