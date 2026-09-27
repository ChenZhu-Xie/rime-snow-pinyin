import { readFileSync } from "node:fs";
import { basename } from "node:path";

export interface WordReading {
	word: string;
	reading: string;
	syllables: string[];
	weight: number;
	sources: string[];
}

export interface DictionaryWord {
	word: string;
	length: number;
	weight: number;
	rank: number;
	readings: WordReading[];
}

export interface CohortDiagnostic {
	code: "MALFORMED_ROW" | "INVALID_WEIGHT" | "READING_LENGTH_MISMATCH";
	source: string;
	line: number;
	message: string;
}

export interface WeightedCohort {
	words: DictionaryWord[];
	diagnostics: CohortDiagnostic[];
}

interface MutableReading extends WordReading {
	sourceSet: Set<string>;
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

export function loadWeightedCohort(
	paths: string[],
	lengths: number[] = [2, 4],
): WeightedCohort {
	const acceptedLengths = new Set(lengths);
	const readingsByWord = new Map<string, Map<string, MutableReading>>();
	const diagnostics: CohortDiagnostic[] = [];

	for (const path of paths) {
		const source = basename(path);
		const lines = readFileSync(path, "utf8").replace(/^\uFEFF/u, "").split(/\r?\n/u);
		let inBody = false;
		for (let index = 0; index < lines.length; index += 1) {
			const raw = lines[index] ?? "";
			const trimmed = raw.trim();
			if (!inBody) {
				if (trimmed === "...") inBody = true;
				continue;
			}
			if (!trimmed || trimmed.startsWith("#")) continue;
			const [word, rawReading, rawWeight, ...extra] = raw.split("\t");
			if (!word || !rawReading || extra.length > 0) {
				diagnostics.push({
					code: "MALFORMED_ROW",
					source,
					line: index + 1,
					message: "词典行必须包含字词、读音和可选权重",
				});
				continue;
			}
			const characters = [...word];
			if (!acceptedLengths.has(characters.length) || !/^\p{Script=Han}+$/u.test(word)) {
				continue;
			}
			const syllables = rawReading.trim().split(/\s+/u);
			if (syllables.length !== characters.length) {
				diagnostics.push({
					code: "READING_LENGTH_MISMATCH",
					source,
					line: index + 1,
					message: `${word} 有 ${characters.length} 字但 ${syllables.length} 个音节`,
				});
				continue;
			}
			const weightText = rawWeight?.trim() || "0";
			const weight = Number.parseFloat(weightText.replace(/%$/u, ""));
			if (!Number.isFinite(weight) || weight < 0) {
				diagnostics.push({
					code: "INVALID_WEIGHT",
					source,
					line: index + 1,
					message: `${word} 的权重无效：${weightText}`,
				});
				continue;
			}

			const reading = syllables.join(" ");
			const wordReadings = readingsByWord.get(word) ?? new Map<string, MutableReading>();
			const previous = wordReadings.get(reading);
			if (previous) {
				previous.weight = Math.max(previous.weight, weight);
				previous.sourceSet.add(source);
				previous.sources = [...previous.sourceSet].sort(compareText);
			} else {
				wordReadings.set(reading, {
					word,
					reading,
					syllables,
					weight,
					sources: [source],
					sourceSet: new Set([source]),
				});
			}
			readingsByWord.set(word, wordReadings);
		}
	}

	const words = [...readingsByWord.entries()].map(([word, readings]) => {
		const normalizedReadings = [...readings.values()]
			.sort((left, right) => compareText(left.reading, right.reading))
			.map(({ sourceSet: _sourceSet, ...reading }) => reading);
		return {
			word,
			length: [...word].length,
			weight: Math.max(...normalizedReadings.map(({ weight }) => weight)),
			rank: 0,
			readings: normalizedReadings,
		};
	});
	words.sort((left, right) => right.weight - left.weight || compareText(left.word, right.word));
	words.forEach((word, index) => {
		word.rank = index + 1;
	});
	return { words, diagnostics };
}
