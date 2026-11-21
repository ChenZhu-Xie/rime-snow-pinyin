// 编码先按 ../input 的教程选取，再在首次遍历时校验首页候选或上屏结果。
// 不从功能 spec 自动抽取：spec 可能遍历所有候选，而且夹杂补丁、预置词频及故意无效的编码。
export interface LatencyCase {
	id: string;
	keys: string;
	source: string;
	page?: string;
	commit?: string;
	options?: string[];
}

export const SCHEMA_NAMES: Record<string, string> = {
	snow_jiandao_toned: "冰雪莲道",
	snow_zhudao: "冰雪鹮道",
	snow_sipin: "冰雪四拼",
	snow_sanpin: "冰雪兰拼",
	snow_yipin: "冰雪一拼",
	snow_jiandao: "冰雪兰道",
	snow_qingyun: "冰雪清韵",
	snow_shenyun_shape: "冰雪鹤道",
	snow_shenyun_tone: "冰雪鹤拼",
	snow_jiandao_classic: "冰雪键道",
	snow_sanpin_classic: "冰雪三拼",
};

// 一击拆成每键按下、每键松开；最后一次松开才产生完整音节反馈。
export function chord(keys: string): string {
	const names: Record<string, string> = {
		" ": "space",
		",": "comma",
		".": "period",
		";": "semicolon",
		"/": "slash",
	};
	return (
		keys + [...keys].map((key) => `{Release+${names[key] ?? key}}`).join("")
	);
}

export const LATENCY_CASES: Record<string, LatencyCase[]> = {
	snow_jiandao_toned: [
		{
			id: "initial-pair-four-aux",
			keys: "rfvaua",
			page: "软饭",
			source: "docs/liandao.md",
		},
		{ id: "single", keys: "xdv", page: "雪", source: "docs/liandao.md" },
		{ id: "double", keys: "bzxdvo", page: "冰雪", source: "docs/liandao.md" },
		{ id: "triple", keys: "krfuav", page: "输入法", source: "docs/liandao.md" },
		{ id: "four", keys: "rgenia", page: "人工智能", source: "docs/liandao.md" },
		{
			id: "editing",
			keys: "bzxdvo{BackSpace}",
			page: "冰雪",
			source: "docs/liandao.md",
		},
		{ id: "radical", keys: "uwangyan", page: "琰", source: "docs/liandao.md" },
	],
	snow_zhudao: [
		{
			id: "initial-pair-four-aux",
			keys: "bdeuea",
			page: "不到",
			source: "docs/zhudao.md",
		},
		{ id: "single", keys: "bno", page: "冰", source: "docs/zhudao.md" },
		{ id: "double", keys: "bnyweo", page: "冰雪", source: "docs/zhudao.md" },
		{ id: "triple", keys: "vrfpeu", page: "输入法", source: "docs/zhudao.md" },
		{ id: "four", keys: "rgxneu", page: "人工智能", source: "docs/zhudao.md" },
		{
			id: "single-initial",
			keys: "f",
			page: "负责",
			source: "lua/snow/shenyun_hints.lua",
		},
		{
			id: "vacant-paging",
			keys: "f{Page_Down}{Page_Up}",
			page: "负责",
			source: "lua/snow/shenyun_hints.lua",
		},
		{ id: "radical", keys: "uwangyan", page: "琰", source: "docs/zhudao.md" },
		{
			id: "editing",
			keys: "bnyweo{BackSpace}",
			page: "冰雪",
			source: "docs/zhudao.md",
		},
	],
	snow_sipin: [
		{ id: "radical", keys: "uwangyan", page: "琰", source: "README.md" },
		{ id: "single", keys: "biu", page: "笔", source: "snow4/spelling.md" },
		{ id: "double", keys: "bxoui", page: "冰雪", source: "snow4/basic.md" },
		{ id: "triple", keys: "svm", page: "为什么", source: "snow4/basic.md" },
		{ id: "four", keys: "gtvv", page: "感同身受", source: "snow4/basic.md" },
		{
			id: "long",
			keys: "whrmGHG",
			page: "中华人民共和国",
			source: "snow4/basic.md",
		},
		{
			id: "paging",
			keys: "b{Page_Down}{Page_Up}",
			source: "snow4/spelling.md",
		},
		{
			id: "editing",
			keys: "bxouie{BackSpace}",
			page: "冰雪",
			source: "snow4/basic.md",
		},
		{
			id: "popping",
			keys: "bxouivrf",
			commit: "冰雪",
			source: "snow4/basic.md",
		},
		{
			id: "buffered",
			keys: "bxouivrf  ",
			commit: "冰雪输入法",
			options: ["buffered"],
			source: "snow4/basic.md",
		},
	],
	snow_sanpin: [
		{ id: "radical", keys: "uwangyan", page: "琰", source: "README.md" },
		{
			id: "single",
			keys: "bgi",
			page: "冰",
			source: "spec/snow_sanpin.test.yaml",
		},
		{
			id: "double",
			keys: "bgxkiu",
			page: "冰雪",
			source: "spec/snow_sanpin.test.yaml",
		},
		{
			id: "triple",
			keys: "krfaiu",
			page: "输入法",
			source: "spec/snow_sanpin.test.yaml",
		},
		{
			id: "four",
			keys: "smxwui",
			page: "充满希望",
			source: "spec/snow_sanpin.test.yaml",
		},
		{
			id: "long",
			keys: "ehrmGHG",
			page: "中华人民共和国",
			source: "spec/snow_sanpin.test.yaml",
		},
		{
			id: "paging",
			keys: "b{Page_Down}{Page_Up}",
			source: "snow3/spelling.md",
		},
		{
			id: "editing",
			keys: "bgxkiu{BackSpace}",
			page: "冰雪",
			source: "spec/snow_sanpin.test.yaml",
		},
		{
			id: "popping",
			keys: "bgxkkrf",
			commit: "冰雪",
			source: "spec/snow_sanpin.test.yaml",
		},
		{
			id: "buffered",
			keys: "bgxkkrf  ",
			commit: "冰雪输入法",
			options: ["buffered"],
			source: "spec/snow_sanpin.test.yaml",
		},
	],
	snow_jiandao: [
		{ id: "radical", keys: "uwangyan", page: "琰", source: "README.md" },
		{
			id: "dense-prefix",
			keys: "mdd",
			page: "目的地",
			source: "snow-jiandao/index.md：连续例句里的「目的地」；从实测慢事件提取",
		},
		{
			id: "single-shape",
			keys: "bgov",
			page: "冰",
			source: "spec/snow_jiandao.test.yaml",
		},
		{
			id: "double",
			keys: "bgxk",
			page: "冰雪",
			source: "spec/snow_jiandao.test.yaml",
		},
		{
			id: "triple",
			keys: "krf",
			page: "输入法",
			source: "spec/snow_jiandao.test.yaml",
		},
		{
			id: "four",
			keys: "smxw",
			page: "充满希望",
			source: "spec/snow_jiandao.test.yaml",
		},
		{
			id: "long-shape",
			keys: "pxfeG",
			page: "科学发展观",
			source: "snow-jiandao/basic.md；逐字补形见 spec/snow_jiandao.test.yaml",
		},
		{
			id: "long",
			keys: "ehrmGHG",
			page: "中华人民共和国",
			source: "snow-jiandao/basic.md",
		},
		{
			id: "mixed",
			keys: "kHrHfL",
			page: "输入法",
			source: "snow-jiandao/index.md；spec/snow_jiandao.test.yaml",
		},
		{
			id: "paging",
			keys: "b{Page_Down}{Page_Up}",
			source: "snow-jiandao/basic.md",
		},
		{
			id: "editing",
			keys: "bgxko{BackSpace}",
			page: "冰雪",
			source: "snow-jiandao/basic.md",
		},
		{
			id: "popping",
			keys: "bgovxkv",
			commit: "冰",
			source: "snow-jiandao/basic.md",
		},
		{
			id: "buffered",
			keys: "bgxkkrf  ",
			commit: "冰雪输入法",
			options: ["buffered"],
			source: "snow-jiandao/basic.md",
		},
	],
	snow_qingyun: [
		// affix 前缀在 rime_api_console 的逐行请求间会被定型；反查功能由 Mira 覆盖，
		// 此处不把控制台限制误记为方案延迟或功能失败。
		{
			id: "single-shape",
			keys: "rrri",
			page: "晶",
			source: "snow-qingyun/basic.md",
		},
		{
			id: "double",
			keys: "kyi",
			page: "可以",
			source: "snow-qingyun/basic.md",
		},
		{
			id: "triple",
			keys: "wsme",
			page: "为什么",
			source: "snow-qingyun/basic.md",
		},
		{
			id: "four",
			keys: "gtss",
			page: "感同身受",
			source: "snow-qingyun/basic.md",
		},
		{
			id: "long",
			keys: "zhrmGHGO",
			page: "中华人民共和国",
			source: "snow-qingyun/basic.md",
		},
		{
			id: "append",
			keys: "kyiE",
			page: "可以",
			source: "snow-qingyun/basic.md",
		},
		{
			id: "paging",
			keys: "b{Page_Down}{Page_Up}",
			source: "snow-qingyun/basic.md",
		},
		{
			id: "editing",
			keys: "rrriI{BackSpace}",
			page: "晶",
			source: "snow-qingyun/basic.md",
		},
		{
			id: "popping",
			keys: "kyiwsme",
			commit: "可以",
			source: "snow-qingyun/basic.md",
		},
		{
			id: "buffered",
			keys: "ppjgkvnagnpabw  ",
			commit: "梦泽闲客",
			options: ["buffered"],
			source: "snow-qingyun/basic.md",
		},
	],
	snow_yipin: [
		{
			id: "single",
			keys: chord("sgi"),
			page: "冰",
			source: "snow1/spelling.md",
		},
		{
			id: "double",
			keys: chord("sgi") + chord("drm "),
			page: "冰雪",
			source: "snow1/index.md；snow1/spelling.md",
		},
		{
			id: "paging",
			keys: chord("sgi") + "{Page_Down}{Page_Up}",
			source: "snow1/spelling.md",
		},
		{
			id: "popping",
			keys: chord("sgi") + chord("drm"),
			commit: "冰",
			source: "snow1/index.md；spec/snow_yipin.test.yaml",
		},
		{
			id: "buffered",
			keys: chord("sgi") + chord("drm") + chord(" ") + chord(" "),
			commit: "冰雪",
			options: ["buffered"],
			source: "snow1/index.md；spec/snow_yipin.test.yaml",
		},
	],
};

// 单键与翻页覆盖空桶提示的首次加载和后续输出；两个 21×26 方案使用同一预算。
for (const schema of ["snow_shenyun_shape", "snow_shenyun_tone"]) {
	LATENCY_CASES[schema] = [
		{
			id: "single-initial",
			keys: "s",
			page: "支持",
			source: `spec/${schema}.test.yaml`,
		},
		{
			id: "many-vacant-buckets",
			keys: "b",
			page: "必须",
			source: "lua/snow/shenyun_hints.lua",
		},
		{
			id: "vacant-paging",
			keys: "s{Page_Down}{Page_Up}",
			page: "支持",
			source: `spec/${schema}.test.yaml`,
		},
		{
			id: "double",
			keys: "cv",
			page: "测试",
			source: `spec/${schema}.test.yaml`,
		},
	];
}

// 声声二字词从两声母逐键追加到四辅，覆盖六方案的形辅和调笔语义。
for (const [schema, keys, page] of [
	["snow_jiandao", "yxoaai", "也许"],
	["snow_sanpin", "yxuoua", "也许"],
	["snow_jiandao_classic", "yxoaai", "也许"],
	["snow_sanpin_classic", "yxuoua", "也许"],
	["snow_shenyun_shape", "cvoaaa", "测试"],
	["snow_shenyun_tone", "cvaiee", "才是"],
]) {
	LATENCY_CASES[schema] ??= [];
	LATENCY_CASES[schema].push({
		id: "initial-pair-four-aux",
		keys,
		page,
		source: `spec/${schema}.test.yaml`,
	});
}

// 同一句教程示例按各方案的实际打法输入；下划线在教程中表示空格，
// 冰雪一拼的下划线则表示该击同时带空格。
for (const [schema, keys, commit, source] of [
	[
		"snow_sipin",
		"ymxs;bveaaebiddaemdd_gneeger_lqaa.",
		"充满希望的跋涉比到达目的地更能给人乐趣。",
		"snow4/index.md",
	],
	[
		"snow_sanpin",
		"bgxkkrf_smxw_ehrmGHG_.",
		"冰雪输入法充满希望中华人民共和国主席。",
		"spec/snow_sanpin.test.yaml",
	],
	[
		"snow_jiandao",
		"bgxkkrf_smxw_ehrmGHG_.",
		"冰雪输入法充满希望中华人民共和国主席。",
		"spec/snow_jiandao.test.yaml",
	],
	[
		"snow_qingyun",
		"cmxwefmqgkmmhbekodzimdd_kr_y_ver.lxotzkv.",
		"充满希望的跋涉比到达目的地更能给人乐趣。",
		"snow-qingyun/index.md",
	],
]) {
	LATENCY_CASES[schema].push({
		id: "sentence",
		keys: keys.replaceAll("_", " "),
		commit,
		source,
	});
}
LATENCY_CASES.snow_yipin.push({
	id: "sentence",
	keys: "dvi cm,_ r;_ euo_ f wul sh_ sgl fkl ful_ cj xcj_ xcj_ sfjk dgy_ sfj, wr bh svj_ k"
		.split(" ")
		.map((keys) => chord(keys.replaceAll("_", " ")))
		.join(""),
	commit: "充满希望的跋涉比到达目的地更能给人乐趣。",
	source: "snow1/index.md",
});

// 四主码词长直选：在真实候选链上验证上屏，同时计入惰性菜单展开的耗时。
for (const [schema, four, preferred, commit] of [
	["snow_jiandao", "rgen", "pxfe", "科学发展观"],
	["snow_sanpin", "rgen", "pxfe", "科学发展观"],
	["snow_jiandao_classic", "rgfn", "kxfq", "科学发展观"],
	["snow_sanpin_classic", "rgfn", "kxfq", "科学发展观"],
	["snow_jiandao_toned", "rgen", "pxfe", "科学发展观"],
	["snow_shenyun_shape", "rgsn", "jqji", "计算机"],
	["snow_shenyun_tone", "rgsn", "jqji", "计算机"],
	["snow_zhudao", "rgxn", "jsjz", "计算机"],
]) {
	LATENCY_CASES[schema].push(
		{
			id: "select-four",
			keys: `${four}{less}`,
			commit: "人工智能",
			source: "docs/word-length-selection.md",
		},
		{
			id: "select-preferred",
			keys: `${preferred}{greater}`,
			commit,
			source: "docs/word-length-selection.md",
		},
	);
}
for (const [schema, prefix, continuation, fallback, commit] of [
	["snow_shenyun_shape", "kyfs", "kyfsG", "wyzr", "有限责任公司"],
	["snow_shenyun_tone", "kyfs", "kyfsG", "wyzr", "有限责任公司"],
	["snow_zhudao", "kyfx", "kyfxG", "gfly", "股份有限公司"],
]) {
	LATENCY_CASES[schema].push(
		{
			id: "native-long-completion",
			keys: prefix,
			page: "科学发展",
			source: "docs/word-length-selection.md",
		},
		{
			id: "explicit-long",
			keys: continuation,
			page: "科学发展观",
			source: "docs/word-length-selection.md",
		},
		{
			id: "select-long-fallback",
			keys: `${fallback}{greater}`,
			commit,
			source: "docs/word-length-selection.md",
		},
	);
}
