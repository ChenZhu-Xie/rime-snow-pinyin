// 只读取已验证的 5500 字报告，不调用 Rime 或重跑最优切分。
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import {
	benchmarkHeatmapReport,
	readHeatmapReport,
	renderBenchmarkHeatmapGallery,
	updateBenchmarkHeatmapReadme,
	writeBenchmarkHeatmaps,
} from "./lib/benchmark-heatmaps";
import { rootPath } from "./lib/paths";

const check = process.argv.includes("--check");
const report = readHeatmapReport();
writeBenchmarkHeatmaps(report, check);
for (const filename of ["README.md", "README_CN.md", benchmarkHeatmapReport]) {
	const path = rootPath(filename);
	const source = readFileSync(path, "utf8");
	const updated = filename.startsWith("README")
		? updateBenchmarkHeatmapReadme(source, report)
		: source.replace(
				/(?:## 实际击键热力图\n[\s\S]*?)?## 带调方案规则/u,
				`${renderBenchmarkHeatmapGallery(report)}\n\n## 带调方案规则`,
			);
	if (check) assert.equal(source, updated, `${filename} 需要重新生成`);
	else if (source !== updated) writeFileSync(path, updated);
}
console.log(
	`${check ? "已校验" : "已生成"} ${Object.keys(report.schemes).length} 份 5500 字实际击键热力图及文档。`,
);
