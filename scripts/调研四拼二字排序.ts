import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyAlgebra, parseAlgebraRules } from "./fixed-corpus/algebra";
import { findStructuralAbbreviation } from "./固顶替代";
import {
	mergeDictionaries,
	plainSyllable,
	readDictionary,
	readShapeCodes,
	toneOf,
	wordLength,
} from "./固顶编译器";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDirectory, "..");
const outputPath = join(root, "reports", "sipin-bigram-ranking-research.md");

const dictionaries = [
	"snow_pinyin.dict.yaml",
	"snow_pinyin.base.dict.yaml",
	"snow_pinyin.ext.dict.yaml",
	"snow_pinyin.tencent.dict.yaml",
	"snow_pinyin.user.dict.yaml",
];
const entries = mergeDictionaries(
	dictionaries.flatMap((file) => readDictionary(join(root, file))),
).filter(
	(entry) =>
		wordLength(entry.word) === 2 &&
		entry.syllables.length === 2 &&
		/^\p{Script=Han}{2}$/u.test(entry.word),
);
const selectableWords = new Set(entries.map((entry) => entry.word));

const sipinRules = parseAlgebraRules(
	readFileSync(join(root, "snow_sipin.schema.yaml"), "utf8"),
	"sipin_algebra",
);
const shenyun = JSON.parse(
	readFileSync(join(root, "docs", "shenyun-r8-mapping.json"), "utf8"),
) as { codes: Record<string, string | null> };

const elementKeys = new Map<string, string>();
for (const line of readFileSync(
	join(root, "lua", "snow", "radical_jiandao.txt"),
	"utf8",
).split(/\r?\n/u)) {
	const [element, code] = line.split("\t");
	if (element && code) elementKeys.set(element, code);
}
const shapeCodes = readShapeCodes(
	join(root, "snow_jiandao_chaifen.dict.yaml"),
	Object.fromEntries(elementKeys),
);

interface ResearchEntry {
	word: string;
	syllables: string[];
	weight: number;
	sipin: [string, string];
}

function sipinCode(syllable: string) {
	return applyAlgebra(syllable, sipinRules).canonical;
}

const words: ResearchEntry[] = [];
for (const entry of entries) {
	const first = sipinCode(entry.syllables[0]);
	const second = sipinCode(entry.syllables[1]);
	if (!first || !second) continue;
	words.push({ ...entry, sipin: [first, second] });
}
const entriesByWord = new Map<string, ResearchEntry[]>();
for (const entry of words) {
	const values = entriesByWord.get(entry.word) ?? [];
	values.push(entry);
	entriesByWord.set(entry.word, values);
}

interface FixedSlot {
	file: "三拼" | "键道";
	section: "二简" | "630";
	code: string;
	word: string;
}

function readFixed(file: "snow_sanpin.fixed.txt" | "snow_jiandao.fixed.txt") {
	const label = file === "snow_sanpin.fixed.txt" ? "三拼" : "键道";
	const result: FixedSlot[] = [];
	let section = "";
	for (const line of readFileSync(join(root, file), "utf8").split(/\r?\n/u)) {
		if (line.startsWith("#")) {
			section = line;
			continue;
		}
		if (!line.includes("\t")) continue;
		const [code, word] = line.split("\t");
		if (section === "# 二简词")
			result.push({ file: label, section: "二简", code, word });
		if (section === "# 630")
			result.push({ file: label, section: "630", code, word });
	}
	return result;
}

const slots = [
	...readFixed("snow_sanpin.fixed.txt"),
	...readFixed("snow_jiandao.fixed.txt"),
];
const slotByKey = new Map(
	slots.map((slot) => [`${slot.file}:${slot.section}:${slot.code}`, slot]),
);

function shenyunSound(syllable: string) {
	return shenyun.codes[plainSyllable(syllable)] ?? null;
}

function legalSlotKeys(entry: ResearchEntry) {
	const result: string[] = [];
	const first = shenyunSound(entry.syllables[0]);
	const second = shenyunSound(entry.syllables[1]);
	if (!first || !second) return result;
	const erjian = first[0] + second[0];
	for (const file of ["三拼", "键道"] as const) {
		const key = `${file}:二简:${erjian}`;
		if (slotByKey.has(key)) result.push(key);
	}
	const tones: Record<string, string> = {
		"1": "i",
		"2": "v",
		"3": "u",
		"4": "a",
		"5": "o",
	};
	const sanpin2 = first[0] + (tones[toneOf(entry.syllables[1]) ?? ""] ?? "");
	const sanpin3 = sanpin2 + (tones[toneOf(entry.syllables[0]) ?? ""] ?? "");
	for (const code of [sanpin2, sanpin3]) {
		const key = `三拼:630:${code}`;
		if (slotByKey.has(key)) result.push(key);
	}
	const secondShape = shapeCodes.get([...entry.word][1]) ?? "";
	for (const length of [1, 2]) {
		const code = first[0] + secondShape.slice(0, length);
		const key = `键道:630:${code}`;
		if (slotByKey.has(key)) result.push(key);
	}
	return result;
}

const pools = new Map<string, ResearchEntry[]>();
for (const entry of words) {
	for (const key of legalSlotKeys(entry)) {
		const pool = pools.get(key) ?? [];
		pool.push(entry);
		pools.set(key, pool);
	}
}
for (const [key, pool] of pools) {
	pool.sort(
		(a, b) => b.weight - a.weight || a.word.localeCompare(b.word, "zh-CN"),
	);
	// 四拼默认次序最终仍以词频为主；每个固顶槽保留足量头部候选即可完成本轮调研。
	pools.set(key, pool.slice(0, 40));
}
// 当前二字候选即使不在同槽词频前 40，也必须进入对照集，避免把“未取样”
// 错当成“没有逐级名次”。多字固顶不属于本轮二字排序的同类比较对象。
for (const [key, slot] of slotByKey) {
	if (wordLength(slot.word) !== 2) continue;
	const pool = pools.get(key) ?? [];
	for (const entry of entriesByWord.get(slot.word) ?? []) {
		if (
			legalSlotKeys(entry).includes(key) &&
			!pool.some(
				(value) =>
					value.word === entry.word &&
					value.syllables.join(" ") === entry.syllables.join(" "),
			)
		) {
			pool.push(entry);
		}
	}
	pools.set(key, pool);
}

interface Stage {
	key: string;
	display: string;
}

function stages(entry: ResearchEntry): Stage[] {
	const [first, second] = entry.sipin;
	const result: Stage[] = [];
	const add = (firstLength: number, secondLength: number) => {
		const firstPrefix = first.slice(0, firstLength);
		const secondPrefix = second.slice(0, secondLength);
		result.push({
			key: `${firstPrefix}\u0000${secondPrefix}`,
			display: `${firstPrefix}${secondPrefix}`,
		});
	};
	add(1, 1);
	for (let length = 2; length <= second.length; length += 1) add(1, length);
	for (let length = 2; length <= first.length; length += 1)
		add(length, second.length);
	return result;
}

const targets = new Map<string, ResearchEntry>();
for (const [key, pool] of pools) {
	const currentWord = slotByKey.get(key)?.word;
	for (const entry of pool)
		targets.set(`${entry.word}\t${entry.syllables.join(" ")}`, entry);
	if (currentWord) {
		for (const entry of words) {
			if (entry.word === currentWord && legalSlotKeys(entry).includes(key)) {
				targets.set(`${entry.word}\t${entry.syllables.join(" ")}`, entry);
			}
		}
	}
}

const wantedStages = new Set(
	[...targets.values()].flatMap((entry) =>
		stages(entry).map((stage) => stage.key),
	),
);
const stageGroups = new Map<string, ResearchEntry[]>();
for (const entry of words) {
	for (const stage of stages(entry)) {
		if (!wantedStages.has(stage.key)) continue;
		const group = stageGroups.get(stage.key) ?? [];
		group.push(entry);
		stageGroups.set(stage.key, group);
	}
}
for (const group of stageGroups.values())
	group.sort(
		(a, b) => b.weight - a.weight || a.word.localeCompare(b.word, "zh-CN"),
	);

function rankAt(entry: ResearchEntry, stage: Stage) {
	const group = stageGroups.get(stage.key) ?? [];
	const seen = new Set<string>();
	for (const candidate of group) {
		if (seen.has(candidate.word)) continue;
		seen.add(candidate.word);
		if (candidate.word === entry.word) return seen.size;
	}
	return Number.POSITIVE_INFINITY;
}

interface RankedEntry extends ResearchEntry {
	ranks: number[];
	displays: string[];
	topSix: number;
	firsts: number;
	topSixRate: number;
	firstRate: number;
	fullRank: number;
}

function rankEntry(entry: ResearchEntry): RankedEntry {
	const path = stages(entry);
	const ranks = path.map((stage) => rankAt(entry, stage));
	return {
		...entry,
		ranks,
		displays: path.map((stage) => stage.display),
		topSix: ranks.filter((rank) => rank <= 6).length,
		firsts: ranks.filter((rank) => rank === 1).length,
		topSixRate: ranks.filter((rank) => rank <= 6).length / ranks.length,
		firstRate: ranks.filter((rank) => rank === 1).length / ranks.length,
		fullRank: ranks.at(-1) ?? Number.POSITIVE_INFINITY,
	};
}

function isTailKeyWord(entry: ResearchEntry) {
	const last = [...entry.word][1];
	const syllable = entry.syllables[1];
	return (
		(last === "的" && syllable === "de5") ||
		(last === "了" && syllable === "le5")
	);
}

function redundant(entry: ResearchEntry) {
	return (
		isTailKeyWord(entry) ||
		findStructuralAbbreviation(entry.word, (base) =>
			selectableWords.has(base),
		) !== undefined
	);
}

const usedByFile = new Map<string, Set<string>>();
for (const slot of slots) {
	const used = usedByFile.get(slot.file) ?? new Set<string>();
	used.add(slot.word);
	usedByFile.set(slot.file, used);
}

interface Suggestion {
	slot: FixedSlot;
	current: RankedEntry | null;
	candidate: RankedEntry;
}

const suggestions: Suggestion[] = [];
for (const [key, pool] of pools) {
	const slot = slotByKey.get(key);
	if (!slot) continue;
	if (wordLength(slot.word) !== 2) continue;
	const ranked = pool.map(rankEntry);
	const current = ranked.find((entry) => entry.word === slot.word) ?? null;
	if (!current) continue;
	const candidates = ranked
		.filter(
			(entry) =>
				entry.word !== slot.word &&
				entry.weight >= 1_000 &&
				entry.topSix >= Math.ceil(entry.ranks.length * 0.6) &&
				!usedByFile.get(slot.file)?.has(entry.word) &&
				!redundant(entry),
		)
		.sort(
			(a, b) =>
				b.topSixRate - a.topSixRate ||
				b.firstRate - a.firstRate ||
				a.fullRank - b.fullRank ||
				b.weight - a.weight,
		);
	const candidate = candidates[0];
	if (!candidate) continue;
	const currentTopSix = current.topSixRate;
	const currentFirsts = current.firstRate;
	if (
		candidate.topSixRate > currentTopSix ||
		(candidate.topSixRate === currentTopSix &&
			candidate.firstRate > currentFirsts)
	) {
		suggestions.push({ slot, current, candidate });
	}
}

suggestions.sort(
	(a, b) =>
		b.candidate.topSixRate -
			(b.current?.topSixRate ?? -1) -
			(a.candidate.topSixRate - (a.current?.topSixRate ?? -1)) ||
		b.candidate.weight - a.candidate.weight,
);

function rankVector(entry: RankedEntry | null) {
	return entry ? entry.ranks.join("/") : "—";
}

function renderTable(values: Suggestion[]) {
	const lines = [
		"| 方案空间 | 码位 | 当前词（四拼逐级名次） | 靠前二字词（四拼逐级名次） | 全码名次 | 研判 |",
		"|---|---:|---|---|---:|---|",
	];
	for (const { slot, current, candidate } of values) {
		const judgment =
			candidate.fullRank === 1
				? "常用度证据强，但四拼全码已首选，固顶边际收益低"
				: "常用度与短码收益可同时复核";
		lines.push(
			`| ${slot.file}${slot.section} | \`${slot.code}\` | ${slot.word}（${rankVector(current)}） | ${candidate.word}（${rankVector(candidate)}） | ${candidate.fullRank} | ${judgment} |`,
		);
	}
	return lines.join("\n");
}

const serious = suggestions
	.filter((value) => value.candidate.fullRank > 1)
	.slice(0, 20);
const evidenceOnly = suggestions
	.filter((value) => value.candidate.fullRank === 1)
	.slice(0, 20);
const seriousTable =
	serious.length > 0
		? renderTable(serious)
		: "本轮没有候选同时满足“逐级排序明显改善”与“完整四拼路径非首选”。";
const currentTwoCharacter = slots.filter(
	(slot) => wordLength(slot.word) === 2,
).length;
const report = `# 四拼二字词逐级排序对神韵固顶的参考调研

> 本报告只读现有词典和固顶表，不修改三拼、键道任何固顶候选。

## 口径

- 共分析 ${words.length.toLocaleString("zh-CN")} 条可编码二字词读音，以及三拼、键道二简/630 的 ${slots.length.toLocaleString("zh-CN")} 个槽位；其中当前候选为二字词的槽位 ${currentTwoCharacter.toLocaleString("zh-CN")} 个。
- 四拼二字词按真实补码顺序观察：两字声码起步，先逐级补第二字的韵头、韵尾、声调，再回补第一字。表中的名次向量按这个顺序列出，例如 \`1/2/1\` 表示三个阶段分别排第 1、2、1。
- 每一级都按当前词典权重模拟默认顺序，并按显示词去重。它不读取个人 userdb，因此是可复现的“静态默认排序”，不是某台机器学习后的现场顺序。
- 本轮尚未复刻 librime 对完整拼写、派生拼写和简拼的 quality 惩罚；实际替换前仍须用 Mira 或现场引擎抓取同一码的真实候选截面。
- 替换候选必须能合法落入原神韵码位，并排除已在同方案固顶、可用结构略码、可用“的/了”尾字键的词。

## 结论

四拼逐级排序**值得作为常用度证据**，但不宜直接等同于“应该占固顶”。原因是：一个词在逐级补全后始终靠前，往往也意味着它在完整四拼路径已经首选；这类词很常用，却未必需要再消耗二简或 630。最有价值的对象，是“前几级稳定靠前、完整路径却不是首选”的词，它同时具备常用度和短码收益。

因此建议把四拼证据接入现有选优器时采用两列独立特征：逐级 Top-6 覆盖级数（常用度）和完整路径名次（边际收益），不要把它们压成一个不透明总分。本轮只生成候选清单，未实施替换。

## 值得进一步人工复核

这些候选完整四拼路径并非首选，固顶可能确有额外收益：

${seriousTable}

## 只宜作为常用度旁证

这些候选逐级排序很好，但完整四拼路径已经首选；除非现有槽位质量明显更差，否则不建议仅凭“常用”替换：

${renderTable(evidenceOnly)}

## 后续接入建议

1. 在固顶编译器中保存每个二字词的完整逐级名次向量，不先合成总分。
2. 只让“逐级多次进入 Top 6”提高入围资格；若完整路径第 1，则施加明确的冗余惩罚。
3. 继续保留现有的码位合法性、肌肉记忆、独立方案家族、结构略码、尾字键和全局不重复约束。
4. 每次实际替换输出“当前词 vs. 新词”的逐级候选截面，再由人工批准；第 6 点本轮不自动改表。
`;

writeFileSync(outputPath, report, "utf8");
console.log(
	`四拼排序调研完成：${suggestions.length} 个有提升信号的槽位；报告 ${outputPath}`,
);
