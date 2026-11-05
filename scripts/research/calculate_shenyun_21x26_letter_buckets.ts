import { readFileSync, writeFileSync } from "node:fs";
import { SpellingAlgebra } from "../lib/algebra";
import { rootPath } from "../lib/paths";

interface Candidate {
	text: string;
	weight: number;
}

interface Bucket {
	code: string;
	candidates: Candidate[];
	valuable10000: number;
	valuable1000: number;
	secondWeight: number;
	thirdWeight: number;
	displacedWeight: number;
}

const dictionaryFiles = [
	"snow_pinyin.dict.yaml",
	"snow_pinyin.base.dict.yaml",
	"snow_pinyin.ext.dict.yaml",
	"snow_pinyin.tencent.dict.yaml",
	"snow_pinyin.user.dict.yaml",
];
const consonants = [..."bcdfghjklmnpqrstvwxyz"];
const vowelAssignments: Readonly<Record<string, string>> = {
	a: "xw",
	e: "xj",
	i: "xb",
	o: "xf",
	u: "xx",
};
const valuableWeight = 10_000;
const algebra = new SpellingAlgebra(
	rootPath("snow_shenyun_common.yaml"),
	"shenyun_algebra",
	{ derive: false },
);

function compareText(left: string, right: string) {
	return left < right ? -1 : left > right ? 1 : 0;
}

function readBuckets() {
	const wordsByCode = new Map<string, Map<string, number>>();
	for (const file of dictionaryFiles) {
		for (const line of readFileSync(rootPath(file), "utf8").split(/\r?\n/u)) {
			if (!line.includes("\t") || line.startsWith("#")) continue;
			const [text, spelling, rawWeight] = line.split("\t");
			const weight = Number(rawWeight);
			if (
				[...text].length !== 1 ||
				!spelling ||
				spelling.startsWith("~") ||
				!Number.isFinite(weight) ||
				weight <= 1
			) {
				continue;
			}
			const code = algebra.apply(spelling);
			if (!/^[a-z]{2}$/u.test(code)) continue;
			const words = wordsByCode.get(code) ?? new Map<string, number>();
			words.set(text, Math.max(words.get(text) ?? 0, weight));
			wordsByCode.set(code, words);
		}
	}
	const result = new Map<string, Bucket>();
	for (const [code, words] of wordsByCode) {
		const candidates = [...words]
			.map(([text, weight]) => ({ text, weight }))
			.sort(
				(left, right) =>
					right.weight - left.weight || compareText(left.text, right.text),
			);
		const displaced = candidates.slice(1);
		result.set(code, {
			code,
			candidates,
			valuable10000: displaced.filter(({ weight }) => weight >= 10_000).length,
			valuable1000: displaced.filter(({ weight }) => weight >= 1_000).length,
			secondWeight: candidates[1]?.weight ?? 0,
			thirdWeight: candidates[2]?.weight ?? 0,
			displacedWeight: displaced.reduce((sum, { weight }) => sum + weight, 0),
		});
	}
	return result;
}

function compareBuckets(left: Bucket, right: Bucket) {
	return (
		left.valuable10000 - right.valuable10000 ||
		left.valuable1000 - right.valuable1000 ||
		left.secondWeight - right.secondWeight ||
		left.thirdWeight - right.thirdWeight ||
		left.displacedWeight - right.displacedWeight ||
		left.candidates.length - right.candidates.length ||
		compareText(left.code, right.code)
	);
}

function aggregateSuffix(suffix: string, buckets: ReadonlyMap<string, Bucket>) {
	const selected = consonants.map((letter) => buckets.get(letter + suffix));
	if (selected.some((bucket) => !bucket)) return null;
	const entries = selected as Bucket[];
	return {
		suffix,
		valuable10000: entries.reduce(
			(sum, bucket) => sum + bucket.valuable10000,
			0,
		),
		valuable1000: entries.reduce((sum, bucket) => sum + bucket.valuable1000, 0),
		secondThirdWeight: entries.reduce(
			(sum, bucket) => sum + bucket.secondWeight + bucket.thirdWeight,
			0,
		),
		displacedWeight: entries.reduce(
			(sum, bucket) => sum + bucket.displacedWeight,
			0,
		),
		candidateCount: entries.reduce(
			(sum, bucket) => sum + bucket.candidates.length,
			0,
		),
	};
}

function compareSuffixes(
	left: NonNullable<ReturnType<typeof aggregateSuffix>>,
	right: NonNullable<ReturnType<typeof aggregateSuffix>>,
) {
	return (
		left.valuable10000 - right.valuable10000 ||
		left.valuable1000 - right.valuable1000 ||
		left.secondThirdWeight - right.secondThirdWeight ||
		left.displacedWeight - right.displacedWeight ||
		left.candidateCount - right.candidateCount ||
		compareText(left.suffix, right.suffix)
	);
}

function renderBucket(letter: string, bucket: Bucket, reason: string) {
	const first = bucket.candidates[0];
	if (!first || !/^\p{Script=Han}$/u.test(first.text)) {
		throw new Error(`${letter.toUpperCase()} 的 ${bucket.code} 没有汉字首选。`);
	}
	return {
		letter,
		code: bucket.code,
		reason,
		naturalTop3: bucket.candidates.slice(0, 3),
		candidateCount: bucket.candidates.length,
		displacedAtLeast10000: bucket.valuable10000,
		displacedAtLeast1000: bucket.valuable1000,
		displacedWeight: bucket.displacedWeight,
	};
}

const buckets = readBuckets();
const commonSuffixes = [..."abcdefghijklmnopqrstuvwxyz"]
	.map((suffix) => aggregateSuffix(suffix, buckets))
	.filter((value) => value !== null)
	.sort(compareSuffixes);
if (commonSuffixes[0]?.suffix !== "y") {
	throw new Error(
		`最低影响的全占用共同尾键不再是 y：${commonSuffixes[0]?.suffix}`,
	);
}

const mapping = new Map<string, ReturnType<typeof renderBucket>>();
const exceptions: Record<string, string> = {};
for (const letter of consonants) {
	const common = buckets.get(`${letter}y`);
	if (!common) throw new Error(`${letter}y 不再是占用桶。`);
	let selected = common;
	let reason = "共同尾键 y";
	if (
		common.candidates.slice(1).some(({ weight }) => weight >= valuableWeight)
	) {
		selected = [..."abcdefghijklmnopqrstuvwxyz"]
			.map((suffix) => buckets.get(letter + suffix))
			.filter((bucket) => bucket !== undefined)
			.sort(compareBuckets)[0];
		exceptions[letter] = selected.code;
		reason = `y 桶含权重不低于 ${valuableWeight} 的后续候选，改用本行最低影响占用桶`;
	}
	mapping.set(letter, renderBucket(letter, selected, reason));
}

const xCode = mapping.get("x")?.code;
if (xCode !== "xy") throw new Error(`X 的共同尾键应为 xy，实际为 ${xCode}`);
const bestVowelBuckets = [..."abcdefghijklmnopqrstuvwxyz"]
	.map((suffix) => buckets.get(`x${suffix}`))
	.filter((bucket) => bucket !== undefined && bucket.code !== xCode)
	.sort(compareBuckets)
	.slice(0, 5);
const expectedVowelCodes = new Set(bestVowelBuckets.map(({ code }) => code));
for (const [letter, code] of Object.entries(vowelAssignments)) {
	if (!expectedVowelCodes.delete(code)) {
		throw new Error(
			`${letter.toUpperCase()} 的 ${code} 不在 x 行最低影响的五个占用桶中。`,
		);
	}
	const bucket = buckets.get(code);
	if (!bucket) throw new Error(`${code} 不再是占用桶。`);
	mapping.set(
		letter,
		renderBucket(letter, bucket, "x 载体行最低影响的五个占用桶之一"),
	);
}
if (expectedVowelCodes.size > 0) {
	throw new Error(`x 行最低影响桶没有全部分配：${[...expectedVowelCodes]}`);
}

const entries = [..."abcdefghijklmnopqrstuvwxyz"].map((letter) => {
	const entry = mapping.get(letter);
	if (!entry) throw new Error(`缺少字母 ${letter.toUpperCase()}。`);
	return entry;
});
const codes = entries.map(({ code }) => code);
if (new Set(codes).size !== 26) throw new Error("字母桶不是 26 个唯一占用码。");
if (entries.some(({ displacedAtLeast10000 }) => displacedAtLeast10000 > 0)) {
	throw new Error("仍有字母桶会挤动权重不低于 10000 的自然候选。");
}

const output = {
	id: "SNOW-SHENYUN-21X26-OCCUPIED-LETTER-BUCKETS-V1",
	status: "reserved-not-enabled",
	schemes: ["snow_shenyun_shape", "snow_shenyun_tone"],
	contract: {
		candidateOrder: ["existing-han", "uppercase-letter", "lowercase-letter"],
		vacantBucketsUsed: 0,
		commonConsonantSuffix: "y",
		valuableCandidateWeight: valuableWeight,
		consonantExceptions: exceptions,
		vowelCarrier: "x",
		preservedNamespaces: {
			ABA: 21 * 5 * 21,
			AAB: "unchanged",
			AAAB: "unchanged",
		},
	},
	source: {
		algebra: "snow_shenyun_common.yaml:/shenyun_algebra",
		dictionaries: dictionaryFiles,
		occupiedDefinition: "single-character non-pseudo entry with weight > 1",
	},
	commonSuffixAudit: commonSuffixes,
	letters: entries,
	totals: {
		candidateCount: entries.reduce(
			(sum, entry) => sum + entry.candidateCount,
			0,
		),
		displacedAtLeast10000: entries.reduce(
			(sum, entry) => sum + entry.displacedAtLeast10000,
			0,
		),
		displacedAtLeast1000: entries.reduce(
			(sum, entry) => sum + entry.displacedAtLeast1000,
			0,
		),
		displacedWeight: entries.reduce(
			(sum, entry) => sum + entry.displacedWeight,
			0,
		),
	},
};
const rendered = `${JSON.stringify(output, null, 2)}\n`;
const outputPath = rootPath("config", "shenyun-21x26-letter-buckets.json");
if (process.argv.includes("--check")) {
	if (readFileSync(outputPath, "utf8").replace(/\r\n/gu, "\n") !== rendered) {
		throw new Error(
			"config/shenyun-21x26-letter-buckets.json 不是当前词典的最新计算结果。",
		);
	}
} else {
	writeFileSync(outputPath, rendered, "utf8");
}
console.log(
	`21×26 字母占用桶：共同尾键 y；例外 ${JSON.stringify(exceptions)}；26 个桶均有汉字首选，未占空桶。`,
);
