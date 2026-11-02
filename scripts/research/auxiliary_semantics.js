"use strict";

// snowshape 语料中的抽象符号按 IEUAO 槽位编码；它们不是方案实际的
// “折、横、撇、竖、点”键序。所有评测都必须经这里转换到物理键。
const SHAPE_SYMBOLS_BY_MEANING = "AEUIO";
const SNOWSHAPE_SLOT_SYMBOLS = "IEUAO";
const TONE_DIGITS_BY_SHAPE_MEANING = "42310";

function characters(value) {
	return [...String(value || "")];
}

function assertFiveDistinctKeys(keys, label) {
	const values = characters(keys);
	if (values.length !== 5 || new Set(values).size !== 5) {
		throw new Error(
			`${label} must contain exactly five distinct keys: ${JSON.stringify(keys)}`,
		);
	}
	return values;
}

function physicalShape(abstract, toneKeysByTone) {
	return characters(abstract)
		.map(
			(symbol) => toneKeysByTone[SNOWSHAPE_SLOT_SYMBOLS.indexOf(symbol)] || "",
		)
		.join("");
}

function shapeKeysFromToneKeys(toneKeysByTone) {
	assertFiveDistinctKeys(toneKeysByTone, "toneKeysByTone");
	return physicalShape(SHAPE_SYMBOLS_BY_MEANING, toneKeysByTone);
}

function toneKeysFromShapeKeys(shapeKeysByMeaning) {
	const keys = assertFiveDistinctKeys(shapeKeysByMeaning, "shapeKeysByMeaning");
	return `${keys[3]}${keys[1]}${keys[2]}${keys[0]}${keys[4]}`;
}

function toneDigitsAtShapeKeys(toneKeysByTone) {
	const tones = assertFiveDistinctKeys(toneKeysByTone, "toneKeysByTone");
	return characters(shapeKeysFromToneKeys(toneKeysByTone))
		.map((key) => {
			const index = tones.indexOf(key);
			return index === 4 ? "0" : String(index + 1);
		})
		.join("");
}

function auxiliarySemantics(toneKeysByTone) {
	const shapeKeysByMeaning = shapeKeysFromToneKeys(toneKeysByTone);
	const roundTrip = toneKeysFromShapeKeys(shapeKeysByMeaning);
	if (roundTrip !== toneKeysByTone) {
		throw new Error(
			`auxiliary semantic round trip failed: ${toneKeysByTone} -> ${shapeKeysByMeaning} -> ${roundTrip}`,
		);
	}
	const toneDigitsByShapeMeaning = toneDigitsAtShapeKeys(toneKeysByTone);
	if (toneDigitsByShapeMeaning !== TONE_DIGITS_BY_SHAPE_MEANING) {
		throw new Error(
			`auxiliary semantic invariant changed: ${toneDigitsByShapeMeaning}`,
		);
	}
	return {
		shapeKeysByMeaning,
		toneKeysByTone,
		toneDigitsByShapeMeaning,
	};
}

module.exports = {
	SHAPE_SYMBOLS_BY_MEANING,
	SNOWSHAPE_SLOT_SYMBOLS,
	TONE_DIGITS_BY_SHAPE_MEANING,
	auxiliarySemantics,
	physicalShape,
	shapeKeysFromToneKeys,
	toneDigitsAtShapeKeys,
	toneKeysFromShapeKeys,
};
