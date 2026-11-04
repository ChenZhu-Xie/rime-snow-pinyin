export const FROZEN_BENCHMARK_CONTRACT = "snow-benchmark-frozen-v2";

const requiredMarkers = [
	FROZEN_BENCHMARK_CONTRACT,
	"空白用户词典",
	"关闭调频",
	"逐标准码首选截断",
] as const;

export function assertFrozenBenchmarkContract(
	content: string,
	source: string,
): void {
	for (const marker of requiredMarkers) {
		if (content.includes(marker)) continue;
		throw new Error(`冻结 benchmark 已失效：${source} 缺少契约标记“${marker}”`);
	}
}
