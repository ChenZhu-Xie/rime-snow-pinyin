import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { collectCorpus } from "./collector";
import { loadManifest } from "./manifest";

export interface CollectCliOptions {
	manifestPath: string;
	cacheRoot: string;
	summaryPath: string;
	offline: boolean;
	inputMethodRoot?: string;
	longmaRoot?: string;
	inspectWords: string[];
}

function requiredValue(args: string[], index: number, option: string): string {
	const value = args[index + 1];
	if (!value || value.startsWith("--")) throw new Error(`${option} 需要路径参数`);
	return value;
}

export function parseCollectArgs(args: string[]): CollectCliOptions {
	const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
	const options: CollectCliOptions = {
		manifestPath: resolve(repoRoot, "config/fixed-corpus-sources.yaml"),
		cacheRoot: resolve(repoRoot, "cache/fixed-corpus"),
		summaryPath: resolve(repoRoot, "reports/fixed-corpus-summary.md"),
		offline: false,
		inspectWords: ["一些", "冲着", "下了"],
	};
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		if (argument === "--offline") {
			options.offline = true;
			continue;
		}
		if (argument === "--manifest") {
			options.manifestPath = resolve(requiredValue(args, index, argument));
			index += 1;
			continue;
		}
		if (argument === "--cache") {
			options.cacheRoot = resolve(requiredValue(args, index, argument));
			index += 1;
			continue;
		}
		if (argument === "--summary") {
			options.summaryPath = resolve(requiredValue(args, index, argument));
			index += 1;
			continue;
		}
		if (argument === "--input-method-root") {
			options.inputMethodRoot = resolve(requiredValue(args, index, argument));
			index += 1;
			continue;
		}
		if (argument === "--longma-root") {
			options.longmaRoot = resolve(requiredValue(args, index, argument));
			index += 1;
			continue;
		}
		if (argument === "--inspect-word") {
			const word = requiredValue(args, index, argument);
			if (!options.inspectWords.includes(word)) options.inspectWords.push(word);
			index += 1;
			continue;
		}
		throw new Error(`未知参数：${argument}`);
	}
	return options;
}

export async function runCollectCli(args: string[]): Promise<number> {
	const options = parseCollectArgs(args);
	const environment = {
		...process.env,
		...(options.inputMethodRoot
			? { FIXED_CORPUS_INPUTMETHOD_ROOT: options.inputMethodRoot }
			: {}),
		...(options.longmaRoot
			? { FIXED_CORPUS_LONGMA_ROOT: options.longmaRoot }
			: {}),
	};
	const manifest = loadManifest(options.manifestPath, environment);
	const result = await collectCorpus(manifest, {
		cacheRoot: options.cacheRoot,
		offline: options.offline,
		inspectWords: options.inspectWords,
	});
	mkdirSync(dirname(options.summaryPath), { recursive: true });
	writeFileSync(options.summaryPath, result.markdown, "utf8");
	process.stdout.write(
		`已生成 ${result.records.length} 条记录、${result.summary.uniqueWordCount} 个去重字词。\n`,
	);
	for (const diagnostic of result.diagnostics) {
		process.stdout.write(
			`[${diagnostic.severity}] ${diagnostic.sourceId} ${diagnostic.code}: ${diagnostic.message}\n`,
		);
	}
	return 0;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
	runCollectCli(process.argv.slice(2)).then(
		(code) => {
			process.exitCode = code;
		},
		(error: unknown) => {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		},
	);
}
