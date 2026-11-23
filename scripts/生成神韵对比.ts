import {
	generateCurrentBenchmark,
	writeCurrentBenchmarkReport,
} from "./lib/current-layout-benchmark";
import { readmeBenchmarkRows } from "./lib/readme-benchmark-rows";

const html = process.argv.find((arg) => arg.endsWith(".html"));
const check = process.argv.includes("--check");
if (html && check)
	throw new Error("--check 只校验已冻结的当前报告，不读取新 HTML");
if (html) generateCurrentBenchmark(html, readmeBenchmarkRows);
else writeCurrentBenchmarkReport(readmeBenchmarkRows, check);
