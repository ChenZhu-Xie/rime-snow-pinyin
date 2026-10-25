import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { SpellingAlgebra } from "./lib/algebra";
import { dataPath, rootPath } from "./lib/paths";
import { join, resolve } from "node:path";

function main() {
	// 由部首读音生成冰雪四拼、冰雪三拼下的部首编码，输出到 lua/snow/radical_*.txt
	const output = resolve(process.argv[2] ?? rootPath("lua", "snow"));
	mkdirSync(output, { recursive: true });
	const 方案列表 = [
		{ 方案: "sipin", 运算: "sipin_algebra" },
		{ 方案: "sanpin", 运算: "sanpin_algebra" },
	];

	const 部首读音 = readFileSync(dataPath("radicals.tsv"), "utf-8")
		.trim()
		.split("\n")
		.map((line) => line.split("\t") as [string, string]);

	for (const { 方案, 运算 } of 方案列表) {
		const rules = new SpellingAlgebra(
			rootPath(`snow_${方案}.schema.yaml`),
			运算,
			{
				derive: false,
			},
		);
		const 结果 = 部首读音.map(
			([部首, 读音]) => `${部首}\t${rules.apply(读音)}`,
		);
		writeFileSync(join(output, `radical_${方案}.txt`), 结果.join("\n"));
	}
}

if (import.meta.main) main();
