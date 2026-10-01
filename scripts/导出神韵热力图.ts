import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const targetScheme = "R8-21X21-M40-01";
const track = "daily|native-punctuation";
const benchmarkPath = process.argv[2];
if (!benchmarkPath) throw new Error("请传入 a7_CKT_R10_integrated.html 路径。");

const html = readFileSync(resolve(benchmarkPath), "utf8");
const payloadMatch = html.match(
	/<script id="payload"[^>]*>([\s\S]*?)<\/script>/,
);
if (!payloadMatch) throw new Error("Benchmark HTML 中未找到压缩 payload。");
const payload = JSON.parse(
	gunzipSync(Buffer.from(payloadMatch[1].trim(), "base64")).toString("utf8"),
) as {
	macroxue: {
		layout: Record<string, { x: number; y: number }>;
		corpora: Record<string, { label: string }>;
		values: Record<
			string,
			Record<string, { hits: number; heat_map: Record<string, number> }>
		>;
	};
};
const sample = payload.macroxue.values[targetScheme]?.[track];
if (!sample)
	throw new Error(
		`Benchmark payload 中未找到 ${targetScheme} 的 ${track} 热力数据。`,
	);

const visibleKeys = Object.entries(payload.macroxue.layout).filter(
	([key, position]) => position.x < 10 && key !== "/",
);
const maximum =
	Math.max(
		...visibleKeys.map(([key]) => sample.heat_map[key.toLowerCase()] ?? 0),
	) / sample.hits;
const percent = (value: number) => `${(value * 100).toFixed(2)}%`;
const heatColor = (ratio: number) => {
	const normalized = Math.max(0, Math.min(1, ratio / (maximum || 1)));
	const cold = [238, 246, 240];
	const hot = [73, 132, 91];
	const channel = (index: number) =>
		Math.round(cold[index] + (hot[index] - cold[index]) * normalized);
	return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
};
const escapeXml = (value: string) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");

const keys = visibleKeys
	.map(([key, position]) => {
		const x =
			18 + (position.x + (position.y ? 0.25 + (position.y - 1) * 0.5 : 0)) * 76;
		const y = 22 + position.y * 88;
		const hits = sample.heat_map[key.toLowerCase()] ?? 0;
		const ratio = hits / sample.hits;
		return `<g data-mxkey="${escapeXml(key)}"><title>${escapeXml(key)}：${hits} 次，${percent(ratio)}</title><rect x="${x}" y="${y}" width="68" height="76" rx="7" fill="${heatColor(ratio)}" stroke="#9cad9e"/><text x="${x + 10}" y="${y + 23}" font-size="18" fill="#30483a">${escapeXml(key)}</text><text x="${x + 34}" y="${y + 49}" text-anchor="middle" font-size="14" fill="#30483a">${percent(ratio)}</text><text x="${x + 34}" y="${y + 65}" text-anchor="middle" font-size="10" fill="#5a6c60">${hits} 次</text></g>`;
	})
	.join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 790 304" role="img" aria-labelledby="title desc">
<title id="title">R10 日常八场景文稿 纯双拼键频图（含标点）</title>
<desc id="desc">双拼热力图基于日常八场景文稿的 ${sample.hits} 次击键。只包含双拼部分，5 辅键未参与评估。</desc>
<rect width="790" height="304" fill="#fbfcfa"/>
${keys}
</svg>\n`;
const output = join(
	dirname(fileURLToPath(import.meta.url)),
	"..",
	"docs",
	"shenyun-v2-keyboard-heat.svg",
);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, svg, "utf8");
console.log(`${output}\n${visibleKeys.length} 键，${sample.hits} 次击键。`);
