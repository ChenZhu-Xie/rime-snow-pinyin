import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseAlgebraRules } from "./algebra";
import { loadWeightedCohort } from "./cohort";
import {
	type EncodedWord,
	encodeDictionaryWords,
	measureCollisions,
} from "./collisions";
import { writeJson } from "./json-writer";
import type { EncodingMode, LayoutDefinition } from "./layout";
import {
	type CollisionComparisonReport,
	type CollisionVariantId,
	renderCollisionMarkdown,
} from "./report";

interface MeasureCliOptions {
	repoRoot: string;
	jsonPath: string;
	markdownPath: string;
}

interface PreparedVariant {
	id: CollisionVariantId;
	name: string;
	words2: EncodedWord[];
	words4: EncodedWord[];
}

function requiredValue(args: string[], index: number, option: string): string {
	const value = args[index + 1];
	if (!value || value.startsWith("--"))
		throw new Error(`${option} 需要路径参数`);
	return value;
}

export function parseMeasureArgs(args: string[]): MeasureCliOptions {
	const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
	let repoRoot = defaultRoot;
	let jsonPath: string | undefined;
	let markdownPath: string | undefined;
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		if (argument === "--repo-root") {
			repoRoot = resolve(requiredValue(args, index, argument));
			index += 1;
			continue;
		}
		if (argument === "--json") {
			jsonPath = resolve(requiredValue(args, index, argument));
			index += 1;
			continue;
		}
		if (argument === "--markdown") {
			markdownPath = resolve(requiredValue(args, index, argument));
			index += 1;
			continue;
		}
		throw new Error(`未知参数：${argument}`);
	}
	return {
		repoRoot,
		jsonPath:
			jsonPath ??
			resolve(repoRoot, "cache/fixed-corpus/reports/collisions.json"),
		markdownPath:
			markdownPath ??
			resolve(repoRoot, "reports/shenyun-collision-comparison.md"),
	};
}

function layout(
	repoRoot: string,
	id: string,
	relativePath: string,
): LayoutDefinition {
	return {
		id,
		rules: parseAlgebraRules(
			readFileSync(resolve(repoRoot, relativePath), "utf8"),
			"sanpin_algebra",
		),
	};
}

function prepareVariant(
	id: CollisionVariantId,
	name: string,
	definition: LayoutDefinition,
	mode: EncodingMode,
	words2: Parameters<typeof encodeDictionaryWords>[0],
	words4: Parameters<typeof encodeDictionaryWords>[0],
): PreparedVariant {
	return {
		id,
		name,
		words2: encodeDictionaryWords(words2, definition, mode),
		words4: encodeDictionaryWords(words4, definition, mode),
	};
}

export function runMeasureCli(args: string[]): number {
	const options = parseMeasureArgs(args);
	const dictionaryPaths = [
		"snow_pinyin.base.dict.yaml",
		"snow_pinyin.ext.dict.yaml",
		"snow_pinyin.tencent.dict.yaml",
	].map((path) => resolve(options.repoRoot, path));
	const cohort = loadWeightedCohort(dictionaryPaths, [2, 4]);
	const words2 = cohort.words.filter(({ length }) => length === 2);
	const words4 = cohort.words.filter(({ length }) => length === 4);
	const shenyun = layout(
		options.repoRoot,
		"shenyun",
		"snow_sanpin.schema.yaml",
	);
	const original = layout(
		options.repoRoot,
		"original-jiandao",
		"config/original-jiandao-algebra.yaml",
	);
	const variants = [
		prepareVariant(
			"shenyun-canonical",
			"神韵规范码",
			shenyun,
			"canonical",
			words2,
			words4,
		),
		prepareVariant(
			"original-canonical",
			"原键道规范码",
			original,
			"canonical",
			words2,
			words4,
		),
		prepareVariant(
			"original-accepted",
			"原键道可接受码",
			original,
			"accepted",
			words2,
			words4,
		),
	];
	const cutoffs: Array<number | null> = [
		500,
		1_000,
		2_000,
		5_000,
		10_000,
		null,
	];
	const report: CollisionComparisonReport = {
		schemaVersion: 1,
		dictionaries: dictionaryPaths.map((path) => basename(path)),
		diagnosticCount: cohort.diagnostics.length,
		cutoffs: cutoffs.map((requested) => {
			const actualTwo =
				requested === null ? words2.length : Math.min(requested, words2.length);
			const actualFour =
				requested === null ? words4.length : Math.min(requested, words4.length);
			return {
				requested,
				label:
					requested === null
						? "全部"
						: `Top ${requested.toLocaleString("en-US")}`,
				actualTwo,
				actualFour,
				variants: variants.map((variant) => ({
					id: variant.id,
					name: variant.name,
					measurement: measureCollisions(
						variant.words2.slice(0, actualTwo),
						variant.words4.slice(0, actualFour),
					),
				})),
			};
		}),
	};
	mkdirSync(dirname(options.jsonPath), { recursive: true });
	mkdirSync(dirname(options.markdownPath), { recursive: true });
	writeJson(report, options.jsonPath);
	writeFileSync(options.markdownPath, renderCollisionMarkdown(report), "utf8");
	process.stdout.write(
		`已测量 ${words2.length} 个二字词、${words4.length} 个四字词；详细报告：${options.jsonPath}\n`,
	);
	return 0;
}

const invokedPath = process.argv[1]
	? pathToFileURL(resolve(process.argv[1])).href
	: "";
if (import.meta.url === invokedPath) {
	try {
		process.exitCode = runMeasureCli(process.argv.slice(2));
	} catch (error) {
		process.stderr.write(
			`${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exitCode = 1;
	}
}
