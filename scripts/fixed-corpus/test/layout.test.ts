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
		readFileSync(
			resolve(repoRoot, "config/original-jiandao-algebra.yaml"),
			"utf8",
		),
		"sanpin_algebra",
	),
};

test("layout encodes representative zero initials, initials, and ju/jue", () => {
	assert.deepEqual(encodeSyllable("a1", shenyun, "canonical"), ["rp"]);
	assert.deepEqual(encodeSyllable("a1", original, "canonical"), ["xs"]);
	assert.deepEqual(encodeSyllable("zhang1", shenyun, "canonical"), ["ky"]);
	assert.deepEqual(encodeSyllable("zhang1", original, "canonical"), ["qp"]);
	assert.deepEqual(encodeSyllable("chang2", shenyun, "canonical"), ["sy"]);
	assert.deepEqual(encodeSyllable("shang4", shenyun, "canonical"), ["ly"]);
	assert.deepEqual(encodeSyllable("ju1", shenyun, "canonical"), ["jd"]);
	assert.deepEqual(encodeSyllable("jue2", original, "canonical"), ["jh"]);
});

test("QZ-e8f37a uses the audited 21x21 initial and final mapping", () => {
	assert.deepEqual(encodeSyllable("ben1", shenyun, "canonical"), ["bd"]);
	assert.deepEqual(encodeSyllable("bo1", shenyun, "canonical"), ["bg"]);
	assert.deepEqual(encodeSyllable("duan1", shenyun, "canonical"), ["de"]);
	assert.deepEqual(encodeSyllable("jun1", shenyun, "canonical"), ["jg"]);
	assert.deepEqual(encodeSyllable("yun1", shenyun, "canonical"), ["yg"]);
	assert.deepEqual(encodeSyllable("en1", shenyun, "canonical"), ["cd"]);
	assert.deepEqual(encodeSyllable("o1", shenyun, "canonical"), ["rg"]);
	assert.deepEqual(encodeSyllable("yo1", shenyun, "canonical"), ["yg"]);
});

test("original accepted mode exposes derived spellings without changing canonical", () => {
	assert.deepEqual(encodeSyllable("zhao3", original, "canonical"), ["fz"]);
	assert.deepEqual(encodeSyllable("zhao3", original, "accepted"), ["fz", "qz"]);
	assert.deepEqual(encodeSyllable("huang4", original, "accepted"), [
		"hx",
		"hm",
	]);
	assert.deepEqual(encodeSyllable("huang4", shenyun, "accepted"), ["hc"]);
});

test("two-character words use full syllable codes and four-character words use initials", () => {
	assert.deepEqual(encodeWord(["a1", "ba4"], shenyun, "canonical"), ["rpbp"]);
	assert.deepEqual(encodeWord(["a1", "ba4"], original, "canonical"), ["xsbs"]);
	assert.deepEqual(
		encodeWord(["zhong1", "hua2", "ren2", "min2"], shenyun, "canonical"),
		["khrm"],
	);
	assert.deepEqual(encodeWord(["zhao3", "huang4"], original, "accepted"), [
		"fzhx",
		"fzhm",
		"qzhx",
		"qzhm",
	]);
});

test("real severe buckets independently recompute from their source readings", () => {
	assert.deepEqual(encodeWord(["yi1", "zhi1"], shenyun, "canonical"), ["yfkf"]);
	assert.deepEqual(
		encodeWord(["zhu3", "yao4", "yuan2", "yin1"], shenyun, "canonical"),
		["kyyy"],
	);
	assert.deepEqual(encodeWord(["yi1", "zhi1"], original, "canonical"), [
		"ykfk",
	]);
});
