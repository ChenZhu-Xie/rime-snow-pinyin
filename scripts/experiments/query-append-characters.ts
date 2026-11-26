import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { exact500Articles } from "../exact_500_articles";
import { benchmarkTargetWords } from "../lib/benchmark-corpus";
import { ROOT, rootPath } from "../lib/paths";
import { copyRimeDependencies } from "../lib/rime-dependencies";
import { RimeCandidateOracle } from "../lib/rime-candidate-oracle";

const argument = (name: string) => {
	const index = process.argv.indexOf(name);
	return index < 0 ? undefined : process.argv[index + 1];
};
const directory = resolve(
	argument("--experiment") ?? rootPath("output/append-characters"),
);
// 每次观察单独落盘；耗时查询由下方共同的持久候选缓存和编译缓存复用。
const output = resolve(
	argument("--output") ??
		join(
			directory,
			"native-observations",
			new Date().toISOString().replaceAll(/[:.]/gu, "-"),
		),
);
const input = JSON.parse(
	readFileSync(join(directory, "probes.json"), "utf8"),
) as {
	revision: string;
	corpusSha256: string;
	schemas: Record<
		string,
		{
			variants: Record<
				string,
				Array<{ input: string; kind: string; expected?: string }>
			>;
		}
	>;
};
assert.equal(
	createHash("sha256").update(JSON.stringify(exact500Articles)).digest("hex"),
	input.corpusSha256,
);
const source = join(directory, `source-${input.revision}`);
assert.equal(
	JSON.parse(
		readFileSync(join(source, "append-experiment-source.json"), "utf8"),
	).revision,
	input.revision,
);
// 冻结版本和当前版本的部件子模块提交须一致，才可补入快照缺少的两个发布依赖。
const { execFileSync } = await import("node:child_process");
execFileSync("git", ["swap", "auto"], { cwd: ROOT, stdio: "ignore" });
const tree = (revision: string) =>
	execFileSync("git", ["ls-tree", revision, "deps/rime-radical-pinyin"], {
		cwd: ROOT,
		encoding: "utf8",
	});
assert.equal(tree(input.revision), tree("HEAD"));
copyRimeDependencies(ROOT, source);
mkdirSync(output, { recursive: true });
const observations = join(output, "observations.jsonl");
assert.ok(
	!existsSync(observations),
	"观测已存在；重跑请另选 --experiment 目录，持久缓存仍可复用",
);
const observedStates = new Map<
	string,
	{ input: string; candidates: string[]; commit: string; completed: boolean }
>();
const targetWords = benchmarkTargetWords(
	exact500Articles.flatMap((article) => article.lines),
);
const summaries: Array<{
	tail: string;
	schema: string;
	queries: number;
	failures: number;
	cache: string;
}> = [];
for (const tail of ["了", "与", "在"]) {
	console.log(`建立独立只读部署：/ → ${tail}`);
	const oracle = new RimeCandidateOracle(Object.keys(input.schemas), {
		sourceDirectory: source,
		appendCharacter: tail,
		cacheRoot: join(directory, "native-cache"),
		compiledCacheRoot: join(directory, "native-compiled"),
	});
	try {
		for (const [schema, entry] of Object.entries(input.schemas)) {
			oracle.selectSchema(schema);
			oracle.setOptions({
				popping: true,
				buffered: false,
				character: false,
				ascii_mode: false,
				full_shape: false,
				traditionalization: false,
			});
			const cases = new Map(
				entry.variants[tail].map((entry) => [entry.input, entry]),
			);
			if (tail !== "了")
				for (const [key, state] of observedStates) {
					if (
						!key.startsWith(schema + "\t") ||
						!state.completed ||
						state.commit !== "" ||
						!state.candidates[0]
					)
						continue;
					const word = state.candidates[0] + tail;
					if (targetWords.has(word))
						cases.set(state.input + "/", {
							input: state.input + "/",
							kind: "append",
							expected: word,
						});
				}
			let failures = 0;
			for (const entry of cases.values()) {
				const actual = oracle.observe(entry.input);
				const passed =
					entry.kind !== "append" ||
					(actual.completed && actual.commit === entry.expected);
				if (!passed) failures++;
				appendFileSync(
					observations,
					JSON.stringify({ schema, tail, ...entry, ...actual, passed }) + "\n",
				);
				if (entry.kind === "state")
					observedStates.set(`${schema}\t${entry.input}`, {
						input: entry.input,
						...actual,
					});
			}
			oracle.auditCachedQueries();
			summaries.push({
				tail,
				schema,
				queries: cases.size,
				failures,
				cache: oracle.cacheDirectory(),
			});
			console.log(
				`${schema}/${tail}：${cases.size} 条，结果不符 ${failures} 条，${JSON.stringify(oracle.cacheStats())}`,
			);
		}
	} finally {
		oracle.close();
	}
}
writeFileSync(
	join(output, "audit.json"),
	JSON.stringify(
		{
			revision: input.revision,
			kind: "local-librime-isolated-readonly",
			dllSha256: process.env.RIME_DLL
				? createHash("sha256")
						.update(readFileSync(process.env.RIME_DLL))
						.digest("hex")
				: undefined,
			essaySha256: process.env.RIME_SHARED_DATA
				? createHash("sha256")
						.update(
							readFileSync(join(process.env.RIME_SHARED_DATA, "essay.txt")),
						)
						.digest("hex")
				: undefined,
			schemas: Object.keys(input.schemas).length,
			summaries,
		},
		null,
		2,
	) + "\n",
);
console.log(`本地候选及追加验证完成：${output}`);
