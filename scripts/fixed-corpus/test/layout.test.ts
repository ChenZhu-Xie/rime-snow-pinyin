import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { parseAlgebraRules } from "../algebra";
import { encodeSyllable, encodeWord, type LayoutDefinition } from "../layout";

const repoRoot = resolve(import.meta.dirname, "../../..");
const shenyun: LayoutDefinition = {
	id: "shenyun",
	rules: parseAlgebraRules(
		readFileSync(resolve(repoRoot, "snow_sanpin.schema.yaml"), "utf8"),
		"sanpin_algebra",
	),
};
const original: LayoutDefinition = {
	id: "original",
	rules: parseAlgebraRules(
		readFileSync(resolve(repoRoot, "config/original-jiandao-algebra.yaml"), "utf8"),
		"sanpin_algebra",
	),
};

test("layout encodes representative zero initials, initials, and ju/jue", () => {
	assert.deepEqual(encodeSyllable("a1", shenyun, "canonical"), ["qn"]);
	assert.deepEqual(encodeSyllable("a1", original, "canonical"), ["xs"]);
	assert.deepEqual(encodeSyllable("zhang1", shenyun, "canonical"), ["eq"]);
	assert.deepEqual(encodeSyllable("zhang1", original, "canonical"), ["qp"]);
	assert.deepEqual(encodeSyllable("chang2", shenyun, "canonical"), ["wq"]);
	assert.deepEqual(encodeSyllable("shang4", shenyun, "canonical"), ["yq"]);
	assert.deepEqual(encodeSyllable("ju1", shenyun, "canonical"), ["jl"]);
	assert.deepEqual(encodeSyllable("jue2", original, "canonical"), ["jh"]);
});

test("original accepted mode exposes derived spellings without changing canonical", () => {
	assert.deepEqual(encodeSyllable("zhao3", original, "canonical"), ["fz"]);
	assert.deepEqual(encodeSyllable("zhao3", original, "accepted"), ["fz", "qz"]);
	assert.deepEqual(encodeSyllable("huang4", original, "accepted"), ["hx", "hm"]);
	assert.deepEqual(encodeSyllable("huang4", shenyun, "accepted"), ["hk"]);
});

test("two-character words use full syllable codes and four-character words use initials", () => {
	assert.deepEqual(encodeWord(["a1", "ba4"], shenyun, "canonical"), ["qnbn"]);
	assert.deepEqual(encodeWord(["a1", "ba4"], original, "canonical"), ["xsbs"]);
	assert.deepEqual(
		encodeWord(["zhong1", "hua2", "ren2", "min2"], shenyun, "canonical"),
		["ehrm"],
	);
	assert.deepEqual(
		encodeWord(["zhao3", "huang4"], original, "accepted"),
		["fzhx", "fzhm", "qzhx", "qzhm"],
	);
});
