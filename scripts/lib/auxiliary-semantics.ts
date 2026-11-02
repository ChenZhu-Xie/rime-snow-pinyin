import { readFileSync } from "node:fs";
import { rootPath } from "./paths";

export const SHAPE_MEANINGS = ["折", "横", "撇", "竖", "点"] as const;
export const TONES = ["一", "二", "三", "四", "轻"] as const;
export const STROKES = ["横", "竖", "撇", "点", "折"] as const;
export const TONE_DIGITS_BY_SHAPE_MEANING = "42310";

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

function characters(value: string, label: string): string[] {
	const keys = [...value.toLowerCase()];
	if (keys.length !== 5 || new Set(keys).size !== 5) {
		throw new Error(`${label} 必须恰好包含五个互异按键：${value}`);
	}
	return keys;
}

export function deriveAuxiliarySemantics(
	capacity: AuxiliarySemantics["capacity"],
	shapeKeysByMeaning: string,
	toneKeysByTone: string,
): AuxiliarySemantics {
	const shapeKeys = characters(shapeKeysByMeaning, "shapeKeysByMeaning");
	const toneKeys = characters(toneKeysByTone, "toneKeysByTone");
	const toneDigitsByShapeMeaning = shapeKeys
		.map((key) => {
			const index = toneKeys.indexOf(key);
			if (index < 0)
				throw new Error(`${capacity} 的形辅键与调辅键不是同一键集。`);
			return index === 4 ? "0" : String(index + 1);
		})
		.join("");
	if (toneDigitsByShapeMeaning !== TONE_DIGITS_BY_SHAPE_MEANING) {
		throw new Error(
			`${capacity} 按折横撇竖点观察声调应为 ${TONE_DIGITS_BY_SHAPE_MEANING}，实际为 ${toneDigitsByShapeMeaning}。`,
		);
	}
	// shapeKeysByMeaning 为折横撇竖点；笔画输入顺序为横竖撇点折。
	const strokeKeysByStroke = [1, 3, 2, 4, 0]
		.map((index) => shapeKeys[index])
		.join("");
	return {
		capacity,
		shapeKeysByMeaning: shapeKeys.join(""),
		toneKeysByTone: toneKeys.join(""),
		strokeKeysByStroke,
		toneDigitsByShapeMeaning,
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
