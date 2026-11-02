import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { rootPath } from "./paths";

export const SHAPE_MEANINGS = ["折", "横", "撇", "竖", "点"] as const;
export const TONES = ["一", "二", "三", "四", "轻"] as const;
export const STROKES = ["横", "竖", "撇", "点", "折"] as const;

const require = createRequire(import.meta.url);
const { auxiliarySemantics, strokeKeysFromToneKeys } =
	require("../research/auxiliary_semantics.js") as {
		auxiliarySemantics: (toneKeysByTone: string) => {
			shapeKeysByMeaning: string;
			toneKeysByTone: string;
			toneDigitsByShapeMeaning: string;
		};
		strokeKeysFromToneKeys: (toneKeysByTone: string) => string;
	};

export interface AuxiliarySemantics {
	capacity: "21x21" | "21x26";
	shapeKeysByMeaning: string;
	toneKeysByTone: string;
	strokeKeysByStroke: string;
	toneDigitsByShapeMeaning: string;
}

interface MappingSource {
	capacity: [number, number];
	shapeKeysByMeaning: string;
	toneKeysByTone: string;
}

export function deriveAuxiliarySemantics(
	capacity: AuxiliarySemantics["capacity"],
	shapeKeysByMeaning: string,
	toneKeysByTone: string,
): AuxiliarySemantics {
	const sourceShapeKeys = shapeKeysByMeaning.toUpperCase();
	const sourceToneKeys = toneKeysByTone.toUpperCase();
	const semantics = auxiliarySemantics(sourceToneKeys);
	if (semantics.shapeKeysByMeaning !== sourceShapeKeys) {
		throw new Error(
			`${capacity} 的 shapeKeysByMeaning 应由 toneKeysByTone 程序推导为 ${semantics.shapeKeysByMeaning}，实际为 ${sourceShapeKeys}。`,
		);
	}
	return {
		capacity,
		shapeKeysByMeaning: semantics.shapeKeysByMeaning.toLowerCase(),
		toneKeysByTone: semantics.toneKeysByTone.toLowerCase(),
		strokeKeysByStroke: strokeKeysFromToneKeys(sourceToneKeys).toLowerCase(),
		toneDigitsByShapeMeaning: semantics.toneDigitsByShapeMeaning,
	};
}

export function loadAuxiliarySemantics(
	capacity: AuxiliarySemantics["capacity"],
): AuxiliarySemantics {
	const filename = `shenyun-${capacity}-mapping.json`;
	const source = JSON.parse(
		readFileSync(rootPath("config", filename), "utf8"),
	) as MappingSource;
	if (source.capacity.join("x") !== capacity) {
		throw new Error(`${filename} 的 capacity 与文件名不一致。`);
	}
	return deriveAuxiliarySemantics(
		capacity,
		source.shapeKeysByMeaning,
		source.toneKeysByTone,
	);
}

export function keysByDigits(keys: string): Readonly<Record<string, string>> {
	return Object.fromEntries(
		[...keys].map((key, index) => [String(index + 1), key]),
	);
}
