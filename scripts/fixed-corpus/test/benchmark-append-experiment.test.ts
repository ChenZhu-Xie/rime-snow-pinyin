import assert from "node:assert/strict";
import test from "node:test";
import {
	appendProbeInput,
	retargetBenchmarkAppend,
} from "../../lib/benchmark-append-experiment";
import {
	optimizeBenchmarkLine,
	type BenchmarkAlternative,
} from "../../lib/benchmark-paths";

function route(word: string, code: string): BenchmarkAlternative {
	return {
		word,
		displayCode: code,
		rawCode: code,
		keyCost: code.length,
		instant: false,
		popppable: false,
		source: "普通码",
		shift: 0,
		selectionCount: 0,
	};
}

test("更换追加字时撤销旧 / 收益，保留普通「了」路径，并按新字重新切分", () => {
	const pool = new Map([
		["甲", [route("甲", "a")]],
		["了", [route("了", "l"), route("了", "/")]],
		["甲了", [route("甲了", "a/")]],
		["与", [route("与", "yu")]],
	]);
	const { alternatives, missing } = retargetBenchmarkAppend(
		pool,
		new Set(["甲", "了", "与", "甲了", "甲与"]),
		"与",
		(input) => ({ candidates: input === "a" ? ["甲"] : [], commit: "" }),
	);
	assert.equal(missing.length, 0);
	assert.equal(alternatives.get("甲了"), undefined);
	assert.deepEqual(
		alternatives.get("了")?.map((a) => a.displayCode),
		["l"],
	);
	assert.equal(optimizeBenchmarkLine("甲与", alternatives).keys, 2);
	assert.equal(optimizeBenchmarkLine("甲了", alternatives).keys, 3);
});

test("缺失前缀、提前提交和非首选不伪造追加路径，保留 Shift 与选重成本", () => {
	const base = route("甲", "⇧A[2]");
	base.keyCost = 3;
	base.shift = 1;
	base.selectionCount = 1;
	const pool = new Map([["甲", [base]]]);
	const words = new Set(["甲", "甲与", "与"]);
	const run = (prefix: Parameters<typeof retargetBenchmarkAppend>[3]) =>
		retargetBenchmarkAppend(pool, words, "与", prefix);
	assert.equal(appendProbeInput(base.displayCode), "A2");
	assert.equal(run(() => undefined).missing.length, 1);
	assert.equal(run(() => undefined).alternatives.has("甲与"), false);
	assert.equal(
		run(() => ({ candidates: [], commit: "甲" })).alternatives.has("甲与"),
		false,
	);
	assert.equal(
		run(() => ({ candidates: ["乙", "甲"], commit: "" })).alternatives.has(
			"甲与",
		),
		false,
	);
	const appended = run(() => ({
		candidates: ["甲"],
		commit: "",
	})).alternatives.get("甲与")?.[0];
	assert.equal(appended?.keyCost, 4);
	assert.equal(appended?.shift, 1);
	assert.equal(appended?.selectionCount, 1);
	assert.throws(() =>
		retargetBenchmarkAppend(pool, words, "的", () => undefined),
	);
});
