// 先在 output/append-generalization 安装 opencc-js@1.0.5，再用 --download 获取固定语料。
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "csv-parse/sync";
import { unzipSync } from "fflate";
import { rootPath } from "../lib/paths";

const directory = rootPath("output/append-generalization");
const data = join(directory, "data");
mkdirSync(data, { recursive: true });
const sources = [
	[
		"subtlex.zip",
		"https://journals.plos.org/plosone/article/file?type=supplementary&id=10.1371/journal.pone.0010729.s002",
		"cced9cb382914b93956a24fd06c10de709d351ff4501ac94c9ab136004421f07",
	],
	[
		"hotel.csv",
		"https://raw.githubusercontent.com/SophonPlus/ChineseNlpCorpus/master/datasets/ChnSentiCorp_htl_all/ChnSentiCorp_htl_all.csv",
		"1d414b9c65caf3a836abdb4efded621968502ad3338e1a9d885ae131c86083f0",
	],
	[
		"gsd-train.conllu",
		"https://raw.githubusercontent.com/UniversalDependencies/UD_Chinese-GSDSimp/r2.17/zh_gsdsimp-ud-train.conllu",
		"956636fe612a1166e8b19e7413fee2e73d68231aca2f0455be2c616b947d629d",
	],
	[
		"gsd-dev.conllu",
		"https://raw.githubusercontent.com/UniversalDependencies/UD_Chinese-GSDSimp/r2.17/zh_gsdsimp-ud-dev.conllu",
		"d03f1eeb93b16071bfbbe6c76b971554be87c9a2307b3f3a820dd7c07f73fb63",
	],
	[
		"gsd-test.conllu",
		"https://raw.githubusercontent.com/UniversalDependencies/UD_Chinese-GSDSimp/r2.17/zh_gsdsimp-ud-test.conllu",
		"3af8046a6f32477b4d5cf3dd06bbf38682a380fe77aade3f68de97e51ab94900",
	],
	[
		"pud.conllu",
		"https://raw.githubusercontent.com/UniversalDependencies/UD_Chinese-PUD/r2.17/zh_pud-ud-test.conllu",
		"e12582af2e2bbc2e27155ca7dc12b6fc4a037dbc716e1f805d67e34ffb2596b3",
	],
].map(([filename, url, sha256]) => ({ filename, url, sha256 }));
await Promise.all(
	sources.map(async (source) => {
		const path = join(data, source.filename);
		if (!existsSync(path)) {
			assert.ok(
				process.argv.includes("--download"),
				`缺少 ${path}；加 --download 获取固定语料`,
			);
			const response = await fetch(source.url);
			assert.ok(response.ok, `${source.url}: ${response.status}`);
			writeFileSync(path, new Uint8Array(await response.arrayBuffer()));
		}
		assert.equal(
			createHash("sha256").update(readFileSync(path)).digest("hex"),
			source.sha256,
			`来源内容改变：${source.filename}`,
		);
	}),
);
for (const [name, bytes] of Object.entries(
	unzipSync(readFileSync(join(data, "subtlex.zip"))),
)) {
	assert.ok(
		["SUBTLEX-CH-CHR", "SUBTLEX-CH-WF", "SUBTLEX-CH-WF_PoS"].includes(name),
		`不认识的附件文件：${name}`,
	);
	writeFileSync(join(data, name), bytes);
}
assert.ok(
	existsSync(join(directory, "node_modules/opencc-js/dist/esm/full.js")),
	"先运行 bun add --cwd output/append-generalization opencc-js@1.0.5",
);
const OpenCC = await import(
	pathToFileURL(join(directory, "node_modules/opencc-js/dist/esm/full.js")).href
);
const convert = OpenCC.Converter({ from: "tw", to: "cn" });
const targets = [..."与在了的是和有不中也地得着过"];
const sha = (value: string | Uint8Array) =>
	createHash("sha256").update(value).digest("hex");
const han = (text: string) =>
	[...text].filter((character) => /\p{Script=Han}/u.test(character)).length;
interface Document {
	id: string;
	text: string;
	tokens?: string[];
}
function conllu(filename: string): Document[] {
	return readFileSync(join(data, filename), "utf8")
		.trim()
		.split(/\r?\n\r?\n/u)
		.map((block) => {
			const lines = block.split(/\r?\n/u);
			return {
				id:
					filename +
					"/" +
					lines.find((line) => line.startsWith("# sent_id = "))!.slice(12),
				text: convert(
					lines.find((line) => line.startsWith("# text = "))!.slice(9),
				),
				tokens: lines
					.filter((line) => /^\d+\t/u.test(line))
					.map((line) => convert(line.split("\t")[1])),
			};
		});
}
const groups: Array<{
	id: string;
	description: string;
	documents: Document[];
}> = [
	{
		id: "gsd",
		description: "UD Chinese-GSDSimp r2.17，百科文本，已简化字转换",
		documents: [
			"gsd-train.conllu",
			"gsd-dev.conllu",
			"gsd-test.conllu",
		].flatMap(conllu),
	},
	{
		id: "pud",
		description: "UD Chinese-PUD r2.17，新闻与百科，OpenCC 1.0.5 tw→cn",
		documents: conllu("pud.conllu"),
	},
	{
		id: "hotel",
		description:
			"ChnSentiCorp_htl_all，携程酒店评论，去空、去重复后 OpenCC tw→cn",
		documents: (
			parse(readFileSync(join(data, "hotel.csv"), "utf8"), {
				columns: true,
				skip_empty_lines: true,
			}) as Array<{ review: string }>
		)
			.filter((row) => row.review)
			.map((row, index) => ({
				id: `hotel/${index + 1}`,
				text: convert(row.review),
			})),
	},
];
const corpora = groups.map((group) => {
	const documents = [
		...new Map(group.documents.map((doc) => [doc.text, doc])).values(),
	];
	const characters = documents.reduce((sum, doc) => sum + han(doc.text), 0);
	const counts = Object.fromEntries(
		targets.map((target) => [
			target,
			documents.reduce(
				(sum, doc) =>
					sum +
					[...doc.text].filter((character) => character === target).length,
				0,
			),
		]),
	);
	const tokenCounts = Object.fromEntries(
		targets.map((target) => {
			const occurrences = documents
				.flatMap((doc) => doc.tokens ?? [])
				.filter((word) => word.includes(target));
			return [
				target,
				{
					singleton: occurrences.filter((word) => word === target).length,
					inWords2: occurrences.filter((word) => [...word].length === 2).length,
					inWords3: occurrences.filter((word) => [...word].length === 3).length,
					inWords4plus: occurrences.filter((word) => [...word].length >= 4)
						.length,
				},
			];
		}),
	);
	// 与测试结果无关的固定哈希顺序，选取整篇／整句至至少 12000 汉字。
	const ordered = documents
		.map((doc) => ({ ...doc, hash: sha("append-independent-v1\0" + doc.text) }))
		.sort((a, b) => a.hash.localeCompare(b.hash));
	const sample: Document[] = [];
	let sampleHan = 0;
	for (const document of ordered) {
		if (!han(document.text)) continue;
		sample.push(document);
		sampleHan += han(document.text);
		if (sampleHan >= 12000) break;
	}
	const segments = sample.flatMap(
		(doc) => doc.text.match(/\p{Script=Han}{1,80}/gu) ?? [],
	);
	return {
		id: group.id,
		description: group.description,
		documents: documents.length,
		hanCharacters: characters,
		counts,
		tokenCounts: group.id === "hotel" ? null : tokenCounts,
		sample: {
			documents: sample,
			hanCharacters: sampleHan,
			segments,
			counts: Object.fromEntries(
				targets.map((target) => [
					target,
					sample.reduce(
						(sum, doc) =>
							sum +
							[...doc.text].filter((character) => character === target).length,
						0,
					),
				]),
			),
			segmentSha256: sha(JSON.stringify(segments)),
		},
	};
});
function frequency(filename: string) {
	return new Map(
		new TextDecoder("gb18030")
			.decode(readFileSync(join(data, filename)))
			.split(/\r?\n/u)
			.slice(3)
			.filter(Boolean)
			.map((line) => {
				const [word, count] = line.split("\t");
				return [word, Number(count)] as const;
			}),
	);
}
const characterFrequency = frequency("SUBTLEX-CH-CHR");
const wordFrequency = frequency("SUBTLEX-CH-WF");
const subtitles = {
	characterTokens: 46841097,
	wordTokens: 33546516,
	definition:
		"SUBTLEX-CH 原论文配套统计表；字频与单字词频分开，不将词频当作连续文本省键实测",
	counts: Object.fromEntries(
		targets.map((target) => [
			target,
			{
				character: characterFrequency.get(target) ?? 0,
				singletonWord: wordFrequency.get(target) ?? 0,
				mostFrequentCompounds: [...wordFrequency]
					.filter(([word]) => word !== target && word.includes(target))
					.sort((a, b) => b[1] - a[1])
					.slice(0, 12),
			},
		]),
	),
};
writeFileSync(
	join(directory, "corpora.json"),
	JSON.stringify(
		{
			sources,
			sampling:
				"每组先去重，再按固定 SHA-256 文本哈希排序，取整篇／句至至少12000汉字；按非汉字断开连续输入，超80字再分段；不按候选字筛选文本",
			corpora,
			subtitles,
		},
		null,
		2,
	) + "\n",
);
console.log(
	JSON.stringify(
		{
			corpora: corpora.map(({ sample, ...group }) => ({
				...group,
				sample: {
					documents: sample.documents.length,
					hanCharacters: sample.hanCharacters,
					counts: sample.counts,
				},
			})),
			subtitles,
		},
		null,
		2,
	),
);
