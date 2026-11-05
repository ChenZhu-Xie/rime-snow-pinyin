const largeKeys = "bpmfdtnlgkhjqxzcsrywv";

const finalKeys: Readonly<Record<string, string>> = {
	a: "a",
	ai: "d",
	an: "j",
	ang: "h",
	ao: "c",
	e: "e",
	ei: "w",
	en: "f",
	eng: "g",
	er: "r",
	i: "i",
	ia: "x",
	ian: "m",
	iang: "l",
	iao: "n",
	ie: "p",
	in: "b",
	ing: "k",
	iong: "s",
	iu: "q",
	o: "o",
	ong: "s",
	ou: "z",
	u: "u",
	ua: "x",
	uai: "k",
	uan: "r",
	uang: "l",
	ue: "t",
	ui: "v",
	un: "y",
	uo: "o",
	v: "v",
	ve: "t",
};

function stripTone(syllable: string): string {
	return syllable.toLowerCase().replaceAll("ü", "v").replace(/\d+$/u, "");
}

/** 声笔小鹤沿用 z/c/s 声母，只使用小鹤的韵母键位；零声母统一用 v。 */
export function sbxhSoundCode(syllable: string): string | null {
	const plain = stripTone(syllable);
	if (!plain) return null;
	let initial = "";
	let final = plain;
	for (const candidate of ["zh", "ch", "sh"]) {
		if (!plain.startsWith(candidate)) continue;
		initial = candidate[0];
		final = plain.slice(2);
		break;
	}
	if (!initial && largeKeys.includes(plain[0])) {
		initial = plain[0];
		final = plain.slice(1);
	}
	if (!initial) initial = "v";
	const finalKey = finalKeys[final];
	return finalKey ? `${initial}${finalKey}` : null;
}

/** 对应 sbxh.dict.yaml 的 AaAbBaBb / AaBaCaCb / AaBaCaZa 组词规则。 */
export function sbxhWordCode(soundCodes: readonly string[]): string | null {
	if (soundCodes.some((code) => code.length !== 2)) return null;
	if (soundCodes.length === 1) return soundCodes[0];
	if (soundCodes.length === 2) return soundCodes.join("");
	if (soundCodes.length === 3)
		return `${soundCodes[0][0]}${soundCodes[1][0]}${soundCodes[2]}`;
	if (soundCodes.length >= 4)
		return `${soundCodes[0][0]}${soundCodes[1][0]}${soundCodes[2][0]}${soundCodes.at(-1)?.[0]}`;
	return null;
}

/**
 * 自动码长翻译器的笔画补码：单字从第三笔继续，二字词取首字前两笔与末字前四笔，
 * 三字及以上取前三字各前两笔。这里不能套用 schema 中的 max_code_length: 6；
 * Lua 翻译器会继续接收这些补码。
 */
export function sbxhSupplementalStrokes(
	characterStrokes: readonly string[],
): string {
	if (characterStrokes.length === 1) return characterStrokes[0].slice(2);
	if (characterStrokes.length === 2)
		return characterStrokes[0].slice(0, 2) + characterStrokes[1].slice(0, 4);
	return characterStrokes
		.slice(0, 3)
		.map((strokes) => strokes.slice(0, 2))
		.join("");
}

/** 按实际 Lua 合同枚举从四码主码到完整笔画补码的每一级标准码。 */
export function sbxhStandardCodes(
	soundCodes: readonly string[],
	characterStrokes: readonly string[],
): string[] {
	const main = sbxhWordCode(soundCodes);
	if (!main) return [];
	const firstCharacterStrokes = characterStrokes[0] ?? "";
	const base =
		soundCodes.length === 1 ? main + firstCharacterStrokes.slice(0, 2) : main;
	if (base.length !== 4) return [];
	const result = [base];
	for (const stroke of sbxhSupplementalStrokes(characterStrokes))
		result.push(result.at(-1) + stroke);
	return result;
}

/** 下一声母能顶屏的合同来自 table_popping、basic_popping 与 zrxh_popping。 */
export function sbxhIsPoppable(code: string): boolean {
	if (/[^a-z0-9]$/u.test(code)) return true;
	if (/^[bpmfdtnlgkhjqxzcsrywv][a-z][aeiou]+$/u.test(code)) return true;
	return /^[bpmfdtnlgkhjqxzcsrywv][a-z][bpmfdtnlgkhjqxzcsrywv][a-z][aeiou]*$/u.test(
		code,
	);
}
