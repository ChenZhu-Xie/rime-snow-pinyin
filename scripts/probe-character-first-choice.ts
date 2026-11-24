/** 仅在 GitHub Actions 运行 Mira；本地 --prepare-only 只生成隔离输入。 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { dump, load } from "js-yaml";
import cases from "./data/character-first-choice-probes.json";
import { makeMiraDefaultCustomization } from "./lib/mira-default-custom";
import { ROOT } from "./lib/paths";
import { copyRimeDependencies } from "./lib/rime-dependencies";

const argument = (name: string) => {
	const index = process.argv.indexOf(name);
	return index < 0 ? undefined : process.argv[index + 1];
};
const source = resolve(argument("--source") ?? ROOT);
const output = resolve(
	argument("--output") ?? join(ROOT, "output/character-first-choice-probes"),
);
const label = argument("--label") ?? "fork";
const prepareOnly = process.argv.includes("--prepare-only");
assert.ok(
	prepareOnly || process.env.GITHUB_ACTIONS === "true",
	"真实候选采集仅允许 GitHub Actions，本地请用 --prepare-only",
);
mkdirSync(output, { recursive: true });
const hash = (file: string) =>
	createHash("sha256").update(readFileSync(file)).digest("hex");
const revision = spawnSync("git", ["rev-parse", "HEAD"], {
	cwd: source,
	encoding: "utf8",
});
assert.equal(revision.status, 0, revision.stderr);
const observation = join(output, "observations.jsonl");
const traces = join(output, "per-key-traces.tsv");
const manifest: {
	label: string;
	revision: string;
	runtime: string;
	sources: Record<string, string>;
	probes: Array<{ schema: string; variant: string; codes: string[] }>;
} = {
	label,
	revision: revision.stdout.trim(),
	runtime: argument("--runtime") ?? "prepare-only",
	sources: {},
	probes: [],
};
// 输出数据不用 assert:error 强迫失败；记录事实，与用户本机观察分开保存。
const observer = String.raw`
function quote(s)
  local escaped = tostring(s):gsub('[%z\1-\31\\"]', function(c)
    if c == '\\' then return '\\\\' end
    if c == '"' then return '\\"' end
    return string.format('\\u%04x', string.byte(c))
  end)
  return '"' .. escaped .. '"'
end
function record(code, schema, variant, label)
  local rows = {}
  for i = 1, math.min(6, #cand) do
    rows[#rows+1] = '{"text":' .. quote(cand[i].text) .. ',"comment":' .. quote(cand[i].comment or '') .. '}'
  end
  local f = assert(io.open(os.getenv('FIRST_CHOICE_OBSERVATIONS'), 'a'))
  f:write('{"label":' .. quote(label) .. ',"schema":' .. quote(schema) .. ',"variant":' .. quote(variant) .. ',"code":' .. quote(code) .. ',"preedit":' .. (preedit and quote(preedit) or 'null') .. ',"commit":' .. (commit and quote(commit) or 'null') .. ',"candidates":[' .. table.concat(rows, ',') .. ']}\n')
  f:close()
  return true
end
`;
// 在候选迭代到首项时记录输入、形辅、类型和固顶标记，不修改候选。
const traceFilter = String.raw`
local filter = {}
function filter.func(translation, env)
  local first = true
  for candidate in translation:iter() do
    if first then
      first = false
      local ctx = env.engine.context
      local f = assert(io.open(os.getenv('FIRST_CHOICE_TRACES'), 'a'))
      f:write(string.format('%q\t%q\t%q\t%q\t%q\n', ctx.input, ctx:get_property('shape_input') or '', candidate.text, candidate.comment, candidate.type))
      f:close()
    end
    yield(candidate)
  end
end
function filter.tags_match(segment, env) return segment:has_tag('abc') end
return filter
`;
interface ProbeSchema {
	__include?: string;
	engine?: { filters: string[]; translators: string[] };
}
function schemaEngine(file: string): NonNullable<ProbeSchema["engine"]> {
	const document = load(
		readFileSync(join(source, file), "utf8"),
	) as ProbeSchema;
	if (document.engine) return document.engine;
	const include = document.__include;
	assert.ok(include && include.endsWith(":/"), `无法展开 ${file} 的 engine`);
	return schemaEngine(include.slice(0, -2));
}
for (const [schema, entry] of Object.entries(cases.schemas)) {
	// 原版仅对照同合同的四拼和清韵；其他布局不能照抄物理输入。
	if (label === "upstream" && !["snow_sipin", "snow_qingyun"].includes(schema))
		continue;
	const engine = schemaEngine(`${schema}.schema.yaml`);
	const variants =
		schema === "snow_qingyun"
			? ["default", "no-postpone", "shape-only", "pinyin-only"]
			: ["default", "no-postpone", "no-fix"];
	for (const variant of variants) {
		const directory = join(output, schema, variant);
		const staging = join(directory, "source");
		mkdirSync(staging, { recursive: true });
		for (const item of readdirSync(source)) {
			if (
				!/^snow_.*(?:\.schema\.yaml|\.dict\.yaml|\.fixed\.txt|_common\.yaml)$/u.test(
					item,
				)
			)
				continue;
			cpSync(join(source, item), join(staging, item));
			manifest.sources[item] = hash(join(source, item));
		}
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
		writeFileSync(join(staging, "lua/first_choice_probe.lua"), traceFilter);
		const patch: Record<string, unknown> = {};
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
		patch["engine/filters"] = [
			...engine.filters.filter(
				(filter) =>
					!(
						variant === "no-postpone" && filter === "lua_filter@*snow.postpone"
					) && !(variant === "no-fix" && filter === "lua_filter@*snow.fix"),
			),
			"lua_filter@*first_choice_probe",
		];
		if (variant === "shape-only")
			patch["engine/translators"] = ["script_translator@qingyun"];
		if (variant === "pinyin-only")
			patch["engine/translators"] = ["script_translator"];
		const codes = [
			...new Set(
				entry.codes.flatMap((code) =>
					Array.from({ length: code.length }, (_, index) =>
						code.slice(0, index + 1),
					),
				),
			),
		];
		manifest.probes.push({ schema, variant, codes });
		const spec = {
			schema,
			source_dir: staging,
			script: observer,
			deploy: {
				probe: {
					patch,
					options: {
						popping: true,
						buffered: false,
						character: false,
						ascii_mode: false,
						full_shape: false,
						traditionalization: false,
					},
					tests: codes.map((code) => ({
						send: code,
						assert: `record(${JSON.stringify(code)}, ${JSON.stringify(schema)}, ${JSON.stringify(variant)}, ${JSON.stringify(label)})`,
					})),
				},
			},
		};
		const specPath = join(directory, "probe.test.yaml");
		writeFileSync(specPath, dump(spec, { lineWidth: -1, noRefs: true }));
		if (prepareOnly) continue;
		const temporary = join(directory, "tmp");
		mkdirSync(temporary, { recursive: true });
		const result = spawnSync(
			resolve(argument("--mira") ?? "./mira"),
			["-C", join(directory, "cache"), specPath],
			{
				cwd: source,
				encoding: "utf8",
				maxBuffer: 32 * 1024 * 1024,
				env: {
					...process.env,
					TMPDIR: temporary,
					FIRST_CHOICE_OBSERVATIONS: observation,
					FIRST_CHOICE_TRACES: traces,
				},
			},
		);
		writeFileSync(join(directory, "mira.log"), result.stdout + result.stderr);
		assert.equal(
			result.status,
			0,
			`${schema}/${variant}: ${result.stdout}\n${result.stderr}`,
		);
		console.log(`${label}/${schema}/${variant}: ${codes.length} 个独立会话`);
	}
}
writeFileSync(
	join(output, "manifest.json"),
	JSON.stringify(manifest, null, 2) + "\n",
);
if (!prepareOnly) {
	assert.ok(existsSync(observation));
	const records = readFileSync(observation, "utf8")
		.trim()
		.split("\n")
		.map((line) => JSON.parse(line));
	assert.equal(
		records.length,
		manifest.probes.reduce((sum, probe) => sum + probe.codes.length, 0),
	);
	console.log(
		JSON.stringify(
			records.filter((row) =>
				cases.schemas[row.schema as keyof typeof cases.schemas].codes.includes(
					row.code,
				),
			),
			null,
			2,
		),
	);
}
