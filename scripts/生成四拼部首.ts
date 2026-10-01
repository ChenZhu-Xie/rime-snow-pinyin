import { readFileSync, writeFileSync } from "fs";
import { SpellingAlgebra } from "./utils";

// 由部首读音生成冰雪四拼、冰雪三拼下的部首编码，输出到 lua/snow/radical_*.txt
const 方案列表 = [
	{ 方案: "sipin", 运算: "sipin_algebra" },
	{ 方案: "sanpin", 运算: "sanpin_algebra" },
];

const 部首读音 = readFileSync("部首读音.txt", "utf-8")
	.trim()
	.split("\n")
	.map((line) => line.split("\t") as [string, string]);

for (const { 方案, 运算 } of 方案列表) {
	const rules = new SpellingAlgebra(`../snow_${方案}.schema.yaml`, 运算, {
		derive: false,
	});
	const 结果 = 部首读音.map(([部首, 读音]) => `${部首}\t${rules.apply(读音)}`);
	writeFileSync(`../lua/snow/radical_${方案}.txt`, 结果.join("\n"));
}
