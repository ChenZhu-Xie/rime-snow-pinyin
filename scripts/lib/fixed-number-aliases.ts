import { SpellingAlgebra } from "./algebra";

export const numeralReadings = [
	["零", "ling2"],
	["一", "yi1"],
	["二", "er4"],
	["三", "san1"],
	["四", "si4"],
	["五", "wu3"],
	["六", "liu4"],
	["七", "qi1"],
	["八", "ba1"],
	["九", "jiu3"],
	["十", "shi2"],
] as const;

// 只添加数字别名；已有汉字首选和字母第 2／3 位不变。
export function addNumberAliases(
	source: string,
	algebra: SpellingAlgebra,
	auxiliary: "shape" | "tone",
	shapeCodes: ReadonlyMap<string, string>,
	shapeKeyMap: ReadonlyMap<string, string>,
	toneKeys: string,
) {
	const lines = source.trimEnd().split("\n");
	const rows = new Map<string, { index: number; words: string[] }>();
	for (const [index, line] of lines.entries()) {
		if (line.startsWith("#") || !line.includes("\t")) continue;
		const [code, text] = line.split("\t");
		rows.set(code, {
			index,
			words: text.split(" ").filter((w) => !/^\d+$/u.test(w)),
		});
	}
	const codes: string[] = [];
	for (const [digit, [han, pinyin]] of numeralReadings.entries()) {
		const main = algebra.apply(pinyin).slice(0, 2);
		const existing = [...rows]
			.filter(
				([code, row]) =>
					code.length <= 3 &&
					row.words.includes(han) &&
					main.startsWith(code.slice(0, 2)),
			)
			.sort(([a], [b]) => a.length - b.length || a.localeCompare(b))[0];
		const firstShape = shapeCodes.get(han)?.[0];
		const suffix =
			auxiliary === "shape"
				? shapeKeyMap.get(firstShape ?? "")
				: toneKeys[Number(pinyin.at(-1)) - 1];
		if (!main || !suffix) throw new Error(`数字 ${digit} 缺少合法主码或辅码`);
		const code = existing?.[0] ?? main + suffix;
		const row = rows.get(code);
		if (row) row.words.push(String(digit));
		else rows.set(code, { index: -1, words: [han, String(digit)] });
		codes.push(code);
	}
	const added: string[] = [];
	for (const [code, { index, words }] of rows) {
		const line = `${code}\t${words.join(" ")}`;
		if (index < 0) added.push(line);
		else lines[index] = line;
	}
	if (added.length) {
		const beforeLetters = lines.indexOf("# 字母");
		lines.splice(
			beforeLetters < 0 ? lines.length : beforeLetters,
			0,
			"# 数字",
			...added,
		);
	}
	return { content: `${lines.join("\n")}\n`, codes };
}
