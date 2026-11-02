import { readFileSync, writeFileSync } from "node:fs";
import {
	loadAuxiliarySemantics,
	type AuxiliarySemantics,
} from "./lib/auxiliary-semantics";
import { rootPath } from "./lib/paths";

function luaDigitTable(keys: string): string {
	return `{ ${[...keys]
		.map((key, index) => `["${index + 1}"] = "${key}"`)
		.join(", ")} }`;
}

function renderEntry(semantics: AuxiliarySemantics): string {
	return `  ["${semantics.capacity}"] = {
    shape_keys_by_meaning = "${semantics.shapeKeysByMeaning}",
    tone_keys_by_tone = "${semantics.toneKeysByTone}",
    stroke_keys_by_stroke = "${semantics.strokeKeysByStroke}",
    tone_digits_by_shape_meaning = "${semantics.toneDigitsByShapeMeaning}",
    tone_keys_by_digit = ${luaDigitTable(semantics.toneKeysByTone)},
    stroke_keys_by_digit = ${luaDigitTable(semantics.strokeKeysByStroke)},
  },`;
}

const semantics = [
	loadAuxiliarySemantics("21x21"),
	loadAuxiliarySemantics("21x26"),
];
const rendered = `-- 由 scripts/generate-auxiliary-semantics.ts 根据 config/shenyun-21x*.json 生成，请勿手改。
-- shape_keys_by_meaning：折、横、撇、竖、点；tone_keys_by_tone：一、二、三、四、轻；
-- stroke_keys_by_stroke：横、竖、撇、点、折。

---@class AuxiliarySemanticMapping
---@field shape_keys_by_meaning string
---@field tone_keys_by_tone string
---@field stroke_keys_by_stroke string
---@field tone_digits_by_shape_meaning string
---@field tone_keys_by_digit table<string, string>
---@field stroke_keys_by_digit table<string, string>

---@type table<string, AuxiliarySemanticMapping>
local semantics = {
${semantics.map(renderEntry).join("\n")}
}

return semantics
`;
const outputPath = rootPath("lua", "snow", "auxiliary_semantics.lua");
if (process.argv.includes("--check")) {
	if (readFileSync(outputPath, "utf8").replace(/\r\n/gu, "\n") !== rendered) {
		throw new Error(
			"lua/snow/auxiliary_semantics.lua 不是当前五辅配置的生成结果。",
		);
	}
} else {
	writeFileSync(outputPath, rendered, "utf8");
}

for (const item of semantics) {
	console.log(
		`${item.capacity}：形义 ${item.shapeKeysByMeaning.toUpperCase()}；声调 ${item.toneKeysByTone.toUpperCase()}；笔画 ${item.strokeKeysByStroke.toUpperCase()}；形位调序 ${item.toneDigitsByShapeMeaning}`,
	);
}
