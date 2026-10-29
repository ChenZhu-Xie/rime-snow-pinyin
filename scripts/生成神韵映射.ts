import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(
	readFileSync(join(root, "config", "shenyun-21x21-mapping.json"), "utf8"),
) as {
	id: string;
	name: string;
	candidateId: string;
	stateKey: string;
	sourceBranch: string;
	sourceReport: string;
	capacity: [number, number];
	commonSyllables: number;
	uniqueCommonCodes: number;
	collisionBuckets: number;
	affectedSyllables: number;
	memory: number;
	ordinaryInitialDisplacements: number;
	vowelDisplacements: number;
	auxiliaryKeys: string;
	toneKeys: string;
	cktV4: number;
	movingHandScore: number;
	initialMap: Record<string, string>;
	finalMap: Record<string, string>;
};
const frozenR9 = JSON.parse(
	readFileSync(join(root, "docs", "shenyun-r9-mapping.json"), "utf8"),
) as {
	payloadCodes: Record<string, string | null>;
	codes: Record<string, string | null>;
};

const unencoded = new Set(["hng", "m", "n", "ng", "ê"]);
const initials = [
	"zh",
	"ch",
	"sh",
	"b",
	"p",
	"m",
	"f",
	"d",
	"t",
	"n",
	"l",
	"g",
	"k",
	"h",
	"j",
	"q",
	"x",
	"r",
	"z",
	"c",
	"s",
];

function deriveCode(syllable: string) {
	if (unencoded.has(syllable)) return null;
	let head: string;
	let final: string;
	if (/^[aeo]/u.test(syllable)) {
		head = syllable[0].toUpperCase();
		final = syllable;
	} else if (syllable.startsWith("y")) {
		head = syllable.startsWith("yu") ? "YU" : "Y";
		final = syllable.startsWith("yu")
			? `v${syllable.slice(2)}`
			: syllable.slice(1);
	} else if (syllable.startsWith("w")) {
		head = "W";
		final = syllable === "wu" ? "u" : syllable.slice(1);
	} else {
		const initial = initials.find((value) => syllable.startsWith(value));
		if (!initial) return null;
		head = initial;
		final = syllable.slice(initial.length);
		if (["j", "q", "x"].includes(initial) && final.startsWith("u")) {
			final = `v${final.slice(1)}`;
		}
	}
	const first = source.initialMap[head];
	const second = source.finalMap[final];
	return first && second ? `${first}${second}`.toLowerCase() : null;
}

const syllables = Object.keys(frozenR9.codes);
const payloadCodes = Object.fromEntries(
	syllables.map((syllable) => [
		syllable,
		frozenR9.payloadCodes[syllable] === null ? null : deriveCode(syllable),
	]),
);
const codes = Object.fromEntries(
	syllables.map((syllable) => [syllable, deriveCode(syllable)]),
);
const derivedSyllables = syllables.filter(
	(syllable) => payloadCodes[syllable] === null && codes[syllable] !== null,
);

function summarize(values: Array<string | null>) {
	const encoded = values.filter((code): code is string => code !== null);
	const buckets = new Map<string, number>();
	for (const code of encoded) buckets.set(code, (buckets.get(code) ?? 0) + 1);
	const collisions = [...buckets.values()].filter((count) => count > 1);
	return {
		encoded: encoded.length,
		unique: buckets.size,
		collisionBuckets: collisions.length,
		affectedSyllables: collisions.reduce((sum, count) => sum + count, 0),
		vacantCodes: source.capacity[0] * source.capacity[1] - buckets.size,
	};
}

const commonSummary = summarize(Object.values(payloadCodes));
if (
	commonSummary.encoded !== source.commonSyllables ||
	commonSummary.unique !== source.uniqueCommonCodes ||
	commonSummary.collisionBuckets !== source.collisionBuckets ||
	commonSummary.affectedSyllables !== source.affectedSyllables
) {
	throw new Error(
		`Common399 摘要与候选审计不一致：${JSON.stringify(commonSummary)}`,
	);
}

const mappingSha256 = createHash("sha256")
	.update(JSON.stringify(codes))
	.digest("hex");
const payloadMappingSha256 = createHash("sha256")
	.update(JSON.stringify(payloadCodes))
	.digest("hex");
const output = {
	...source,
	scheme: source.id,
	mappingSha256,
	payloadMappingSha256,
	commonSummary,
	extendedSummary: summarize(Object.values(codes)),
	derivedSyllables,
	payloadCodes,
	codes,
};
const outputPath = join(root, "docs", "shenyun-u357-mapping.json");
const rendered = `${JSON.stringify(output, null, 2)}\n`;
if (process.argv.includes("--check")) {
	if (readFileSync(outputPath, "utf8").replace(/\r\n/gu, "\n") !== rendered) {
		throw new Error("神韵 U357 映射快照不是当前源配置的生成结果。");
	}
} else {
	writeFileSync(outputPath, rendered, "utf8");
}
console.log(
	`${source.id}：Common399 ${JSON.stringify(commonSummary)}；扩展域 ${JSON.stringify(output.extendedSummary)}；SHA256 ${mappingSha256}`,
);
