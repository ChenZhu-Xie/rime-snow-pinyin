import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { load } from "js-yaml";
import { SpellingAlgebra } from "../../lib/algebra";
import { loadAuxiliarySemantics } from "../../lib/auxiliary-semantics";
import {
	initialPairCodes,
	pronunciationCodes,
} from "../../lib/benchmark-schemes";
import { rootPath } from "../../lib/paths";
import { readShenyunHints } from "../../lib/shenyun-hints";

const read = (path: string) => readFileSync(rootPath(path), "utf8");
const mapping = JSON.parse(read("config/snow-zhudao-mapping.json")) as {
	id: string;
	referenceTonedCodes: Record<string, string>;
	shapeKeysByMeaning: string;
	toneKeysByTone: string;
	toneDigitsByShapeMeaning: string;
};
const algebra = new SpellingAlgebra(
	rootPath("snow_zhudao.schema.yaml"),
	"shenyun_algebra",
);
const zhudaoHints = readShenyunHints(true);
const hedaoHints = readShenyunHints();

test("冰雪竹道逐条复现冠军页面的 1407 个带调音节，保留 516 个占用桶及 30 个空桶", () => {
	assert.equal(mapping.id, "T2126-POLISHED-8832091");
	assert.equal(Object.keys(mapping.referenceTonedCodes).length, 1407);
	for (const [reading, expected] of Object.entries(mapping.referenceTonedCodes))
		assert.equal(algebra.apply(reading), expected, reading);
	assert.equal(new Set(Object.values(mapping.referenceTonedCodes)).size, 516);
	assert.equal(
		21 * 26 - new Set(Object.values(mapping.referenceTonedCodes)).size,
		30,
	);
});

test("冰雪竹道与鹤道使用同一五辅语义，声调已进入第二码", () => {
	const semantics = loadAuxiliarySemantics("21x26");
	assert.equal(
		mapping.shapeKeysByMeaning.toLowerCase(),
		semantics.shapeKeysByMeaning,
	);
	assert.equal(mapping.toneKeysByTone.toLowerCase(), semantics.toneKeysByTone);
	assert.equal(mapping.toneDigitsByShapeMeaning, "42310");
	assert.deepEqual(
		[1, 2, 3, 4, 5].map((tone) => algebra.apply(`bing${tone}`)),
		["bn", "bw", "bw", "bl", "bn"],
	);
	assert.deepEqual(
		pronunciationCodes("zhudao", "冰雪", ["bing1", "xue3"]).map((c) => c.code),
		["bnyr", "bnyro", "bnyroe"],
	);
	assert.ok(
		pronunciationCodes("zhudao", "输入法", ["shu1", "ru4", "fa3"]).some(
			(c) => c.code === "vrfyeu",
		),
	);
	assert.ok(
		pronunciationCodes("zhudao", "人工智能", [
			"ren2",
			"gong1",
			"zhi4",
			"neng2",
		]).some((c) => c.code === "rgsnea"),
	);
});

test("竹道声声空桶反序逐字取两辅至六码，非空音节和辅键第二码不回收", () => {
	const { vacant, vacantAA } = zhudaoHints;
	assert.equal(vacant.length, 24);
	assert.equal(vacantAA.length, 19);
	assert.equal(hedaoHints.vacant.length, 142);
	assert.equal(hedaoHints.vacantAA.length, 129);
	assert.deepEqual(
		initialPairCodes("zhudao", "不到", ["bu4", "dao4"]).map((c) => c.code),
		["bd", "bde", "bdea", "bdeae", "bdeaeu"],
	);
	assert.deepEqual(
		initialPairCodes("zhudao", "不到", ["bu4", "dao4"], "21").map(
			(c) => c.code,
		),
		["bd", "bde", "bdeu", "bdeue", "bdeuea"],
	);
	assert.deepEqual(initialPairCodes("zhudao", "测试", ["ce4", "shi4"]), []);
});

test("竹道字母占用桶保留汉字首选及大写第二小写第三，未挤占声声空桶", () => {
	const letters = JSON.parse(
		read("config/snow-zhudao-letter-buckets.json"),
	) as { letters: Array<{ letter: string; code: string }> };
	const fixed = new Map(
		read("snow_zhudao.fixed.txt")
			.split(/\r?\n/u)
			.filter((l) => l.includes("\t") && !l.startsWith("#"))
			.map((l) => l.split("\t") as [string, string]),
	);
	const vacant = new Set(zhudaoHints.vacant);
	assert.equal(letters.letters.length, 26);
	assert.equal(new Set(letters.letters.map((e) => e.code)).size, 26);
	for (const { letter, code } of letters.letters) {
		assert.ok(!vacant.has(code), code);
		const candidates = fixed.get(code)?.split(" ");
		assert.ok(candidates && /^\p{Script=Han}$/u.test(candidates[0]), code);
		assert.deepEqual(candidates.slice(1), [letter.toUpperCase(), letter]);
	}
});

test("竹道复用鹤道形辅路由并独立隔离棱镜、用户词典与键位图", () => {
	const schema = load(read("snow_zhudao.schema.yaml")) as Record<string, any>;
	assert.equal(schema.__include, "snow_shenyun_common.yaml:/");
	assert.equal(schema.shenyun_options.auxiliary, "shape");
	assert.equal(schema.shenyun.prism, "snow_zhudao");
	assert.equal(schema.vacancy.prism, "snow_zhudao");
	assert.equal(
		schema.patch["translator/user_dict_name"],
		"snow_zhudao_polished_8832091",
	);
	assert.equal(schema.keymap.image, "snow_zhudao.svg");
	assert.ok(read("lua/snow/keymaps/snow_zhudao.svg").includes(mapping.id));
});
