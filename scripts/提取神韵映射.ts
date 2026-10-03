import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const targetScheme = "R9-21X21-M40-02";
const benchmarkPath = process.argv[2];
if (!benchmarkPath) throw new Error("请传入 benchmark HTML 路径。");
const html = readFileSync(resolve(benchmarkPath), "utf8");
const payloadMatch = html.match(
	/<script id="payload"[^>]*>([\s\S]*?)<\/script>/,
);
if (!payloadMatch) throw new Error("Benchmark HTML 中未找到压缩 payload。");
const payload = JSON.parse(
	gunzipSync(Buffer.from(payloadMatch[1].trim(), "base64")).toString("utf8"),
) as {
	pinyin: string[];
	entries: Array<{
		id: string;
		codeList: Array<string | null>;
		initialMap: Record<string, string>;
		finalMap: Record<string, string>;
	}>;
};
const scheme = payload.entries.find((entry) => entry.id === targetScheme);
if (!scheme) throw new Error(`Benchmark payload 中未找到 ${targetScheme}。`);
const payloadMapping = Object.fromEntries(
	payload.pinyin.map((syllable, index) => [
		syllable,
		scheme.codeList[index]?.toLowerCase() ?? null,
	]),
);

// R9 的公开评分域是 Common399；报告对规则可推导的扩展音节保留 null。
// Rime 实现仍按同一声韵规则补齐这些扩展音节，只排除独立鼻音等无声韵拆分项。
const unencoded = new Set(["hng", "m", "n", "ng", "ê"]);
const initials = [
	"zh",
	"ch",
	"sh",
	"b",
	"p",
	"m",
	"f",
	"d",
	"t",
	"n",
	"l",
	"g",
	"k",
	"h",
	"j",
	"q",
	"x",
	"r",
	"z",
	"c",
	"s",
];
function deriveCode(syllable: string) {
	if (unencoded.has(syllable)) return null;
	let head: string;
	let final: string;
	if (/^[aeo]/.test(syllable)) {
		head = syllable[0].toUpperCase();
		final = syllable;
	} else if (syllable.startsWith("y")) {
		head = "Y";
		final = syllable.startsWith("yu")
			? `v${syllable.slice(2)}`
			: syllable.slice(1);
	} else if (syllable.startsWith("w")) {
		head = "W";
		final = syllable === "wu" ? "u" : syllable.slice(1);
	} else {
		const initial = initials.find((value) => syllable.startsWith(value));
		if (!initial) return null;
		head = initial;
		final = syllable.slice(initial.length);
		if (["j", "q", "x"].includes(initial) && final.startsWith("u")) {
			final = `v${final.slice(1)}`;
		}
	}
	const first = scheme.initialMap[head];
	const second = scheme.finalMap[final];
	return first && second ? `${first}${second}`.toLowerCase() : null;
}
const mapping = Object.fromEntries(
	payload.pinyin.map((syllable) => [
		syllable,
		payloadMapping[syllable] ?? deriveCode(syllable),
	]),
);
const derivedSyllables = payload.pinyin.filter(
	(syllable) => payloadMapping[syllable] === null && mapping[syllable] !== null,
);
const mappingSha256 = createHash("sha256")
	.update(JSON.stringify(mapping))
	.digest("hex");
const output = {
	scheme: scheme.id,
	release: "R9",
	mappingSha256,
	payloadMappingSha256: createHash("sha256")
		.update(JSON.stringify(payloadMapping))
		.digest("hex"),
	derivedSyllables,
	payloadCodes: payloadMapping,
	codes: mapping,
};
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = join(root, "docs", "shenyun-r9-mapping.json");
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(
	`${outputPath}\n${Object.keys(mapping).length} 个音节（${derivedSyllables.length} 个规则扩展），SHA256 ${mappingSha256}`,
);
