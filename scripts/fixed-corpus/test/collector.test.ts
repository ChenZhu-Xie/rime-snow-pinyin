import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { collectCorpus } from "../collector";
import type { CorpusManifest, SourceAdapter } from "../manifest";

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
