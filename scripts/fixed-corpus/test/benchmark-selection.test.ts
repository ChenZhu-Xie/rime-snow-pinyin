import assert from "node:assert/strict";
import test from "node:test";
import {
	candidateSelection,
	snowSelectionReplay,
} from "../../lib/benchmark-selection";
import { countBenchmarkKeys } from "../../lib/benchmark-key-counts";
import { optimizeBenchmarkLine } from "../../lib/benchmark-paths";

test("六候选页在 6/7/12/13 边界计翻页，首选不加确认键", () => {
	assert.equal(candidateSelection(1, 6).keys, 0);
	for (const [rank, pages, keys] of [
		[6, 0, 1],
		[7, 1, 2],
		[12, 1, 2],
		[13, 2, 3],
		[23, 3, 4],
	]) {
		assert.equal(candidateSelection(rank, 6).pages, pages);
		const counts = countBenchmarkKeys(["ye" + snowSelectionReplay(rank)]);
		assert.equal(counts.keys, 2 + keys);
		assert.equal(counts.frequencies.PageDown ?? 0, pages);
		assert.equal(counts.selections, 1);
	}
	assert.throws(() => candidateSelection(0, 6));
});

test("最优切分在同为选重时比较含翻页成本，无选重仍优先", () => {
	const make = (code: string, rank: number) => ({
		word: "玥",
		rawCode: code,
		displayCode: code + snowSelectionReplay(rank),
		keyCost: code.length + candidateSelection(rank, 6).keys,
		instant: true,
		popppable: false,
		source: "普通码",
		shift: 0,
		selectionCount: Number(rank > 1),
	});
	const options = [make("ye", 23), make("wye", 2)];
	assert.equal(optimizeBenchmarkLine("玥", new Map([["玥", options]])).keys, 4);
	options.push(make("longcode", 1));
	const result = optimizeBenchmarkLine("玥", new Map([["玥", options]]));
	assert.equal(result.selectionCount, 0);
	assert.equal(result.keys, 8);
});
