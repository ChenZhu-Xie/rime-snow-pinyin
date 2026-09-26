import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { SpellingAlgebra, 获取大字集拼音 } from "./utils";
import { readShapeCodes, wordLength } from "./固顶编译器";

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

const shapeElementKeys = new Map<string, string>();
for (const line of readFileSync(
	join(scriptDirectory, "..", "lua", "snow", "radical_jiandao.txt"),
	"utf8",
).split(/\r?\n/)) {
	const [element, code] = line.split("\t");
	if (element && code) shapeElementKeys.set(element, code);
}
const shapeCodes = readShapeCodes(
	join(scriptDirectory, "..", "snow_jiandao_chaifen.dict.yaml"),
	Object.fromEntries(shapeElementKeys),
);
const mainKeys = new Set([..."bpmfdtnlgkhjqxzcsrwye"]);
const auxiliaryKeys = new Set([..."ivuao"]);

function toneKey(syllable: string) {
	return algebra.apply(syllable).at(-1) ?? null;
}

function fixedCodeMatches(
	file: string,
	section: string,
	code: string,
	word: string,
	pinyin: string[],
) {
	const sounds = pinyin.map(getSoundCode);
	if (sounds.some((sound) => !sound)) return false;
	const firstSound = sounds[0];
	if (!firstSound) return false;
	if (section === "# 二简词") {
		const secondSound = sounds[1];
		if (!secondSound) return false;
		return (
			pinyin.length === 2 &&
			wordLength(word) === 2 &&
			firstSound[0] + secondSound[0] === code
		);
	}
	if (section === "# 630") {
		if (file === "snow_sanpin.fixed.txt") {
			if (pinyin.length < 2 || wordLength(word) !== pinyin.length) return false;
			const shortCode = firstSound[0] + toneKey(pinyin[1]);
			if (code.length === 2) return code === shortCode;
			const target = pinyin.length === 2 ? pinyin[0] : pinyin[2];
			return code === shortCode + toneKey(target);
		}
		if (pinyin.length !== 2 || wordLength(word) !== 2) return false;
		const secondCharacter = [...word][1];
		const shape = shapeCodes.get(secondCharacter);
		if (!shape) return false;
		return code === firstSound[0] + shape.slice(0, code.length - 1);
	}
	if (section === "# 单字") {
		if (pinyin.length !== 1 || wordLength(word) !== 1) return false;
		if (code.length === 1) return firstSound[0] === code;
		if (code.length === 2) return firstSound === code;
		if (file !== "snow_jiandao.fixed.txt" || code.length !== 3) return false;
		const shape = shapeCodes.get(word);
		if (!shape) return false;
		return code === firstSound + shape[0];
	}
	return false;
}

function codeBelongsToSection(file: string, section: string, code: string) {
	if (section === "# 二简词")
		return code.length === 2 && [...code].every((key) => mainKeys.has(key));
	if (section === "# 630")
		return (
			(code.length === 2 || code.length === 3) &&
			mainKeys.has(code[0]) &&
			[...code.slice(1)].every((key) => auxiliaryKeys.has(key))
		);
	if (section === "# 单字") {
		if (code.length === 1) return mainKeys.has(code);
		if (code.length === 2) return [...code].every((key) => mainKeys.has(key));
		return (
			file === "snow_jiandao.fixed.txt" &&
			code.length === 3 &&
			mainKeys.has(code[0]) &&
			mainKeys.has(code[1]) &&
			auxiliaryKeys.has(code[2])
		);
	}
	return false;
}

for (const file of ["snow_sanpin.fixed.txt", "snow_jiandao.fixed.txt"]) {
	let section = "";
	let checkedCodes = 0;
	let checkedWords = 0;
	const seen = new Set<string>();
	const entries: Array<{ section: string; code: string; word: string }> = [];
	const sectionLengths = new Map<string, number>();
	const phraseWords = new Set<string>();
	const singleWords = new Set<string>();
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
		const words = wordsText.split(" ");
		if (words.length !== 1)
			fixedFailures.push(`${section} ${code} 必须且只能有一个固顶候选`);
		if (!codeBelongsToSection(file, section, code))
			fixedFailures.push(`${section} ${code} 不属于该固顶空间`);
		sectionLengths.set(
			`${section}:${code.length}`,
			(sectionLengths.get(`${section}:${code.length}`) ?? 0) + 1,
		);
		for (const word of words) {
			const pronunciations = pronunciationMap.get(word) ?? [];
			if (
				!pronunciations.some((pinyin) =>
					fixedCodeMatches(file, section, code, word, pinyin),
				)
			) {
				fixedFailures.push(`${section} ${code}→${word} 与现行神韵编码不一致`);
			}
			const wordSet = section === "# 单字" ? singleWords : phraseWords;
			if (wordSet.has(word)) fixedFailures.push(`${section} 重复固顶“${word}”`);
			wordSet.add(word);
			entries.push({ section, code, word });
			checkedWords += 1;
		}
		checkedCodes += 1;
	}
	for (const short of entries) {
		for (const long of entries) {
			if (
				short.code !== long.code &&
				long.code.startsWith(short.code) &&
				short.word === long.word
			) {
				fixedFailures.push(
					`固顶父子码重复：${short.code}、${long.code} 均为“${short.word}”`,
				);
			}
		}
	}
	const count = (name: string, length: number) =>
		sectionLengths.get(`${name}:${length}`) ?? 0;
	if (count("# 二简词", 2) !== 64)
		fixedFailures.push(`二简应为 64，实际 ${count("# 二简词", 2)}`);
	if (count("# 630", 2) !== 105)
		fixedFailures.push(`630 二码应为 105，实际 ${count("# 630", 2)}`);
	if (file === "snow_jiandao.fixed.txt" && count("# 630", 3) !== 525) {
		fixedFailures.push(`键道 630 三码应为 525，实际 ${count("# 630", 3)}`);
	}
	if (file === "snow_sanpin.fixed.txt" && count("# 630", 3) < 500) {
		fixedFailures.push(`三拼 630 三码少于质量下限 500`);
	}
	if (count("# 单字", 1) !== 21 || count("# 单字", 2) !== 377) {
		fixedFailures.push(
			`单字空间应为 21 个一码和 377 个二码，实际 ${count("# 单字", 1)}/${count("# 单字", 2)}`,
		);
	}
	const allocatedMainPairs = entries.filter(
		(entry) =>
			entry.code.length === 2 &&
			(entry.section === "# 二简词" || entry.section === "# 单字"),
	);
	if (allocatedMainPairs.length !== 441)
		fixedFailures.push(`AA 空间未完整覆盖 441 槽`);
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
		const targetCode = target.codeList[index];
		const expected = targetCode ? `${targetCode.toLowerCase()}i` : "";
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
