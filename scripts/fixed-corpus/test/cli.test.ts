import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

function temporaryDirectory(prefix: string): string {
	return mkdtempSync(join(tmpdir(), prefix));
}

function removeTemporaryDirectory(path: string): void {
	const resolved = resolve(path);
	assert.ok(resolved.startsWith(resolve(tmpdir())));
	rmSync(resolved, { recursive: true, force: true });
}

function yamlPath(path: string): string {
	return `'${path.replace(/\\/gu, "/").replace(/'/gu, "''")}'`;
}

const tsxCli = resolve(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const corpusCli = resolve(import.meta.dirname, "../cli.ts");

test("CLI writes corpus artifacts and reports optional sources", (t) => {
	const root = temporaryDirectory("fixed-corpus-cli-");
	t.after(() => removeTemporaryDirectory(root));
	const sourceRoot = join(root, "source");
	const cacheRoot = join(root, "cache");
	const summaryPath = join(root, "summary.md");
	mkdirSync(sourceRoot);
	writeFileSync(join(sourceRoot, "fixed.txt"), "gt\t共同词\n", "utf8");
	const manifestPath = join(root, "manifest.yaml");
	writeFileSync(
		manifestPath,
		`schemaVersion: 1
globalPolicy:
  deny: []
  requireExplicitInclude: []
sources:
  - id: fixture
    name: Fixture
    family: fixture
    required: true
    localPaths: [${yamlPath(sourceRoot)}]
    inputs:
      - adapter: ordered-fixed
        include: [fixed.txt]
  - id: optional-missing
    name: Optional Missing
    family: missing
    required: false
    localPaths: [${yamlPath(join(root, "missing"))}]
    inputs:
      - adapter: rime-table
        include: [missing.dict.yaml]
`,
		"utf8",
	);

	const result = spawnSync(
		process.execPath,
		[
			tsxCli,
			corpusCli,
			"--manifest",
			manifestPath,
			"--cache",
			cacheRoot,
			"--summary",
			summaryPath,
			"--offline",
		],
		{ encoding: "utf8" },
	);

	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /optional-missing/u);
	for (const path of [
		join(cacheRoot, "normalized", "fixture.jsonl"),
		join(cacheRoot, "corpus.jsonl"),
		join(cacheRoot, "provenance.json"),
		join(cacheRoot, "reports", "summary.json"),
		summaryPath,
	]) {
		assert.equal(existsSync(path), true, `missing ${path}`);
	}
	const summary = readFileSync(summaryPath, "utf8");
	assert.match(summary, /共同词/u);
	assert.match(summary, /optional-missing/u);
	assert.match(summary, /一些/u);
});

test("CLI exits nonzero when a required source is missing", (t) => {
	const root = temporaryDirectory("fixed-corpus-required-");
	t.after(() => removeTemporaryDirectory(root));
	const manifestPath = join(root, "manifest.yaml");
	writeFileSync(
		manifestPath,
		`schemaVersion: 1
globalPolicy:
  deny: []
  requireExplicitInclude: []
sources:
  - id: required-missing
    name: Required Missing
    family: missing
    required: true
    localPaths: [${yamlPath(join(root, "missing"))}]
    inputs:
      - adapter: rime-table
        include: [missing.dict.yaml]
`,
		"utf8",
	);

	const result = spawnSync(
		process.execPath,
		[
			tsxCli,
			corpusCli,
			"--manifest",
			manifestPath,
			"--cache",
			join(root, "cache"),
			"--summary",
			join(root, "summary.md"),
			"--offline",
		],
		{ encoding: "utf8" },
	);

	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /必需来源缺失：required-missing/u);
});
