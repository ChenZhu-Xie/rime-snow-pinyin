import { readFileSync, writeFileSync } from "node:fs";
import { rootPath } from "./lib/paths";

// Gitee 当前不解析 GitHub 脚注；从同一正文生成普通页内链接与注释。
export function renderGiteeReadme(source: string) {
	source = source.replaceAll("\r\n", "\n");
	const definitions = new Map<string, string>();
	for (const match of source.matchAll(/^\[\^([^\]]+)\]: (.+)$/gmu)) {
		if (definitions.has(match[1])) throw new Error(`重复脚注：${match[1]}`);
		definitions.set(match[1], match[2]);
	}
	const body = source.replace(/^\[\^[^\]]+\]: .+\n?/gmu, "");
	const numbers = new Map<string, number>();
	const counters = new Map<string, number>();
	for (const match of body.matchAll(/\[\^([^\]]+)\]/gu)) {
		const id = match[1];
		if (!definitions.has(id)) throw new Error(`缺少脚注定义：${id}`);
		if (numbers.has(id)) continue;
		const language = id.split("-")[0];
		const number = (counters.get(language) ?? 0) + 1;
		counters.set(language, number);
		numbers.set(id, number);
	}
	return (
		"<!-- 由 bun scripts/generate-gitee-readme.ts 从 README.md 生成，请修改源文件。 -->\n\n" +
		source
			.replace(
				/^\[\^([^\]]+)\]: (.+)$/gmu,
				(_match, id: string, text: string) => {
					const number = numbers.get(id);
					if (number === undefined) return "";
					return `<a id="readme-note-${id}"></a>\n\n**[${number}]** ${text}\n`;
				},
			)
			.replace(/\[\^([^\]]+)\]/gu, (_match, id: string) => {
				const number = numbers.get(id);
				if (number === undefined) throw new Error(`缺少脚注编号：${id}`);
				return `[${number}](#readme-note-${id})`;
			})
			.replaceAll(
				"https://github.com/more-14-different/shuangpin-layout-benchmark/",
				"https://gitee.com/xie-chenzhu/shuangpin-layout-benchmark/",
			)
			.replaceAll(
				"shuangpin-layout-benchmark/blob/main/README.md",
				"shuangpin-layout-benchmark/blob/main/README_CN.md",
			)
			.replaceAll(
				"https://github.com/ChenZhu-Xie/rime-snow-pinyin/releases/",
				"https://gitee.com/xie-chenzhu/rime-snow-pinyin/releases/",
			)
			.replace(/\n{3,}/gu, "\n\n")
	);
}

export function updateGiteeReadme(check = false) {
	const path = rootPath("README_CN.md");
	const output = renderGiteeReadme(readFileSync(rootPath("README.md"), "utf8"));
	if (output === readFileSync(path, "utf8")) {
		console.log("Gitee README 已同步。");
	} else if (check) {
		throw new Error(
			"README_CN.md 需要运行 bun scripts/generate-gitee-readme.ts 重新生成。",
		);
	} else {
		writeFileSync(path, output, "utf8");
		console.log("已同步 Gitee README。");
	}
}

if (import.meta.main) updateGiteeReadme(process.argv.includes("--check"));
