import { createHash } from "crypto";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { gunzipSync } from "zlib";

const benchmarkPath = process.argv[2];
if (!benchmarkPath) throw new Error("请传入 a7_CKT_NF3_closure.html 路径。");
const html = readFileSync(resolve(benchmarkPath), "utf8");
const payloadMatch = html.match(/<script id="payload"[^>]*>([\s\S]*?)<\/script>/);
if (!payloadMatch) throw new Error("Benchmark HTML 中未找到压缩 payload。");
const payload = JSON.parse(
	gunzipSync(Buffer.from(payloadMatch[1].trim(), "base64")).toString("utf8"),
) as {
	pinyin: string[];
	entries: Array<{ id: string; codeList: Array<string | null> }>;
};
const scheme = payload.entries.find((entry) => entry.id === "NF3-21X21-M40-44");
if (!scheme) throw new Error("Benchmark payload 中未找到 NF3-21X21-M40-44。");
const mapping = Object.fromEntries(
	payload.pinyin.map((syllable, index) => [syllable, scheme.codeList[index]?.toLowerCase() ?? null]),
);
const mappingSha256 = createHash("sha256")
	.update(JSON.stringify(mapping))
	.digest("hex");
const output = {
	scheme: scheme.id,
	release: "NF3-PB1",
	mappingSha256,
	codes: mapping,
};
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = join(root, "docs", "shenyun-v1-mapping.json");
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`${outputPath}\n${Object.keys(mapping).length} 个音节，SHA256 ${mappingSha256}`);
