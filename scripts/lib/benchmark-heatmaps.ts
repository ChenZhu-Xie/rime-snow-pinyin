import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import {
	benchmarkFunctionKeys,
	type BenchmarkKeyCounts,
} from "./benchmark-key-counts";
import { rootPath } from "./paths";

export const benchmarkHeatmapTitle = "十一场景 5500 字最优路径全按键键频图";
export const benchmarkHeatmapReport =
	"reports/十一场景_5500字_当前十二方案对比评测.md";
export const benchmarkHeatmapData =
	"reports/5500字_当前十二方案最优切分实测结果.json";

export interface HeatmapScheme {
	name: string;
	total: BenchmarkKeyCounts;
	scenes: BenchmarkKeyCounts[];
}

export interface HeatmapReport {
	corpus: {
		scenes: number;
		hanCharacters: number;
		punctuationCharacters: number;
	};
	schemes: Record<string, HeatmapScheme>;
}

export function readHeatmapReport(): HeatmapReport {
	return JSON.parse(readFileSync(rootPath(benchmarkHeatmapData), "utf8"));
}

export function benchmarkHeatmapPath(id: string): string {
	assert.match(id, /^[a-z0-9-]+$/u);
	return `docs/benchmark-${id}-5500-keyboard-heat.svg`;
}

export function validateHeatmapReport(report: HeatmapReport): void {
	assert.deepEqual(report.corpus, {
		...report.corpus,
		scenes: 11,
		hanCharacters: 5500,
		punctuationCharacters: 392,
	});
	for (const [id, scheme] of Object.entries(report.schemes)) {
		assert.equal(scheme.scenes.length, 11, `${id}/场景数`);
		const frequencies: Record<string, number> = {};
		for (const scene of scheme.scenes) {
			for (const [key, count] of Object.entries(scene.frequencies)) {
				assert.ok(Number.isSafeInteger(count) && count >= 0, `${id}/${key}`);
				frequencies[key] = (frequencies[key] ?? 0) + count;
			}
		}
		assert.deepEqual(frequencies, scheme.total.frequencies, `${id}/逐场景键频`);
		for (const field of [
			"keys",
			"spaces",
			"shifts",
			"selections",
			"pageTurns",
		] as const)
			assert.equal(
				scheme.scenes.reduce((sum, scene) => sum + scene[field], 0),
				scheme.total[field],
				`${id}/${field}`,
			);
		assert.equal(
			Object.values(frequencies).reduce((sum, count) => sum + count, 0),
			scheme.total.keys,
			`${id}/总按键`,
		);
		assert.equal(frequencies.Space ?? 0, scheme.total.spaces, `${id}/Space`);
		assert.equal(frequencies.Shift ?? 0, scheme.total.shifts, `${id}/Shift`);
		assert.equal(
			(frequencies.PageUp ?? 0) + (frequencies.PageDown ?? 0),
			scheme.total.pageTurns,
			`${id}/翻页键`,
		);
		for (const key of benchmarkFunctionKeys)
			assert.equal(
				scheme.scenes.reduce((sum, scene) => sum + scene.functionKeys[key], 0),
				scheme.total.functionKeys[key],
				`${id}/功能键 ${key}`,
			);
	}
}

function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

// 延续历史紫色图的键帽尺寸、错位与颜色；逻辑选重另列，避免假定物理键位。
export function renderBenchmarkHeatmap(scheme: HeatmapScheme): string {
	const { frequencies, keys, spaces, shifts, selections } = scheme.total;
	const maximum = Math.max(...Object.values(frequencies));
	const hasDigits = [..."`1234567890-"].some((key) => frequencies[key] > 0);
	const top = hasDigits ? 110 : 22;
	const specs: Array<{
		key: string;
		label: string;
		x: number;
		y: number;
		width: number;
	}> = [];
	const addRow = (row: string, x: number, y: number) => {
		for (const [i, key] of [...row].entries())
			specs.push({ key, label: key, x: x + i * 76, y, width: 68 });
	};
	if (hasDigits) addRow("`1234567890-", 18, 22);
	addRow("QWERTYUIOP[]", 18, top);
	addRow(frequencies["'"] ? "ASDFGHJKL;'\\" : "ASDFGHJKL;\\", 56, top + 88);
	specs.push({ key: "Shift", label: "Shift", x: 18, y: top + 176, width: 106 });
	addRow("ZXCVBNM,./", 132, top + 176);
	specs.push({
		key: "Space",
		label: "Space",
		x: 285,
		y: top + 264,
		width: 370,
	});
	const logical = Object.keys(frequencies).filter((key) =>
		/^Candidate[1-9]$/u.test(key),
	);
	const extraKeys = [
		...logical.sort(),
		...["PageUp", "PageDown"].filter((key) => frequencies[key] > 0),
	];
	for (const [i, key] of extraKeys.entries())
		specs.push({
			key,
			label: key.startsWith("Candidate") ? `候选 ${key.slice(9)}（逻辑）` : key,
			x: 18 + i * 180,
			y: top + 354,
			width: 172,
		});
	const height = top + 354 + (extraKeys.length > 0 ? 88 : 0);
	const known = new Set(specs.map(({ key }) => key));
	for (const [key, count] of Object.entries(frequencies))
		assert.ok(count === 0 || known.has(key), `键盘图缺少按键：${key}`);
	const groups = specs.flatMap(({ key, label, x, y, width }) => {
		const count = frequencies[key] ?? 0;
		if (count === 0) return [];
		const ratio = count / maximum;
		const color = [244, 242, 255].map((low, i) =>
			Math.round(low + ([94, 67, 184][i] - low) * ratio),
		);
		const foreground = ratio >= 0.62 ? "#ffffff" : "#30275a";
		const secondary = ratio >= 0.62 ? "#eeeaff" : "#655b82";
		const percentage = ((count / keys) * 100).toFixed(3);
		const center = x + width / 2;
		return `<g data-mxkey="${escapeXml(key)}"><title>${escapeXml(label)}：${count} 次，${percentage}%</title><rect x="${x}" y="${y}" width="${width}" height="76" rx="7" fill="rgb(${color.join(", ")})" stroke="#a89dc9"/><text x="${x + 10}" y="${y + 23}" font-size="${label.length > 2 ? 14 : 18}" fill="${foreground}">${escapeXml(label)}</text><text x="${center}" y="${y + 49}" text-anchor="middle" font-size="14" fill="${foreground}">${percentage}%</text><text x="${center}" y="${y + 65}" text-anchor="middle" font-size="10" fill="${secondary}">${count} 次</text></g>`;
	});
	const description = `${scheme.name}；来自当前十二方案最优切分逐键回放，共十一场景、5500 汉字、392 标点、${keys} 次实际按键；包含编码、辅码、定位、略码、词长直选、Space（${spaces} 次）、Shift（${shifts} 次）、标点与选重（${selections} 次）；只绘制非 0 按键，百分比分母为全部实际按键。第十篇与独立赛文相同，按两个场景计入。${logical.length ? "CandidateN 单独表示逻辑选重，不假定物理键位。" : ""}`;
	const width = frequencies["'"] ? 1016 : 940;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc"><title id="title">${benchmarkHeatmapTitle}</title><desc id="desc">${escapeXml(description)}</desc><rect width="${width}" height="${height}" fill="#f8f7ff"/>${groups.join("")}</svg>\n`;
}

export function writeBenchmarkHeatmaps(
	report: HeatmapReport,
	check = false,
): void {
	validateHeatmapReport(report);
	for (const [id, scheme] of Object.entries(report.schemes)) {
		const path = rootPath(benchmarkHeatmapPath(id));
		const svg = renderBenchmarkHeatmap(scheme);
		if (check)
			assert.equal(readFileSync(path, "utf8"), svg, `${path} 需要重新生成`);
		else writeFileSync(path, svg);
	}
}

export function renderBenchmarkHeatmapGallery(report: HeatmapReport): string {
	return [
		"## 实际击键热力图",
		"按上述 5500 字最优路径的全部实际按键绘制，延续历史紫色键频图样式。每键显示次数及占总按键的百分比，颜色按本图最高键频归一化。包括辅码、定位、略码、词长直选、Space、Shift、标点和选重；计数为零的键不绘制。Shift 不区分左右手；清风版 CandidateN 单列为逻辑选重，不假定物理键位。第十篇与独立赛文按两个场景计入。",
		...Object.entries(report.schemes)
			.sort(([, a], [, b]) => a.total.keys - b.total.keys)
			.flatMap(([id, scheme]) => [
				`### ${scheme.name}`,
				`共 ${scheme.total.keys} 键，Space ${scheme.total.spaces}、Shift ${scheme.total.shifts}、选重 ${scheme.total.selections}。`,
				`![${scheme.name} · 5500 字实际击键热力图](../${benchmarkHeatmapPath(id)})`,
			]),
	].join("\n\n");
}

export function updateBenchmarkHeatmapReadme(
	markdown: string,
	report: HeatmapReport,
): string {
	markdown = markdown.replaceAll("\r\n", "\n");
	markdown = markdown.replace(
		/<!-- benchmark-heatmaps:[^\n]+ -->\n[\s\S]*?<!-- \/benchmark-heatmaps -->\n\n/gu,
		"",
	);
	for (const [anchor, ids] of [
		["shenyun-rc26", ["rc26-shape", "rc26-tone"]],
		["shenyun-ued-3158ce08b5bc", ["oc21-shape", "oc21-tone"]],
		["liandao", ["liandao"]],
		["zhudao", ["zhudao"]],
	] as const) {
		// 紧随纯双拼图及其说明；两种辅码成员必须分别展示实际路径。
		const pattern = new RegExp(
			`(!\\[[^\\n]*\\]\\(docs/${anchor}-keyboard-heat\\.svg\\)\\n\\n[^\\n]+\\n\\n)`,
			"gu",
		);
		assert.equal(
			[...markdown.matchAll(pattern)].length,
			3,
			`README 缺少 ${anchor} 的三语纯双拼图`,
		);
		markdown = markdown.replace(pattern, (prefix, _capture, offset: number) => {
			const before = markdown.slice(0, offset);
			const language =
				before.lastIndexOf("## 繁體中文") >= 0
					? "zht"
					: before.lastIndexOf("## English") >= 0
						? "en"
						: "zh";
			const title =
				language === "en"
					? "**All-key frequency maps over eleven scenarios and 5,500 Chinese characters**"
					: language === "zht"
						? "**十一場景 5500 字最優路徑全按鍵鍵頻圖**"
						: `**${benchmarkHeatmapTitle}**`;
			const intro =
				language === "en"
					? "Actual optimal-path keystrokes include auxiliaries, Space, Shift, punctuation and selection. Each key shows its count and share of all keystrokes; colors are normalized within each map. Article 10 is also counted as the standalone scenario."
					: language === "zht"
						? "依目前最優路徑統計全部實際按鍵，包含輔碼、Space、Shift、標點、詞長直選與選重；每鍵顯示次數及占總按鍵的百分比，顏色按本圖最高鍵頻歸一化。第十篇與獨立賽文按兩個場景計入。"
						: "按当前最优路径统计全部实际按键，包含辅码、Space、Shift、标点、词长直选与选重；每键显示次数及占总按键的百分比，颜色按本图最高键频归一化。第十篇与独立赛文按两个场景计入。";
			const maps = ids.flatMap((id) => {
				const scheme = report.schemes[id];
				assert.ok(scheme, `缺少热力图方案 ${id}`);
				const { keys, spaces, shifts, selections } = scheme.total;
				const stats =
					language === "en"
						? `${keys} keys; Space ${spaces}, Shift ${shifts}, selections ${selections}.`
						: `${keys} ${language === "zht" ? "鍵" : "键"}；Space ${spaces}、Shift ${shifts}、${language === "zht" ? "選重" : "选重"} ${selections}。`;
				return [
					`**${scheme.name}** · ${stats}`,
					`![${scheme.name} · 5500](${benchmarkHeatmapPath(id)})`,
				];
			});
			const links =
				language === "en"
					? `[All twelve schemes](${benchmarkHeatmapReport}#实际击键热力图) · [Raw key counts](${benchmarkHeatmapData})`
					: language === "zht"
						? `[十二方案完整熱力圖](${benchmarkHeatmapReport}#实际击键热力图) · [原始鍵頻資料](${benchmarkHeatmapData})`
						: `[十二方案完整热力图](${benchmarkHeatmapReport}#实际击键热力图) · [原始键频数据](${benchmarkHeatmapData})`;
			return (
				prefix +
				[
					`<!-- benchmark-heatmaps:${anchor} -->`,
					title,
					intro,
					...maps,
					links,
					"<!-- /benchmark-heatmaps -->",
				].join("\n\n") +
				"\n\n"
			);
		});
	}
	return markdown;
}
