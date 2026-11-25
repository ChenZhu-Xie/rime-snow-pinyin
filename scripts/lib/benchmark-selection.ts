/** 候选序号从 1 开始；首选确认由调用方处理，后续候选计翻页及选择。 */
export function candidateSelection(rank: number, pageSize: number) {
	if (
		!Number.isInteger(rank) ||
		rank < 1 ||
		!Number.isInteger(pageSize) ||
		pageSize < 1
	)
		throw new Error("候选序号及每页数量必须为正整数");
	const pages = Math.floor((rank - 1) / pageSize);
	return {
		pages,
		slot: ((rank - 1) % pageSize) + 1,
		keys: rank === 1 ? 0 : pages + 1,
	};
}

/** 冰雪六候选页；页内首项以 Space 选择，其余使用方案选重键。 */
export function snowSelectionReplay(rank: number) {
	const { pages, slot } = candidateSelection(rank, 6);
	if (rank === 1) return "";
	const key = ["Space", "2", "3", "8", "9", "0"][slot - 1];
	return "{PageDown}".repeat(pages) + `[${key}]`;
}
