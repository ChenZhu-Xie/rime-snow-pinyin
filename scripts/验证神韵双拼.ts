import { createHash } from "crypto";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { gunzipSync } from "zlib";
import { SpellingAlgebra, 获取大字集拼音 } from "./utils";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(scriptDirectory, "..", "snow_sanpin.schema.yaml");
const schemaSource = readFileSync(schemaPath, "utf8");
if (!schemaSource.includes("erase/^(hng|m|n|ng|ê)\\d$/")) {
	throw new Error("神韵双拼缺少 5 个未编码扩展音节的 erase 规则。");
}
const algebra = new SpellingAlgebra(schemaPath, "sanpin_algebra");

const initialMap: Record<string, string> = {
	b: "b",
	p: "p",
	m: "m",
	f: "f",
	d: "d",
	t: "t",
	n: "n",
	l: "l",
	g: "g",
	k: "k",
	h: "h",
	j: "j",
	q: "q",
	x: "x",
	zh: "e",
	ch: "w",
	sh: "y",
	r: "r",
	z: "z",
	c: "c",
	s: "s",
};

const finalMap: Record<string, string> = {
	a: "n",
	ai: "h",
	an: "j",
	ang: "q",
	ao: "y",
	e: "s",
	ei: "e",
	en: "z",
	eng: "r",
	er: "e",
	i: "p",
	ia: "s",
	ian: "g",
	iang: "f",
	iao: "c",
	ie: "b",
	in: "d",
	ing: "k",
	iong: "y",
	iu: "x",
	o: "w",
	ong: "w",
	ou: "x",
	u: "l",
	ua: "g",
	uai: "b",
	uan: "m",
	uang: "k",
	ue: "h",
	ui: "f",
	un: "t",
	uo: "d",
	v: "m",
	ve: "t",
};

const zeroCodes: Record<string, string> = {
	a: "qn",
	ai: "qh",
	an: "qj",
	ang: "qq",
	ao: "qy",
	e: "qs",
	ei: "qe",
	en: "qz",
	eng: "qr",
	er: "qe",
	o: "qw",
	ou: "qx",
	ya: "fn",
	yan: "fj",
	yang: "fq",
	yao: "fy",
	ye: "fs",
	yi: "fp",
	yin: "fd",
	ying: "fk",
	yo: "fw",
	yong: "fw",
	you: "fx",
	yu: "fl",
	yuan: "fm",
	yue: "fh",
	yun: "ft",
	wa: "jn",
	wai: "jh",
	wan: "jj",
	wang: "jq",
	wei: "je",
	wen: "jz",
	weng: "jr",
	wo: "jw",
	wu: "jl",
};

const cases = new Map<string, string>();
for (const [initial, key] of Object.entries(initialMap)) {
	cases.set(`${initial}a1`, `${key}ni`);
}
for (const [final, key] of Object.entries(finalMap)) {
	if (final === "v") cases.set("lv1", `l${key}i`);
	else if (final === "ve") cases.set("lve1", `l${key}i`);
	else cases.set(`b${final}1`, `b${key}i`);
}
for (const [syllable, code] of Object.entries(zeroCodes)) {
	cases.set(`${syllable}1`, `${code}i`);
}

const failures: string[] = [];
for (const [pinyin, expected] of cases) {
	const actual = algebra.apply(pinyin);
	if (actual !== expected) failures.push(`${pinyin}: ${actual} != ${expected}`);
}

if (failures.length > 0) {
	throw new Error(`神韵双拼映射校验失败：\n${failures.join("\n")}`);
}

console.log(`神韵双拼映射校验通过：${cases.size} 个规则覆盖用例。`);

const pronunciationMap = new Map<string, string[][]>();
for (const dictionary of [
	"snow_pinyin.dict.yaml",
	"snow_pinyin.base.dict.yaml",
	"snow_pinyin.ext.dict.yaml",
	"snow_pinyin.tencent.dict.yaml",
	"snow_pinyin.user.dict.yaml",
]) {
	for (const line of readFileSync(
		join(scriptDirectory, "..", dictionary),
		"utf8",
	).split(/\r?\n/)) {
		if (!line.includes("\t") || line.startsWith("#")) continue;
		const [word, pinyin] = line.split("\t");
		if (!word || !pinyin) continue;
		const values = pronunciationMap.get(word) ?? [];
		if (!values.some((value) => value.join(" ") === pinyin))
			values.push(pinyin.split(" "));
		pronunciationMap.set(word, values);
	}
}
for (const { 汉字, 拼音 } of 获取大字集拼音()) {
	const values = pronunciationMap.get(汉字) ?? [];
	if (!values.some((value) => value[0] === 拼音)) values.push([拼音]);
	pronunciationMap.set(汉字, values);
}

const unencodedSyllables = new Set(["hng", "m", "n", "ng", "ê"]);
const getSoundCode = (syllable: string) => {
	if (unencodedSyllables.has(syllable.replace(/[1-5]$/, ""))) return null;
	return algebra.apply(syllable).slice(0, -1);
};

function fixedCodeMatches(
	file: string,
	section: string,
	code: string,
	pinyin: string[],
) {
	const sounds = pinyin.map(getSoundCode);
	if (sounds.some((sound) => !sound)) return false;
	if (section === "# 二简词") {
		return sounds.length >= 2 && sounds[0]![0] + sounds[1]![0] === code;
	}
	if (section === "# 630") {
		return sounds[0]![0] === code[0];
	}
	if (section === "# 单字") {
		return code.length === 1
			? sounds[0]![0] === code
			: sounds[0] === code.slice(0, 2);
	}
	return false;
}

for (const file of ["snow_sanpin.fixed.txt", "snow_jiandao.fixed.txt"]) {
	let section = "";
	let checkedCodes = 0;
	let checkedWords = 0;
	const seen = new Set<string>();
	const fixedFailures: string[] = [];
	for (const line of readFileSync(
		join(scriptDirectory, "..", file),
		"utf8",
	).split(/\r?\n/)) {
		if (!line) continue;
		if (line.startsWith("#")) {
			section = line;
			continue;
		}
		const [code, wordsText] = line.split("\t");
		if (!code || !wordsText || !section) {
			fixedFailures.push(`无法解析：${line}`);
			continue;
		}
		if (seen.has(code))
			fixedFailures.push(`扁平固顶码表存在全局重复码：${code}`);
		seen.add(code);
		for (const word of wordsText.split(" ")) {
			const pronunciations = pronunciationMap.get(word) ?? [];
			if (
				!pronunciations.some((pinyin) =>
					["# 二简词", "# 630", "# 单字"].some((candidateSection) =>
						fixedCodeMatches(file, candidateSection, code, pinyin),
					),
				)
			) {
				fixedFailures.push(`${section} ${code}→${word} 与现行神韵编码不一致`);
			}
			checkedWords += 1;
		}
		checkedCodes += 1;
	}
	if (fixedFailures.length > 0) {
		throw new Error(`${file} 批量核验失败：\n${fixedFailures.join("\n")}`);
	}
	console.log(
		`${file} 批量核验通过：${checkedCodes} 个全局唯一码位、${checkedWords} 个固顶候选。`,
	);
}

const fixture = JSON.parse(
	readFileSync(
		join(scriptDirectory, "..", "docs", "shenyun-v1-mapping.json"),
		"utf8",
	),
) as {
	scheme: string;
	mappingSha256: string;
	codes: Record<string, string | null>;
};
const fixtureHash = createHash("sha256")
	.update(JSON.stringify(fixture.codes))
	.digest("hex");
if (
	fixture.scheme !== "NF3-21X21-M40-44" ||
	fixtureHash !== fixture.mappingSha256
) {
	throw new Error("神韵映射快照的方案标识或 SHA256 不一致。");
}
const fixtureFailures: string[] = [];
for (const [syllable, code] of Object.entries(fixture.codes)) {
	const actual =
		code === null && unencodedSyllables.has(syllable)
			? null
			: algebra.apply(`${syllable}1`).slice(0, -1);
	if (actual !== code)
		fixtureFailures.push(`${syllable}: ${actual ?? "∅"} != ${code ?? "∅"}`);
}
if (fixtureFailures.length > 0) {
	throw new Error(`冻结映射快照核验失败：\n${fixtureFailures.join("\n")}`);
}
console.log(
	`冻结映射快照核验通过：${Object.keys(fixture.codes).length}/421 音节，SHA256 ${fixtureHash}。`,
);

const benchmarkPath = process.argv[2];
if (benchmarkPath) {
	const html = readFileSync(benchmarkPath, "utf8");
	const payloadMatch = html.match(
		/<script id="payload"[^>]*>([\s\S]*?)<\/script>/,
	);
	if (!payloadMatch) throw new Error("Benchmark HTML 中未找到压缩 payload。");
	const payload = JSON.parse(
		gunzipSync(Buffer.from(payloadMatch[1].trim(), "base64")).toString("utf8"),
	) as {
		pinyin: string[];
		entries: Array<{ id: string; codeList: Array<string | null> }>;
	};
	const target = payload.entries.find(
		(entry) => entry.id === "NF3-21X21-M40-44",
	);
	if (!target) throw new Error("Benchmark payload 中未找到 NF3-21X21-M40-44。");

	const sourceFailures: string[] = [];
	const unencoded = new Set(["hng", "m", "n", "ng", "ê"]);
	for (const [index, syllable] of payload.pinyin.entries()) {
		const actual = unencoded.has(syllable) ? "" : algebra.apply(`${syllable}1`);
		const expected = target.codeList[index]
			? `${target.codeList[index]!.toLowerCase()}i`
			: "";
		const fixtureCode = fixture.codes[syllable];
		if ((target.codeList[index]?.toLowerCase() ?? null) !== fixtureCode) {
			sourceFailures.push(`${syllable}: HTML 与冻结映射快照不一致`);
		}
		if (actual !== expected) {
			sourceFailures.push(
				`${syllable}: ${actual || "∅"} != ${expected || "∅"}`,
			);
		}
	}
	if (sourceFailures.length > 0) {
		throw new Error(
			`Benchmark 421 音节逐项校验失败：\n${sourceFailures.join("\n")}`,
		);
	}
	console.log("Benchmark 逐项校验通过：421/421 音节与目标 payload 一致。");
}
