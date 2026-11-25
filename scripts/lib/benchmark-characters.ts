/** CKT 冻结字频口径：先筛常用字，同频保持原行序，再取前 m 字。 */
export function benchmarkCharacters(content: string, count = 8000) {
	return content
		.split(/\r?\n/u)
		.filter((line) => line && !line.startsWith("#"))
		.map((line) => {
			const [text, frequency, pronunciation, common] = line.split("\t");
			return {
				text,
				frequency: Number(frequency),
				pronunciation,
				common: common === "1",
			};
		})
		.filter(({ common }) => common)
		.sort((a, b) => b.frequency - a.frequency)
		.slice(0, count);
}
