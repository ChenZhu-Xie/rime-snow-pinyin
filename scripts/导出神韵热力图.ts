import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { rootPath } from "./lib/paths";

const htmlPath = process.argv.find((arg) => arg.endsWith(".html"));
if (!htmlPath) throw new Error("请传入 benchmark HTML 路径。");
const html = readFileSync(htmlPath, "utf8");
const match = html.match(/<script id="payload"[^>]*>([\s\S]*?)<\/script>/u);
if (!match) throw new Error("Benchmark HTML 中未找到压缩 payload。");
const payload = JSON.parse(
	gunzipSync(Buffer.from(match[1].trim(), "base64")).toString("utf8"),
) as {
	macroxue: {
		values: Record<
			string,
			Record<string, { hits: number; heat_map: Record<string, number> }>
		>;
	};
	tonedContractBenchmark: {
		schemes: {
			research: Record<
				string,
				{
					macro: Record<
						string,
						{ hits: number; heat_map: Record<string, number> }
					>;
				}
			>;
		};
	};
};
const is21x26 = process.argv.includes("--21x26");
const tonedSchema = process.argv.includes("--liandao")
	? "snow-jiandao-toned"
	: process.argv.includes("--zhudao")
		? "snow-zhudao"
		: undefined;
if (
	["--21x26", "--liandao", "--zhudao"].filter((flag) =>
		process.argv.includes(flag),
	).length > 1
)
	throw new Error("每次只选择一份布局");
const mapping = JSON.parse(
	readFileSync(
		rootPath(
			"config",
			`${tonedSchema ?? `shenyun-${is21x26 ? "21x26" : "21x21"}`}-mapping.json`,
		),
		"utf8",
	),
) as { id: string };
const stat = (
	tonedSchema
		? payload.tonedContractBenchmark.schemes.research[mapping.id]?.macro
		: payload.macroxue.values[mapping.id]
)?.["daily|native-punctuation"];
if (
	!stat ||
	Object.values(stat.heat_map).reduce((sum, value) => sum + value, 0) !==
		stat.hits
)
	throw new Error(`${mapping.id} 缺少完整键频数据。`);
const title = "日常八场景文稿纯双拼键频图（含标点）";
const parts = [
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 790 304" role="img" aria-labelledby="title desc">',
	`<title id="title">${title}</title><desc id="desc">${mapping.id}；benchmark 冻结日常文稿，共 ${stat.hits} 击键；只含纯双拼与标点。</desc>`,
	'<rect width="790" height="304" fill="#fbfcfa"/>',
	`<text x="20" y="28" font-size="18" fill="#445650">${mapping.id}</text>`,
];
const max = Math.max(...Object.values(stat.heat_map));
for (const [row, keys] of ["QWERTYUIOP", "ASDFGHJKL;", "ZXCVBNM,."].entries()) {
	for (const [column, key] of [...keys].entries()) {
		const count = stat.heat_map[key.toLowerCase()] ?? 0;
		const x = 20 + column * 73 + row * 17;
		const y = 46 + row * 80;
		parts.push(
			`<g data-mxkey="${key}"><title>${key}：${count}</title><rect x="${x}" y="${y}" width="66" height="70" rx="7" fill="hsl(152 27% ${96 - (43 * count) / max}%)" stroke="#b8c7be"/><text x="${x + 10}" y="${y + 24}" font-size="20" fill="#354b40">${key}</text><text x="${x + 33}" y="${y + 55}" text-anchor="middle" font-size="15" fill="#354b40">${count}</text></g>`,
		);
	}
}
parts.push("</svg>");
const svg = `${parts.join("")}\n`;
const output = rootPath(
	"docs",
	tonedSchema
		? `${tonedSchema === "snow-jiandao-toned" ? "liandao" : "zhudao"}-keyboard-heat.svg`
		: is21x26
			? "shenyun-rc26-keyboard-heat.svg"
			: "shenyun-ued-3158ce08b5bc-keyboard-heat.svg",
);
if (process.argv.includes("--check")) {
	if (readFileSync(output, "utf8") !== svg)
		throw new Error(`${output} 需要重新生成。`);
} else writeFileSync(output, svg);
console.log(
	`${mapping.id}：${stat.hits} 击键，29 键热力图${process.argv.includes("--check") ? "校验" : "导出"}完成。`,
);
