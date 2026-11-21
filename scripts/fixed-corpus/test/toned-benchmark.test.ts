import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	ALL_BENCHMARK_SCHEMES,
	initialPairCodes,
	pronunciationCodes,
	supportsStructuralAbbreviations,
} from "../../lib/benchmark-schemes";
import { rootPath } from "../../lib/paths";

test("莲道与鹮道评测主码逐条遵循冻结的 1407 个带调音节，后置仅补形辅", () => {
	for (const [id, file] of [
		["liandao", "snow-jiandao-toned-mapping.json"],
		["zhudao", "snow-zhudao-mapping.json"],
	] as const) {
		const mapping = JSON.parse(readFileSync(rootPath("config", file), "utf8"));
		for (const [reading, main] of Object.entries(mapping.referenceTonedCodes)) {
			const codes = pronunciationCodes(id, "冰", [reading]);
			assert.equal(
				codes.find((c) => c.mainLength === 2 && c.auxiliaryLength === 0)?.code,
				main,
				`${id}/${reading}`,
			);
			assert.ok(codes.every((c) => c.mainLength === 1 || c.mainLength === 2));
		}
	}
	assert.deepEqual(
		pronunciationCodes("liandao", "测试", ["ce4", "shi4"]).map((c) => c.code),
		["cwkr", "cwkro", "cwkroa"],
	);
	assert.deepEqual(
		pronunciationCodes("zhudao", "冰雪", ["bing1", "xue3"]).map((c) => c.code),
		["bnyw", "bnywe", "bnyweo"],
	);
});

test("莲道与鹮道按各自反序取声声四辅并保留不同的三字主码", () => {
	// 方（丶一乙丿）的前两形辅 ov，法（水・土乙）的前两形辅 av；标准 21 的反序为 12。
	assert.deepEqual(
		initialPairCodes("liandao", "方法", ["fang1", "fa3"]).map((c) => c.code),
		["ff", "ffo", "ffov", "ffova", "ffovav"],
	);
	assert.ok(
		pronunciationCodes("liandao", "输入法", ["shu1", "ru4", "fa3"]).some((c) =>
			/[A-Z]/u.test(c.code),
		),
	);
	assert.ok(
		pronunciationCodes("zhudao", "输入法", ["shu1", "ru4", "fa3"]).some(
			(c) => c.code === "vrfpeu",
		),
	);
	assert.equal(supportsStructuralAbbreviations("liandao"), false);
	assert.equal(supportsStructuralAbbreviations("zhudao"), true);
	assert.equal(ALL_BENCHMARK_SCHEMES.length, 10);
	assert.ok(!ALL_BENCHMARK_SCHEMES.some((s) => s.schemaId === "snow_yipin"));
});
