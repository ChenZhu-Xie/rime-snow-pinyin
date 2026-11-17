import { readFileSync, writeFileSync } from "node:fs";
import { rootPath } from "./lib/paths";
import { readShenyunHints } from "./lib/shenyun-hints";

const { hints, vacant, vacantAA } = readShenyunHints();
Object.assign(hints, readShenyunHints(true).hints);
const lines = [
	"-- 由 scripts/generate-shenyun-hints.ts 生成，请勿手改。",
	"-- 单键后每个声声空桶只提示一个首选词，按该词的系统词频降序排列。",
	"",
	"---@class ShenyunHint",
	"---@field code string",
	"---@field text string",
	"---@field weight number",
	"",
	"---@type table<string, table<string, ShenyunHint[]>>",
	"local hints = {",
];
for (const [schema, entries] of Object.entries(hints)) {
	lines.push(`  ${schema} = {`);
	for (const initial of [...new Set(entries.map(({ code }) => code[0]))]) {
		lines.push(`    ${initial} = {`);
		for (const { code, text, weight } of entries.filter(
			(entry) => entry.code[0] === initial,
		)) {
			lines.push(
				`      { code = "${code}", text = ${JSON.stringify(text)}, weight = ${weight} },`,
			);
		}
		lines.push("    },");
	}
	lines.push("  },");
}
lines.push("}", "", "return hints", "");
const rendered = lines.join("\n");
const outputPath = rootPath("lua/snow/shenyun_hints.lua");
if (process.argv.includes("--check")) {
	if (readFileSync(outputPath, "utf8").replace(/\r\n/gu, "\n") !== rendered) {
		throw new Error("声声空桶提示不是当前词典、映射与固顶表的最新生成结果。");
	}
} else {
	writeFileSync(outputPath, rendered, "utf8");
}
console.log(
	`21×26：${vacant.length} 个声韵空桶，其中 ${vacantAA.length} 个声声空桶；${Object.entries(
		hints,
	)
		.map(([schema, entries]) => `${schema} 提示 ${entries.length} 桶`)
		.join("；")}。`,
);
