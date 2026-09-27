import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import {
	expandCandidatePath,
	isAllowedSourcePath,
	loadManifest,
} from "../manifest";
import type { GlobalSourcePolicy, SourceInput } from "../manifest";

test("expands environment and repository path candidates", () => {
	const environment = {
		APPDATA: "C:\\Users\\tester\\AppData\\Roaming",
		FIXED_CORPUS_INPUTMETHOD_ROOT: "D:\\input method",
		REPO_ROOT: "D:\\repo",
	};

	assert.equal(
		expandCandidatePath("%APPDATA%/Rime", environment),
		resolve("C:\\Users\\tester\\AppData\\Roaming/Rime"),
	);
	assert.equal(
		expandCandidatePath("${FIXED_CORPUS_INPUTMETHOD_ROOT}/KeyTao", environment),
		resolve("D:\\input method/KeyTao"),
	);
	assert.equal(
		expandCandidatePath("${REPO_ROOT}/snow_jiandao.fixed.txt", environment),
		resolve("D:\\repo/snow_jiandao.fixed.txt"),
	);
});

test("privacy deny-list wins over broad includes", () => {
	const input: SourceInput = {
		adapter: "rime-table",
		include: ["sbxh.dict.yaml", "**/*.yaml", "**/*.txt"],
	};
	const policy: GlobalSourcePolicy = {
		deny: [
			"build/**",
			"sync/**",
			"**/*.userdb/**",
			"**/*.user.dict.yaml",
		],
		requireExplicitInclude: ["**/custom_phrase*.txt"],
	};

	assert.equal(isAllowedSourcePath("sbxh.dict.yaml", input, policy), true);
	assert.equal(isAllowedSourcePath("build/sbxh.schema.yaml", input, policy), false);
	assert.equal(isAllowedSourcePath("sync/x/sbxh.dict.yaml", input, policy), false);
	assert.equal(isAllowedSourcePath("foo.userdb/x", input, policy), false);
	assert.equal(isAllowedSourcePath("snow_pinyin.user.dict.yaml", input, policy), false);
	assert.equal(isAllowedSourcePath("custom_phrase.txt", input, policy), false);
	assert.equal(isAllowedSourcePath("../sbxh.dict.yaml", input, policy), false);
});

test("explicitly listed published phrase tables are allowed", () => {
	const input: SourceInput = {
		adapter: "custom-phrase",
		include: ["custom_phrase/custom_phrase_super_2jian.txt"],
	};
	const policy: GlobalSourcePolicy = {
		deny: ["sync/**"],
		requireExplicitInclude: ["**/custom_phrase*.txt"],
	};

	assert.equal(
		isAllowedSourcePath(
			"custom_phrase/custom_phrase_super_2jian.txt",
			input,
			policy,
		),
		true,
	);
});

test("loads the tracked manifest", () => {
	const manifest = loadManifest(
		resolve(import.meta.dirname, "../../../config/fixed-corpus-sources.yaml"),
		process.env,
	);

	assert.equal(manifest.schemaVersion, 1);
	assert.ok(manifest.sources.length >= 10);
	assert.ok(manifest.sources.some((source) => source.id === "snow-current"));
	assert.ok(manifest.sources.some((source) => source.id === "sbxh"));
	assert.ok(manifest.sources.every((source) => source.family.length > 0));
});

test("tracked policy blocks scheme-local personal dictionaries", () => {
	const manifest = loadManifest(
		resolve(import.meta.dirname, "../../../config/fixed-corpus-sources.yaml"),
		process.env,
	);
	const broadInput: SourceInput = {
		adapter: "encoder-derived",
		include: ["**/*.dict.yaml"],
	};

	assert.equal(
		isAllowedSourcePath("cn_dicts/my_user.dict.yaml", broadInput, manifest.globalPolicy),
		false,
	);
});
