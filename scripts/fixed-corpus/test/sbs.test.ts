import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { load } from "js-yaml";
import {
	pronunciationCodes,
	sbsCodes,
	type BenchmarkSchemeId,
} from "../../lib/benchmark-schemes";
import { rootPath } from "../../lib/paths";

test("21×26 声辅声三字词统一 2123，形辅与调笔均按本地语义生成全部合法前缀", () => {
	for (const [scheme, expected] of [
		["rc26-shape", ["vuf", "vufe", "vufeo", "vufeoa"]],
		["rc26-tone", ["vaf", "vafi", "vafiu", "vafiuu"]],
		["zhudao", ["vuf", "vufe", "vufeo", "vufeoa"]],
	] as const) {
		assert.deepEqual(
			sbsCodes(scheme, "输入法", ["shu1", "ru4", "fa3"]).map((v) => v.code),
			expected,
		);
		const all = new Set(
			pronunciationCodes(scheme, "输入法", ["shu1", "ru4", "fa3"]).map(
				(v) => v.code,
			),
		);
		for (const code of expected) assert.ok(all.has(code), code);
	}
});

test("21×26 声辅声四字词统一 214，二字词仅在第二键属于五辅时开放三码", () => {
	for (const [scheme, expected] of [
		["rc26-shape", ["resn", "resni", "resnia"]],
		["rc26-tone", ["risn", "risne", "risnee"]],
		["zhudao", ["rexn", "rexni", "rexnia"]],
	] as const)
		assert.deepEqual(
			sbsCodes(scheme, "人工智能", ["ren2", "gong1", "zhi4", "neng2"]).map(
				(v) => v.code,
			),
			expected,
		);
	assert.deepEqual(
		sbsCodes("rc26-shape", "不是", ["bu4", "shi4"]).map((v) => v.code),
		["buv"],
	);
	assert.deepEqual(
		sbsCodes("rc26-tone", "不是", ["bu4", "shi4"]).map((v) => v.code),
		["buv"],
	);
	assert.deepEqual(sbsCodes("zhudao", "不是", ["bu4", "shi4"]), []);
	for (const scheme of [
		"rc26-shape",
		"rc26-tone",
		"zhudao",
	] as BenchmarkSchemeId[])
		assert.deepEqual(sbsCodes(scheme, "可以", ["ke3", "yi3"]), []);
	assert.deepEqual(
		sbsCodes("oc21-shape", "输入法", ["shu1", "ru4", "fa3"]),
		[],
	);
});

test("声辅声缺辅即止，不能用单字短形补码伪造第二字第二辅", () => {
	for (const scheme of ["rc26-shape", "zhudao"] as const) {
		const codes = sbsCodes(scheme, "一一一", ["yi1", "yi1", "yi1"]);
		assert.deepEqual(
			codes.map((v) => v.code.length),
			[3, 4],
		);
	}
});

test("两套 21×26 棱镜只在内部代理中开放省略音节，真实输入仍不能输入问号", () => {
	for (const file of ["snow_shenyun_common.yaml", "snow_huandao.schema.yaml"]) {
		const doc = load(readFileSync(rootPath(file), "utf8")) as {
			speller: { alphabet?: string; algebra: { __append: string[] } };
		};
		assert.ok(doc.speller.algebra.__append.includes("abbrev/^[a-z]{2}$/?/"));
		assert.ok(!doc.speller.alphabet?.includes("?"));
	}
});

test("声辅声精确词长查询关闭长词补全，原四声母入口继续保留长词补全", () => {
	const common = load(
		readFileSync(rootPath("snow_shenyun_common.yaml"), "utf8"),
	) as {
		shenyun: { enable_word_completion: boolean };
		shenyun_sbs: { __include: string; enable_word_completion: boolean };
	};
	assert.equal(common.shenyun.enable_word_completion, true);
	assert.equal(common.shenyun_sbs.__include, "/shenyun");
	assert.equal(common.shenyun_sbs.enable_word_completion, false);
	const toned = load(
		readFileSync(rootPath("snow_huandao.schema.yaml"), "utf8"),
	) as {
		shenyun_sbs: { prism: string };
	};
	assert.equal(toned.shenyun_sbs.prism, "snow_huandao");
});
