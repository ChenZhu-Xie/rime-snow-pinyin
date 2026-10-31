export type ComparisonDirection =
	| "min"
	| "max"
	| "closest-to-half"
	| "triple-sum";

export interface ComparisonValue {
	display: string;
	score: number | number[];
}

export type ShenyunLanguage = "zh" | "en" | "zht";
export type LinkHost = "github" | "gitee";

const traditional21x21Indices = [1, 2] as const;
const nonShoudaoIndices: readonly number[] = [0, 1, 2];
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
	peers: readonly number[] = traditional21x21Indices,
) {
	if (values.length === 0) return [];
	const scores = values.map(({ score }) =>
		readComparisonScore(score, direction),
	);
	if (scores.some((score) => !Number.isFinite(score)))
		throw new Error("比较值必须是有限数字。");
	const globalBest = Math.min(...scores);
	const peerBest = Math.min(...peers.map((index) => scores[index]));
	const nonShoudaoBest = Math.min(
		...nonShoudaoIndices.map((index) => scores[index]),
	);
	return values.map(({ display }, index) => {
		let output = stripComparisonDecoration(display);
		const isPeerBest = peers.includes(index) && isTied(scores[index], peerBest);
		const isNonShoudaoBest =
			nonShoudaoIndices.includes(index) &&
			isTied(scores[index], nonShoudaoBest);
		if (isPeerBest || isNonShoudaoBest) output = `**${output}**`;
		if (isNonShoudaoBest) output += " ★★";
		else if (isPeerBest) output += " ★";
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
) {
	const lines = markdown.split("\n");
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
		if (cells.length < 5) throw new Error("比较表至少需要指标列和四个方案列。");
		const displays = cells.slice(1, 5);
		const decorated = decorateComparison(
			displays.map((display) => ({
				display,
				score: parseTableValue(display, direction),
			})),
			direction,
		);
		cells.splice(1, 4, ...decorated);
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
	overall: "https://input.tansongchen.com/snow-feihua/basic.html",
	u357: "https://pingshunhuangalex.gitbook.io/rime-xkjd/advance-in-xkjd/alt-code",
	s005: "https://pingshunhuangalex.gitbook.io/rime-xkjd/learn-xkjd/layouts",
	benchmarkGithub:
		"https://github.com/more-14-different/shuangpin-layout-benchmark/blob/main/README_CN.md",
	benchmarkGitee:
		"https://gitee.com/xie-chenzhu/shuangpin-layout-benchmark/blob/main/README_CN.md",
} as const;

const terms: Record<ShenyunLanguage, Array<[string, keyof typeof links]>> = {
	zh: [
		["神韵(Overall-17) 21×26 双拼", "overall"],
		["无飞键道(U357) 21×21 双拼", "u357"],
		["神韵(Overall-17)", "overall"],
		["无飞键道(U357)", "u357"],
		["星空键道 S005", "s005"],
		["首道 B04", "benchmarkGithub"],
		["飞花式四码顶", "overall"],
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
		["Shenyun(Overall-17) 21×26 double pinyin", "overall"],
		["Wufei KeyTao(U357) 21×21 double pinyin", "u357"],
		["Shenyun(Overall-17)", "overall"],
		["Wufei KeyTao(U357)", "u357"],
		["Feihua four-code-top", "overall"],
		["S005", "s005"],
		["B04", "benchmarkGithub"],
	],
	zht: [
		["神韻(Overall-17) 21×26 雙拼", "overall"],
		["無飛鍵道(U357) 21×21 雙拼", "u357"],
		["神韻(Overall-17)", "overall"],
		["無飛鍵道(U357)", "u357"],
		["飛花式四碼頂", "overall"],
		["S005", "s005"],
		["B04", "benchmarkGithub"],
	],
};

export function linkShenyunTerms(
	markdown: string,
	language: ShenyunLanguage,
	host: LinkHost = "github",
) {
	const protectedFragments: string[] = [];
	const protectedMarkdown = markdown.replace(
		/!?\[[^\]]*\]\([^)]+\)|`[^`]*`/gu,
		(fragment) => {
			const index = protectedFragments.push(fragment) - 1;
			return `\u0000${index}\u0000`;
		},
	);
	const replacements = new Map(
		terms[language].map(([term, key]) => [
			term,
			key === "benchmarkGithub" && host === "gitee"
				? links.benchmarkGitee
				: links[key],
		]),
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
		);
}
