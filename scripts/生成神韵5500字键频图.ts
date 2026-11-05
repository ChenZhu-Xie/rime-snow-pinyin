// 从仓库的 5000 字与 500 字 benchmark 语料生成神韵纯双拼键频图。

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { exact500Articles } from "./exact_500_articles";
import {
	pronunciationCodes,
	type BenchmarkSchemeId,
} from "./lib/benchmark-schemes";
import { getPinyin } from "./lib/word-pinyin";
import { rootPath } from "./lib/paths";

const visibleKeys = [..."QWERTYUIOPASDFGHJKL;\\ZXCVBNM,."];
const rows = [
	{ keys: [..."QWERTYUIOP"], offset: 18 },
	{ keys: [..."ASDFGHJKL;\\"], offset: 37 },
	{ keys: [..."ZXCVBNM,."], offset: 75 },
] as const;
const punctuationKeys: Readonly<Record<string, string>> = {
	"，": ",",
	"。": ".",
	"、": "\\",
};
const title = "十一场景 5500 字实战赛文纯双拼键频图（含标点）";

interface Layout {
	id: BenchmarkSchemeId;
	displayName: string;
	filename: string;
}

const layouts: readonly Layout[] = [
	{
		id: "overall17-shape",
		displayName: "神韵(Overall-17) 21×26 双拼",
		filename: "shenyun-overall17-5500-keyboard-heat.svg",
	},
	{
		id: "u357-shape",
		displayName: "无飞键道(U357) 21×21 双拼",
		filename: "shenyun-u357-5500-keyboard-heat.svg",
	},
] as const;

const standaloneArticle = exact500Articles.find(({ id }) => id === 10);
if (!standaloneArticle) throw new Error("找不到单篇 500 字输入法赛文。 ");

// 仓库有一组十篇 500 字 benchmark，以及同一篇输入法赛文的独立 500 字 benchmark。
// 按任务指定的十一场景／5500 字口径，两组都计入；因此第 10 篇输入法赛文计两遍。
const scenes = [
	...exact500Articles.map((article) => ({
		name: `十篇语料·篇${article.id}`,
		lines: article.lines,
	})),
	{ name: "独立 500 字赛文", lines: standaloneArticle.lines },
];

function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

function normalizeSyllable(syllable: string): string {
	return syllable.replaceAll("\r", "").replaceAll("\n", "");
}

function increment(counts: Map<string, number>, key: string): void {
	counts.set(key, (counts.get(key) ?? 0) + 1);
}

function collectCounts(layout: Layout) {
	const counts = new Map(visibleKeys.map((key) => [key, 0]));
	let hanCount = 0;
	let punctuationCount = 0;
	for (const scene of scenes) {
		for (const line of scene.lines) {
			const characters = [...line].filter((character) =>
				/\p{Script=Han}/u.test(character),
			);
			const syllables = getPinyin(line).map(normalizeSyllable);
			if (characters.length !== syllables.length) {
				throw new Error(
					`${scene.name} 注音数量不符：${characters.length} 字／${syllables.length} 音节。`,
				);
			}
			hanCount += characters.length;
			for (const [index, character] of characters.entries()) {
				const code = pronunciationCodes(layout.id, character, [
					syllables[index],
				])
					.find(
						(candidate) =>
							candidate.mainLength === 2 && candidate.auxiliaryLength === 0,
					)
					?.code.toUpperCase();
				if (!code || code.length !== 2) {
					throw new Error(
						`${layout.displayName} 缺少 ${character}（${syllables[index]}）的双拼全码。`,
					);
				}
				for (const key of code) increment(counts, key);
			}
			for (const character of line) {
				const key = punctuationKeys[character];
				if (!key) continue;
				increment(counts, key);
				punctuationCount += 1;
			}
		}
	}
	const totalKeystrokes = [...counts.values()].reduce(
		(sum, count) => sum + count,
		0,
	);
	if (hanCount !== 5500)
		throw new Error(`十一场景应有 5500 汉字，实际 ${hanCount}。`);
	if (punctuationCount !== 392)
		throw new Error(`十一场景应有 392 个标点，实际 ${punctuationCount}。`);
	if (totalKeystrokes !== hanCount * 2 + punctuationCount) {
		throw new Error(
			`总键数应为 ${hanCount * 2 + punctuationCount}，实际 ${totalKeystrokes}。`,
		);
	}
	return { counts, hanCount, punctuationCount, totalKeystrokes };
}

function heatColor(count: number, maximum: number): string {
	const ratio = maximum === 0 ? 0 : count / maximum;
	const low = [244, 242, 255];
	const high = [94, 67, 184];
	const [red, green, blue] = low.map((value, index) =>
		Math.round(value + (high[index] - value) * ratio),
	);
	return `rgb(${red}, ${green}, ${blue})`;
}

function renderSvg(
	layout: Layout,
	result: ReturnType<typeof collectCounts>,
): string {
	const { counts, hanCount, punctuationCount, totalKeystrokes } = result;
	const maximum = Math.max(...counts.values());
	const groups: string[] = [];
	for (const [rowIndex, row] of rows.entries()) {
		for (const [columnIndex, key] of row.keys.entries()) {
			const count = counts.get(key) ?? 0;
			const percentage = (count / totalKeystrokes) * 100;
			const x = row.offset + columnIndex * 76;
			const y = 22 + rowIndex * 88;
			const foreground = count / maximum >= 0.62 ? "#ffffff" : "#30275a";
			const secondary = count / maximum >= 0.62 ? "#eeeaff" : "#655b82";
			groups.push(
				`<g data-mxkey="${escapeXml(key)}"><title>${escapeXml(key)}：${count} 次，${percentage.toFixed(3)}%</title><rect x="${x}" y="${y}" width="68" height="76" rx="7" fill="${heatColor(count, maximum)}" stroke="#a89dc9"/><text x="${x + 10}" y="${y + 23}" font-size="18" fill="${foreground}">${escapeXml(key)}</text><text x="${x + 34}" y="${y + 49}" text-anchor="middle" font-size="14" fill="${foreground}">${percentage.toFixed(3)}%</text><text x="${x + 34}" y="${y + 65}" text-anchor="middle" font-size="10" fill="${secondary}">${count} 次</text></g>`,
			);
		}
	}
	const description = `${layout.displayName}；来自本仓库十篇 500 字 benchmark 与独立 500 字赛文，共十一场景、${hanCount} 汉字、${punctuationCount} 标点、${totalKeystrokes} 次纯双拼及标点击键；独立赛文与十篇语料的第 10 篇相同，按两个 benchmark 场景计两遍；不含五辅键、空格和选重。顿号按反斜杠键计。`;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 885 304" role="img" aria-labelledby="title desc"><title id="title">${title}</title><desc id="desc">${description}</desc><rect width="885" height="304" fill="#f8f7ff"/>${groups.join("")}</svg>\n`;
}

const summary: Record<string, unknown> = {
	contract: "snow-shenyun-5500-double-pinyin-heatmap-v1",
	corpus: {
		scenes: scenes.length,
		hanCharacters: 5500,
		note: "十篇 500 字语料加独立 500 字赛文；独立赛文与十篇语料第 10 篇相同，按两个 benchmark 场景计两遍。",
		punctuationKeyMapping: punctuationKeys,
	},
	layouts: {},
};

for (const layout of layouts) {
	const result = collectCounts(layout);
	writeFileSync(
		rootPath("docs", layout.filename),
		renderSvg(layout, result),
		"utf8",
	);
	(summary.layouts as Record<string, unknown>)[layout.id] = {
		displayName: layout.displayName,
		totalKeystrokes: result.totalKeystrokes,
		counts: Object.fromEntries(result.counts),
	};
	console.log(
		`${layout.displayName}：${result.hanCount} 字，${result.punctuationCount} 标点，${result.totalKeystrokes} 键。`,
	);
}

writeFileSync(
	join(rootPath("reports"), "神韵十一场景_5500字_纯双拼键频.json"),
	`${JSON.stringify(summary, null, 2)}\n`,
	"utf8",
);
