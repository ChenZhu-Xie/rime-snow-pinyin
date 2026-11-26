import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
	closeSync,
	cpSync,
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { dump } from "js-yaml";
import { exact500Articles } from "../exact_500_articles";
import { benchmarkTargetWords } from "../lib/benchmark-corpus";
import { makeMiraDefaultCustomization } from "../lib/mira-default-custom";
import { ROOT } from "../lib/paths";
import { copyRimeDependencies } from "../lib/rime-dependencies";

const argument = (name: string) => {
	const index = process.argv.indexOf(name);
	return index < 0 ? undefined : process.argv[index + 1];
};
const source = resolve(argument("--source") ?? ROOT);
const output = resolve(
	argument("--output") ?? join(ROOT, "output/append-probes"),
);
const prepareOnly = process.argv.includes("--prepare-only");
assert.ok(
	prepareOnly || process.env.GITHUB_ACTIONS === "true",
	"真实候选验证仅允许 GitHub Actions，本地请用 --prepare-only",
);
const input = JSON.parse(
	readFileSync(
		resolve(
			argument("--cases") ??
				join(ROOT, "scripts/data/append-character-probes.json"),
		),
		"utf8",
	),
) as {
	revision: string;
	corpusSha256: string;
	schemas: Record<
		string,
		{
			name: string;
			variants: Record<
				string,
				Array<{ input: string; kind: string; expected?: string }>
			>;
		}
	>;
};
const onlySchema = argument("--schema");
assert.equal(
	createHash("sha256").update(JSON.stringify(exact500Articles)).digest("hex"),
	input.corpusSha256,
	"实验语料发生变化",
);
const targetWords = benchmarkTargetWords(
	exact500Articles.flatMap((article) => article.lines),
);
const observations = join(output, "observations.jsonl");
mkdirSync(output, { recursive: true });
assert.ok(!existsSync(observations), "观测文件已存在，请使用新的输出目录");
const revision = spawnSync("git", ["rev-parse", "HEAD"], {
	cwd: source,
	encoding: "utf8",
});
assert.equal(revision.status, 0);
if (!prepareOnly)
	assert.equal(
		revision.stdout.trim(),
		input.revision,
		"探针必须与冻结评测源码版本一致",
	);
const observer = String.raw`
function quote(s)
  return '"' .. tostring(s):gsub('[%z\1-\31\\"]', function(c)
    if c == '\\' then return '\\\\' end
    if c == '"' then return '\\"' end
    return string.format('\\u%04x', string.byte(c))
  end) .. '"'
end
function record(schema, tail, input, kind, expected)
  local rows = {}
  for i = 1, math.min(6, #cand) do rows[#rows+1] = quote(cand[i].text) end
  local text = commit or ""
  local passed = kind ~= "append" or text == expected
  local f = assert(io.open(os.getenv("APPEND_OBSERVATIONS"), "a"))
  f:write('{"schema":', quote(schema), ',"tail":', quote(tail), ',"input":', quote(input), ',"kind":', quote(kind), ',"expected":', quote(expected), ',"commit":', quote(text), ',"candidates":[', table.concat(rows, ','), '],"passed":', tostring(passed), '}\n')
  f:close()
  return true
end
`;
let completed = 0;
for (const [schema, entry] of Object.entries(input.schemas)) {
	if (onlySchema && schema !== onlySchema) continue;
	for (const [tail, cases] of Object.entries(entry.variants)) {
		const actualCases = new Map(cases.map((entry) => [entry.input, entry]));
		// 第一轮「了」收集未知前缀；后续两个候选补测这些前缀实际首选的追加。
		if (!prepareOnly && tail !== "了" && existsSync(observations))
			for (const line of readFileSync(observations, "utf8")
				.trim()
				.split(/\r?\n/u)) {
				const row = JSON.parse(line);
				if (
					row.schema !== schema ||
					row.tail !== "了" ||
					row.kind !== "state" ||
					row.commit !== "" ||
					!row.candidates[0]
				)
					continue;
				const word = row.candidates[0] + tail;
				if (targetWords.has(word))
					actualCases.set(row.input + "/", {
						input: row.input + "/",
						kind: "append",
						expected: word,
					});
			}
		const requests = [...actualCases.values()];
		const directory = join(output, schema, tail);
		const staging = join(directory, "source");
		mkdirSync(staging, { recursive: true });
		for (const name of readdirSync(source))
			if (
				/^snow_.*(?:\.yaml|\.fixed\.txt)$/u.test(name) &&
				!name.endsWith(".custom.yaml")
			)
				cpSync(join(source, name), join(staging, name));
		cpSync(join(source, "lua"), join(staging, "lua"), { recursive: true });
		if (existsSync(join(source, "opencc")))
			cpSync(join(source, "opencc"), join(staging, "opencc"), {
				recursive: true,
			});
		copyRimeDependencies(source, staging);
		cpSync(
			join(ROOT, "spec/fixtures/default.yaml"),
			join(staging, "default.yaml"),
		);
		writeFileSync(
			join(staging, "default.custom.yaml"),
			makeMiraDefaultCustomization(schema),
		);
		const patch: Record<string, unknown> = {
			"punctuator/half_shape/+": { "/": tail },
		};
		for (const namespace of [
			"translator",
			"qingyun",
			"jianpin",
			"initial_pair",
			"shenyun",
			"pinyin",
		]) {
			patch[`${namespace}/enable_user_dict`] = false;
			patch[`${namespace}/enable_schema_user_dict`] = false;
		}
		const spec = {
			schema,
			source_dir: staging,
			script: observer,
			deploy: {
				append: {
					patch,
					options: {
						popping: true,
						buffered: false,
						character: false,
						ascii_mode: false,
						full_shape: false,
						traditionalization: false,
					},
					tests: requests.map((entry) => ({
						send: entry.input,
						assert: `record(${[schema, tail, entry.input, entry.kind, entry.expected ?? ""].map((value) => JSON.stringify(value)).join(", ")})`,
					})),
				},
			},
		};
		const specPath = join(directory, "probe.test.yaml");
		writeFileSync(specPath, dump(spec, { lineWidth: -1, noRefs: true }));
		if (prepareOnly) continue;
		const temporary = join(directory, "tmp");
		mkdirSync(temporary, { recursive: true });
		const logPath = join(directory, "mira.log");
		const log = openSync(logPath, "w");
		const result = spawnSync(
			resolve(argument("--mira") ?? "./mira"),
			["-C", join(directory, "cache"), specPath],
			{
				cwd: source,
				stdio: ["ignore", log, log],
				env: {
					...process.env,
					TMPDIR: temporary,
					APPEND_OBSERVATIONS: observations,
				},
			},
		);
		closeSync(log);
		assert.equal(result.status, 0, `${schema}/${tail} 采集失败：${logPath}`);
		const text = readFileSync(logPath, "utf8");
		assert.doesNotMatch(
			text,
			/Lua\w*::\w+ error\(|Error opening (?:reversedb|db)|attempt to index a nil value/u,
		);
		console.log(`${schema}/${tail}：${requests.length} 条观测`);
		completed += requests.length;
	}
}
if (!prepareOnly) {
	const rows = readFileSync(observations, "utf8")
		.trim()
		.split(/\r?\n/u)
		.map((line) => JSON.parse(line));
	assert.equal(rows.length, completed);
	const failed = rows.filter((row) => !row.passed);
	writeFileSync(
		join(output, "summary.json"),
		JSON.stringify(
			{
				revision: input.revision,
				observations: completed,
				appendFailures: failed.length,
				failed,
			},
			null,
			2,
		) + "\n",
	);
	console.log(
		`观测 ${completed} 条，追加结果不符 ${failed.length} 条；完整记录 ${observations}`,
	);
	// 不用错误断言中断采集；保留所有反例，供模型复核后重新选路。
}
