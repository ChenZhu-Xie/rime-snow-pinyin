import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SpellingAlgebra } from "../../lib/algebra";
import {
	productionCharacterCodes,
	passesUnknownShape,
	qingyunReadingCodes,
} from "../../lib/benchmark-schemes";
import { rootPath } from "../../lib/paths";

test("无部件汉字参与道系补码竞争，但英数和21×26不能借此放行", () => {
	assert.ok(passesUnknownShape("liandao", "刋"));
	assert.ok(!passesUnknownShape("liandao", "口"));
	assert.ok(!passesUnknownShape("liandao", "O"));
	assert.ok(!passesUnknownShape("rc26-shape", "刋"));
	assert.ok(!passesUnknownShape("oc21-tone", "刋"));
});

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
	const lockRoutes = productionCharacterCodes("sipin", "锁", "suo3");
	assert.ok(lockRoutes.some(({ code }) => code === "souo"));
	assert.ok(!lockRoutes.some(({ code }) => code === "souu"));
	assert.ok(
		lockRoutes.some(
			({ code, mainLength, auxiliaryLength }) =>
				code.startsWith("souo") && mainLength === 4 && auxiliaryLength > 0,
		),
	);
	assert.ok(
		productionCharacterCodes("sipin", "布", "bu4").some(
			({ code }) => code === "buao",
		),
	);
});

test("英数入口执行方案实际拼写，并保留清韵两字词的韵码", () => {
	assert.ok(
		productionCharacterCodes("oc21-shape", "i", "~i").some(
			({ code }) => code === "xl",
		),
	);
	assert.ok(
		productionCharacterCodes("oc21-tone", "i", "~i").some(
			({ code }) => code === "xlo",
		),
	);
	assert.ok(
		productionCharacterCodes("qingyun", "彐", "xue").some(
			({ code }) => code === "xe",
		),
	);
	const pair = qingyunReadingCodes(["zhe4", "xie1"], true);
	assert.ok(pair.some(({ code }) => code === "zxe"));
	assert.ok(!pair.some(({ code }) => code === "zx"));
	assert.ok(
		qingyunReadingCodes(["ke", "me", "ke", "me", "ke"]).every(
			({ code }) => code.length <= 4,
		),
	);
});

test("按首键分批不丢失单字码路或英数竞争码路", () => {
	for (const [id, text, reading] of [
		["sipin", "锁", "suo3"],
		["oc21-shape", "i", "~i"],
		["oc21-tone", "干", "gan1"],
		["qingyun", "写", "xie3"],
		["rc26-tone", "倒", "dao3"],
	] as const) {
		const all = productionCharacterCodes(id, text, reading);
		const batched = [...new Set(all.map(({ code }) => code[0]))].flatMap(
			(prefix) =>
				productionCharacterCodes(id, text, reading, prefix).filter(({ code }) =>
					code.startsWith(prefix),
				),
		);
		assert.deepEqual(
			batched.map(({ code }) => code).sort(),
			all.map(({ code }) => code).sort(),
		);
	}
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
	const text = readFileSync(rootPath("snow_hepin.fixed.txt"), "utf8");
	assert.match(text, /^wii\t一 1\r?$/mu);
	assert.match(text, /^fii\t七 7\r?$/mu);
	const shape = readFileSync(rootPath("snow_hedao.fixed.txt"), "utf8");
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
