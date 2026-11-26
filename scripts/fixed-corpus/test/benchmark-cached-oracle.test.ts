import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { BenchmarkCachedOracle } from "../../lib/benchmark-cached-oracle";

test("未变化方案的候选缓存保持名次，缺码或不一致提交记录立即失败", () => {
	const directory = mkdtempSync(join(tmpdir(), "snow-cached-oracle-"));
	try {
		const path = join(directory, "snow_sipin.jsonl");
		writeFileSync(
			path,
			`${JSON.stringify({ code: "ab", candidates: ["乙", "甲"], commit: "" })}\n`,
		);
		const oracle = new BenchmarkCachedOracle(directory, "snow_sipin");
		assert.deepEqual(oracle.candidates("ab"), ["乙", "甲"]);
		assert.equal(oracle.cacheStats().hits, 1);
		assert.throws(() => oracle.candidates("ac"), /必须重新测量/u);
		writeFileSync(
			path,
			`${JSON.stringify({ code: "ab", candidates: ["乙"], commit: "甲" })}\n`,
		);
		assert.throws(() => new BenchmarkCachedOracle(directory, "snow_sipin"));
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
import { createHash } from "node:crypto";

test("显式开关缓存互相隔离，不回退到无开关的旧缓存", () => {
	const directory = mkdtempSync(join(tmpdir(), "snow-option-cache-"));
	try {
		writeFileSync(
			join(directory, "snow_qingyun.jsonl"),
			JSON.stringify({ code: "ab", candidates: ["旧模式"], commit: "" }) + "\n",
		);
		const options = { character: true };
		assert.throws(
			() => new BenchmarkCachedOracle(directory, "snow_qingyun", options),
		);
		const suffix = createHash("sha256")
			.update(JSON.stringify(Object.entries(options).sort()))
			.digest("hex")
			.slice(0, 16);
		writeFileSync(
			join(directory, `snow_qingyun-${suffix}.jsonl`),
			JSON.stringify({
				code: "ab",
				candidates: ["单字"],
				commit: "",
				completed: true,
			}) + "\n",
		);
		assert.deepEqual(
			new BenchmarkCachedOracle(directory, "snow_qingyun", options).candidates(
				"ab",
			),
			["单字"],
		);
		assert.deepEqual(
			new BenchmarkCachedOracle(directory, "snow_qingyun").candidates("ab"),
			["旧模式"],
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
