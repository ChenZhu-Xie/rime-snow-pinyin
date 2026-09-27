import assert from "node:assert/strict";
import test from "node:test";
import {
	measureCollisions,
	type EncodedWord,
} from "../collisions";

function word(
	text: string,
	length: 2 | 4,
	weight: number,
	codes: string[],
): EncodedWord {
	return {
		word: text,
		length,
		weight,
		codes: codes.map((code) => ({ code, readings: [`${text}-reading`] })),
	};
}

test("collision metrics count exact within-length and cross-length buckets", () => {
	const words2 = [
		word("甲乙", 2, 10, ["aaaa"]),
		word("丙丁", 2, 20, ["bbbb", "cccc"]),
		word("戊己", 2, 30, ["bbbb", "cccc"]),
	];
	const words4 = [
		word("春夏秋冬", 4, 40, ["eeee"]),
		word("东西南北", 4, 50, ["eeee"]),
		word("天地玄黄", 4, 60, ["aaaa"]),
		word("宇宙洪荒", 4, 70, ["zzzz"]),
	];

	const result = measureCollisions(words2, words4, {});
	assert.deepEqual(
		{
			buckets: result.withinTwo.bucketCount,
			affected: result.withinTwo.affectedWordCount,
			uniqueCodeRate: result.withinTwo.uniqueCodeRate,
			maxBucket: result.withinTwo.maxBucketSize,
			wordRate: result.withinTwo.affectedWordRate,
			weightedRate: result.withinTwo.weightedMassRate,
		},
		{
			buckets: 2,
			affected: 2,
			uniqueCodeRate: 1 / 3,
			maxBucket: 2,
			wordRate: 2 / 3,
			weightedRate: 50 / 60,
		},
	);
	assert.equal(result.withinFour.bucketCount, 1);
	assert.equal(result.withinFour.affectedWordCount, 2);
	assert.equal(result.withinFour.uniqueCodeRate, 2 / 3);
	assert.equal(result.withinFour.weightedMassRate, 90 / 220);
	assert.equal(result.crossLength.bucketCount, 1);
	assert.equal(result.crossLength.affectedWordCount, 2);
	assert.equal(result.crossLength.affectedWordRate, 2 / 7);
	assert.equal(result.crossLength.weightedMassRate, 70 / 280);
	assert.equal(result.crossLength.uniqueCodeRate, 4 / 5);
	assert.deepEqual(
		result.crossLength.buckets[0]?.members.map(({ word }) => word),
		["甲乙", "天地玄黄"],
	);
});

test("a multi-code word appears in every actual bucket but counts once in totals", () => {
	const result = measureCollisions(
		[
			word("甲乙", 2, 10, ["aaaa", "bbbb"]),
			word("丙丁", 2, 20, ["aaaa"]),
			word("戊己", 2, 30, ["bbbb"]),
		],
		[],
		{},
	);

	assert.equal(result.withinTwo.bucketCount, 2);
	assert.equal(result.withinTwo.affectedWordCount, 3);
	assert.equal(result.withinTwo.affectedWeight, 60);
	assert.equal(
		result.withinTwo.buckets.filter(({ members }) =>
			members.some(({ word }) => word === "甲乙"),
		).length,
		2,
	);
});

test("coverage excludes unencodable entries without changing the input denominator", () => {
	const result = measureCollisions(
		[word("甲乙", 2, 10, []), word("丙丁", 2, 20, ["aaaa"])],
		[],
		{},
	);

	assert.deepEqual(result.coverage.two, {
		inputWordCount: 2,
		encodableWordCount: 1,
		rate: 0.5,
	});
	assert.equal(result.withinTwo.totalWordCount, 1);
});
