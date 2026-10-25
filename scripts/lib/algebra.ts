import { readFileSync } from "node:fs";
import { load } from "js-yaml";

interface Replace {
	from: RegExp;
	to: string;
}

export class SpellingAlgebra {
	private rules: Replace[];

	// derive 在 Rime 中会保留原拼写，这里无法表示多个结果，故默认按 xform 处理；
	// 传入 derive: false 则忽略 derive 规则，只计算规范拼写
	constructor(schema: string, key: string, options: { derive?: boolean } = {}) {
		const { derive = true } = options;
		const content = readFileSync(schema, "utf8");
		const yaml = load(content) as Record<string, any>;
		const rules: string[] = yaml[key];
		const parsed: Replace[] = [];
		rules.forEach((rule) => {
			const trimmed = rule.trim();
			const ruleParts = trimmed.split(trimmed.at(-1)!);
			if (ruleParts[0] === "derive" && !derive) return;
			if (ruleParts[0] === "xform" || ruleParts[0] === "derive") {
				parsed.push({
					from: new RegExp(ruleParts[1], "g"),
					to: ruleParts[2],
				});
			} else if (ruleParts[0] === "xlit") {
				const fromList = [...ruleParts[1]];
				const toList = [...ruleParts[2]];
				fromList.forEach((from, i) => {
					parsed.push({
						from: new RegExp(from, "g"),
						to: toList[i],
					});
				});
			}
		});
		this.rules = parsed;
	}

	apply(code: string) {
		let final = code;
		for (const rule of this.rules) {
			final = final.replaceAll(rule.from, rule.to);
		}
		return final;
	}
}
