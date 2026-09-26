import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { SpellingAlgebra, 获取大字集拼音 } from "./utils";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const algebra = new SpellingAlgebra(
	join(root, "snow_sanpin.schema.yaml"),
	"sanpin_algebra",
);
const unencoded = new Set(["hng", "m", "n", "ng", "ê"]);
const dictionaries = [
	"snow_pinyin.dict.yaml",
	"snow_pinyin.base.dict.yaml",
	"snow_pinyin.ext.dict.yaml",
	"snow_pinyin.tencent.dict.yaml",
	"snow_pinyin.user.dict.yaml",
];

const pronunciations = new Map<string, string[][]>();
const wordWeights = new Map<string, number>();
for (const dictionary of dictionaries) {
	for (const line of readFileSync(join(root, dictionary), "utf8").split(/\r?\n/)) {
		if (!line.includes("\t") || line.startsWith("#")) continue;
		const [word, pinyin, weightText] = line.split("\t");
		if (!word || !pinyin) continue;
		const weight = Number(weightText) || 0;
		wordWeights.set(word, Math.max(wordWeights.get(word) ?? 0, weight));
		const values = pronunciations.get(word) ?? [];
		const syllables = pinyin.split(" ");
		if (!values.some((value) => value.join(" ") === pinyin)) values.push(syllables);
		pronunciations.set(word, values);
	}
}
for (const { 汉字, 拼音 } of 获取大字集拼音()) {
	const values = pronunciations.get(汉字) ?? [];
	if (!values.some((value) => value[0] === 拼音)) values.push([拼音]);
	pronunciations.set(汉字, values);
}

function firstKey(syllable: string): string {
	const code = algebra.apply(syllable);
	if (!code) throw new Error(`音节没有神韵编码：${syllable}`);
	return code[0];
}

function legacySoundCodes(rawSyllable: string): string[] {
	let syllable = rawSyllable.replace(/[1-5]$/, "");
	if (syllable === "m") return ["xm"];
	if (syllable === "n") return ["xn"];
	if (syllable === "ng") return ["xr"];
	if (syllable === "hng") return ["hr"];
	if (/^[jqxy]ue?$/.test(syllable)) syllable = syllable.replace(/ue?$/, (x) => x.replace("u", "v"));
	let initial = "";
	let final = syllable;
	const match = syllable.match(/^(zh|ch|sh|[bpmfdtnlgkhjqxzcsrwy])/);
	if (match) {
		initial = match[0];
		final = syllable.slice(initial.length);
	}

	let initials: string[];
	if (!initial && /^[aoe]/.test(syllable)) initials = ["x"];
	else if (initial === "zh") {
		if (/^(an|ang|ei|en|eng|u|un)$/.test(final)) initials = ["q"];
		else if (/^(ai|ao|e)$/.test(final)) initials = ["q", "f"];
		else initials = ["f"];
	} else if (initial === "ch") {
		if (/^(ai|an|ang|ei|en|eng|u|un)$/.test(final)) initials = ["j"];
		else if (/^(ao|e)$/.test(final)) initials = ["j", "w"];
		else initials = ["w"];
	} else if (initial === "sh") initials = ["e"];
	else initials = [initial];

	let finals: string[];
	if (final === "uang") finals = ["m", "x"];
	else if (final === "iang") finals = ["x"];
	else if (final === "iong" || final === "ong") finals = ["y"];
	else if (final === "ang") finals = ["p"];
	else if (final === "ing" || final === "uai") finals = ["g"];
	else if (final === "eng" || final === "ng") finals = ["r"];
	else if (final === "ei" || final === "un") finals = ["w"];
	else if (final === "en") finals = ["n"];
	else if (final === "uan") finals = ["t"];
	else if (final === "ian") finals = ["m"];
	else if (final === "an") finals = ["f"];
	else if (final === "iu" || final === "ua") finals = ["q"];
	else if (final === "ie" || final === "ou") finals = ["d"];
	else if (["ai", "ve", "ue"].includes(final)) finals = ["h"];
	else if (final === "iao") finals = ["c"];
	else if (final === "ao") finals = ["z"];
	else if (final === "in" || final === "ui") finals = ["b"];
	else if (["uo", "o", "v"].includes(final)) finals = ["l"];
	else if (final === "i") finals = ["k"];
	else if (final === "ia" || final === "a") finals = ["s"];
	else if (final === "er" || final === "u") finals = ["j"];
	else if (final === "e") finals = ["e"];
	else throw new Error(`无法还原旧方案音节：${rawSyllable}`);
	return initials.flatMap((first) => finals.map((second) => first + second));
}

function matchesLegacy(section: string, oldCode: string, pinyin: string[]) {
	const first = legacySoundCodes(pinyin[0]);
	if (section === "# 二简词") {
		if (pinyin.length < 2) return false;
		const second = legacySoundCodes(pinyin[1]);
		return first.some((a) => second.some((b) => a[0] + b[0] === oldCode));
	}
	if (section === "# 630") return first.some((code) => code[0] === oldCode[0]);
	if (section === "# 单字") {
		if (oldCode.length === 1) return first.some((code) => code[0] === oldCode);
		return first.includes(oldCode.slice(0, 2));
	}
	return false;
}

function matchesCurrent(section: string, code: string, pinyin: string[]) {
	if (pinyin.some((syllable) => unencoded.has(syllable.replace(/[1-5]$/, "")))) return false;
	const sounds = pinyin.map((syllable) => algebra.apply(syllable).slice(0, -1));
	if (section === "# 二简词") {
		return sounds.length >= 2 && sounds[0][0] + sounds[1][0] === code;
	}
	if (section === "# 630") return sounds[0][0] === code[0];
	if (section === "# 单字") {
		return code.length === 1 ? sounds[0][0] === code : sounds[0] === code.slice(0, 2);
	}
	return false;
}

function choosePronunciation(
	file: string,
	section: string,
	oldCode: string,
	word: string,
) {
	const values = pronunciations.get(word);
	if (!values) throw new Error(`${file} 中的“${word}”未在词典找到拼音。`);
	const matched = values.find((pinyin) => matchesCurrent(section, oldCode, pinyin))
		?? values.find((pinyin) => matchesLegacy(section, oldCode, pinyin));
	if (matched) return matched;
	return undefined;
}

function migrate(file: string) {
	const source = readFileSync(join(root, file), "utf8");
	const sections = new Map<string, Map<string, { word: string; weight: number }>>();
	const conflicts: string[] = [];
	const omissions: string[] = [];
	let section = "";
	for (const line of source.split(/\r?\n/)) {
		if (!line) continue;
		if (line.startsWith("#")) {
			section = line;
			sections.set(section, new Map());
			continue;
		}
		const [oldCode, wordsText] = line.split("\t");
		if (!oldCode || !wordsText || !sections.has(section)) {
			throw new Error(`${file} 中无法解析：${line}`);
		}
		for (const word of wordsText.split(" ")) {
			const pinyin = choosePronunciation(file, section, oldCode, word);
			if (!pinyin) {
				omissions.push(`${section} ${oldCode}: “${word}”的现有词典读音与旧码不一致`);
				continue;
			}
			if (pinyin.some((syllable) => unencoded.has(syllable.replace(/[1-5]$/, "")))) {
				omissions.push(`${section} ${oldCode}: “${word}”含目标方案未编码音节`);
				continue;
			}
			let code: string;
			if (section === "# 二简词") {
				code = firstKey(pinyin[0]) + firstKey(pinyin[1]);
			} else if (section === "# 630") {
				code = firstKey(pinyin[0]) + oldCode.slice(1);
			} else if (section === "# 单字") {
				const soundCode = algebra.apply(pinyin[0]).slice(0, -1);
				code = oldCode.length === 1 ? soundCode[0] : soundCode + oldCode.slice(2);
			} else {
				throw new Error(`${file} 中存在未知分区：${section}`);
			}
			const target = sections.get(section)!;
			const weight = wordWeights.get(word) ?? 0;
			const previous = target.get(code);
			if (!previous) target.set(code, { word, weight });
			else if (previous.word !== word) {
				if (weight > previous.weight) {
					conflicts.push(`${section} ${code}: 保留“${word}”(${weight})，舍弃“${previous.word}”(${previous.weight})`);
					target.set(code, { word, weight });
				} else {
					conflicts.push(`${section} ${code}: 保留“${previous.word}”(${previous.weight})，舍弃“${word}”(${weight})`);
				}
			}
		}
	}

	const output: string[] = [];
	for (const [heading, entries] of sections) {
		output.push(heading);
		for (const [code, entry] of [...entries].sort(([a], [b]) =>
			a < b ? -1 : a > b ? 1 : 0,
		)) {
			output.push(`${code}\t${entry.word}`);
		}
	}
	return {
		file,
		output: `${output.join("\n")}\n`,
		codes: [...sections.values()].reduce((sum, entries) => sum + entries.size, 0),
		conflicts,
		omissions,
	};
}

const results = ["snow_sanpin.fixed.txt", "snow_jiandao.fixed.txt"].map(migrate);
for (const result of results) writeFileSync(join(root, result.file), result.output, "utf8");
for (const result of results) {
	const file = result.file;
	console.log(`${file}: ${result.codes} 个重映射码位，${result.conflicts.length} 个新冲突，${result.omissions.length} 个未编码项`);
	for (const conflict of result.conflicts) console.log(`  ${conflict}`);
	for (const omission of result.omissions) console.log(`  ${omission}`);
}
