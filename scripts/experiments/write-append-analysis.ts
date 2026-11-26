// 在上下文统计与跨语料本地测量完成后生成 output/append-generalization/analysis.md。
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { rootPath } from "../lib/paths";

const directory = rootPath("output/append-generalization");
const read = (name: string) =>
	JSON.parse(readFileSync(join(directory, name), "utf8"));
const contexts = read("contexts5500.json");
const prepared = read("corpora.json");
const measured = read(
	existsSync(join(directory, "measured-extended.json"))
		? "measured-extended.json"
		: "measured.json",
);
interface Row {
	scheme: string;
	group: string;
	tail: string;
	characters: number;
	excludedCharacters: number;
	saved: number;
	savedPer10000Han: number;
	keys: number;
	selections: number;
	uses: number;
}
const rows = measured.rows as Row[];
const names: Record<string, string> = {
	original5500: "原 5500 字（按非汉字断段重测）",
	gsd: "独立百科 GSD",
	pud: "独立新闻／百科 PUD",
	hotel: "独立酒店评论",
};
const frequencyRows = [
	{
		name: "原评测 5500 字",
		characters: 5500,
		counts: { 与: 56, 在: 54, 了: 31 },
	},
	...prepared.corpora.map(
		(group: {
			description: string;
			hanCharacters: number;
			counts: Record<string, number>;
		}) => ({
			name: group.description,
			characters: group.hanCharacters,
			counts: group.counts,
		}),
	),
	{
		name: "SUBTLEX-CH 影视字幕",
		characters: prepared.subtitles.characterTokens,
		counts: Object.fromEntries(
			["与", "在", "了"].map((tail) => [
				tail,
				prepared.subtitles.counts[tail].character,
			]),
		),
	},
];
const schemes = [...new Set(rows.map((row) => row.scheme))];
const groups = [...new Set(rows.map((row) => row.group))];
const landaoIs = rows.filter(
	(row) =>
		row.scheme === "冰雪兰道" &&
		row.group !== "original5500" &&
		row.tail === "是",
);
const landaoLe = rows.filter(
	(row) =>
		row.scheme === "冰雪兰道" &&
		row.group !== "original5500" &&
		row.tail === "了",
);
const landaoSaving = landaoIs.reduce((sum, row) => sum + row.saved, 0);
const landaoSavingPercent =
	(landaoSaving * 100) / landaoLe.reduce((sum, row) => sum + row.keys, 0);
for (const value of Object.values(measured.verification) as Array<{
	failed: unknown[];
}>)
	assert.equal(value.failed.length, 0);
const lines = [
	"# `/` 追加字：上下文成因与独立语料对照",
	"",
	"本实验只比较追加字，不修改生产方案。原 5500 字中「与」最省键成立；是否适合作为通用默认，另用真实独立文本和大规模频率表判断。所有码长数据使用同一冻结评测源码，避免把候选、固顶或分词规则变化混入追加字的效果。",
	"",
	"## 原 5500 字里的 56 个「与」",
	"",
	"逐处审读：53 次是并列连接「A 与 B」，2 次引入关联对象（「与其年龄智力相适应」「与中华本土文化相互激荡」），1 次在固定表达「与此同时」中。没有「参与」「赠与」那种词内的「与」。这里的语法分类是人工判断，输入段长统计来自冰雪兰道最优回放。",
	"",
	"原输入路径中，50 次「与」单独成段、1 次在二字段、4 次在三字段、1 次在四字段。单独成段不表示它在自然语言里孤立成句；多数是在两个较长对象之间，前后对象各自已能用词语码输入。",
	"",
	"例如「深度学习架构与计算硬件」：原路径的 `架构 jlgw` ＋ `与 yt_` 共 7 键，替换后 `架构与 jlgw/` 共 5 键，再输入「计算硬件」。所以按 `/` 确认的是此前候选「架构」，同时提交「与」；它位于句中，但被人为并入前一个输入段尾部。这是输入动作的分组，不声称「架构与」构成一个自然词。",
	"",
	"不是「与」无法组成三字词。当前冻结词库去重后有 97 个含「与」的二字条目、735 个三字条目、843 个四字条目；其中三字条目 316 个把「与」放中间。词库条目也包含搭配，不能把类型数当作真实使用频率。原回放保留了「与科技」「与经济」「与科学」「与中华」等三字段；「与此同时」仍使用其原有短码。",
	"",
	"| 场景 | 文体 | 与 | 在 | 了 | `/→与` 较了净省（冰雪兰道） | `/→在` 较了净省 |",
	"| ---: | --- | ---: | ---: | ---: | ---: | ---: |",
	...contexts.genreStats.map(
		(group: {
			scene: number;
			genre: string;
			counts: Record<string, number>;
			netSavingYu: number;
			netSavingZai: number;
		}) =>
			`| ${group.scene} | ${group.genre} | ${group.counts.与} | ${group.counts.在} | ${group.counts.了} | ${group.netSavingYu} | ${group.netSavingZai} |`,
	),
	"",
	"科技科普一篇占 13 个「与」，财经分析占 10 个。标为「日常口语」的篇章，原稿没有「与」，扩写到 500 字后在偏抒情的段落里加入了 4 个。原稿十篇合计 32 个「与」，严格 500 字版本合计 56 个；这说明扩写改变了文体用字分布，不能把这组自编示例当作自然输入的代表性抽样。第十篇与第十一场景重复，两者均无「与」；5500 字不是 11 篇独立文章。",
	"",
	"完整 56 条上下文和更换前后的输入段见 [上下文 TSV](contexts5500.tsv)；机器可读原始统计见 [上下文 JSON](contexts5500.json)。",
	"",
	"## 更大范围的字频与单字词频",
	"",
	"下表列每万汉字中的出现次数，只说明出现机会，不等于每万字省键数。外部文本按相同规则去重复并转简体；原文件 URL 和 SHA-256 记录在 `corpora.json`。",
	"",
	"| 来源 | 汉字总量 | 与／万字 | 在／万字 | 了／万字 |",
	"| --- | ---: | ---: | ---: | ---: |",
	...frequencyRows.map(
		(group) =>
			`| ${group.name} | ${group.characters} | ${["与", "在", "了"].map((tail) => ((group.counts[tail] * 10000) / group.characters).toFixed(2)).join(" | ")} |`,
	),
	"",
	"SUBTLEX-CH 来自 6243 个影视上下文，原作者同时公布字频和词频；这里使用论文原始附件，按 GB18030 解码。论文明确区分字符在所有词中的出现，与一个字符独立成词的出现，因此不会用「总字频减随意词表频次」推测一字词频。[论文及原始附件](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0010729)",
	"",
	"| 字 | 字符总次数 | 单字词次数 | 独立成词占对应字频 |",
	"| --- | ---: | ---: | ---: |",
	...["与", "在", "了"].map((tail) => {
		const count = prepared.subtitles.counts[tail];
		return `| ${tail} | ${count.character} | ${count.singletonWord} | ${((count.singletonWord * 100) / count.character).toFixed(2)}% |`;
	}),
	"",
	"在人工标注的 GSD 语料里，531 个「与」有 485 个独立成词、43 个位于二字词、0 个位于三字词、3 个位于四字及以上词；PUD 的 57 个「与」对应 50／6／1／0。这支持「与常用于连接两个对象，较少被普通多字词吸收」的解释，但并不支持「所有语料都高频」。GSD 主要是百科，PUD 是翻译的新闻／百科，酒店评论是单一消费领域，各有偏向。[GSD 来源说明](https://raw.githubusercontent.com/UniversalDependencies/UD_Chinese-GSDSimp/r2.17/README.md) · [PUD 来源说明](https://raw.githubusercontent.com/UniversalDependencies/UD_Chinese-PUD/r2.17/README.md) · [酒店评论来源说明](https://raw.githubusercontent.com/SophonPlus/ChineseNlpCorpus/master/datasets/ChnSentiCorp_htl_all/intro.ipynb)",
	"",
	"## 独立文本的本地实际候选重切分",
	"",
	"每组先按固定文本哈希排序，取完整篇／句至至少 12000 汉字；不按目标字筛选。独立抽样共 36235 汉字，再加原 5500 字作同口径对照。以冰雪四拼、冰雪兰道、冰雪鹤道覆盖三种结构；直接调用本地 librime，使用独立临时部署、空白且关闭学习的用户词典和持久缓存。候选语料池一致，撤销原 `/→了` 路径再加入新追加字，随后重新求全句最优切分，先最少选重再最少实际键数。",
	"",
	"本表只比较汉字段的实际按键和确认键，原文非汉字视为段落边界；标点、数字与拉丁文本不计费用，不是完整混排文本的总键数。不能拿本表的绝对键数直接替换生产 5500 字报告。含未能枚举到合法候选的整段，按同一方案各追加字的共同可编码交集处理，排除量另列；未为某个候选单独删除难例。",
	"",
	"正数为相对现行「了」每万汉字净省的键数，负数为增加键数；所有方案的「了」均为零基线。",
	"",
	"| 方案 | 文本 | 纳入／排除汉字 | 与净省／万字 | 在净省／万字 | 本轮候选最优字 | 相对了净省／万字 |",
	"| --- | --- | ---: | ---: | ---: | --- | ---: |",
	...schemes.flatMap((scheme) =>
		groups.map((group) => {
			const subset = rows.filter(
				(row) => row.scheme === scheme && row.group === group,
			);
			const pick = (tail: string) => subset.find((row) => row.tail === tail)!;
			const best = [...subset].sort(
				(a, b) => a.selections - b.selections || a.keys - b.keys,
			)[0];
			const base = pick("了");
			return `| ${scheme} | ${names[group]} | ${base.characters}／${base.excludedCharacters} | ${pick("与").savedPer10000Han.toFixed(2)} | ${pick("在").savedPer10000Han.toFixed(2)} | ${best.tail} | ${best.savedPer10000Han.toFixed(2)} |`;
		}),
	),
	"",
	`本轮筛选 ${measured.candidates?.length ?? new Set(rows.map((row) => row.tail)).size} 个追加字；「了／与／在」及各组获胜对象的最终追加路径均另行查询真实提交，并与预期逐条核对。完整明细见 [码长 TSV](${existsSync(join(directory, "measured-extended.json")) ? "measured-extended.tsv" : "measured.tsv"})，排除片段、核验结果和运行库 SHA-256 见对应 JSON。`,
	"",
	`真实提交核对剔除了 ${measured.rejectedAppendRoutes?.length ?? 0} 条模型追加反例，然后重新求解并验证替代路径；反例记录保留在 JSON 的 rejectedAppendRoutes。比如「母是」的「mueaa/」实际会提交「母a是」，说明「目标在首选」仍不代表前缀编码被完整消费。此类路径不计为有效省键路径。未逐条核验的其他低排名候选仍仅作模型筛选结果。`,
	"",
	"以下把三组独立样本合并，原 5500 字不参与选择默认字；这是三个指定文体近似等量的比较，不声称符合某个人真实输入的文体权重。",
	"",
	"| 方案 | 独立样本中较了省键最多的前五字（净省键数） | 与／在／了净省键数 |",
	"| --- | --- | --- |",
	...schemes.map((scheme) => {
		const totals = [...new Set(rows.map((row) => row.tail))]
			.map((tail) => ({
				tail,
				selections: rows
					.filter(
						(row) =>
							row.scheme === scheme &&
							row.tail === tail &&
							row.group !== "original5500",
					)
					.reduce((sum, row) => sum + row.selections, 0),
				saved: rows
					.filter(
						(row) =>
							row.scheme === scheme &&
							row.tail === tail &&
							row.group !== "original5500",
					)
					.reduce((sum, row) => sum + row.saved, 0),
			}))
			.sort((a, b) => a.selections - b.selections || b.saved - a.saved);
		return `| ${scheme} | ${totals
			.slice(0, 5)
			.map((row) => `${row.tail}（${row.saved > 0 ? "+" : ""}${row.saved}）`)
			.join(
				"、",
			)} | ${["与", "在", "了"].map((tail) => totals.find((row) => row.tail === tail)!.saved).join("／")} |`;
	}),
	"",
	"键义同时包含空输入时直接输出该字；完整明细分别保留 directUses（单独按 `/`）与 appendUses（候选后追加）。不能把两者的总次数都称为「候选后追加次数」。自然语言中「单独成词」也不同于输入法中的「单独编码」：即使「了」在语言学分词中独立，词库仍可能把「推动了」作为一次输入。",
	"",
	`就三个近似等量的独立样本合计而言，冰雪四拼、冰雪鹤道的最省键对象仍为「了」，冰雪兰道是「是」（比「了」净省 ${landaoSaving} 键，约 ${landaoSavingPercent.toFixed(2)}% 总按键）。「与」在三个方案的独立样本合计中都比「了」费键。基于这轮证据，不建议把统一默认改成「与」；若要为冰雪兰道单独优化，「是」值得继续测，但现有收益很小。不能把三种代表性方案的结果当作另外六种方案已做过同样的跨语料实测。`,
	"",
	"## 判读边界",
	"",
	"追加键的收益取决于三个量：目标字在实际输入中的出现机会、它尚未被原有词语码吸收的比例，以及原来的独立输入／确认成本。因此「句子中间」不妨碍做追加字，「语言学词尾」也不是必要条件；但「句子里很常见」本身不足以保证省键。",
	"",
	"大规模字词频表用于检查文体偏向，三组真实抽样用于核对本仓库规则下的净收益。它们不是覆盖所有人的输入分布，也没有测手指舒适度、误击或真人习惯成本。通用默认应优先看多文体净收益，而专门写技术并列结构时可以单独考虑「与」。本实验不改生产键义。",
	"",
	"复现需保留原 5500 字评测的冻结源码及候选缓存（先前 compare-append-characters.ts / query-append-characters.ts 的输出）。然后在仓库根目录依次运行以下命令；新语料候选及编译缓存追加到 output/append-characters/ 下，重复测量可直接复用，实验结果不写入生产报告。",
	"",
	"```powershell",
	"bun add --cwd output/append-generalization opencc-js@1.0.5",
	"bun scripts/experiments/prepare-append-corpora.ts --download",
	"bun scripts/experiments/analyze-append-contexts.ts",
	"# RIME_DLL / RIME_SHARED_DATA 可沿用现有本地评测配置",
	"bun scripts/experiments/measure-append-corpora.ts --extended",
	"bun scripts/experiments/write-append-analysis.ts",
	"```",
	"",
	"## 56 条上下文索引",
	"",
	"| 序号 | 文体 | 上下文 | 原输入段 | `/→与` 后输入段 |",
	"| ---: | --- | --- | --- | --- |",
	...contexts.occurrences.map(
		(row: {
			number: number;
			genre: string;
			context: string;
			baseline: { word: string };
			appendYu: { word: string };
		}) =>
			`| ${row.number} | ${row.genre} | ${row.context} | ${row.baseline.word} | ${row.appendYu.word} |`,
	),
	"",
];
writeFileSync(join(directory, "analysis.md"), lines.join("\n"));
console.log(join(directory, "analysis.md"));
