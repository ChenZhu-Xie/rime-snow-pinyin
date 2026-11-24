/** 声笔小鹤原版逐键诊断；只在 Actions 运行，不读取个人用户词典。 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { dump } from "js-yaml";

assert.equal(process.env.GITHUB_ACTIONS, "true", "仅允许 Actions 真实候选诊断");
const source = resolve(process.argv[2]);
const mira = resolve(process.argv[3]);
const output = resolve("output/sbxh-character-strokes");
const staging = join(output, "source");
mkdirSync(staging, { recursive: true });
cpSync(source, staging, { recursive: true });
cpSync("spec/fixtures/default.yaml", join(staging, "default.yaml"));
writeFileSync(
	join(staging, "default.custom.yaml"),
	"patch:\n  schema_list:\n    - schema: sbxh\n",
);
const targets = { 璟: "jkeeieiaee", 罍: "lwiaeieiae" };
const observations = join(output, "observations.jsonl");
const script = String.raw`
function quote(s)
  return '"' .. tostring(s):gsub('[%z\1-\31\\"]', function(c)
    if c == '\\' then return '\\\\' end
    if c == '"' then return '\\"' end
    return string.format('\\u%04x', string.byte(c))
  end) .. '"'
end
function record(code, target)
  local rows, rank = {}, nil
  for i, c in ipairs(cand) do
    if c.text == target and not rank then rank = i end
    if i <= 6 then rows[#rows+1] = '{"text":' .. quote(c.text) .. ',"comment":' .. quote(c.comment or '') .. '}' end
  end
  local f = assert(io.open(os.getenv('FIRST_CHOICE_OBSERVATIONS'), 'a'))
  f:write('{"code":' .. quote(code) .. ',"target":' .. quote(target) .. ',"rank":' .. (rank or 'null') .. ',"commit":' .. (commit and quote(commit) or 'null') .. ',"preedit":' .. (preedit and quote(preedit) or 'null') .. ',"candidates":[' .. table.concat(rows, ',') .. ']}\n')
  f:close()
  return true
end
`;
const spec = {
	schema: "sbxh",
	source_dir: staging,
	script,
	deploy: {
		probe: {
			patch: {
				"translator/enable_user_dict": false,
				"extended/enable_user_dict": false,
			},
			tests: Object.entries(targets)
				.flatMap(([target, full]) =>
					Array.from({ length: full.length }, (_, i) => {
						const code = full.slice(0, i + 1);
						return {
							send: code,
							assert: `record(${JSON.stringify(code)}, ${JSON.stringify(target)})`,
						};
					}),
				)
				.concat([
					{ send: "jkeeiei8", assert: 'commit == "璟"' },
					{ send: "lwiaeiei8", assert: 'commit == "罍"' },
				]),
		},
	},
};
const specPath = join(output, "probe.test.yaml");
writeFileSync(specPath, dump(spec, { lineWidth: -1, noRefs: true }));
const sources = Object.fromEntries(
	[
		"sbxh.schema.yaml",
		"sbxh.dict.yaml",
		"sbxh.extended.dict.yaml",
		"lua/sbxlm/auto_length.lua",
		"lua/sbxlm/strokes.txt",
	].map((file) => [
		file,
		createHash("sha256")
			.update(readFileSync(join(source, file)))
			.digest("hex"),
	]),
);
writeFileSync(
	join(output, "manifest.json"),
	JSON.stringify(
		{
			sources,
			targets,
			runtime: createHash("sha256").update(readFileSync(mira)).digest("hex"),
			revision: process.env.SBXH_REVISION,
		},
		null,
		2,
	),
);
mkdirSync(join(output, "tmp"), { recursive: true });
const result = spawnSync(mira, ["-C", join(output, "cache"), specPath], {
	encoding: "utf8",
	maxBuffer: 16 * 1024 * 1024,
	env: {
		...process.env,
		TMPDIR: join(output, "tmp"),
		FIRST_CHOICE_OBSERVATIONS: observations,
	},
});
writeFileSync(join(output, "mira.log"), result.stdout + result.stderr);
assert.equal(result.status, 0, result.stdout + result.stderr);
console.log(readFileSync(observations, "utf8"));
