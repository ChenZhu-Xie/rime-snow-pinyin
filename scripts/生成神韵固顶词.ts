import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	cumulativeEvidence,
	readEvidenceSnapshot,
} from "./fixed-corpus/evidence";
import {
	addCandidate,
	assertLayout,
	assertNoPrefixWordRepeats,
	assertOneCandidatePerCode,
	chooseCandidate,
	type Candidate,
	type FixedLayout,
	type FixedSections,
	firstKey,
	isHanWord,
	makeCandidate,
	mergeDictionaries,
	parseLegacyFixed,
	readDictionary,
	readLegacyFixed,
	readShapeCodes,
	renderFixedTable,
	sortCandidates,
	soundCode,
	toneOf,
	wordLength,
} from "./固顶编译器";
import {
	findStructuralAbbreviation,
	FixedReplacementIndex,
	type FixedReplacement,
} from "./固顶替代";
import {
	explicitlyRequestedWords,
	fullCodeAlreadyEasyWords,
	preferredEverydayWords,
	rejectedFixedWords,
} from "./固顶选优策略";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDirectory, "..");
const checkOnly = process.argv.includes("--check");
const reportSanpinArgument = process.argv.find((value) =>
	value.startsWith("--report-sanpin="),
);
const reportSanpinCodes = reportSanpinArgument
	? reportSanpinArgument.split("=")[1].split(",")
	: [];
const legacyReference = process.argv
	.find((value) => value.startsWith("--legacy-ref="))
	?.split("=", 2)[1];

interface OptimizationRejection {
	scope: string;
	code: string;
	word: string;
	replacement: FixedReplacement;
}

const optimizationRejections: OptimizationRejection[] = [];
let structuralRejectionCount = 0;
let efficientFullCodeRejectionCount = 0;
let selectableAbbreviationBases = new Set<string>();

function structuralAbbreviation(word: string) {
	return findStructuralAbbreviation(word, (base) =>
		selectableAbbreviationBases.has(base),
	);
}

interface FullCodeStanding {
	rank: number;
	siblingCount: number;
	weight: number;
	runnerUpWeight: number;
}

const fullCodeStandings = new Map<string, FullCodeStanding>();

function dictionaryEntryKey(entry: { word: string; syllables: string[] }) {
	return `${entry.word}\t${entry.syllables.join(" ")}`;
}

function everydayBonus(word: string) {
	if (explicitlyRequestedWords.has(word)) return 900_000_000;
	return preferredEverydayWords.has(word) ? 600_000_000 : 0;
}

function fullCodeDifficultyBonus(entry: {
	word: string;
	syllables: string[];
	weight: number;
}) {
	if (!preferredEverydayWords.has(entry.word)) return 0;
	const standing = fullCodeStandings.get(dictionaryEntryKey(entry));
	if (!standing || standing.rank <= 1 || entry.weight < 1_000) return 0;
	if (standing.rank === 2) return 30_000_000;
	if (standing.rank === 3) return 20_000_000;
	return 10_000_000;
}

function isEfficientAtFullCode(entry: { word: string; syllables: string[] }) {
	if (preferredEverydayWords.has(entry.word)) return false;
	if (!fullCodeAlreadyEasyWords.has(entry.word)) return false;
	const standing = fullCodeStandings.get(dictionaryEntryKey(entry));
	return Boolean(
		standing &&
			standing.rank === 1 &&
			standing.siblingCount >= 5 &&
			standing.runnerUpWeight > 0 &&
			standing.weight >= standing.runnerUpWeight * 3,
	);
}

function chooseWithoutRedundancy(
	candidates: Candidate[],
	usedWords: ReadonlySet<string>,
	code: string,
	replacements: FixedReplacementIndex,
	scope: string,
	minimumWeight = 0,
	rejectEfficientFullCode = false,
) {
	for (const candidate of sortCandidates(candidates)) {
		if (
			usedWords.has(candidate.word) ||
			rejectedFixedWords.has(candidate.word) ||
			(!candidate.legacy &&
				!preferredEverydayWords.has(candidate.word) &&
				candidate.weight < minimumWeight)
		) {
			continue;
		}
		if (
			scope === "三拼 630" &&
			code.length === 3 &&
			!candidate.legacy &&
			!preferredEverydayWords.has(candidate.word) &&
			wordLength(candidate.word) > 2
		) {
			continue;
		}
		if (structuralAbbreviation(candidate.word)) {
			structuralRejectionCount += 1;
			continue;
		}
		if (rejectEfficientFullCode && isEfficientAtFullCode(candidate)) {
			efficientFullCodeRejectionCount += 1;
			continue;
		}
		const replacement = replacements.find(candidate.word, code.length);
		if (replacement) {
			optimizationRejections.push({
				scope,
				code,
				word: candidate.word,
				replacement,
			});
			continue;
		}
		return candidate;
	}
	return undefined;
}
const evidence = readEvidenceSnapshot(
	join(root, "config", "shenyun-fixed-evidence.json"),
);

interface EvidenceSummary {
	families: string[];
	sources: string[];
	bestRank: number | null;
}

function wordEvidence(word: string, maximumCodeLength: 1 | 2 | 3) {
	return cumulativeEvidence(evidence.words[word], maximumCodeLength);
}

function evidenceBonus(summary: EvidenceSummary) {
	const rankBonus = summary.bestRank
		? Math.max(0, 4 - summary.bestRank) * 250_000
		: 0;
	return (
		summary.families.length * 8_000_000 +
		summary.sources.length * 400_000 +
		rankBonus
	);
}

function makeOptimizedCandidate(
	entry: Parameters<typeof makeCandidate>[0],
	legacy: boolean,
	maximumEvidenceCodeLength: 1 | 2 | 3,
	bonus = 0,
	legacyBonus = 0,
) {
	const candidate = makeCandidate(
		entry,
		new Set<string>(),
		bonus +
			evidenceBonus(wordEvidence(entry.word, maximumEvidenceCodeLength)) +
			(legacy ? legacyBonus : 0),
	);
	candidate.legacy = legacy;
	return candidate;
}

const fixture = JSON.parse(
	readFileSync(join(root, "docs", "shenyun-v1-mapping.json"), "utf8"),
) as {
	scheme: string;
	codes: Record<string, string | null>;
};

const shapeElementKeys = new Map<string, string>();
for (const line of readFileSync(
	join(root, "lua", "snow", "radical_jiandao.txt"),
	"utf8",
).split(/\r?\n/)) {
	const [element, code] = line.split("\t");
	if (element && code) shapeElementKeys.set(element, code);
}

const layout: FixedLayout = {
	id: fixture.scheme,
	mainKeys: [..."bpmfdtnlgkhjqxzcsrwye"],
	auxiliaryKeys: [..."ivuao"],
	toneKeys: { "1": "i", "2": "v", "3": "u", "4": "a", "5": "o" },
	syllableCodes: Object.fromEntries(
		Object.entries(fixture.codes).map(([syllable, code]) => [
			syllable,
			code?.toLowerCase() ?? null,
		]),
	),
	shapeElementKeys: Object.fromEntries(shapeElementKeys),
};
assertLayout(layout);

// 一码只保留一个冠军。未发生语义变化的原版习惯优先保留；发生首键合并的
// j/f/q 与新出现的 w/x 则按独立使用频率和下级可达性重新决胜。
const seedOneKeyWords = new Map<string, string>([
	["b", "不"],
	["c", "才"],
	["d", "的"],
	["e", "这"],
	["f", "一"],
	["g", "个"],
	["h", "和"],
	["j", "我"],
	["k", "可"],
	["l", "了"],
	["m", "没"],
	["n", "你"],
	["p", "平"],
	["q", "去"],
	["r", "人"],
	["s", "三"],
	["t", "他"],
	["w", "吃"],
	["x", "想"],
	["y", "是"],
	["z", "在"],
]);

// 53 个神韵天然音码空位，加 11 个极冷音码让位，恢复 64 个二简的完整规模。
// 每个词的两键均为两个音节在当前布局中的首键，不能通过旧码迁移得到。
const seedErjianWords = new Map<string, string>([
	["bf", "不要"],
	["bm", "部门"],
	["bs", "比赛"],
	["bt", "不同"],
	["bx", "不行"],
	["cb", "从不"],
	["cc", "从此"],
	["ce", "财政"],
	["cg", "错过"],
	["ck", "参考"],
	["cz", "存在"],
	["de", "地址"],
	["dz", "电子"],
	["ec", "注册"],
	["ee", "这种"],
	["fb", "一般"],
	["fc", "因此"],
	["ff", "方法"],
	["fg", "一个"],
	["gc", "刚才"],
	["gp", "股票"],
	["hc", "缓存"],
	["hp", "和平"],
	["kc", "库存"],
	["kp", "恐怕"],
	["lz", "来自"],
	["mf", "没有"],
	["mm", "密码"],
	["mt", "明天"],
	["pf", "朋友"],
	["pm", "排名"],
	["ps", "配送"],
	["pt", "平台"],
	["qr", "确认"],
	["rb", "日报"],
	["rc", "如此"],
	["re", "认真"],
	["rg", "如果"],
	["rh", "如何"],
	["rk", "认可"],
	["rn", "热闹"],
	["sb", "随便"],
	["sc", "三次"],
	["se", "随着"],
	["sg", "三个"],
	["sk", "思考"],
	["te", "调整"],
	["tz", "投资"],
	["wc", "尺寸"],
	["we", "成长"],
	["wg", "成功"],
	["xe", "限制"],
	["xj", "希望"],
	["xn", "性能"],
	["xq", "需求"],
	["xr", "信任"],
	["xw", "形成"],
	["xz", "现在"],
	["yc", "收藏"],
	["yw", "市场"],
	["zb", "资本"],
	["zc", "字词"],
	["zg", "字根"],
	["zk", "最快"],
]);

// 词频不能识别所有句法边界和独立使用价值。这些词条在大词库中可能有较高
// 权重，但单独固顶时不自然或不够常用；仅作精确否决，避免误伤“是的、算了”
// 等可独立使用表达。
const rejectedSanpinWords = new Set([
	"吧啊",
	"有了吗",
	"有的啊",
	"快了吧",
	"没了啊",
	"男的呢",
	"我们的心",
]);

const dictionaryFiles = [
	"snow_pinyin.dict.yaml",
	"snow_pinyin.base.dict.yaml",
	"snow_pinyin.ext.dict.yaml",
	"snow_pinyin.tencent.dict.yaml",
	"snow_pinyin.user.dict.yaml",
];
const allEntries = mergeDictionaries(
	dictionaryFiles.flatMap((file) => readDictionary(join(root, file))),
);
selectableAbbreviationBases = new Set(allEntries.map((entry) => entry.word));
const singleEntries = allEntries.filter(
	(entry) => entry.syllables.length === 1 && isHanWord(entry.word, 1, 1),
);

// “的/了”尾字键可以从已有固顶候选直接追加轻声 de/le。除单字“的/了”
// 本身外，这类词不再占用二简、630 或其他固定简码位。按读音而非字面判断，
// 因而“目的（dì）”“除了（liǎo）”等词不受影响。
function hasTailKeyReplacement(entry: { word: string; syllables: string[] }) {
	if (entry.syllables.length <= 1) return false;
	const lastCharacter = [...entry.word].at(-1);
	const lastSyllable = entry.syllables.at(-1);
	return (
		(lastCharacter === "的" && lastSyllable === "de5") ||
		(lastCharacter === "了" && lastSyllable === "le5")
	);
}

const supplementalEverydayEntries = [
	"snow_pinyin.ext.dict.yaml",
	"snow_pinyin.user.dict.yaml",
]
	.flatMap((file) => readDictionary(join(root, file)))
	.filter((entry) => preferredEverydayWords.has(entry.word));
const baseWordEntries = mergeDictionaries([
	...readDictionary(join(root, "snow_pinyin.base.dict.yaml")),
	...supplementalEverydayEntries,
]).filter((entry) => !hasTailKeyReplacement(entry));

// 用完整双音码模拟二字词的默认同码排序。排名靠后的词使用固定简码收益更高；
// 反之，像 jkjp→“经济”这样在大量同码词中又明显稳居首选的词，完整码已足够顺手。
const fullCodeGroups = new Map<string, typeof baseWordEntries>();
for (const entry of baseWordEntries) {
	if (wordLength(entry.word) !== 2 || entry.syllables.length !== 2) continue;
	const codes = entry.syllables.map((syllable) => soundCode(layout, syllable));
	if (codes.some((code) => !code)) continue;
	const code = codes.join("");
	const group = fullCodeGroups.get(code) ?? [];
	group.push(entry);
	fullCodeGroups.set(code, group);
}
for (const group of fullCodeGroups.values()) {
	group.sort(
		(a, b) => b.weight - a.weight || a.word.localeCompare(b.word, "zh-CN"),
	);
	for (const [index, entry] of group.entries()) {
		fullCodeStandings.set(dictionaryEntryKey(entry), {
			rank: index + 1,
			siblingCount: group.length,
			weight: entry.weight,
			runnerUpWeight: group[index === 0 ? 1 : 0]?.weight ?? 0,
		});
	}
}

function readLegacy(file: string) {
	if (!legacyReference) return readLegacyFixed(join(root, file));
	return parseLegacyFixed(
		execFileSync("git", ["show", `${legacyReference}:${file}`], {
			cwd: root,
			encoding: "utf8",
		}),
	);
}

const legacySanpin = readLegacy("snow_sanpin.fixed.txt");
const legacyJiandao = readLegacy("snow_jiandao.fixed.txt");

function isLegacyAtCode(
	sections: ReturnType<typeof readLegacyFixed>,
	section: string,
	code: string,
	word: string,
) {
	return sections.get(section)?.get(code)?.includes(word) ?? false;
}

function isLegacySingleAtCode(code: string, word: string) {
	return (
		isLegacyAtCode(legacySanpin, "# 单字", code, word) ||
		isLegacyAtCode(legacyJiandao, "# 单字", code, word)
	);
}

const readingsByWord = new Map<string, string[][]>();
for (const entry of allEntries) {
	const readings = readingsByWord.get(entry.word) ?? [];
	if (
		!readings.some((reading) => reading.join(" ") === entry.syllables.join(" "))
	) {
		readings.push(entry.syllables);
	}
	readingsByWord.set(entry.word, readings);
}

function assertCuratedCodes(
	oneKeyWords: ReadonlyMap<string, string>,
	erjianWords: ReadonlyMap<string, string>,
) {
	if (oneKeyWords.size !== 21) throw new Error("一码单字必须恰好为 21 个。");
	if (erjianWords.size !== 64) throw new Error("二简必须恰好为 64 个唯一码。");
	for (const [code, word] of oneKeyWords) {
		const readings = readingsByWord.get(word) ?? [];
		if (!readings.some((reading) => firstKey(layout, reading[0]) === code))
			throw new Error(`一码 ${code}→${word} 与神韵首键不一致。`);
	}
	for (const [code, word] of erjianWords) {
		const readings = readingsByWord.get(word) ?? [];
		if (
			!readings.some((reading) => {
				if (reading.length !== 2) return false;
				const first = firstKey(layout, reading[0]);
				const second = firstKey(layout, reading[1]);
				return first !== null && second !== null && first + second === code;
			})
		) {
			throw new Error(`二简 ${code}→${word} 与神韵两字首键不一致。`);
		}
	}
}
assertCuratedCodes(seedOneKeyWords, seedErjianWords);

// 只在既定空间骨架内选优：53 个天然空位和 11 个极冷音码让位保持不变，
// 因而不会为了二简牺牲“有”这类高频 AA 单字。独立方案家族共识可以击败
// 一般词频，但旧固顶享有明确的肌肉记忆成本，只有显著改进才会替换。
const oneKeyPools = new Map<string, ReturnType<typeof makeCandidate>[]>();
for (const entry of singleEntries) {
	const code = firstKey(layout, entry.syllables[0]);
	if (!code) continue;
	addCandidate(
		oneKeyPools,
		code,
		makeOptimizedCandidate(
			entry,
			seedOneKeyWords.get(code) === entry.word,
			1,
			0,
			60_000_000,
		),
	);
}
const oneKeyWords = new Map<string, string>();
const usedOneKeyWords = new Set<string>();
for (const code of layout.mainKeys) {
	const selected = chooseCandidate(
		oneKeyPools.get(code) ?? [],
		usedOneKeyWords,
	);
	if (!selected) throw new Error(`一码 ${code} 没有可用候选。`);
	oneKeyWords.set(code, selected.word);
	usedOneKeyWords.add(selected.word);
}

const erjianReplacements = new FixedReplacementIndex();
for (const [code, word] of oneKeyWords) erjianReplacements.addFixed(code, word);

const erjianPools = new Map<string, ReturnType<typeof makeCandidate>[]>();
for (const entry of baseWordEntries) {
	if (!isHanWord(entry.word, 2, 2) || entry.syllables.length !== 2) continue;
	const first = firstKey(layout, entry.syllables[0]);
	const second = firstKey(layout, entry.syllables[1]);
	if (!first || !second) continue;
	const code = first + second;
	if (!seedErjianWords.has(code)) continue;
	addCandidate(
		erjianPools,
		code,
		makeOptimizedCandidate(
			entry,
			seedErjianWords.get(code) === entry.word,
			2,
			everydayBonus(entry.word),
			20_000_000,
		),
	);
}
const erjianWords = new Map<string, string>();
const usedErjianWords = new Set<string>();
for (const code of seedErjianWords.keys()) {
	const selected = chooseWithoutRedundancy(
		erjianPools.get(code) ?? [],
		usedErjianWords,
		code,
		erjianReplacements,
		"二简",
	);
	if (!selected) throw new Error(`二简 ${code} 没有可用候选。`);
	erjianWords.set(code, selected.word);
	usedErjianWords.add(selected.word);
	erjianReplacements.addFixed(code, selected.word);
}
assertCuratedCodes(oneKeyWords, erjianWords);

const soundCodes = new Set(
	Object.values(layout.syllableCodes).filter(
		(code): code is string => code !== null,
	),
);
const occupiedErjianCodes = [...erjianWords.keys()].filter((code) =>
	soundCodes.has(code),
);
if (soundCodes.size !== 388 || occupiedErjianCodes.length !== 11) {
	throw new Error(
		`AA 空间不符合 388 音码、53 天然空位、11 冷音码让位的设计：${soundCodes.size}/${occupiedErjianCodes.length}`,
	);
}

const singlePools = new Map<string, ReturnType<typeof makeCandidate>[]>();
for (const entry of singleEntries) {
	const code = soundCode(layout, entry.syllables[0]);
	if (!code) continue;
	addCandidate(
		singlePools,
		code,
		makeOptimizedCandidate(
			entry,
			isLegacySingleAtCode(code, entry.word),
			3,
			0,
			20_000_000,
		),
	);
}

const sharedSingles = new Map(oneKeyWords);
const usedSingleWords = new Set(oneKeyWords.values());
const twoKeySoundCodes = [...soundCodes].filter(
	(code) => !erjianWords.has(code),
);
twoKeySoundCodes.sort(
	(a, b) =>
		(singlePools.get(a)?.length ?? 0) - (singlePools.get(b)?.length ?? 0) ||
		a.localeCompare(b),
);
for (const code of twoKeySoundCodes) {
	const selected = chooseCandidate(
		singlePools.get(code) ?? [],
		usedSingleWords,
	);
	if (!selected) throw new Error(`单字音码 ${code} 没有不重复的候选。`);
	sharedSingles.set(code, selected.word);
	usedSingleWords.add(selected.word);
}
if ([...sharedSingles].filter(([code]) => code.length === 2).length !== 377)
	throw new Error("AA 单字必须恰好为 377 个。");

const allMainPairs = new Set(
	layout.mainKeys.flatMap((first) =>
		layout.mainKeys.map((second) => first + second),
	),
);
const allocatedMainPairs = new Set([
	...erjianWords.keys(),
	...[...sharedSingles.keys()].filter((code) => code.length === 2),
]);
if (
	allocatedMainPairs.size !== 441 ||
	[...allMainPairs].some((code) => !allocatedMainPairs.has(code))
) {
	throw new Error("AA 的 377 单字＋64 二简没有完整覆盖 21×21 空间。");
}

function selectSixThirty(
	pools: Map<string, ReturnType<typeof makeCandidate>[]>,
	minimumThreeKeyWeight: number,
	replacements: FixedReplacementIndex,
	scope: string,
) {
	const selected = new Map<string, string>();
	const usedWords = new Set(erjianWords.values());
	for (const first of layout.mainKeys) {
		for (const second of layout.auxiliaryKeys) {
			const code = first + second;
			const candidate = chooseWithoutRedundancy(
				pools.get(code) ?? [],
				usedWords,
				code,
				replacements,
				scope,
				0,
				true,
			);
			if (!candidate) throw new Error(`630 短码 ${code} 没有可用候选。`);
			selected.set(code, candidate.word);
			usedWords.add(candidate.word);
			replacements.addFixed(code, candidate.word);
		}
	}
	const threeKeyCodes = layout.mainKeys.flatMap((first) =>
		layout.auxiliaryKeys.flatMap((second) =>
			layout.auxiliaryKeys.map((third) => first + second + third),
		),
	);
	threeKeyCodes.sort(
		(a, b) =>
			(pools.get(a)?.length ?? 0) - (pools.get(b)?.length ?? 0) ||
			a.localeCompare(b),
	);
	for (const code of threeKeyCodes) {
		const candidate = chooseWithoutRedundancy(
			pools.get(code) ?? [],
			usedWords,
			code,
			replacements,
			scope,
			minimumThreeKeyWeight,
			true,
		);
		if (!candidate) continue;
		selected.set(code, candidate.word);
		usedWords.add(candidate.word);
		replacements.addFixed(code, candidate.word);
	}
	return selected;
}

function createCommonReplacementIndex() {
	const replacements = new FixedReplacementIndex();
	for (const [code, word] of oneKeyWords) replacements.addFixed(code, word);
	for (const [code, word] of erjianWords) replacements.addFixed(code, word);
	for (const [code, word] of sharedSingles) {
		if (code.length === 2) replacements.addFixed(code, word);
	}
	return replacements;
}

const sanpinPools = new Map<string, ReturnType<typeof makeCandidate>[]>();
for (const entry of baseWordEntries) {
	const length = wordLength(entry.word);
	if (
		rejectedSanpinWords.has(entry.word) ||
		!isHanWord(entry.word, 2, 4) ||
		entry.syllables.length !== length ||
		entry.syllables.length < 2
	) {
		continue;
	}
	const first = firstKey(layout, entry.syllables[0]);
	const secondTone = toneOf(entry.syllables[1]);
	if (!first || !secondTone) continue;
	const second = layout.toneKeys[secondTone];
	if (!second) continue;
	const twoKeyCode = first + second;
	addCandidate(
		sanpinPools,
		twoKeyCode,
		makeOptimizedCandidate(
			entry,
			isLegacyAtCode(legacySanpin, "# 630", twoKeyCode, entry.word),
			3,
			everydayBonus(entry.word) +
				(length === 2 ? 100_000_000 + fullCodeDifficultyBonus(entry) : 0),
			250_000_000,
		),
	);
	const target =
		entry.syllables.length === 2 ? entry.syllables[0] : entry.syllables[2];
	const targetTone = toneOf(target);
	if (!targetTone) continue;
	const third = layout.toneKeys[targetTone];
	if (!third) continue;
	addCandidate(
		sanpinPools,
		twoKeyCode + third,
		makeOptimizedCandidate(
			entry,
			isLegacyAtCode(legacySanpin, "# 630", twoKeyCode + third, entry.word),
			3,
			everydayBonus(entry.word) +
				(length === 2 ? fullCodeDifficultyBonus(entry) : 0) +
				(targetTone === "5" && length >= 3 ? 200_000_000 : 0),
			250_000_000,
		),
	);
}
const sanpin630 = selectSixThirty(
	sanpinPools,
	1_000,
	createCommonReplacementIndex(),
	"三拼 630",
);
for (const code of reportSanpinCodes) {
	console.log(`三拼 630 候选 ${code}:`);
	for (const candidate of sortCandidates(sanpinPools.get(code) ?? []).slice(
		0,
		20,
	)) {
		console.log(
			`  ${candidate.word}\t${candidate.syllables.join(" ")}\t词频=${candidate.weight}` +
				`\t得分=${candidate.score}\t家族=${wordEvidence(candidate.word, 3).families.length}` +
				`${candidate.legacy ? "\t原码位固顶" : ""}`,
		);
	}
}

const shapeCodes = readShapeCodes(
	join(root, "snow_jiandao_chaifen.dict.yaml"),
	layout.shapeElementKeys,
);
const jiandaoPools = new Map<string, ReturnType<typeof makeCandidate>[]>();
for (const entry of baseWordEntries) {
	if (
		!isHanWord(entry.word, 2, 2) ||
		entry.syllables.length !== 2 ||
		wordLength(entry.word) !== 2
	) {
		continue;
	}
	const first = firstKey(layout, entry.syllables[0]);
	const secondCharacter = [...entry.word][1];
	const shape = shapeCodes.get(secondCharacter);
	if (!first || !shape) continue;
	const twoKeyCode = first + shape[0];
	addCandidate(
		jiandaoPools,
		twoKeyCode,
		makeOptimizedCandidate(
			entry,
			isLegacyAtCode(legacyJiandao, "# 630", twoKeyCode, entry.word),
			3,
			100_000_000 + everydayBonus(entry.word) + fullCodeDifficultyBonus(entry),
			250_000_000,
		),
	);
	if (shape.length >= 2) {
		addCandidate(
			jiandaoPools,
			twoKeyCode + shape[1],
			makeOptimizedCandidate(
				entry,
				isLegacyAtCode(
					legacyJiandao,
					"# 630",
					twoKeyCode + shape[1],
					entry.word,
				),
				3,
				everydayBonus(entry.word) + fullCodeDifficultyBonus(entry),
				250_000_000,
			),
		);
	}
}
const jiandao630 = selectSixThirty(
	jiandaoPools,
	0,
	createCommonReplacementIndex(),
	"键道 630",
);
if (jiandao630.size !== 630)
	throw new Error(`键道 630 必须完整覆盖 630 槽，实际为 ${jiandao630.size}。`);

const tygf = new Set(
	readFileSync(join(scriptDirectory, "tygf.txt"), "utf8")
		.split(/\r?\n/)
		.map((line) => line.split("\t")[0])
		.filter(Boolean),
);
const threeKeySinglePools = new Map<
	string,
	ReturnType<typeof makeCandidate>[]
>();
for (const entry of singleEntries) {
	if (!tygf.has(entry.word)) continue;
	const sound = soundCode(layout, entry.syllables[0]);
	const shape = shapeCodes.get(entry.word);
	if (!sound || !shape) continue;
	addCandidate(
		threeKeySinglePools,
		sound + shape[0],
		makeOptimizedCandidate(
			entry,
			isLegacyAtCode(legacyJiandao, "# 单字", sound + shape[0], entry.word),
			3,
			0,
			20_000_000,
		),
	);
}
const jiandaoSingles = new Map(sharedSingles);
const threeKeyCodes = [...threeKeySinglePools.keys()].sort(
	(a, b) =>
		(threeKeySinglePools.get(a)?.length ?? 0) -
			(threeKeySinglePools.get(b)?.length ?? 0) || a.localeCompare(b),
);
for (const code of threeKeyCodes) {
	const prefixWords = new Set(usedSingleWords);
	const selected = chooseCandidate(
		threeKeySinglePools.get(code) ?? [],
		prefixWords,
	);
	if (!selected) continue;
	jiandaoSingles.set(code, selected.word);
	usedSingleWords.add(selected.word);
}

const sanpin: FixedSections = {
	erjian: erjianWords,
	sixThirty: sanpin630,
	single: sharedSingles,
};
const jiandao: FixedSections = {
	erjian: erjianWords,
	sixThirty: jiandao630,
	single: jiandaoSingles,
};
for (const sections of [sanpin, jiandao]) {
	assertOneCandidatePerCode(sections);
	assertNoPrefixWordRepeats(sections);
}

function assertNoReplaceableFixed(name: string, sections: FixedSections) {
	const replacements = new FixedReplacementIndex();
	for (const entries of [
		sections.erjian,
		sections.sixThirty,
		sections.single,
	]) {
		for (const [code, word] of entries) replacements.addFixed(code, word);
	}
	const redundant: string[] = [];
	for (const [section, entries] of [
		["二简", sections.erjian],
		["630", sections.sixThirty],
	] as const) {
		for (const [code, word] of entries) {
			const abbreviation = structuralAbbreviation(word);
			if (abbreviation) {
				redundant.push(
					`${section} ${code}→${word} 符合结构略码 ${abbreviation.base}${abbreviation.trigger}`,
				);
				continue;
			}
			const replacement = replacements.find(word, code.length);
			if (replacement) {
				redundant.push(
					`${section} ${code}→${word} 可由 ${replacement.code}（${replacement.mechanism}）替代`,
				);
			}
		}
	}
	if (redundant.length > 0) {
		throw new Error(
			`${name} 仍有等长或更短的冗余固顶：\n${redundant.join("\n")}`,
		);
	}
}

assertNoReplaceableFixed("冰雪三拼", sanpin);
assertNoReplaceableFixed("冰雪键道", jiandao);

const outputs = new Map([
	["snow_sanpin.fixed.txt", renderFixedTable(sanpin)],
	["snow_jiandao.fixed.txt", renderFixedTable(jiandao)],
]);
for (const [file, output] of outputs) {
	const path = join(root, file);
	if (reportSanpinCodes.length > 0) continue;
	if (checkOnly) {
		if (readFileSync(path, "utf8") !== output)
			throw new Error(`${file} 不是通用固顶编译器的最新产物。`);
	} else {
		writeFileSync(path, output, "utf8");
	}
}

const sanpinThreeKey = [...sanpin630.keys()].filter(
	(code) => code.length === 3,
).length;
const jiandaoThreeKeySingles = [...jiandaoSingles.keys()].filter(
	(code) => code.length === 3,
).length;
const uniqueRejections = new Map(
	optimizationRejections.map((value) => [
		`${value.scope}\t${value.code}\t${value.word}`,
		value,
	]),
);
const rejectionSummary = [...uniqueRejections.values()].reduce(
	(summary, value) => {
		summary[value.replacement.mechanism] =
			(summary[value.replacement.mechanism] ?? 0) + 1;
		return summary;
	},
	{} as Record<string, number>,
);
console.log(
	`神韵固顶${checkOnly ? "核验" : "生成"}完成：二简 64；AA 单字 377；三拼 630 为 105+${sanpinThreeKey}；键道 630 为 105+525；键道三码单字 ${jiandaoThreeKeySingles}；结构略码筛选 ${structuralRejectionCount}；完整码稳居首选筛选 ${efficientFullCodeRejectionCount}；等长或更短替代筛选 ${JSON.stringify(rejectionSummary)}。`,
);
