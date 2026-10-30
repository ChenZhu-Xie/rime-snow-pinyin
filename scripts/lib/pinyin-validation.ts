import { SpellingAlgebra } from "./algebra";
import { rootPath } from "./paths";

// 正则依据 ../input 的各方案拼写教程，独立于方案中的输入、顶功和简码规则。
// 四拼、三拼只取音节运算；其余方案展开 speller/algebra，忽略 abbrev。
// derive 在这里保留全部完整音节分支，例如三拼、键道的声母飞键和 uang 双编码。
export const SYLLABLE_PATTERNS = [
	{
		schema: "snow_sipin",
		name: "冰雪四拼",
		key: "sipin_algebra",
		// snow4/spelling.md：声码 + 一至二码韵母 + 调码。
		pattern: /^[bpmfdtnlgkhjqxzcsrwyv][aeiou]{2,3}$/,
	},
	{
		schema: "snow_sanpin",
		name: "冰雪三拼",
		key: "sanpin_algebra",
		// snow3/spelling.md：键道的声韵两码 + 调码；声韵均不用 viuoa 五键。
		pattern: /^[bpmfdtnlgkhjqxzcsrywe]{2}[viuoa]$/,
	},
	{
		schema: "snow_yipin",
		name: "冰雪一拼",
		key: "speller/algebra",
		// snow1/spelling.md：声介 + 韵调；j 表示翘舌或零声母，i/u/v 为介音。
		// 介音归入声介后，韵基只剩 a/ai/an/ang/ao/e/ei/en/eng/ou，亦可省略。
		pattern:
			/^[bpmfdtnlgkhzcsr]j?[iuv]?(a|ai|an|ang|ao|e|ei|en|eng|ou)?[wyxq]$/,
	},
	{
		schema: "snow_jiandao",
		name: "冰雪键道",
		key: "speller/algebra",
		// snow-jiandao/index.md、snow3/spelling.md：与三拼共用声韵，无调码。
		pattern: /^[bpmfdtnlgkhjqxzcsrywe]{2}$/,
	},
	{
		schema: "snow_qingyun",
		name: "冰雪清韵",
		key: "speller/algebra",
		// snow-qingyun/spelling.md：声码（平翘舌合并，零声母 v）+ 九键韵码。
		pattern: /^[bpmfdtnlgkhjqxzcsrwyv][aeiou;,./]$/,
	},
];

export function checkPinyinReadings(readings: Iterable<string>) {
	const syllables = [...new Set(readings)].filter(
		// 字母使用专门的映射规则，不属于汉字音节。
		(reading) => !/^~{1,2}[a-z]$/.test(reading),
	);
	const invalid: string[] = [];
	const schemes: Array<{
		name: string;
		pattern: RegExp;
		excluded: string[];
	}> = [];
	for (const { schema, name, key, pattern } of SYLLABLE_PATTERNS) {
		const algebra = new SpellingAlgebra(rootPath(`${schema}.schema.yaml`), key);
		const excluded: string[] = [];
		for (const reading of syllables) {
			const result = algebra.applyAllWithStatus(reading);
			if (result.codes.length === 0) {
				if (result.erased) {
					excluded.push(reading);
				} else {
					invalid.push(`${name}：${reading} 没有生成任何完整音节编码`);
				}
			}
			for (const code of result.codes) {
				if (!pattern.test(code)) {
					invalid.push(`${name}：${reading} → ${code}，预期 ${pattern}`);
				}
			}
		}
		schemes.push({ name, pattern, excluded });
	}
	if (invalid.length > 0) {
		throw new Error(
			`完整音节编码不符合方案的拼写结构，请检查拼音来源或拼写规则：\n${invalid.join("\n")}`,
		);
	}
	return { total: syllables.length, schemes };
}
