/** 只生成逐键采集输入，不加载 Rime。 */
import { readFileSync } from "node:fs";
import conflicts from "./data/character-first-choice-conflicts.json";
import {
	ALL_BENCHMARK_SCHEMES,
	productionCharacterCodes,
	qingyunReadingCodes,
	directOutputCodes,
} from "./lib/benchmark-schemes";
import { rootPath, writeOutput } from "./lib/paths";

const readings = readFileSync(rootPath("snow_pinyin.dict.yaml"), "utf8")
	.split(/\r?\n/u)
	.filter((line) => line.includes("\t") && !line.startsWith("#"))
	.map((line) => line.split("\t"));
const shapes = readFileSync(rootPath("snow_qingyun.dict.yaml"), "utf8")
	.split(/\r?\n/u)
	.filter((line) => line.includes("\t") && !line.startsWith("#"))
	.map((line) => line.split("\t"));
const schemas: Record<
	string,
	{
		codes: string[];
		targets: Record<
			string,
			{ routes: string[]; previousMinimum: string; userCode?: string }
		>;
	}
> = {};
for (const scheme of ALL_BENCHMARK_SCHEMES) {
	const entry =
		conflicts.schemas[scheme.schemaId as keyof typeof conflicts.schemas];
	const targets = new Map(
		Object.entries(entry.targets).map(([text, value]) => [
			text,
			{ ...value, routes: new Set<string>() },
		]),
	);
	for (const [text, reading] of readings) {
		const target = targets.get(text);
		if (!target) continue;
		for (const { code } of productionCharacterCodes(scheme.id, text, reading))
			target.routes.add(code);
	}
	if (scheme.id === "qingyun")
		for (const [text, reading] of shapes) {
			const target = targets.get(text);
			if (!target) continue;
			for (const { code } of qingyunReadingCodes(reading.split(" ")))
				target.routes.add(code);
		}
	for (const line of readFileSync(rootPath(scheme.fixedFile), "utf8").split(
		/\r?\n/u,
	)) {
		const [code, texts] = line.split("\t");
		if (!code || !texts) continue;
		for (const text of texts.split(" ")) targets.get(text)?.routes.add(code);
	}
	for (const [text, code] of directOutputCodes(scheme.id))
		targets.get(text)?.routes.add(code);
	const codes = new Set(entry.conflictCodes);
	for (const target of targets.values()) {
		if (target.previousMinimum !== "NA")
			target.routes.add(target.previousMinimum);
		if ("userCode" in target) target.routes.add(String(target.userCode));
		for (const code of target.routes)
			for (let length = 1; length <= code.length; length++)
				codes.add(code.slice(0, length));
	}
	schemas[scheme.schemaId] = {
		codes: [...codes].sort(),
		targets: Object.fromEntries(
			[...targets].map(([text, value]) => [
				text,
				{ ...value, routes: [...value.routes].sort() },
			]),
		),
	};
	console.log(`${scheme.schemaId}: ${targets.size} 字，${codes.size} 编码`);
}
writeOutput(
	process.argv[2] ?? rootPath("output/character-conflict-probes/input.json"),
	JSON.stringify(
		{ contract: "character-conflict-probes-v1", schemas },
		null,
		2,
	) + "\n",
);
