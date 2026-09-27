import assert from "node:assert/strict";
import test from "node:test";
import {
	buildEvidenceSnapshot,
	cumulativeEvidence,
	isEligibleEvidence,
} from "../evidence";
import type { CorpusRecord } from "../types";

function record(overrides: Partial<CorpusRecord>): CorpusRecord {
	return {
		schemaVersion: 1,
		sourceId: "source-a",
		family: "family-a",
		sourcePath: "fixture",
		sourceRevision: "fixture",
		line: 1,
		word: "一些",
		originalCode: "jc",
		normalizedCode: "jc",
		wordLength: 2,
		codeLength: 2,
		category: "erjian",
		level: "two-code",
		rank: 2,
		weight: null,
		derived: false,
		metadata: {},
		...overrides,
	};
}

async function* jsonLines(records: CorpusRecord[]) {
	for (const item of records) yield JSON.stringify(item);
}

test("evidence excludes current output, inventory and full codes", () => {
	assert.equal(isEligibleEvidence(record({ sourceId: "snow-current" })), false);
	assert.equal(
		isEligibleEvidence(record({ metadata: { evidenceRole: "inventory" } })),
		false,
	);
	assert.equal(isEligibleEvidence(record({ codeLength: 4 })), false);
	assert.equal(isEligibleEvidence(record({})), true);
});

test("evidence aggregates independent sources and families by exact code length", async () => {
	const snapshot = await buildEvidenceSnapshot(
		jsonLines([
			record({ rank: 2 }),
			record({ sourceId: "source-b", family: "family-a", rank: 1 }),
			record({ sourceId: "source-c", family: "family-c", codeLength: 3 }),
			record({ word: "无关" }),
		]),
		{ allowedWords: new Set(["一些"]) },
	);
	assert.equal(snapshot.statistics.inputRecords, 4);
	assert.equal(snapshot.statistics.eligibleRecords, 3);
	assert.deepEqual(snapshot.words["一些"]?.byCodeLength["2"], {
		sources: ["source-a", "source-b"],
		families: ["family-a"],
		bestRank: 1,
	});
	assert.deepEqual(cumulativeEvidence(snapshot.words["一些"], 3), {
		sources: ["source-a", "source-b", "source-c"],
		families: ["family-a", "family-c"],
		bestRank: 1,
	});
});
