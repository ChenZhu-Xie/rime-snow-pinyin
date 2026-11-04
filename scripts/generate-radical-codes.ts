import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SpellingAlgebra } from "./lib/algebra";
import { loadAuxiliarySemantics } from "./lib/auxiliary-semantics";
import { dataPath, rootPath } from "./lib/paths";

function main() {
	// 由部首读音生成冰雪四拼、冰雪弎拼下的部首编码，输出到 lua/snow/radical_*.txt
	const checkOnly = process.argv.includes("--check");
	const outputArgument = process.argv
		.slice(2)
		.find((value) => !value.startsWith("--"));
	const output = resolve(outputArgument ?? rootPath("lua", "snow"));
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
		writeGenerated(
			join(output, `radical_${方案}.txt`),
			结果.join("\n"),
			checkOnly,
		);
	}

	// 键道二分形辅源文件只保存抽象形义 A/E/U/I/O（折/横/撇/竖/点），
	// 产物的物理键由 21×21 shapeKeysByMeaning 生成，不与声调序混用。
	const semantics = loadAuxiliarySemantics("21x21");
	const abstractKeysByMeaning = "aeuio";
	const 键道形义 = readFileSync(dataPath("jiandao-shape-elements.tsv"), "utf8")
		.trim()
		.split(/\r?\n/u)
		.map((line) => {
			const [element, abstractCode] = line.split("\t");
			const physicalCode = [...abstractCode]
				.map((symbol) => {
					const index = abstractKeysByMeaning.indexOf(symbol);
					if (index < 0) throw new Error(`未知键道形义符号：${symbol}`);
					return semantics.shapeKeysByMeaning[index];
				})
				.join("");
			return `${element}\t${physicalCode}`;
		});
	writeGenerated(
		join(output, "radical_jiandao.txt"),
		键道形义.join("\n"),
		checkOnly,
	);
}

function writeGenerated(path: string, content: string, checkOnly: boolean) {
	if (checkOnly) {
		const actual = readFileSync(path, "utf8").replace(/\r\n/gu, "\n");
		if (actual !== content)
			throw new Error(`${path} 不是当前语义源的生成结果。`);
	} else {
		writeFileSync(path, content);
	}
}

if (import.meta.main) main();
