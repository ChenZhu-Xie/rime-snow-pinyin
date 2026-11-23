import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SpellingAlgebra } from "../../lib/algebra";
import { pronunciationCodes } from "../../lib/benchmark-schemes";
import { rootPath } from "../../lib/paths";

const readJson = (file: string) =>
	JSON.parse(readFileSync(rootPath(file), "utf8"));

test("UED 冻结来源逐条约束 421 音节与五辅语义", () => {
	const source = readJson("docs/shenyun-ued-source.json");
	const mapping = readJson("docs/shenyun-ued-3158ce08b5bc-mapping.json");
	assert.equal(source.id, "UED-3158ce08b5bc");
	assert.equal(source.pinyin.length, 421);
	assert.equal(
		createHash("sha256").update(JSON.stringify(source.codeList)).digest("hex"),
		source.codeListSha256,
	);
	assert.deepEqual(source.auxiliarySemantics, {
		toneKeyClass: "AVUIO",
		toneKeySet: "AIOUV",
		shapeKeysByMeaning: "AVUIO",
		toneKeysByTone: "IVUAO",
		toneDigitsByShapeMeaning: "42310",
	});
	const algebra = new SpellingAlgebra(
		rootPath("snow_sanpin.schema.yaml"),
		"sanpin_algebra",
	);
	for (const [index, syllable] of source.pinyin.entries()) {
		const code = source.codeList[index];
		if (!code) continue; // 原始 Common399 之外的扩展音节由仓库完整音节检查覆盖。
		assert.equal(mapping.codes[syllable], code.toLowerCase(), syllable);
		for (const [tone, key] of [..."ivuao"].entries()) {
			assert.equal(
				algebra.apply(`${syllable}${tone + 1}`),
				code.toLowerCase() + key,
				syllable,
			);
		}
	}
});

test("当前 21×21 布局的 Common399 和扩展域碰撞分别计量", () => {
	const current = readJson("docs/shenyun-ued-3158ce08b5bc-mapping.json");
	for (const [mapping, common, extended] of [
		[current, [399, 351, 48, 90], [416, 360, 55, 81]],
	] as const) {
		for (const [codes, expected] of [
			[mapping.payloadCodes, common],
			[mapping.codes, extended],
		] as const) {
			const counts = new Map<string, number>();
			const values = Object.values(codes).filter(
				(value): value is string => typeof value === "string",
			);
			for (const code of values) counts.set(code, (counts.get(code) ?? 0) + 1);
			assert.deepEqual(
				[
					values.length,
					counts.size,
					[...counts.values()].filter((count) => count > 1).length,
					441 - counts.size,
				],
				expected,
			);
		}
	}
});

test("UED 三四字词按字位取辅，区别于原生产布局", () => {
	// 充满希望：一声、三声、一声、四声；兰拼 23 应取 ui，旧 21 会取 uu。
	assert.equal(
		pronunciationCodes("oc21-tone", "充满希望", [
			"chong1",
			"man3",
			"xi1",
			"wang4",
		]).find(
			({ mainLength, auxiliaryLength }) =>
				mainLength === 4 && auxiliaryLength === 2,
		)?.code,
		"smxwui",
	);
	// 输入法：兰道 231 取入、法、输的首形；兰拼 213 取入、输、法的调。
	assert.equal(
		pronunciationCodes("oc21-shape", "输入法", ["shu1", "ru4", "fa3"]).find(
			({ mainLength, auxiliaryLength }) =>
				mainLength === 3 && auxiliaryLength === 3,
		)?.code,
		"krfuav",
	);
	assert.equal(
		pronunciationCodes("oc21-tone", "输入法", ["shu1", "ru4", "fa3"]).find(
			({ mainLength, auxiliaryLength }) =>
				mainLength === 3 && auxiliaryLength === 3,
		)?.code,
		"krfaiu",
	);
});
