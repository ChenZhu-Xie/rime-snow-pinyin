import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	readSourceRevision,
	resolveSource,
} from "../source-resolver";
import type { SourceDefinition } from "../manifest";

function temporaryDirectory(prefix: string): string {
	return mkdtempSync(join(tmpdir(), prefix));
}

function removeTemporaryDirectory(path: string): void {
	const resolved = resolve(path);
	assert.ok(resolved.startsWith(resolve(tmpdir())));
	rmSync(resolved, { recursive: true, force: true });
}

function source(overrides: Partial<SourceDefinition> = {}): SourceDefinition {
	return {
		id: "fixture",
		name: "Fixture",
		family: "fixture",
		required: false,
		localPaths: [],
		inputs: [{ adapter: "rime-table", include: ["fixture.dict.yaml"] }],
		...overrides,
	};
}

test("prefers a local source and never mutates its dirty Git state", async (t) => {
	const root = temporaryDirectory("fixed-corpus-local-");
	const cacheRoot = temporaryDirectory("fixed-corpus-cache-");
	t.after(() => {
		removeTemporaryDirectory(root);
		removeTemporaryDirectory(cacheRoot);
	});

	execFileSync("git", ["init", "--quiet", root]);
	execFileSync("git", ["-C", root, "config", "user.email", "fixture@example.test"]);
	execFileSync("git", ["-C", root, "config", "user.name", "Fixture"]);
	writeFileSync(join(root, "fixture.dict.yaml"), "词\tci\n", "utf8");
	execFileSync("git", ["-C", root, "add", "fixture.dict.yaml"]);
	execFileSync("git", ["-C", root, "commit", "--quiet", "-m", "fixture"]);
	writeFileSync(join(root, "dirty.txt"), "keep me", "utf8");
	const before = execFileSync("git", ["-C", root, "status", "--porcelain"], {
		encoding: "utf8",
	});

	const result = await resolveSource(source({ localPaths: [root] }), {
		cacheRoot,
		offline: true,
	});
	const after = execFileSync("git", ["-C", root, "status", "--porcelain"], {
		encoding: "utf8",
	});

	assert.equal(result.root, resolve(root));
	assert.equal(result.resolution, "local");
	assert.match(result.revision ?? "", /^[0-9a-f]{40}$/u);
	assert.equal(after, before);
	assert.equal(readFileSync(join(root, "dirty.txt"), "utf8"), "keep me");
});

test("hashes non-Git directories deterministically", (t) => {
	const root = temporaryDirectory("fixed-corpus-hash-");
	t.after(() => removeTemporaryDirectory(root));
	mkdirSync(join(root, "nested"));
	writeFileSync(join(root, "nested", "a.txt"), "alpha", "utf8");

	const first = readSourceRevision(root);
	const second = readSourceRevision(root);

	assert.equal(first, second);
	assert.match(first, /^sha256:[0-9a-f]{64}$/u);
});

test("reports an optional missing source while offline", async (t) => {
	const cacheRoot = temporaryDirectory("fixed-corpus-missing-");
	t.after(() => removeTemporaryDirectory(cacheRoot));
	const result = await resolveSource(
		source({
			localPaths: [join(cacheRoot, "does-not-exist")],
			repository: "https://example.test/fixture.git",
		}),
		{ cacheRoot, offline: true },
	);

	assert.equal(result.root, null);
	assert.equal(result.resolution, "missing");
	assert.equal(result.diagnostics[0]?.code, "SOURCE_MISSING_OFFLINE");
});

test("clones only into the selected repository cache", async (t) => {
	const cacheRoot = temporaryDirectory("fixed-corpus-clone-");
	t.after(() => removeTemporaryDirectory(cacheRoot));
	const result = await resolveSource(
		source({ repository: "https://example.test/fixture.git", ref: "stable" }),
		{
			cacheRoot,
			cloneRepository: async (_repository, destination, ref) => {
				assert.equal(destination, join(resolve(cacheRoot), "repositories", "fixture"));
				assert.equal(ref, "stable");
				mkdirSync(destination, { recursive: true });
				writeFileSync(join(destination, "fixture.dict.yaml"), "词\tci\n", "utf8");
			},
		},
	);

	assert.equal(result.resolution, "cloned");
	assert.equal(result.root, join(resolve(cacheRoot), "repositories", "fixture"));
	assert.match(result.revision ?? "", /^sha256:[0-9a-f]{64}$/u);
});

test("does not treat an interrupted Git clone as a valid cache", async (t) => {
	const cacheRoot = temporaryDirectory("fixed-corpus-interrupted-");
	t.after(() => removeTemporaryDirectory(cacheRoot));
	const interrupted = join(cacheRoot, "repositories", "fixture");
	mkdirSync(join(interrupted, ".git"), { recursive: true });
	writeFileSync(join(interrupted, "partial.pack"), "incomplete", "utf8");

	const result = await resolveSource(
		source({ repository: "https://example.test/fixture.git" }),
		{ cacheRoot, offline: true },
	);

	assert.equal(result.root, null);
	assert.equal(result.resolution, "missing");
	assert.equal(result.diagnostics[0]?.code, "SOURCE_CACHE_INCOMPLETE");
});
