import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	benchmarkHeatmapPath,
	benchmarkHeatmapReport,
	readHeatmapReport,
	renderBenchmarkHeatmap,
	renderBenchmarkHeatmapGallery,
	updateBenchmarkHeatmapReadme,
	validateHeatmapReport,
	type HeatmapScheme,
} from "../../lib/benchmark-heatmaps";
import { countBenchmarkKeys } from "../../lib/benchmark-key-counts";
import { rootPath } from "../../lib/paths";

const report = readHeatmapReport();
const read = (path: string) => readFileSync(rootPath(path), "utf8");
const svgCounts = (svg: string) =>
	Object.fromEntries(
		[...svg.matchAll(/<g data-mxkey="([^"]+)"><title>[^<]+：(\d+) 次/gu)].map(
			(match) => [match[1], Number(match[2])],
		),
	);

test("十二张紫色图逐键等于 5500 字报告及十一场景之和", () => {
	validateHeatmapReport(report);
	assert.equal(Object.keys(report.schemes).length, 12);
	for (const [id, scheme] of Object.entries(report.schemes)) {
		const svg = read(benchmarkHeatmapPath(id));
		assert.equal(svg, renderBenchmarkHeatmap(scheme), id);
		assert.deepEqual(svgCounts(svg), scheme.total.frequencies, id);
		assert.ok(svg.includes('fill="#f8f7ff"'), id);
		for (const [key, count] of Object.entries(scheme.total.frequencies))
			assert.ok(
				svg.includes(`${((count / scheme.total.keys) * 100).toFixed(3)}%`),
				`${id}/${key}`,
			);
	}
	const stale = structuredClone(report);
	stale.schemes["rc26-shape"].total.frequencies[","]--;
	assert.throws(() => validateHeatmapReport(stale), /逐场景键频/u);
});

test("词长直选计入 Shift 与标点键，逻辑选重不冒充数字键", () => {
	const total = countBenchmarkKeys(["abcd<", "efgh>", "a'[2]", "xh[候选2]"]);
	const scheme: HeatmapScheme = { name: "示例", total, scenes: [] };
	const svg = renderBenchmarkHeatmap(scheme);
	const counts = svgCounts(svg);
	assert.equal(counts.Shift, 2);
	assert.equal(counts[","], 1);
	assert.equal(counts["."], 1);
	assert.equal(counts["2"], 1);
	assert.equal(counts.Candidate2, 1);
	assert.equal(counts["'"], 1);
	assert.ok(svg.includes("候选 2（逻辑）"));
	assert.equal(counts["1"], undefined);
	assert.throws(
		() =>
			renderBenchmarkHeatmap({
				...scheme,
				total: { ...total, frequencies: { Enter: 1 } },
			}),
		/缺少按键/u,
	);
});

test("两份 README 三语分别展示六个现行成员，十二方案报告图集与生成器一致", () => {
	for (const path of ["README.md", "README_CN.md"]) {
		const markdown = read(path);
		assert.equal(
			updateBenchmarkHeatmapReadme(markdown, report),
			markdown,
			path,
		);
		for (const id of [
			"rc26-shape",
			"rc26-tone",
			"oc21-shape",
			"oc21-tone",
			"liandao",
			"zhudao",
		])
			assert.equal(
				markdown.split(`](${benchmarkHeatmapPath(id)})`).length - 1,
				3,
				`${path}/${id}`,
			);
		for (const anchor of [
			"shenyun-rc26",
			"shenyun-ued-3158ce08b5bc",
			"liandao",
			"zhudao",
		]) {
			const blocks = [
				...markdown.matchAll(
					new RegExp(`<!-- benchmark-heatmaps:${anchor} -->`, "gu"),
				),
			];
			assert.equal(blocks.length, 3, `${path}/${anchor}`);
			for (const block of blocks) {
				const before = markdown.slice(0, block.index);
				assert.match(
					before,
					new RegExp(
						`!\\[[^\\n]*\\]\\(docs/${anchor}-keyboard-heat\\.svg\\)\\n\\n[^\\n]+\\n\\n$`,
						"u",
					),
				);
			}
		}
	}
	const gallery = renderBenchmarkHeatmapGallery(report);
	assert.ok(read(benchmarkHeatmapReport).includes(gallery));
	for (const id of Object.keys(report.schemes))
		assert.equal(
			gallery.split(`](../${benchmarkHeatmapPath(id)})`).length - 1,
			1,
			id,
		);
});

test("上下翻页各绘制实际次数，与选重键分开", () => {
	const total = countBenchmarkKeys(["ab{PageDown}{PageDown}{PageUp}[2]"]);
	const counts = svgCounts(
		renderBenchmarkHeatmap({ name: "翻页示例", total, scenes: [] }),
	);
	assert.equal(counts.PageDown, 2);
	assert.equal(counts.PageUp, 1);
	assert.equal(counts["2"], 1);
});
