import assert from "node:assert/strict";
import test from "node:test";
import { FixedReplacementIndex, generateAbbreviations } from "../../固顶替代";

test("structure abbreviations mirror the Lua processor", () => {
	const twoCharacters = new Map(
		generateAbbreviations("可爱").map(({ trigger, word }) => [trigger, word]),
	);
	assert.equal(twoCharacters.get("D"), "可爱的可爱");
	assert.equal(twoCharacters.get("J"), "可了可爱");
	assert.equal(twoCharacters.get("G"), "可个爱");
	assert.equal(twoCharacters.get("E"), "可可爱");
	assert.equal(twoCharacters.get("T"), "爱可爱");
	assert.equal(twoCharacters.get("Y"), "可爱可");
	assert.equal(twoCharacters.get("I"), "可爱爱");
	assert.equal(twoCharacters.get("A"), "可爱可爱");
	assert.equal(twoCharacters.get("O"), "可可爱爱");
	assert.equal(twoCharacters.get("W"), "可爱着可爱着");
	assert.equal(twoCharacters.get("Q"), "可爱来可爱去");

	const oneCharacter = new Map(
		generateAbbreviations("人").map(({ trigger, word }) => [trigger, word]),
	);
	assert.equal(oneCharacter.get("["), "人人");
	assert.equal(oneCharacter.get("G"), "人个");
	assert.equal(generateAbbreviations("春夏秋冬").length, 0);
});

test("suffix keys and abbreviations only replace equal-or-longer fixed codes", () => {
	const index = new FixedReplacementIndex();
	index.addFixed("f", "一");
	index.addFixed("ka", "可爱");

	assert.deepEqual(index.find("一个", 2), {
		word: "一个",
		base: "一",
		code: "fG",
		cost: 2,
		mechanism: "结构略码",
	});
	assert.equal(index.find("可爱的", 2), undefined);
	assert.deepEqual(index.find("可爱的", 3), {
		word: "可爱的",
		base: "可爱",
		code: "ka;",
		cost: 3,
		mechanism: "尾字键",
	});
	assert.deepEqual(index.find("一个的", 3), {
		word: "一个的",
		base: "一",
		code: "fG;",
		cost: 3,
		mechanism: "结构略码+尾字键",
	});
});
