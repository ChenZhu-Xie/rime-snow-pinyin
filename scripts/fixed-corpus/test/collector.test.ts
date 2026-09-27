import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { collectCorpus, serializeJsonLineChunks } from "../collector";
import type { CorpusManifest, SourceAdapter } from "../manifest";
import { summarizeCorpus } from "../summary";
import type { CorpusRecord } from "../types";

function temporaryDirectory(prefix: string): string {
	return mkdtempSync(join(tmpdir(), prefix));
}

function removeTemporaryDirectory(path: string): void {
	const resolved = resolve(path);
	assert.ok(resolved.startsWith(resolve(tmpdir())));
	rmSync(resolved, { recursive: true, force: true });
}

function manifestFor(sources: Array<{
	id: string;
	family: string;
	root: string;
	file: string;
	adapter: SourceAdapter;
}>): CorpusManifest {
	return {
		schemaVersion: 1,
		globalPolicy: { deny: [], requireExplicitInclude: [] },
		sources: sources.map((source) => ({
			id: source.id,
			name: source.id,
			family: source.family,
			required: true,
			localPaths: [source.root],
			inputs: [{ adapter: source.adapter, include: [source.file], codeMarkers: ["/"] }],
		})),
	};
}

test("collection is deterministic and preserves source versus family coverage", async (t) => {
	const fixtureRoot = temporaryDirectory("fixed-corpus-fixtures-");
	const cacheOne = temporaryDirectory("fixed-corpus-output-one-");
	const cacheTwo = temporaryDirectory("fixed-corpus-output-two-");
	t.after(() => {
		removeTemporaryDirectory(fixtureRoot);
		removeTemporaryDirectory(cacheOne);
		removeTemporaryDirectory(cacheTwo);
	});

	const firstRoot = join(fixtureRoot, "first");
	const secondRoot = join(fixtureRoot, "second");
	const thirdRoot = join(fixtureRoot, "third");
	for (const root of [firstRoot, secondRoot, thirdRoot]) {
		await import("node:fs").then(({ mkdirSync }) => mkdirSync(root));
	}
	writeFileSync(
		join(firstRoot, "first.dict.yaml"),
		"---\nname: first\n...\n共同词\tgt\t99\n坏行\n",
		"utf8",
	);
	writeFileSync(join(secondRoot, "second.fixed.txt"), "gt\t共同词 次选\n", "utf8");
	writeFileSync(join(thirdRoot, "third.txt"), "共同词\tgt/\t50\n独立词\tdl/\t40\n", "utf8");
	const manifest = manifestFor([
		{ id: "first", family: "related", root: firstRoot, file: "first.dict.yaml", adapter: "rime-table" },
		{ id: "second", family: "related", root: secondRoot, file: "second.fixed.txt", adapter: "ordered-fixed" },
		{ id: "third", family: "independent", root: thirdRoot, file: "third.txt", adapter: "custom-phrase" },
	]);

	const first = await collectCorpus(manifest, { cacheRoot: cacheOne, offline: true });
	const second = await collectCorpus(manifest, { cacheRoot: cacheTwo, offline: true });

	assert.deepEqual(
		first.records.map((record) => [record.sourceId, record.sourcePath, record.line, record.word, record.rank]),
		[
			["first", "first.dict.yaml", 4, "共同词", 1],
			["second", "second.fixed.txt", 1, "次选", 2],
			["second", "second.fixed.txt", 1, "共同词", 1],
			["third", "third.txt", 1, "共同词", 1],
			["third", "third.txt", 2, "独立词", 1],
		],
	);
	assert.equal(
		readFileSync(join(cacheOne, "corpus.jsonl"), "utf8"),
		readFileSync(join(cacheTwo, "corpus.jsonl"), "utf8"),
	);
	for (const id of ["first", "second", "third"]) {
		assert.equal(existsSync(join(cacheOne, "normalized", `${id}.jsonl`)), true);
	}
	const coverage = first.summary.wordCoverage.find((entry) => entry.word === "共同词");
	assert.deepEqual(coverage, {
		word: "共同词",
		sourceCount: 3,
		familyCount: 2,
		sources: ["first", "second", "third"],
		families: ["independent", "related"],
	});
	assert.equal(first.diagnostics.length, 1);
	assert.equal(first.diagnostics[0]?.line, 5);
	assert.match(first.diagnostics[0]?.message ?? "", /至少需要/u);

	const provenanceOne = readFileSync(join(cacheOne, "provenance.json"), "utf8");
	const provenanceTwo = readFileSync(join(cacheTwo, "provenance.json"), "utf8");
	assert.equal(provenanceOne, provenanceTwo);
	assert.equal(provenanceOne.includes(fixtureRoot), false);
	const provenance = JSON.parse(provenanceOne) as {
		sources: Array<{ id: string; files: Array<{ path: string; sha256: string }> }>;
	};
	assert.deepEqual(provenance.sources.map((source) => source.id), ["first", "second", "third"]);
	assert.match(provenance.sources[0].files[0].sha256, /^[0-9a-f]{64}$/u);
});

test("collection appends large source batches without argument-stack overflow", async (t) => {
	const fixtureRoot = temporaryDirectory("fixed-corpus-large-");
	const cacheRoot = temporaryDirectory("fixed-corpus-large-output-");
	t.after(() => {
		removeTemporaryDirectory(fixtureRoot);
		removeTemporaryDirectory(cacheRoot);
	});
	writeFileSync(
		join(fixtureRoot, "large.dict.yaml"),
		`---\nname: large\n...\n${"词\tz\n".repeat(126_000)}`,
		"utf8",
	);
	const manifest = manifestFor([
		{
			id: "large",
			family: "large",
			root: fixtureRoot,
			file: "large.dict.yaml",
			adapter: "rime-table",
		},
	]);

	const result = await collectCorpus(manifest, { cacheRoot, offline: true });

	assert.equal(result.records.length, 126_000);
});

test("collection follows imports from a header-only encoder dictionary", async (t) => {
	const fixtureRoot = temporaryDirectory("fixed-corpus-import-");
	const cacheRoot = temporaryDirectory("fixed-corpus-import-output-");
	t.after(() => {
		removeTemporaryDirectory(fixtureRoot);
		removeTemporaryDirectory(cacheRoot);
	});
	writeFileSync(
		join(fixtureRoot, "aggregate.dict.yaml"),
		"---\nname: aggregate\nimport_tables:\n  - child\n",
		"utf8",
	);
	writeFileSync(
		join(fixtureRoot, "child.dict.yaml"),
		"---\nname: child\ncolumns: [text, code, weight]\n...\n一些\tyx\t88\n",
		"utf8",
	);
	const manifest = manifestFor([
		{
			id: "aggregate",
			family: "aggregate",
			root: fixtureRoot,
			file: "aggregate.dict.yaml",
			adapter: "encoder-derived",
		},
	]);

	const result = await collectCorpus(manifest, { cacheRoot, offline: true });

	assert.deepEqual(
		result.records.map((record) => [record.word, record.originalCode, record.sourcePath]),
		[["一些", "yx", "child.dict.yaml"]],
	);
});

test("JSONL serialization yields bounded deterministic chunks", () => {
	const record = {
		schemaVersion: 1,
		sourceId: "fixture",
		family: "fixture",
		sourcePath: "fixture.txt",
		sourceRevision: "revision",
		line: 1,
		word: "一些",
		originalCode: "yx",
		normalizedCode: "yx",
		wordLength: 2,
		codeLength: 2,
		category: "erjian",
		level: "two-code",
		rank: 1,
		weight: 10,
		derived: false,
		metadata: {},
	} satisfies CorpusRecord;
	const records = [record, { ...record, line: 2 }, { ...record, line: 3 }];

	const chunks = [...serializeJsonLineChunks(records, 350)];

	assert.ok(chunks.length > 1);
	assert.equal(
		chunks.join(""),
		`${records.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
	);
});

test("summary bounds detailed word coverage while reporting omissions", () => {
	const records: CorpusRecord[] = Array.from({ length: 10_005 }, (_, index) => ({
		schemaVersion: 1,
		sourceId: "fixture",
		family: "fixture",
		sourcePath: "fixture.txt",
		sourceRevision: "revision",
		line: index + 1,
		word: `词${index.toString().padStart(5, "0")}`,
		originalCode: "z",
		normalizedCode: "z",
		wordLength: 2,
		codeLength: 1,
		category: "shortcut",
		level: "one-code",
		rank: 1,
		weight: null,
		derived: false,
		metadata: {},
	}));

	const summary = summarizeCorpus(records, []);

	assert.equal(summary.wordCoverage.length, 10_000);
	assert.equal(summary.omittedWordCoverageCount, 5);
});
