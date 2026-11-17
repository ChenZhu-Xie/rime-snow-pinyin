export interface CharacterReadingPriority {
	word: string;
	reading: string;
	weight: number;
}

// 优先级属于「字＋读音」，不能按字汇总后继承该字首条读音的位置。
export function characterReadingPriorities(
	source: string,
): CharacterReadingPriority[] {
	return (
		source
			.trim()
			.split(/\r?\n/u)
			.map((line) => {
				const [word, reading, rawWeight] = line.split("\t");
				const weight = Number(rawWeight);
				if (!word || !reading || !Number.isFinite(weight) || weight < 0) {
					throw new Error(`无效单字读音及权重：${line}`);
				}
				return { word, reading, weight };
			})
			// 同权重保持来源顺序，不改变已有的平局选择。
			.sort((a, b) => b.weight - a.weight)
	);
}
