import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
	createWriteStream,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { ROOT, rootPath } from "./lib/paths";

// 五个阶段串行：真实候选、声笔、清风、5500 字汇总、额外 500 字同源导出。
const stages = [
	["internal", "generate_full_benchmark_reports.ts"],
	["sbxh", "benchmark-sbxh-5000.ts"],
	["flypy", "benchmark-flypy-5000.ts"],
	["summary", "generate-5500-benchmark.ts"],
	["standalone", "export-500-benchmark.ts"],
] as const;
const arg = (name: string) => {
	const i = process.argv.indexOf(name);
	return i < 0 ? undefined : process.argv[i + 1];
};
const first = arg("--from") ?? "internal";
const reuseUnchanged = process.argv.includes("--reuse-unchanged");
const previousInternal = reuseUnchanged
	? JSON.parse(
			readFileSync(
				rootPath("reports/5000字_当前十方案最优切分实测结果.json"),
				"utf8",
			),
		)
	: undefined;
const previousExternal = reuseUnchanged
	? JSON.parse(
			readFileSync(
				rootPath("reports/5000字_当前十二方案最优切分实测结果.json"),
				"utf8",
			),
		)
	: undefined;
const start = stages.findIndex(([name]) => name === first);
if (start < 0)
	throw new Error(
		`未知阶段 ${first}；可选 internal/sbxh/flypy/summary/standalone`,
	);
const sbxh = resolve(
	arg("--sbxh-dir") ?? join(process.env.APPDATA ?? "", "Rime"),
);
const flypy = resolve(
	arg("--flypy-dir") ??
		[
			"C:/Program Files/WindInput/data_custom",
			join(process.env.LOCALAPPDATA ?? "", "WindInput/data_custom"),
		].find((p) => existsSync(join(p, "schemas/flypy.schema.toml"))) ??
		"",
);
if (!existsSync(join(sbxh, "sbxh.schema.yaml")))
	throw new Error(`找不到声笔小鹤：${sbxh}`);
if (!existsSync(join(flypy, "schemas/flypy.schema.toml")))
	throw new Error(`找不到小鹤音形（清风版）：${flypy}`);
const runDirectory = rootPath(
	"output/benchmark-runs",
	new Date().toISOString().replaceAll(/[:.]/gu, "-"),
);
mkdirSync(runDirectory, { recursive: true });

function snapshot() {
	const files: Record<string, string> = {};
	const add = (path: string) => {
		if (existsSync(path))
			files[
				path.startsWith(ROOT)
					? relative(ROOT, path).replaceAll("\\", "/")
					: path
			] = createHash("sha256").update(readFileSync(path)).digest("hex");
	};
	const tree = (directory: string, accept: RegExp) => {
		if (!existsSync(directory)) return;
		for (const item of readdirSync(directory, { withFileTypes: true })) {
			if (item.isDirectory() && !["node_modules", ".git"].includes(item.name))
				tree(join(directory, item.name), accept);
			else if (item.isFile() && accept.test(item.name))
				add(join(directory, item.name));
		}
	};
	for (const name of readdirSync(ROOT))
		if (/^snow_.*\.(yaml|txt)$/u.test(name) && !name.endsWith(".custom.yaml"))
			add(rootPath(name));
	tree(rootPath("lua/snow"), /\.(lua|txt)$/u);
	tree(rootPath("scripts"), /\.(ts|js|json|tsv)$/u);
	tree(rootPath("config"), /\.json$/u);
	for (const name of ["radical_pinyin.schema.yaml", "radical_pinyin.dict.yaml"])
		add(rootPath("deps/rime-radical-pinyin", name));
	for (const name of [
		"default.yaml",
		"sbfh.yaml",
		"sbpy.dict.yaml",
		"sbpy.schema.yaml",
		"sbpy.unihan.dict.yaml",
		"sbxh.dict.yaml",
		"sbxh.schema.yaml",
		"sbxlm.yaml",
		"sbyp.schema.yaml",
	])
		add(join(sbxh, name));
	tree(join(sbxh, "lua"), /\.lua$/u);
	tree(
		join(sbxh, "build"),
		/^(bihua|sbpy(?:\.(base|ext|tencent))?|sbxh(?:\.extended)?|sbxh2|sbyp|zhlf)\.(bin|schema\.yaml|prism\.bin|reverse\.bin|table\.bin)$/u,
	);
	add(join(flypy, "schemas/flypy.schema.toml"));
	tree(join(flypy, "schemas/flypy"), /\.(wdat|yaml)$/u);
	return files;
}
const before = snapshot();
const manifest = {
	contract: "snow-benchmark-run-v1",
	startedAt: new Date().toISOString(),
	from: first,
	wordLengthSelection: !process.argv.includes(
		"--without-word-length-selection",
	),
	sources: { sbxh, flypy },
	reuseUnchanged: reuseUnchanged
		? {
				internal: ["snow_sipin", "snow_qingyun"],
				candidateCache:
					previousInternal.reusedUnchangedCandidateCache ??
					previousInternal.candidateCache,
				sbxhCache: previousExternal.schemes.sbxh.candidateCache,
				reason:
					"调用者已审计这些方案及外部词库的规则和来源未变化；八个双拼方案不复用旧候选",
			}
		: undefined,
	files: before,
	completed: [] as string[],
};
const save = () =>
	writeFileSync(
		join(runDirectory, "manifest.json"),
		`${JSON.stringify(manifest, null, 2)}\n`,
	);
save();
console.log(`十二方案 5500 字评测；日志与输入 SHA-256：${runDirectory}`);
for (const [name, script] of stages.slice(start)) {
	console.log(`开始 ${name}：${script}`);
	const args = [rootPath("scripts", script)];
	if (
		name === "internal" &&
		process.argv.includes("--without-word-length-selection")
	)
		args.push("--without-word-length-selection");
	if (name === "sbxh") args.push("--source-dir", sbxh);
	if (name === "internal" && reuseUnchanged)
		args.push(
			"--reuse-unchanged-cache",
			previousInternal.reusedUnchangedCandidateCache ??
				previousInternal.candidateCache,
		);
	if (name === "sbxh" && reuseUnchanged)
		args.push(
			"--reuse-candidate-cache",
			previousExternal.schemes.sbxh.candidateCache,
		);
	if (name === "flypy") args.push("--source-dir", flypy);
	const log = createWriteStream(join(runDirectory, `${name}.log`));
	const exitCode = await new Promise<number | null>((done, reject) => {
		const child = spawn(process.execPath, args, {
			cwd: ROOT,
			stdio: ["ignore", "pipe", "pipe"],
		});
		child.stdout.pipe(log, { end: false });
		child.stdout.pipe(process.stdout, { end: false });
		child.stderr.pipe(log, { end: false });
		child.on("error", reject);
		child.on("close", (code) => {
			log.end(() => done(code));
		});
	});
	if (exitCode !== 0)
		throw new Error(
			`${name} 失败（${exitCode}），日志：${runDirectory}；候选缓存已保留。`,
		);
	const runtimeErrors = readFileSync(join(runDirectory, `${name}.log`), "utf8")
		.split(/\r?\n/u)
		.filter((line) =>
			/Lua\w*::\w+ error\(|Error opening (?:reversedb|db)|attempt to index a nil value/u.test(
				line,
			),
		);
	if (runtimeErrors.length > 0)
		throw new Error(
			`${name} 出现 Rime 运行错误，停止生成可信报告：\n${runtimeErrors.slice(0, 5).join("\n")}`,
		);
	manifest.completed.push(name);
	save();
}
const after = snapshot();
const changed = [
	...new Set([...Object.keys(before), ...Object.keys(after)]),
].filter((p) => before[p] !== after[p]);
if (changed.length)
	throw new Error(`运行期间输入发生变化，需要复跑：${changed.join("、")}`);
writeFileSync(
	join(runDirectory, "success.json"),
	`${JSON.stringify({ completedAt: new Date().toISOString(), report: "reports/十一场景_5500字_当前十二方案对比评测.md", inputFingerprint: createHash("sha256").update(JSON.stringify(before)).digest("hex") }, null, 2)}\n`,
);
console.log("十二方案评测及逐键核验完成，缓存已保留。");
