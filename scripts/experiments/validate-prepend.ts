// 验证所有入选 / 路径。字符参数不影响候选或分段，用固定「在」分别验证前插与追加。
import assert from "node:assert/strict";
import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { rootPath } from "../lib/paths";
import { RimeCandidateOracle } from "../lib/rime-candidate-oracle";
import { appendProbeInput } from "../lib/benchmark-append-experiment";

const id = process.argv[2] ?? "sipin";
const output = rootPath("output/prepend-experiment");
const summary = JSON.parse(
	readFileSync(join(output, `${id}-summary.json`), "utf8"),
);
const source = join(output, "validation-source");
const { ALL_BENCHMARK_SCHEMES } = await import(
	pathToFileURL(join(summary.source, "scripts/lib/benchmark-schemes.ts")).href
);
const scheme = ALL_BENCHMARK_SCHEMES.find((s: any) => s.id === id);
if (!existsSync(join(source, "lua/snow/benchmark_affix.lua"))) {
	mkdirSync(source, { recursive: true });
	for (const name of readdirSync(summary.source))
		if (/^snow_.*\.(yaml|txt)$/.test(name) && !name.endsWith(".custom.yaml"))
			cpSync(join(summary.source, name), join(source, name));
	cpSync(join(summary.source, "lua"), join(source, "lua"), { recursive: true });
	cpSync(join(summary.source, "spec/fixtures"), join(source, "spec/fixtures"), {
		recursive: true,
	});
	cpSync(
		join(summary.source, "deps/rime-radical-pinyin"),
		join(source, "deps/rime-radical-pinyin"),
		{ recursive: true },
	);
	for (const name of readdirSync(source).filter((name) =>
		name.endsWith(".yaml"),
	)) {
		const path = join(source, name);
		const original = readFileSync(path, "utf8");
		if (!original.includes("  processors:")) continue;
		writeFileSync(
			path,
			original.replace(
				"  processors:",
				"  processors:\n    - lua_processor@*snow.benchmark_affix",
			),
		);
	}
	writeFileSync(
		join(source, "lua/snow/benchmark_affix.lua"),
		`-- 仅隔离实验：/ 提交参数字和完整候选，不写生产配置。
local snow = require "snow.snow"
local processor = {}
function processor.func(key, env)
  if key.keycode ~= 47 or key.modifier > 0 then return snow.kNoop end
  local ctx = env.engine.context
  local text = ""
  if ctx.input ~= "" then
    local cand = ctx:get_selected_candidate()
    if not cand or cand.start ~= 0 or cand._end ~= #ctx.input then return snow.kNoop end
    text = cand.text
  end
  local output
  if ctx:get_option("benchmark_prepend") then output = "在" .. text
  else output = text .. "在" end
  snow.commit_text(env.engine, output)
  ctx:clear()
  return snow.kAccepted
end
return processor
`,
	);
}
const probes = JSON.parse(
	readFileSync(join(output, `${id}-probes.json`), "utf8"),
);
const unique = new Map<string, any>();
for (const p of probes) {
	const [direction, char] = p.variant.split(":");
	assert.ok(
		direction === "prepend"
			? p.expected.startsWith(char)
			: p.expected.endsWith(char),
	);
	const base =
		direction === "prepend"
			? p.expected.slice(char.length)
			: p.expected.slice(0, -char.length);
	const key = `${direction}\t${p.code}`;
	const existing = unique.get(key);
	assert.ok(!existing || existing.base === base, `同码不同候选 ${key}`);
	unique.set(key, { direction, code: p.code, base });
}
const oracle = new RimeCandidateOracle([scheme.schemaId], {
	sourceDirectory: source,
	cacheRoot: join(output, "validation-cache", id),
	compiledCacheRoot: join(output, "validation-compiled", id),
});
const validationPath = join(output, `${id}-validation.json`);
const results: any[] = existsSync(validationPath)
	? JSON.parse(readFileSync(validationPath, "utf8")).results.filter(
			(r: any) => !unique.has(`${r.direction}\t${r.code}`),
		)
	: [];
try {
	oracle.selectSchema(scheme.schemaId);
	for (const direction of ["append", "prepend"]) {
		oracle.setOptions({
			popping: true,
			buffered: false,
			character: false,
			ascii_mode: false,
			full_shape: false,
			traditionalization: false,
			benchmark_prepend: direction === "prepend",
		});
		let count = 0;
		for (const p of unique.values())
			if (p.direction === direction) {
				const observed = oracle.observe(appendProbeInput(p.code));
				const expected =
					direction === "prepend" ? "在" + p.base : p.base + "在";
				results.push({
					...p,
					expected,
					observed,
					ok: observed.completed !== false && observed.commit === expected,
				});
				if (++count % 500 === 0) {
					Bun.gc(true);
					console.log(id, direction, count, oracle.cacheStats());
				}
			}
	}
	writeFileSync(
		join(output, `${id}-validation.json`),
		JSON.stringify(
			{
				cache: oracle.cacheDirectory(),
				stats: oracle.cacheStats(),
				parameter: "在",
				results,
			},
			null,
			2,
		),
	);
	console.log(
		id,
		"validated",
		results.length,
		"rejected",
		results.filter((r) => !r.ok).length,
	);
	const rejectedCurrent = results.filter(
		(r) => !r.ok && unique.has(`${r.direction}\t${r.code}`),
	);
	summary.status = rejectedCurrent.length
		? "terminal failures; reoptimization required"
		: "terminal-validated (parameterized character 在)";
	summary.validation = {
		path: validationPath,
		uniqueTerminalCases: unique.size,
		rejectedCurrent: rejectedCurrent.length,
	};
	writeFileSync(
		join(output, `${id}-summary.json`),
		JSON.stringify(summary, null, 2),
	);
} finally {
	oracle.close();
}
