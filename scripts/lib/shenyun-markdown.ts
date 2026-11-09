export type ComparisonDirection =
	| "min"
	| "max"
	| "closest-to-half"
	| "sum"
	| "triple-sum";

export interface ComparisonValue {
	display: string;
	score: number | number[];
}

export type ShenyunLanguage = "zh" | "en" | "zht";
export type LinkHost = "github" | "gitee";

const epsilon = 1e-12;

export const readComparisonScore = (
	score: number | number[],
	direction: ComparisonDirection,
) => {
	const scalar = Array.isArray(score)
		? score.reduce((sum, value) => sum + value, 0)
		: score;
	if (direction === "max") return -scalar;
	if (direction === "closest-to-half") return Math.abs(scalar - 0.5);
	return scalar;
};

export const stripComparisonDecoration = (value: string) => {
	let result = value
		.trim()
		.replace(/(?:\s+★+)+/gu, "")
		.replaceAll(" 🥇", "");
	if (result.startsWith("**") && result.endsWith("**"))
		result = result.slice(2, -2);
	return result;
};

const isTied = (left: number, right: number) =>
	Math.abs(left - right) <= epsilon;

export function decorateComparison(
	values: readonly ComparisonValue[],
	direction: ComparisonDirection,
	rankedCount = 3,
) {
	if (values.length === 0) return [];
	if (
		!Number.isInteger(rankedCount) ||
		rankedCount < 0 ||
		rankedCount > values.length
	)
		throw new Error("排名方案数量超出比较值范围。");
	const rankedIndices = Array.from(
		{ length: rankedCount },
		(_, index) => index,
	);
	const scores = values.map(({ score }) =>
		readComparisonScore(score, direction),
	);
	if (scores.some((score) => !Number.isFinite(score)))
		throw new Error("比较值必须是有限数字。");
	const globalBest = Math.min(...scores);
	return values.map(({ display }, index) => {
		let output = stripComparisonDecoration(display);
		if (rankedIndices.includes(index)) {
			const rank =
				1 +
				rankedIndices.filter(
					(otherIndex) => scores[otherIndex] < scores[index] - epsilon,
				).length;
			if (rank <= 2) output = `**${output}** ${rank === 1 ? "★★" : "★"}`;
		}
		if (isTied(scores[index], globalBest)) output += " 🥇";
		return output;
	});
}

const parseTableValue = (display: string, direction: ComparisonDirection) => {
	const plain = stripComparisonDecoration(display).replace(
		/\[([^\]]+)\]\([^)]+\)/gu,
		"$1",
	);
	const numbers = [...plain.matchAll(/-?\d+(?:\.\d+)?/gu)].map((match) =>
		Number(match[0]),
	);
	if (numbers.length === 0) throw new Error(`表格单元格没有数字：${display}`);
	if (direction === "sum") return numbers;
	if (direction === "triple-sum") return numbers.slice(0, 3);
	if (direction === "closest-to-half") {
		const value = numbers.at(-1) ?? Number.NaN;
		return plain.includes("%") ? value / 100 : value;
	}
	return numbers[0];
};

export function decorateMarkdownTable(
	markdown: string,
	directions: readonly ComparisonDirection[],
	rankedCount = 3,
) {
	const lines = markdown.split("\n");
	const headerCells = lines[0]
		?.trim()
		.slice(1, -1)
		.split("|")
		.map((cell) => cell.trim());
	if (!headerCells || headerCells.length < 5)
		throw new Error("比较表至少需要指标列和四个方案列。");
	const hasTrailingExplanation = /^(?:何为好|Better|何者為佳)$/u.test(
		headerCells.at(-1) ?? "",
	);
	const schemeCount = headerCells.length - 1 - (hasTrailingExplanation ? 1 : 0);
	let rowIndex = 0;
	for (let index = 2; index < lines.length; index++) {
		if (!lines[index].trimStart().startsWith("|")) continue;
		const direction = directions[rowIndex];
		if (!direction) throw new Error("比较方向少于 Markdown 表格数据行。");
		const cells = lines[index]
			.trim()
			.slice(1, -1)
			.split("|")
			.map((cell) => cell.trim());
		if (cells.length !== headerCells.length)
			throw new Error("比较表数据列数与表头不一致。");
		const displays = cells.slice(1, 1 + schemeCount);
		const decorated = decorateComparison(
			displays.map((display) => ({
				display,
				score: parseTableValue(display, direction),
			})),
			direction,
			rankedCount,
		);
		cells.splice(1, schemeCount, ...decorated);
		lines[index] = `| ${cells.join(" | ")} |`;
		rowIndex++;
	}
	if (rowIndex !== directions.length)
		throw new Error(
			`Markdown 表格有 ${rowIndex} 行，比较方向有 ${directions.length} 项。`,
		);
	return lines.join("\n");
}

const links = {
	overallGithub:
		"https://github.com/more-14-different/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md",
	overallGitee:
		"https://gitee.com/xie-chenzhu/shuangpin-layout-benchmark/blob/7a7e154f3f7d0c86653ee15e755ccd72e866e5e2/research/milestones/strict-d0/2026-10-30-strict-d0-production-closure-report.md",
	u357Github:
		"https://github.com/more-14-different/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md",
	u357Gitee:
		"https://gitee.com/xie-chenzhu/shuangpin-layout-benchmark/blob/11713b652cd6a2350d8bf6d0a16d3383d8f0038f/research/notes/2026-10-29-prodgate-directed-repair-final-report.md",
	feihua: "https://input.tansongchen.com/snow-feihua/basic.html",
	s005: "https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts",
	benchmarkGithub:
		"https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md",
	benchmarkGitee:
		"https://gitee.com/xie-chenzhu/shuangpin-layout-benchmark/blob/main/README_CN.md",
} as const;

const terms: Record<ShenyunLanguage, Array<[string, keyof typeof links]>> = {
	zh: [
		["神韵(Overall-17) 21×26 双拼", "overallGithub"],
		["无飞键道(U357) 21×21 双拼", "u357Github"],
		["神韵(Overall-17)", "overallGithub"],
		["无飞键道(U357)", "u357Github"],
		["双拼布局 Benchmark", "benchmarkGithub"],
		["星空键道 S005", "s005"],
		["首道 B04", "benchmarkGithub"],
		["飞花式四码顶", "feihua"],
		["A7E-v6-CW150", "benchmarkGithub"],
		["A7E-v5", "benchmarkGithub"],
		["A7E-v4", "benchmarkGithub"],
		["A7E-v3", "benchmarkGithub"],
		["Common399", "benchmarkGithub"],
		["LU-v1r", "benchmarkGithub"],
		["FA-1", "benchmarkGithub"],
		["M-R2", "benchmarkGithub"],
		["CKT v4", "benchmarkGithub"],
		["CKT v3", "benchmarkGithub"],
		["S005", "s005"],
		["B04", "benchmarkGithub"],
	],
	en: [
		["Shenyun(Overall-17) 21×26 double pinyin", "overallGithub"],
		["Wufei KeyTao(U357) 21×21 double pinyin", "u357Github"],
		["Shenyun(Overall-17)", "overallGithub"],
		["Wufei KeyTao(U357)", "u357Github"],
		["Shuangpin Layout Benchmark", "benchmarkGithub"],
		["Feihua four-code-top", "feihua"],
		["S005", "s005"],
		["B04", "benchmarkGithub"],
	],
	zht: [
		["神韻(Overall-17) 21×26 雙拼", "overallGithub"],
		["無飛鍵道(U357) 21×21 雙拼", "u357Github"],
		["神韻(Overall-17)", "overallGithub"],
		["無飛鍵道(U357)", "u357Github"],
		["雙拼布局 Benchmark", "benchmarkGithub"],
		["飛花式四碼頂", "feihua"],
		["S005", "s005"],
		["B04", "benchmarkGithub"],
	],
};

const resolveLink = (key: keyof typeof links, host: LinkHost) => {
	if (host === "gitee") {
		if (key === "overallGithub") return links.overallGitee;
		if (key === "u357Github") return links.u357Gitee;
		if (key === "benchmarkGithub") return links.benchmarkGitee;
	}
	return links[key];
};

const escapeRegexp = (value: string) =>
	value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

export function linkShenyunTerms(
	markdown: string,
	language: ShenyunLanguage,
	host: LinkHost = "github",
) {
	for (const [term, key] of terms[language]) {
		if (key !== "overallGithub" && key !== "u357Github") continue;
		markdown = markdown.replace(
			new RegExp(`(?<!!)\\[${escapeRegexp(term)}\\]\\([^)]+\\)`, "gu"),
			`[${term}](${resolveLink(key, host)})`,
		);
	}
	markdown = markdown.replace(
		/(\[!\[[^\]]*U357[^\]]*\]\(docs\/shenyun-u357-keyboard\.svg\)\])\([^)]+\)/gu,
		`$1(${resolveLink("u357Github", host)})`,
	);
	const protectedFragments: string[] = [];
	const protectedMarkdown = markdown.replace(
		/!?\[[^\]]*\]\([^)]+\)|`[^`]*`/gu,
		(fragment) => {
			const index = protectedFragments.push(fragment) - 1;
			return `\u0000${index}\u0000`;
		},
	);
	const replacements = new Map(
		terms[language].map(([term, key]) => [term, resolveLink(key, host)]),
	);
	const pattern = new RegExp(
		[...replacements.keys()]
			.sort((left, right) => right.length - left.length)
			.map((term) => term.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
			.join("|"),
		"gu",
	);
	const linked = protectedMarkdown.replace(pattern, (term) => {
		const url = replacements.get(term);
		return url ? `[${term}](${url})` : term;
	});
	return linked.replace(
		/\u0000(\d+)\u0000/gu,
		(_match, index: string) => protectedFragments[Number(index)],
	);
}

export function linkReadmeFiles(markdown: string, host: LinkHost) {
	const benchmark =
		host === "gitee"
			? "https://gitee.com/xie-chenzhu/shuangpin-layout-benchmark/blob/main/a7_CKT_R11.html"
			: "https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/a7_CKT_R11.html";
	const overallSource = resolveLink("overallGithub", host);
	const u357Source = resolveLink("u357Github", host);
	return markdown
		.replace(
			/(?<!\[)`snow_shenyun_shape`/gu,
			"[`snow_shenyun_shape`](snow_shenyun_shape.schema.yaml)",
		)
		.replace(
			/(?<!\[)`snow_shenyun_tone`/gu,
			"[`snow_shenyun_tone`](snow_shenyun_tone.schema.yaml)",
		)
		.replace(
			/(?<!\[)`SNOW-SHENYUN-21X26-PRODUCTION`/gu,
			"[`SNOW-SHENYUN-21X26-PRODUCTION`](config/shenyun-21x26-mapping.json)",
		)
		.replace(
			/(?<!\[)`a7_CKT_R11\.html`/gu,
			`[\`a7_CKT_R11.html\`](${benchmark})`,
		)
		.replace(
			/(?<!\[)`(?:7a7e154|2026-10-30-strict-d0-production-closure-report\.md)`/gu,
			(match) => `[${match}](${overallSource})`,
		)
		.replace(
			/(?<!\[)`(?:11713b6|2026-10-29-prodgate-directed-repair-final-report\.md)`/gu,
			(match) => `[${match}](${u357Source})`,
		);
}
