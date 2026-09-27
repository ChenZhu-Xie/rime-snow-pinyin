import { load } from "js-yaml";

export interface EncoderRule {
	lengthEqual?: number;
	lengthInRange?: [number, number];
	formula: string;
}

export interface EncoderEntry {
	word: string;
}

export interface DerivedWordCodeResult {
	codes: string[];
	rule: EncoderRule | null;
	missingCharacters: string[];
	diagnostics: string[];
}

interface RawEncoderRule {
	length_equal?: number;
	length_in_range?: [number, number];
	formula?: string;
}

function dictionaryHeader(text: string): string {
	const start = text.indexOf("---");
	const end = text.indexOf("...", start + 3);
	if (start < 0) throw new Error("Rime 词典缺少 YAML 头");
	return text.slice(start + 3, end < 0 ? text.length : end);
}

export function parseEncoderRules(text: string): EncoderRule[] {
	const header = load(dictionaryHeader(text)) as {
		encoder?: { rules?: RawEncoderRule[] };
	};
	const rawRules = header.encoder?.rules ?? [];
	return rawRules.map((raw, index) => {
		if (typeof raw.formula !== "string" || raw.formula.length === 0) {
			throw new Error(`encoder.rules[${index}] 缺少 formula`);
		}
		if (raw.length_equal !== undefined) {
			return { lengthEqual: raw.length_equal, formula: raw.formula };
		}
		if (
			Array.isArray(raw.length_in_range) &&
			raw.length_in_range.length === 2 &&
			raw.length_in_range.every(Number.isInteger)
		) {
			return {
				lengthInRange: [raw.length_in_range[0], raw.length_in_range[1]],
				formula: raw.formula,
			};
		}
		throw new Error(`encoder.rules[${index}] 缺少受支持的长度条件`);
	});
}

function matchingRule(length: number, rules: EncoderRule[]): EncoderRule | null {
	return (
		rules.find((rule) => {
			if (rule.lengthEqual !== undefined) return rule.lengthEqual === length;
			if (rule.lengthInRange) {
				return length >= rule.lengthInRange[0] && length <= rule.lengthInRange[1];
			}
			return false;
		}) ?? null
	);
}

interface FormulaToken {
	characterIndex: number;
	codeIndex: number;
}

function parseFormula(formula: string, wordLength: number): FormulaToken[] {
	if (!/^(?:[A-Z][a-z])+$/u.test(formula)) {
		throw new Error(`不支持的 encoder formula：${formula}`);
	}
	const tokens: FormulaToken[] = [];
	for (let index = 0; index < formula.length; index += 2) {
		const characterToken = formula[index];
		const codeToken = formula[index + 1];
		const characterIndex = characterToken === "Z"
			? wordLength - 1
			: characterToken.charCodeAt(0) - "A".charCodeAt(0);
		const codeIndex = codeToken.charCodeAt(0) - "a".charCodeAt(0);
		if (characterIndex < 0 || characterIndex >= wordLength) {
			throw new Error(`encoder formula ${formula} 引用了词长之外的字符`);
		}
		tokens.push({ characterIndex, codeIndex });
	}
	return tokens;
}

function cartesian<T>(sets: readonly (readonly T[])[]): T[][] {
	let combinations: T[][] = [[]];
	for (const set of sets) {
		combinations = combinations.flatMap((prefix) =>
			set.map((item) => [...prefix, item]),
		);
	}
	return combinations;
}

export function deriveWordCode(
	entry: EncoderEntry,
	rules: EncoderRule[],
	charCodes: ReadonlyMap<string, readonly string[]>,
): DerivedWordCodeResult {
	const characters = Array.from(entry.word);
	const rule = matchingRule(characters.length, rules);
	if (!rule) {
		return {
			codes: [],
			rule: null,
			missingCharacters: [],
			diagnostics: [`词条“${entry.word}”没有匹配的 encoder 规则`],
		};
	}
	const tokens = parseFormula(rule.formula, characters.length);
	const referencedIndexes = [...new Set(tokens.map((token) => token.characterIndex))];
	const missingCharacters = referencedIndexes
		.filter((index) => !(charCodes.get(characters[index])?.length))
		.map((index) => characters[index]);
	if (missingCharacters.length > 0) {
		return {
			codes: [],
			rule,
			missingCharacters,
			diagnostics: [
				`词条“${entry.word}”缺少字符码：${missingCharacters.join("、")}`,
			],
		};
	}

	const codeSets = referencedIndexes.map((index) => charCodes.get(characters[index]) ?? []);
	const indexPositions = new Map(referencedIndexes.map((value, index) => [value, index]));
	const codes = cartesian(codeSets).map((combination) => {
		return tokens
			.map((token) => {
				const code = combination[indexPositions.get(token.characterIndex) ?? -1];
				const character = code?.[token.codeIndex];
				if (!character) {
					throw new Error(
						`词条“${entry.word}”的字符码不足以执行 formula ${rule.formula}`,
					);
				}
				return character;
			})
			.join("");
	});
	return {
		codes: [...new Set(codes)],
		rule,
		missingCharacters: [],
		diagnostics: [],
	};
}
