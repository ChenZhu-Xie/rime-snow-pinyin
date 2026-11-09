// 从十四方案最优切分逐键回放生成神韵 5500 字全按键键频图。

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	ALL_BENCHMARK_SCHEMES,
	type BenchmarkSchemeId,
} from "./lib/benchmark-schemes";
import { rootPath } from "./lib/paths";

const title = "十一场景 5500 字最优路径全按键键频图";
const replayDirectory = rootPath("reports", "十篇五百字_十四方案逐键对齐回放");
const benchmarkReportPath = rootPath(
	"reports",
	"5000字_十四方案最优切分实测结果.json",
);
const outputReportPath = rootPath(
	"reports",
	"神韵十一场景_5500字_最优路径全按键键频.json",
);

interface Layout {
	id: BenchmarkSchemeId;
	displayName: string;
	benchmarkName: string;
	filename: string;
	auxiliaryKeys: readonly string[];
}

interface ArticleStat {
	id: number;
	keys: number;
	spaces: number;
	shifts: number;
}

interface SchemeStat {
	total: {
		keys: number;
		spaces: number;
		shifts: number;
		selections: { total: number };
	};
	articles: ArticleStat[];
}

interface BenchmarkReport {
	schemes: Record<string, SchemeStat>;
}

interface KeyCounts {
	counts: Map<string, number>;
	totalKeystrokes: number;
	spaces: number;
	shifts: number;
	selections: number;
}

interface KeySpec {
	key: string;
	label: string;
	x: number;
	y: number;
	width: number;
}

const benchmarkSchemes = new Map(
	ALL_BENCHMARK_SCHEMES.map((scheme) => [scheme.id, scheme]),
);
const layouts: readonly Layout[] = [
	{
		id: "d3v1-shape",
		displayName: "D3/V1 21×26",
		benchmarkName: benchmarkSchemes.get("d3v1-shape")?.name ?? "",
		filename: "shenyun-d3v1-5500-keyboard-heat.svg",
		auxiliaryKeys: [..."AEUIO"],
	},
	{
		id: "qz-shape",
		displayName: "QZ-e8f37a 21×21",
		benchmarkName: benchmarkSchemes.get("qz-shape")?.name ?? "",
		filename: "shenyun-qz-e8f37a-5500-keyboard-heat.svg",
		auxiliaryKeys: [..."AVUIO"],
	},
	{
		id: "overall17-first-shape",
		displayName: "Overall-17·初代 21×26",
		benchmarkName: benchmarkSchemes.get("overall17-first-shape")?.name ?? "",
		filename: "shenyun-overall17-5500-keyboard-heat.svg",
		auxiliaryKeys: [..."AEUIO"],
	},
	{
		id: "u357-first-shape",
		displayName: "U357·初代 21×21",
		benchmarkName: benchmarkSchemes.get("u357-first-shape")?.name ?? "",
		filename: "shenyun-u357-5500-keyboard-heat.svg",
		auxiliaryKeys: [..."AVUIO"],
	},
] as const;

if (layouts.some(({ benchmarkName }) => benchmarkName === ""))
	throw new Error("找不到热力图对应的 benchmark 方案。");

const replayFiles = readdirSync(replayDirectory)
	.filter((filename) => filename.endsWith(".md"))
	.sort((left, right) => left.localeCompare(right, "zh-CN"));
if (replayFiles.length !== 10)
	throw new Error(`逐键回放应有 10 篇，实际 ${replayFiles.length} 篇。`);
const duplicateReplay = replayFiles.find((filename) =>
	/^篇10_/u.test(filename),
);
if (!duplicateReplay) throw new Error("找不到作为独立场景重复计算的第 10 篇。");

const benchmarkReport = JSON.parse(
	readFileSync(benchmarkReportPath, "utf8"),
) as BenchmarkReport;

function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

function increment(counts: Map<string, number>, key: string): void {
	counts.set(key, (counts.get(key) ?? 0) + 1);
}

function emptyCounts(): KeyCounts {
	return {
		counts: new Map(),
		totalKeystrokes: 0,
		spaces: 0,
		shifts: 0,
		selections: 0,
	};
}

function press(result: KeyCounts, key: string): void {
	increment(result.counts, key);
	result.totalKeystrokes += 1;
	if (key === "Space") result.spaces += 1;
	if (key === "Shift") result.shifts += 1;
}

function countDisplayCode(displayCode: string, result: KeyCounts): void {
	const code = displayCode.replaceAll(/\s/gu, "");
	for (let index = 0; index < code.length; index += 1) {
		const character = code[index];
		if (character === "[") {
			const selection = code.slice(index).match(/^\[([0-9])\]/u);
			if (selection) {
				press(result, selection[1]);
				result.selections += 1;
				index += selection[0].length - 1;
			} else {
				press(result, character);
			}
			continue;
		}
		if (character === "?" || character === "⇧") {
			if (!/[A-Z]/u.test(code[index + 1] ?? ""))
				throw new Error(`无法识别逐键回放中的 Shift 标记：${displayCode}`);
			continue;
		}
		if (character === "_") {
			press(result, "Space");
			continue;
		}
		if (/[A-Z]/u.test(character)) {
			press(result, "Shift");
			press(result, character);
			continue;
		}
		if (/[a-z]/u.test(character)) {
			press(result, character.toUpperCase());
			continue;
		}
		if (/[0-9]/u.test(character)) {
			press(result, character);
			continue;
		}
		if (/^[\],.;\\/]$/u.test(character)) {
			press(result, character);
			continue;
		}
		throw new Error(`逐键回放含未建模按键 ${character}：${displayCode}`);
	}
}

function collectFiles(layout: Layout, filenames: readonly string[]): KeyCounts {
	const result = emptyCounts();
	const prefix = `${layout.benchmarkName} `;
	for (const filename of filenames) {
		const lines = readFileSync(join(replayDirectory, filename), "utf8")
			.split(/\r?\n/u)
			.filter((line) => line.startsWith(prefix));
		if (lines.length === 0)
			throw new Error(
				`${filename} 中找不到 ${layout.benchmarkName} 的逐键回放。`,
			);
		for (const line of lines)
			countDisplayCode(line.slice(prefix.length), result);
	}
	return result;
}

function mergeCounts(left: KeyCounts, right: KeyCounts): KeyCounts {
	const result = emptyCounts();
	for (const [key, count] of left.counts)
		result.counts.set(key, count + (right.counts.get(key) ?? 0));
	for (const [key, count] of right.counts)
		if (!result.counts.has(key)) result.counts.set(key, count);
	result.totalKeystrokes = left.totalKeystrokes + right.totalKeystrokes;
	result.spaces = left.spaces + right.spaces;
	result.shifts = left.shifts + right.shifts;
	result.selections = left.selections + right.selections;
	return result;
}

function assertCounts(
	label: string,
	actual: KeyCounts,
	expected: {
		keys: number;
		spaces: number;
		shifts: number;
		selections?: number;
	},
): void {
	for (const [field, actualValue, expectedValue] of [
		["总按键", actual.totalKeystrokes, expected.keys],
		["Space", actual.spaces, expected.spaces],
		["Shift", actual.shifts, expected.shifts],
		["选重", actual.selections, expected.selections],
	] as const) {
		if (expectedValue !== undefined && actualValue !== expectedValue)
			throw new Error(
				`${label} ${field}与 benchmark 不符：${actualValue} / ${expectedValue}。`,
			);
	}
}

function collectCounts(layout: Layout): KeyCounts {
	const stat = benchmarkReport.schemes[layout.id];
	if (!stat) throw new Error(`总报告缺少 ${layout.id}。`);
	const tenScenes = collectFiles(layout, replayFiles);
	assertCounts(`${layout.displayName} 十篇`, tenScenes, {
		keys: stat.total.keys,
		spaces: stat.total.spaces,
		shifts: stat.total.shifts,
		selections: stat.total.selections.total,
	});
	const article10 = stat.articles.find(({ id }) => id === 10);
	if (!article10) throw new Error(`${layout.displayName} 总报告缺少第 10 篇。`);
	const standaloneScene = collectFiles(layout, [duplicateReplay!]);
	assertCounts(
		`${layout.displayName} 独立 500 字场景`,
		standaloneScene,
		article10,
	);
	return mergeCounts(tenScenes, standaloneScene);
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

function keyboardSpecs(counts: ReadonlyMap<string, number>): {
	specs: KeySpec[];
	height: number;
} {
	const hasDigits = [..."1234567890"].some((key) => (counts.get(key) ?? 0) > 0);
	const top = hasDigits ? 110 : 22;
	const specs: KeySpec[] = [];
	const addRow = (keys: string, x: number, y: number) => {
		for (const [index, key] of [...keys].entries())
			specs.push({ key, label: key, x: x + index * 76, y, width: 68 });
	};
	if (hasDigits) addRow("1234567890", 94, 22);
	addRow("QWERTYUIOP[]", 18, top);
	addRow("ASDFGHJKL;\\", 56, top + 88);
	specs.push({ key: "Shift", label: "Shift", x: 18, y: top + 176, width: 106 });
	addRow("ZXCVBNM,./", 132, top + 176);
	specs.push({
		key: "Space",
		label: "Space",
		x: 285,
		y: top + 264,
		width: 370,
	});
	return { specs, height: top + 354 };
}

function renderSvg(layout: Layout, result: KeyCounts): string {
	const { counts, totalKeystrokes, spaces, shifts, selections } = result;
	const maximum = Math.max(...counts.values());
	const { specs, height } = keyboardSpecs(counts);
	const known = new Set(specs.map(({ key }) => key));
	const unknown = [...counts].filter(
		([key, count]) => count > 0 && !known.has(key),
	);
	if (unknown.length > 0)
		throw new Error(
			`键盘图缺少非 0 按键：${unknown.map(([key]) => key).join("、")}`,
		);
	const groups: string[] = [];
	for (const { key, label, x, y, width } of specs) {
		const count = counts.get(key) ?? 0;
		if (count === 0) continue;
		const percentage = (count / totalKeystrokes) * 100;
		const foreground = count / maximum >= 0.62 ? "#ffffff" : "#30275a";
		const secondary = count / maximum >= 0.62 ? "#eeeaff" : "#655b82";
		const center = x + width / 2;
		groups.push(
			`<g data-mxkey="${escapeXml(key)}"><title>${escapeXml(label)}：${count} 次，${percentage.toFixed(3)}%</title><rect x="${x}" y="${y}" width="${width}" height="76" rx="7" fill="${heatColor(count, maximum)}" stroke="#a89dc9"/><text x="${x + 10}" y="${y + 23}" font-size="${label.length > 2 ? 14 : 18}" fill="${foreground}">${escapeXml(label)}</text><text x="${center}" y="${y + 49}" text-anchor="middle" font-size="14" fill="${foreground}">${percentage.toFixed(3)}%</text><text x="${center}" y="${y + 65}" text-anchor="middle" font-size="10" fill="${secondary}">${count} 次</text></g>`,
		);
	}
	const description = `${layout.displayName}；来自十四方案最优切分逐键回放，共十一场景、5500 汉字、392 标点、${totalKeystrokes} 次实际按键；包含短码、五辅键、Space、Shift、标点与选重，选重为 ${selections} 次；只绘制计数非 0 的按键。第 10 篇按十篇语料和独立赛文两个场景计两遍。`;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 940 ${height}" role="img" aria-labelledby="title desc"><title id="title">${title}</title><desc id="desc">${description}</desc><rect width="940" height="${height}" fill="#f8f7ff"/>${groups.join("")}</svg>\n`;
}

const previousSummary = existsSync(outputReportPath)
	? (JSON.parse(readFileSync(outputReportPath, "utf8")) as {
			contract?: string;
			corpus?: unknown;
			layouts?: Record<string, unknown>;
			historical?: unknown;
		})
	: {};
const historical =
	previousSummary.contract === "snow-shenyun-5500-optimal-path-all-keys-v2"
		? {
				contract: previousSummary.contract,
				corpus: previousSummary.corpus,
			}
		: previousSummary.historical;
const summary: Record<string, unknown> = {
	contract: "snow-shenyun-5500-optimal-path-all-keys-v3",
	historical,
	corpus: {
		scenes: 11,
		hanCharacters: 5500,
		punctuationCharacters: 392,
		source: "reports/十篇五百字_十四方案逐键对齐回放",
		note: "十篇 500 字最优切分逐键回放加独立 500 字赛文；独立赛文与第 10 篇相同，按两个场景计两遍。所有实际非 0 按键均计入。",
	},
	layouts: { ...previousSummary.layouts },
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
		auxiliaryKeys: layout.auxiliaryKeys,
		totalKeystrokes: result.totalKeystrokes,
		spaces: result.spaces,
		shifts: result.shifts,
		selections: result.selections,
		nonZeroKeys: result.counts.size,
		counts: Object.fromEntries(result.counts),
	};
	console.log(
		`${layout.displayName}：${result.totalKeystrokes} 键，Space ${result.spaces}，Shift ${result.shifts}，选重 ${result.selections}。`,
	);
}

writeFileSync(
	outputReportPath,
	`${JSON.stringify(summary, null, 2)}\n`,
	"utf8",
);
