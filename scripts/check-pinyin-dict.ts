import { readDictionary } from "./lib/dictionary";
import { rootPath } from "./lib/paths";
import { checkPinyinReadings } from "./lib/pinyin-validation";

export function checkPinyinDictionary() {
	const result = checkPinyinReadings(
		readDictionary(rootPath("snow_pinyin.dict.yaml")).map(
			([, pinyin]) => pinyin,
		),
	);
	for (const { name, pattern, excluded } of result.schemes) {
		const exclusion =
			excluded.length > 0
				? `；明确排除 ${excluded.length} 种：${excluded.join("、")}`
				: "";
		console.log(
			`✓ ${name}音节编码检查：${result.total} 种读音，${pattern}${exclusion}`,
		);
	}
}

if (import.meta.main) checkPinyinDictionary();
