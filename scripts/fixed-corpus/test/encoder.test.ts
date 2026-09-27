import assert from "node:assert/strict";
import test from "node:test";
import { deriveWordCode, parseEncoderRules } from "../encoder";

const header = `---
name: fixture
encoder:
  rules:
    - length_equal: 2
      formula: AaAbBaBb
    - length_equal: 3
      formula: AaBaCaCb
    - length_in_range: [4, 10]
      formula: AaBaCaZa
...
甲乙
`;

test("parses Rime encoder rules from a dictionary header", () => {
	assert.deepEqual(parseEncoderRules(header), [
		{ lengthEqual: 2, formula: "AaAbBaBb" },
		{ lengthEqual: 3, formula: "AaBaCaCb" },
		{ lengthInRange: [4, 10], formula: "AaBaCaZa" },
	]);
});

test("derives two, three, and four-character formula codes", () => {
	const rules = parseEncoderRules(header);
	const charCodes = new Map([
		["甲", ["ab"]],
		["乙", ["cd"]],
		["丙", ["ef"]],
		["丁", ["gh"]],
	]);

	assert.deepEqual(deriveWordCode({ word: "甲乙" }, rules, charCodes).codes, ["abcd"]);
	assert.deepEqual(deriveWordCode({ word: "甲乙丙" }, rules, charCodes).codes, ["acef"]);
	assert.deepEqual(deriveWordCode({ word: "甲乙丙丁" }, rules, charCodes).codes, ["aceg"]);
});

test("supports the three-initial encoder formula", () => {
	const rules = [{ lengthEqual: 3, formula: "AaBaCa" }];
	const charCodes = new Map([
		["甲", ["ab"]],
		["乙", ["cd"]],
		["丙", ["ef"]],
	]);

	assert.deepEqual(deriveWordCode({ word: "甲乙丙" }, rules, charCodes).codes, ["ace"]);
});

test("reports missing character codes instead of fabricating output", () => {
	const result = deriveWordCode(
		{ word: "甲乙" },
		[{ lengthEqual: 2, formula: "AaAbBaBb" }],
		new Map([["甲", ["ab"]]]),
	);

	assert.deepEqual(result.codes, []);
	assert.deepEqual(result.missingCharacters, ["乙"]);
	assert.equal(result.diagnostics[0], "词条“甲乙”缺少字符码：乙");
});

test("expands polyphonic character code combinations deterministically", () => {
	const result = deriveWordCode(
		{ word: "甲乙" },
		[{ lengthEqual: 2, formula: "AaAbBaBb" }],
		new Map([
			["甲", ["ab", "xy"]],
			["乙", ["cd"]],
		]),
	);

	assert.deepEqual(result.codes, ["abcd", "xycd"]);
});
