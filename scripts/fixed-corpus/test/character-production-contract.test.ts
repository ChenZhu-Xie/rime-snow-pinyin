import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SpellingAlgebra } from "../../lib/algebra";
import { rootPath } from "../../lib/paths";

test("四拼三键音节的 o 是生产补码，不能把第四键都当成笔画", () => {
	const algebra = new SpellingAlgebra(
		rootPath("snow_sipin.schema.yaml"),
		"speller/algebra",
	);
	const lock = algebra.applyAll("suo3");
	assert.ok(lock.includes("souo"));
	assert.ok(!lock.includes("souu"));
	assert.ok(algebra.applyAll("sou3").includes("souu"));
	assert.ok(algebra.applyAll("bu4").includes("buao"));
	assert.ok(!algebra.applyAll("bu4").includes("buae"));
});

test("清韵单字形码与普通拼音必须保留独立来源，不能替换成同一份字频", () => {
	const algebra = new SpellingAlgebra(
		rootPath("snow_qingyun.schema.yaml"),
		"speller/algebra",
	);
	assert.ok(algebra.applyAll("xue").includes("xe"));
	assert.ok(algebra.applyAll("xie3").includes("xe"));
	const shapes = readFileSync(rootPath("snow_qingyun.dict.yaml"), "utf8");
	assert.match(shapes, /^彐\txue\t101\r?$/mu);
	assert.match(shapes, /^写\tbao yu\t\d+\r?$/mu);
});

test("拼系也有数字别名的三码固顶，不能按方案类型丢弃", () => {
	const text = readFileSync(rootPath("snow_shenyun_tone.fixed.txt"), "utf8");
	assert.match(text, /^wii\t一 1\r?$/mu);
	assert.match(text, /^fii\t七 7\r?$/mu);
	const shape = readFileSync(rootPath("snow_shenyun_shape.fixed.txt"), "utf8");
	assert.match(shape, /^dki\t倒\r?$/mu);
	assert.match(shape, /^dku\t岛\r?$/mu);
});

test("倒的两个声调都有独立读音，不能只以最高频读音构造筛选路径", () => {
	const dictionary = readFileSync(rootPath("snow_pinyin.dict.yaml"), "utf8");
	assert.match(dictionary, /^倒\tdao4\t\d+\r?$/mu);
	assert.match(dictionary, /^倒\tdao3\t\d+\r?$/mu);
	const algebra = new SpellingAlgebra(
		rootPath("snow_shenyun_common.yaml"),
		"shenyun_algebra",
		{ derive: false },
	);
	assert.equal(algebra.apply("dao3"), "dk");
	assert.equal(algebra.apply("dao4"), "dk");
});
