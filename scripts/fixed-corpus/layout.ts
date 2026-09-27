import { applyAlgebra, type AlgebraRule } from "./algebra";

export type EncodingMode = "canonical" | "accepted";

export interface LayoutDefinition {
	id: string;
	rules: AlgebraRule[];
}

function unique(values: string[]): string[] {
	return [...new Set(values)];
}

export function encodeSyllable(
	syllable: string,
	layout: LayoutDefinition,
	mode: EncodingMode,
): string[] {
	const tone = /([1-5])$/u.exec(syllable)?.[1];
	if (!tone) return [];
	const result = applyAlgebra(syllable, layout.rules);
	const mapped = mode === "canonical" ? (result.canonical ? [result.canonical] : []) : result.accepted;
	return unique(
		mapped.flatMap((code) => (/^[a-z]{2}[ivuao]$/u.test(code) ? [code.slice(0, -1)] : [])),
	);
}

function product(parts: string[][]): string[] {
	let results = [""];
	for (const variants of parts) {
		if (variants.length === 0) return [];
		results = results.flatMap((prefix) => variants.map((variant) => prefix + variant));
	}
	return unique(results);
}

export function encodeWord(
	reading: string[],
	layout: LayoutDefinition,
	mode: EncodingMode,
): string[] {
	if (reading.length !== 2 && reading.length !== 4) return [];
	const syllableCodes = reading.map((syllable) => encodeSyllable(syllable, layout, mode));
	if (reading.length === 2) return product(syllableCodes);
	return product(syllableCodes.map((codes) => unique(codes.map((code) => code[0] ?? ""))));
}
