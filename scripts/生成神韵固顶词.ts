import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	addCandidate,
	assertLayout,
	assertNoPrefixWordRepeats,
	assertOneCandidatePerCode,
	chooseCandidate,
	type FixedLayout,
	type FixedSections,
	firstKey,
	isHanWord,
	makeCandidate,
	mergeDictionaries,
	readDictionary,
	readLegacyFixed,
	readShapeCodes,
	renderFixedTable,
	sortCandidates,
	soundCode,
	toneOf,
	wordLength,
	wordsInSection,
} from "./固顶编译器";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDirectory, "..");
const checkOnly = process.argv.includes("--check");
const reportSanpinArgument = process.argv.find((value) =>
	value.startsWith("--report-sanpin="),
);
const reportSanpinCodes = reportSanpinArgument
	? reportSanpinArgument.split("=")[1].split(",")
	: [];

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
const oneKeyWords = new Map<string, string>([
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
const erjianWords = new Map<string, string>([
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

// 词频不能识别所有句法边界。这些词条在大词库中有较高权重，但单独固顶时
// 明显是不完整片段；仅作精确否决，避免误伤“是的、算了”等可独立使用表达。
const rejectedSanpinWords = new Set([
	"别的了",
	"吧啊",
	"词的",
	"有了吗",
	"有的啊",
	"快了吧",
	"没了啊",
	"你们了",
	"男的呢",
	"平的",
	"强的",
	"群的",
	"墙的",
	"全的",
	"俗的",
	"差的",
	"车的",
	"处理的",
	"下的",
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
const singleEntries = allEntries.filter(
	(entry) => entry.syllables.length === 1 && isHanWord(entry.word, 1, 1),
);
const baseWordEntries = mergeDictionaries(
	readDictionary(join(root, "snow_pinyin.base.dict.yaml")),
);

const legacySanpin = readLegacyFixed(join(root, "snow_sanpin.fixed.txt"));
const legacyJiandao = readLegacyFixed(join(root, "snow_jiandao.fixed.txt"));
const legacySingles = new Set<string>();
for (const sections of [legacySanpin, legacyJiandao]) {
	for (const entries of sections.values()) {
		for (const words of entries.values()) {
			for (const word of words) {
				if (wordLength(word) === 1) legacySingles.add(word);
			}
		}
	}
}
const legacySanpin630 = wordsInSection(legacySanpin, "# 630");
const legacyJiandao630 = wordsInSection(legacyJiandao, "# 630");

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

function assertCuratedCodes() {
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
assertCuratedCodes();

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
	addCandidate(singlePools, code, makeCandidate(entry, legacySingles));
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
) {
	const selected = new Map<string, string>();
	const usedWords = new Set(erjianWords.values());
	for (const first of layout.mainKeys) {
		for (const second of layout.auxiliaryKeys) {
			const code = first + second;
			const candidate = chooseCandidate(pools.get(code) ?? [], usedWords);
			if (!candidate) throw new Error(`630 短码 ${code} 没有可用候选。`);
			selected.set(code, candidate.word);
			usedWords.add(candidate.word);
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
		const candidate = chooseCandidate(
			pools.get(code) ?? [],
			usedWords,
			minimumThreeKeyWeight,
		);
		if (!candidate) continue;
		selected.set(code, candidate.word);
		usedWords.add(candidate.word);
	}
	return selected;
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
		makeCandidate(entry, legacySanpin630, length === 2 ? 100_000_000 : 0),
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
		makeCandidate(
			entry,
			legacySanpin630,
			targetTone === "5" && length >= 3 ? 200_000_000 : 0,
		),
	);
}
const sanpin630 = selectSixThirty(sanpinPools, 1_000);
for (const code of reportSanpinCodes) {
	console.log(`三拼 630 候选 ${code}:`);
	for (const candidate of sortCandidates(sanpinPools.get(code) ?? []).slice(
		0,
		20,
	)) {
		console.log(
			`  ${candidate.word}\t${candidate.syllables.join(" ")}\t${candidate.weight}${candidate.legacy ? "\t旧固顶" : ""}`,
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
		makeCandidate(entry, legacyJiandao630, 100_000_000),
	);
	if (shape.length >= 2) {
		addCandidate(
			jiandaoPools,
			twoKeyCode + shape[1],
			makeCandidate(entry, legacyJiandao630),
		);
	}
}
const jiandao630 = selectSixThirty(jiandaoPools, 0);
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
		makeCandidate(entry, legacySingles),
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
console.log(
	`神韵固顶${checkOnly ? "核验" : "生成"}完成：二简 64；AA 单字 377；三拼 630 为 105+${sanpinThreeKey}；键道 630 为 105+525；键道三码单字 ${jiandaoThreeKeySingles}。`,
);
