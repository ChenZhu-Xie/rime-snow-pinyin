import assert from "node:assert/strict";
import test from "node:test";
import type { CollisionMeasurement } from "../collisions";
import { serializeJsonChunks } from "../json-writer";
import {
	type CollisionComparisonReport,
	renderCollisionMarkdown,
} from "../report";

function measurement(rate: number, code: string): CollisionMeasurement {
	const metric = {
		codeCount: 2,
		uniqueCodeCount: 1,
		uniqueCodeRate: 0.5,
		bucketCount: 1,
		affectedWordCount: 2,
		affectedWordRate: rate,
		affectedWeight: 30,
		totalWordCount: 4,
		totalWeight: 100,
		weightedMassRate: rate / 2,
		maxBucketSize: 2,
		buckets: [
			{
				code,
				totalWeight: 30,
				members: [
					{
						word: "一些",
						length: 2 as const,
						weight: 20,
						readings: ["yi1 xie1"],
					},
					{
						word: "冲着",
						length: 2 as const,
						weight: 10,
						readings: ["chong1 zhe5"],
					},
				],
			},
		],
	};
	return {
		coverage: {
			two: { inputWordCount: 4, encodableWordCount: 4, rate: 1 },
			four: { inputWordCount: 3, encodableWordCount: 3, rate: 1 },
		},
		withinTwo: metric,
		withinFour: { ...metric, buckets: [] },
		crossLength: { ...metric, buckets: [] },
	};
}

test("report renders every cutoff, layout mode, metric class, delta, and examples", () => {
	const report: CollisionComparisonReport = {
		schemaVersion: 1,
		dictionaries: ["base", "ext", "tencent"],
		diagnosticCount: 0,
		cutoffs: [500, 1000, 2000, 5000, 10000, null].map((requested, index) => ({
			requested,
			label:
				requested === null
					? "全部"
					: `Top ${requested.toLocaleString("en-US")}`,
			actualTwo: index === 0 ? 487 : 800,
			actualFour: index === 0 ? 450 : 700,
			variants: [
				{
					id: "shenyun-canonical",
					name: "神韵规范码",
					measurement: measurement(0.5, "abcd"),
				},
				{
					id: "original-canonical",
					name: "原键道规范码",
					measurement: measurement(0.4, "efgh"),
				},
				{
					id: "original-accepted",
					name: "原键道可接受码",
					measurement: measurement(0.6, "ijkl"),
				},
			],
		})),
	};

	const markdown = renderCollisionMarkdown(report);
	for (const label of [
		"Top 500",
		"Top 1,000",
		"Top 2,000",
		"Top 5,000",
		"Top 10,000",
		"全部",
	]) {
		assert.match(
			markdown,
			new RegExp(label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")),
		);
	}
	assert.match(markdown, /实际二字 487、四字 450/u);
	assert.match(markdown, /神韵规范码/u);
	assert.match(markdown, /原键道规范码/u);
	assert.match(markdown, /原键道可接受码/u);
	assert.match(markdown, /二字内部/u);
	assert.match(markdown, /四字内部/u);
	assert.match(markdown, /二字↔四字/u);
	assert.match(markdown, /受影响率差/u);
	assert.match(markdown, /词频质量差/u);
	assert.match(markdown, /abcd/u);
	assert.match(markdown, /一些/u);
});

test("report uses actual cohort sizes when a requested cutoff is unavailable", () => {
	const report: CollisionComparisonReport = {
		schemaVersion: 1,
		dictionaries: [],
		diagnosticCount: 0,
		cutoffs: [
			{
				requested: 10_000,
				label: "Top 10,000",
				actualTwo: 23,
				actualFour: 17,
				variants: [
					{
						id: "shenyun-canonical",
						name: "神韵规范码",
						measurement: measurement(0, "aaaa"),
					},
					{
						id: "original-canonical",
						name: "原键道规范码",
						measurement: measurement(0, "bbbb"),
					},
					{
						id: "original-accepted",
						name: "原键道可接受码",
						measurement: measurement(0, "cccc"),
					},
				],
			},
		],
	};

	assert.match(
		renderCollisionMarkdown(report),
		/Top 10,000（实际二字 23、四字 17）/u,
	);
});

test("detailed reports serialize in bounded chunks without changing JSON", () => {
	const value = {
		cutoffs: Array.from({ length: 100 }, (_, index) => ({
			index,
			members: ["一些", "冲着", "下了"],
		})),
	};
	const chunks = [...serializeJsonChunks(value, 37)];

	assert.ok(chunks.length > 1);
	assert.ok(chunks.every((chunk) => chunk.length <= 37));
	assert.deepEqual(JSON.parse(chunks.join("")), value);
});
