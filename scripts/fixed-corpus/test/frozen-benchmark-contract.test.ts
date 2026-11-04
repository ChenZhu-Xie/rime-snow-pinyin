import assert from "node:assert/strict";
import test from "node:test";
import {
	assertFrozenBenchmarkContract,
	FROZEN_BENCHMARK_CONTRACT,
} from "../../lib/frozen-benchmark-contract";

const validContent = `${FROZEN_BENCHMARK_CONTRACT}
空白用户词典
关闭调频
逐标准码首选截断`;

test("拒绝没有审计契约的旧冻结回放", () => {
	assert.throws(
		() => assertFrozenBenchmarkContract("旧回放", "外部轨.txt"),
		/外部轨\.txt.*snow-benchmark-frozen-v2/u,
	);
});

test("接受声明全部现行 benchmark 前提的冻结回放", () => {
	assert.doesNotThrow(() =>
		assertFrozenBenchmarkContract(validContent, "外部轨.txt"),
	);
});

for (const marker of ["空白用户词典", "关闭调频", "逐标准码首选截断"]) {
	test(`缺少“${marker}”时冻结回放失效`, () => {
		assert.throws(
			() =>
				assertFrozenBenchmarkContract(
					validContent.replace(marker, ""),
					"外部轨.txt",
				),
			new RegExp(marker, "u"),
		);
	});
}
