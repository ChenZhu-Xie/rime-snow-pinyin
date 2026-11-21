import { readFileSync } from "node:fs";
import { rootPath } from "./paths";
import {
	latestCurrentBenchmark,
	table,
	type BenchmarkLanguage,
} from "./current-layout-benchmark";

function tonedSections(language: BenchmarkLanguage) {
	const snapshot = latestCurrentBenchmark();
	if (!snapshot) return "";
	const captions = {
		zh: [
			"带调双拼：冰雪莲道与冰雪鹮道",
			"属性",
			"宿主键域",
			"声调位置",
			"第二码内，不追加独立调辅",
			"形辅序（二／三／四字）",
			"形义序（折横撇竖点）",
			"研究音节／占用桶／静态空桶",
			"运行时可用声声空桶",
			"记忆下限／守门 M-T1",
			"键位图",
		],
		en: [
			"Tone-in-main double pinyin: 冰雪莲道 and 冰雪鹮道",
			"Property",
			"Host capacity",
			"Tone position",
			"Inside key 2; no independent tone auxiliary",
			"Shape order (2/3/4 characters)",
			"Shape keys (bend/horizontal/left-falling/vertical/dot)",
			"Research syllables / occupied / vacant",
			"Runtime vacant initial pairs",
			"M-T1 lower / guard",
			"Keyboard map",
		],
		zht: [
			"帶調雙拼：冰雪蓮道與冰雪鹮道",
			"屬性",
			"宿主鍵域",
			"聲調位置",
			"第二碼內，不追加獨立調輔",
			"形輔序（二／三／四字）",
			"形義序（折橫撇豎點）",
			"研究音節／占用桶／靜態空桶",
			"執行時可用聲聲空桶",
			"記憶下限／守門 M-T1",
			"鍵位圖",
		],
	}[language];
	const overview = table(
		[captions[1], "冰雪莲道", "冰雪鹮道"],
		[
			["schema_id", "`snow_jiandao_toned`", "`snow_zhudao`"],
			["Layout ID", "`CR-REF-7e650f7a4c`", "`T2126-V52-M4-ec60a3637a99`"],
			[captions[2], "21×21", "21×26"],
			[captions[3], captions[4], captions[4]],
			[captions[5], "`21/231/14`", "`21/12/23`"],
			[captions[6], "`AVUIO`", "`AEUIO`"],
			[captions[7], "1407 / 433 / 8", "1407 / 526 / 20"],
			[captions[8], "7", "14"],
			[
				captions[9],
				...["Liandao", "Zhudao"].map(
					(scheme) =>
						`${snapshot.native[scheme].memory.lower} / ${snapshot.native[scheme].memory.guard}[^${language}-benchmark-toned]`,
				),
			],
			[
				"CKT v5.2",
				...["Liandao", "Zhudao"].map(
					(scheme) =>
						`${snapshot.metrics.cktV52[scheme].toFixed(6)}[^${language}-benchmark-v52]`,
				),
			],
			[
				captions[10],
				"[SVG](lua/snow/keymaps/snow_jiandao_toned.svg)",
				"[SVG](lua/snow/keymaps/snow_zhudao.svg)",
			],
		],
	);
	const introduction = {
		zh: "冰雪莲道沿用冰雪兰道的主码路由、630 与大写补韵；冰雪鹮道沿用冰雪鹤道的四码顶、三键简拼与候选处理。两者都把声调融入第二码，随后只补键道形辅；二、三声同区，一声、轻声同区，并非五声各自完全分离。单字最多四辅，标准一至四字词最长六码。声声空桶按各自标准二字词辅序的反序，逐字取两辅至六码。",
		en: "冰雪莲道 inherits 冰雪兰道's routing, 630 shortcuts and uppercase final completion; 冰雪鹮道 inherits 冰雪鹤道's four-code-top routing, three-key abbreviations and candidate behavior. Both encode tone in key 2 and append only KeyTao shape auxiliaries. Tones 2/3 share a region, as do 1/neutral. Single characters allow up to four auxiliaries and standard one-to-four-character codes stop at six. Vacant initial pairs take two auxiliaries per character in the reverse of the standard two-character order.",
		zht: "冰雪蓮道沿用冰雪兰道的主碼路由、630 與大寫補韻；冰雪鹮道沿用冰雪鶴道的四碼頂、三鍵簡拼及候選處理。兩者將聲調融入第二碼，後續只補鍵道形輔；二、三聲同區，一聲、輕聲同區，並非五聲各自完全分離。單字最多四輔，標準一至四字詞最長六碼。聲聲空桶按標準二字詞輔序的反序逐字取兩輔至六碼。",
	}[language];
	const details = [];
	for (const [name, filename, scheme] of [
		["冰雪莲道", "snow-jiandao-toned-mapping.json", "Liandao"],
		["冰雪鹮道", "snow-zhudao-mapping.json", "Zhudao"],
	]) {
		const config = JSON.parse(
			readFileSync(rootPath("config", filename), "utf8"),
		);
		const groups = config.rhymeGroups ?? config.sourcePublication.rhymeGroups;
		// 两份生产配置均保留按韵组的实际上／中／下排次键。
		const rows = groups
			.map(
				(
					group: { finals: string[]; keys?: Record<string, string> | string[] },
					index: number,
				) => {
					const keys = group.keys ?? config.rowKeysByGroup?.[index];
					if (!keys) return [];
					return [
						group.finals.join(" / "),
						...["upper", "home", "lower"].map(
							(row, index) =>
								`\`${Array.isArray(keys) ? keys[index] : keys[row]}\``,
						),
					];
				},
			)
			.filter((row: string[]) => row.length > 0);
		const toneRows =
			scheme === "Liandao" ? ["4", "2/3", "1/5"] : ["2/3", "4", "1/5"];
		const label =
			language === "en"
				? ["Final group", ...toneRows.map((tone) => `Tone ${tone}`)]
				: language === "zht"
					? ["韻母組", ...toneRows.map((tone) => `${tone} 聲`)]
					: ["韵母组", ...toneRows.map((tone) => `${tone} 声`)];
		const link = scheme === "Liandao" ? "liandao" : "zhudao";
		const prose =
			language === "en"
				? `Initial/carrier mapping, examples, occupied letter buckets, shortcut collisions and runtime vacancy rules: [${name}](docs/${link}.md). Research inventory vacancies and runtime initial-pair vacancies use different dictionaries and scopes. The configuration is the generation source.`
				: language === "zht"
					? `聲母／零聲母、範例、字母占用桶、固頂同碼與執行時空桶規則見[${name}](docs/${link}.md)。研究音節域空碼與執行時聲聲空桶的詞典和口徑不同，不能互相替代。配置是生成來源。`
					: `声母／零声母、输入示例、字母占用桶、固顶同码和运行时空桶规则见[${name}](docs/${link}.md)。研究音节域的静态空码与运行时声声空桶使用不同词典和口径，不能互相替代。配置是生成来源。`;
		details.push(
			`#### ${name} · ${config.id}`,
			prose,
			rows.length > 0 ? table(label, rows) : "",
			`![${name}](lua/snow/keymaps/${scheme === "Liandao" ? "snow_jiandao_toned" : "snow_zhudao"}.svg)`,
		);
	}
	return (
		[`### ${captions[0]}`, introduction, overview, ...details]
			.filter(Boolean)
			.join("\n\n") + "\n\n"
	);
}

export function updateTonedReadmeDocumentation(markdown: string) {
	const snapshot = latestCurrentBenchmark();
	if (!snapshot) return markdown;
	for (const [language, heading] of [
		["zh", "### 固顶、空桶与逐级简码"],
		["en", "### Fixed candidates, vacant buckets, and staged abbreviations"],
		["zht", "### 固頂、空桶與逐級簡碼"],
	] as const) {
		const tonalHeading = {
			zh: "### 带调双拼：冰雪莲道与冰雪鹮道",
			en: "### Tone-in-main double pinyin: 冰雪莲道 and 冰雪鹮道",
			zht: "### 帶調雙拼：冰雪蓮道與冰雪鹮道",
		}[language];
		const start = markdown.indexOf(tonalHeading);
		const end = markdown.indexOf(heading);
		if (end < 0) throw new Error(`README 缺少 ${heading}`);
		if (start >= 0) markdown = markdown.slice(0, start) + markdown.slice(end);
		markdown = markdown.replace(heading, tonedSections(language) + heading);
	}
	markdown = markdown.replace(
		/^新增生产方案\[冰雪鹮道\].*$/mu,
		"六套现行双拼使用四份冻结布局：无调 21×21 的冰雪兰道／冰雪兰拼（UED）、无调 21×26 的冰雪鹤道／冰雪鹤拼（RC26），以及新增的带调[冰雪莲道](docs/liandao.md)（CR-REF）与[冰雪鹮道](docs/zhudao.md)（T2126）。布局、辅序、键位图与 benchmark 已按当前生产配置更新，历史结果在 reports 中保留并追加对照。",
	);
	markdown = markdown.replace(
		/^四套双拼顶功方案分为两组：.*$/mu,
		"六套双拼顶功方案覆盖四份布局：冰雪兰道／冰雪兰拼共用 UED 21×21，冰雪鹤道／冰雪鹤拼共用 RC26 21×26（M=40、无飞键、无音节重码、无 630），每组分别用形辅、调辅；冰雪莲道、冰雪鹮道分别使用带调 21×21、21×26，主码已含调，后置为纯形辅。schema_id 保持兼容。",
	);
	markdown = markdown.replace(
		/^Four double-pinyin schemes.*$/mu,
		"Six current double-pinyin schemes use four layouts: the untoned UED 21×21 and RC26 21×26 each have shape/tone members; 冰雪莲道 and 冰雪鹮道 use tone-in-main 21×21 and 21×26 with shape-only completion. Layouts, policies and benchmark values follow the current frozen production configurations.",
	);
	markdown = markdown.replace(
		/^四套雙拼頂功方案.*$/mu,
		"六套雙拼頂功方案使用四份布局：無調 UED 21×21 與 RC26 21×26 各有形輔／調輔成員；冰雪蓮道、冰雪鹮道為帶調 21×21、21×26，主碼內含聲調，後置純形輔。布局、輔序與 benchmark 依目前凍結生產配置更新。",
	);
	// 旧版公式留作历史解释，明确它们不是当前生产辅序。
	markdown = markdown.replace(
		/当前布局各成员的二／三／四字最优辅序为：神韵/g,
		"历史 v5 快照（非当前生产辅序）为：神韵",
	);
	markdown = markdown.replace(
		/Layout-specific optimal two-\/three-\/four-character orders are Shenyun/g,
		"Historical v5 policies (not current production policies) are Shenyun",
	);
	markdown = markdown.replace(
		/當前布局各成員的二／三／四字最優輔序為：神韻/g,
		"歷史 v5 快照（非目前生產輔序）為：神韻",
	);
	markdown = markdown.replace(
		/\| 冰雪兰道、冰雪键道 \|/g,
		"| 冰雪兰道、冰雪莲道、冰雪键道 |",
	);
	markdown = markdown.replace(
		/五布局／六布局追加报告/g,
		"当前四布局／六生产方案与历史布局追加报告",
	);
	const latestLink = `reports/shenyun-comparison.md#current-layout-${snapshot.sourceSha256.slice(0, 12)}`;
	markdown = markdown.replace(
		/下表以当前 RC26[^\n]*直接替代 README 历史表[^\n]*/gu,
		`下表对照当前四份布局：RC26 与 UED 各代表形辅／调辅两个生产方案，另增冰雪莲道、冰雪鹮道两列，并保留 S005 与 B04 参考。新增 CKT v5.2、成本敏感性、第三辅、耗时、选重与终局负载等维度；[当前完整追加报告](${latestLink})保留逐轨来源及定义。`,
	);
	markdown = markdown.replace(
		/This table replaces[^\n]*historical[^\n]*/gu,
		`The table compares four current layouts (six production schemes) and two references, adding toned columns and CKT v5.2 cost sensitivity, third auxiliaries, timing and terminal loads. See the [latest appended report](${latestLink}) for source data and definitions.`,
	);
	markdown = markdown.replace(
		/下表以目前 RC26[^\n]*直接替代 README 歷史表[^\n]*/gu,
		`下表對照目前四份布局／六套生產方案與兩個參考，新增兩個帶調欄、CKT v5.2、成本敏感性、第三輔、耗時及終局負載；[最新追加報告](${latestLink})保留逐軌來源與定義。`,
	);
	markdown = markdown.replace(
		/These four artifacts are the complete current result/gu,
		"These four artifacts preserve that historical result",
	);
	markdown = markdown.replace(
		/这四份产物是当前完整结果/gu,
		"这四份产物保留该次历史结果",
	);
	markdown = markdown.replace(
		/这四项是当前完整成果/gu,
		"这四项保留该次历史成果",
	);
	markdown = markdown.replace(/与四套现行方案共享/gu, "与现行方案共享");
	markdown = markdown.replace(
		/這四份產物是目前完整結果/gu,
		"這四份產物保留該次歷史結果",
	);
	return markdown;
}
