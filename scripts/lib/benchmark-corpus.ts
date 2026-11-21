/** 枚举连续汉字子串；不针对特定词人工指定切分或排除合法长词。 */
export function benchmarkTargetWords(lines: readonly string[]): Set<string> {
	const words = new Set<string>();
	for (const line of lines) {
		const characters = [...line];
		for (let start = 0; start < characters.length; start++) {
			for (
				let length = 1;
				length <= 12 && start + length <= characters.length;
				length++
			) {
				const word = characters.slice(start, start + length).join("");
				if (!/^\p{Script=Han}+$/u.test(word)) break;
				words.add(word);
			}
		}
	}
	return words;
}
