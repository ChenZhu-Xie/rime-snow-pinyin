export interface RimeCandidateQueryDriver {
	clearComposition(): void;
	processKey(keycode: number, modifier: number): void;
	readCandidates(): string[];
	takeCommit(): string;
}

/** 每键读取完整候选页，并拒绝中途上屏后只剩尾段的伪候选。 */
export function queryRimeCandidates(
	code: string,
	driver: RimeCandidateQueryDriver,
): { candidates: string[]; commit: string } {
	driver.clearComposition();
	if (driver.takeCommit() !== "")
		throw new Error(`查询前有未消费的上屏文本：${code}`);
	let result: string[] = [];
	for (const character of code) {
		driver.processKey(
			character.codePointAt(0) ?? 0,
			/[A-Z]/u.test(character) ? 1 : 0,
		);
		result = driver.readCandidates();
		const commit = driver.takeCommit();
		if (commit !== "") return { candidates: [], commit };
	}
	return { candidates: result, commit: "" };
}
