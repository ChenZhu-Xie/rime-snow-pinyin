import type { DictionaryWord } from "./cohort";
import {
	encodeWord,
	type EncodingMode,
	type LayoutDefinition,
} from "./layout";

export interface EncodedCode {
	code: string;
	readings: string[];
}

export interface EncodedWord {
	word: string;
	length: 2 | 4;
	weight: number;
	codes: EncodedCode[];
}

export interface CollisionMember {
	word: string;
	length: 2 | 4;
	weight: number;
	readings: string[];
}

export interface CollisionBucket {
	code: string;
	members: CollisionMember[];
	totalWeight: number;
}

export interface CollisionMetric {
	codeCount: number;
	uniqueCodeCount: number;
	uniqueCodeRate: number;
	bucketCount: number;
	affectedWordCount: number;
	affectedWordRate: number;
	affectedWeight: number;
	totalWordCount: number;
	totalWeight: number;
	weightedMassRate: number;
	maxBucketSize: number;
	buckets: CollisionBucket[];
}

export interface CoverageMetric {
	inputWordCount: number;
	encodableWordCount: number;
	rate: number;
}

export interface CollisionMeasurement {
	coverage: { two: CoverageMetric; four: CoverageMetric };
	withinTwo: CollisionMetric;
	withinFour: CollisionMetric;
	crossLength: CollisionMetric;
}

export interface CollisionOptions {
	maxBuckets?: number;
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function ratio(numerator: number, denominator: number): number {
	return denominator === 0 ? 0 : numerator / denominator;
}

export function encodeDictionaryWords(
	words: DictionaryWord[],
	layout: LayoutDefinition,
	mode: EncodingMode,
): EncodedWord[] {
	return words.map((word) => {
		const readingsByCode = new Map<string, Set<string>>();
		for (const reading of word.readings) {
			for (const code of encodeWord(reading.syllables, layout, mode)) {
				const readings = readingsByCode.get(code) ?? new Set<string>();
				readings.add(reading.reading);
				readingsByCode.set(code, readings);
			}
		}
		return {
			word: word.word,
			length: word.length as 2 | 4,
			weight: word.weight,
			codes: [...readingsByCode.entries()]
				.sort(([left], [right]) => compareText(left, right))
				.map(([code, readings]) => ({
					code,
					readings: [...readings].sort(compareText),
				})),
		};
	});
}

function encodable(words: EncodedWord[]): EncodedWord[] {
	return words.filter(({ codes }) => codes.length > 0);
}

function coverage(words: EncodedWord[]): CoverageMetric {
	const encodableWordCount = encodable(words).length;
	return {
		inputWordCount: words.length,
		encodableWordCount,
		rate: ratio(encodableWordCount, words.length),
	};
}

function identity(word: Pick<EncodedWord, "word" | "length">): string {
	return `${word.length}:${word.word}`;
}

function buildIndex(words: EncodedWord[]): Map<string, Map<string, CollisionMember>> {
	const index = new Map<string, Map<string, CollisionMember>>();
	for (const word of encodable(words)) {
		for (const encoded of word.codes) {
			const members = index.get(encoded.code) ?? new Map<string, CollisionMember>();
			const key = identity(word);
			const previous = members.get(key);
			members.set(key, {
				word: word.word,
				length: word.length,
				weight: word.weight,
				readings: [...new Set([...(previous?.readings ?? []), ...encoded.readings])].sort(compareText),
			});
			index.set(encoded.code, members);
		}
	}
	return index;
}

function sortedMembers(members: Map<string, CollisionMember>): CollisionMember[] {
	return [...members.values()].sort(
		(left, right) => left.length - right.length || compareText(left.word, right.word),
	);
}

function makeMetric(
	index: Map<string, Map<string, CollisionMember>>,
	words: EncodedWord[],
	isCollision: (members: Map<string, CollisionMember>) => boolean,
	options: CollisionOptions,
): CollisionMetric {
	const encodedWords = encodable(words);
	const allBuckets = [...index.entries()]
		.filter(([, members]) => isCollision(members))
		.map(([code, members]) => {
			const sorted = sortedMembers(members);
			return {
				code,
				members: sorted,
				totalWeight: sorted.reduce((sum, member) => sum + member.weight, 0),
			};
		})
		.sort(
			(left, right) =>
				right.members.length - left.members.length ||
				right.totalWeight - left.totalWeight ||
				compareText(left.code, right.code),
		);
	const affected = new Map<string, CollisionMember>();
	for (const bucket of allBuckets) {
		for (const member of bucket.members) affected.set(identity(member), member);
	}
	const totalWeight = encodedWords.reduce((sum, word) => sum + word.weight, 0);
	const affectedWeight = [...affected.values()].reduce((sum, word) => sum + word.weight, 0);
	const maxBuckets = options.maxBuckets ?? Number.POSITIVE_INFINITY;
	return {
		codeCount: index.size,
		uniqueCodeCount: index.size - allBuckets.length,
		uniqueCodeRate: ratio(index.size - allBuckets.length, index.size),
		bucketCount: allBuckets.length,
		affectedWordCount: affected.size,
		affectedWordRate: ratio(affected.size, encodedWords.length),
		affectedWeight,
		totalWordCount: encodedWords.length,
		totalWeight,
		weightedMassRate: ratio(affectedWeight, totalWeight),
		maxBucketSize: allBuckets[0]?.members.length ?? 0,
		buckets: allBuckets.slice(0, maxBuckets),
	};
}

export function measureCollisions(
	words2: EncodedWord[],
	words4: EncodedWord[],
	options: CollisionOptions = {},
): CollisionMeasurement {
	const index2 = buildIndex(words2);
	const index4 = buildIndex(words4);
	const combined = buildIndex([...words2, ...words4]);
	return {
		coverage: { two: coverage(words2), four: coverage(words4) },
		withinTwo: makeMetric(index2, words2, (members) => members.size > 1, options),
		withinFour: makeMetric(index4, words4, (members) => members.size > 1, options),
		crossLength: makeMetric(
			combined,
			[...words2, ...words4],
			(members) => {
				const lengths = new Set([...members.values()].map(({ length }) => length));
				return lengths.size > 1;
			},
			options,
		),
	};
}
