import { readFileSync, writeFileSync } from "node:fs";
import { rootPath } from "./lib/paths";

// 活动配置是生产声韵映射的唯一来源；最长韵母先替换，声母转大写以隔离韵母。
for (const [domain, filename, section] of [
	["21x21", "snow_lanpin.schema.yaml", "sanpin_algebra"],
	["21x26", "snow_shenyun_common.yaml", "shenyun_algebra"],
] as const) {
	const mapping = JSON.parse(
		readFileSync(rootPath("config", `shenyun-${domain}-mapping.json`), "utf8"),
	) as {
		id: string;
		initialMap: Record<string, string>;
		finalMap: Record<string, string>;
		toneKeysByTone: string;
	};
	const rules = [
		`  # ${mapping.id}；由 scripts/generate-layout-algebra.ts 生成。`,
		"  - erase/^(hng|m|n|ng|ê)\\d$/",
		"  - xform/(^| )r5(?= |$)/$1er5/",
		...[
			["uan", "van"],
			["ue", "ve"],
			["un", "vn"],
			["u", "v"],
		].map(([from, to]) => `  - xform/([jqx])${from}(?=\\d)/$1${to}/`),
		"  - xform/ue(?=\\d)/ve/",
		`  - xform/(^| )yu/$1${mapping.initialMap.YU}v/`,
		...["A", "E", "O"].map(
			(head) =>
				`  - xform/(^| )(?=${head.toLowerCase()})/$1${mapping.initialMap[head]}/`,
		),
		...["y", "w"].map(
			(head) =>
				`  - xform/(^| )${head}/$1${mapping.initialMap[head.toUpperCase()]}/`,
		),
		...Object.entries(mapping.initialMap)
			.filter(([head]) => head === head.toLowerCase())
			.sort(
				([left], [right]) =>
					right.length - left.length || left.localeCompare(right),
			)
			.map(([head, key]) => `  - xform/(^| )${head}/$1${key}/`),
		...Object.entries(mapping.finalMap)
			.sort(
				([left], [right]) =>
					right.length - left.length || left.localeCompare(right),
			)
			.map(([final, key]) => `  - xform/${final}(?=\\d)/${key}/`),
		...(domain === "21x26" ? ["  - xform/\\d//"] : []),
		"  - xlit/QWERTYUIOPASDFGHJKLZXCVBNM/qwertyuiopasdfghjklzxcvbnm/",
		...(domain === "21x21"
			? [`  - xlit/12345/${mapping.toneKeysByTone.toLowerCase()}/`]
			: []),
	];
	const path = rootPath(filename);
	const source = readFileSync(path, "utf8").replace(/\r\n/gu, "\n");
	const output = source.replace(
		new RegExp(`^${section}:\\n[\\s\\S]*?(?=\\n[^ #\\n])`, "mu"),
		`${section}:\n${rules.join("\n")}\n`,
	);
	if (output === source && !source.includes(rules.join("\n")))
		throw new Error(`找不到 ${section}`);
	if (process.argv.includes("--check")) {
		if (output !== source)
			throw new Error(`${filename} 的声韵代数需要重新生成。`);
	} else writeFileSync(path, output);
	console.log(
		`${mapping.id}：${filename} 声韵代数${process.argv.includes("--check") ? "校验" : "生成"}完成。`,
	);
}
