/** 独立进程中的常驻 DLL 采集；缓存指纹一致时只查询缺少的路径。 */
import assert from "node:assert/strict";
import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	truncateSync,
	writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { RimeCandidateOracle } from "./lib/rime-candidate-oracle";
import { rootPath } from "./lib/paths";
import { physicalKeys } from "./lib/character-first-choice";

const [schema, inputArg, , outputArg, compiledArg] = process.argv.slice(2);
assert.ok(schema && inputArg && outputArg && compiledArg);
const output = resolve(outputArg);
const input = JSON.parse(readFileSync(resolve(inputArg), "utf8"));
const entry = input.schemas[schema];
assert.ok(entry, `缺少方案：${schema}`);
const characterMode = entry.options?.character === true;
const codes = [...new Set<string>(entry.codes)];
const required = new Set(codes);
mkdirSync(join(output, "results"), { recursive: true });
writeFileSync(
	join(output, "input.json"),
	JSON.stringify({ schemas: { [schema]: entry } }, null, 2) + "\n",
);
const revision = spawnSync("git", ["rev-parse", "HEAD"], {
	cwd: rootPath(),
	encoding: "utf8",
});
assert.equal(revision.status, 0);
const sources: Record<string, string> = {};
for (const name of readdirSync(rootPath())) {
	if (
		/^snow_.*(?:\.schema\.yaml|\.dict\.yaml|\.fixed\.txt|_common\.yaml)$/u.test(
			name,
		)
	) {
		sources[name] = createHash("sha256")
			.update(readFileSync(rootPath(name), "utf8").replaceAll("\r\n", "\n"))
			.digest("hex");
	}
}
const start = performance.now();
const oracle = new RimeCandidateOracle([schema], {
	cacheRoot: join(output, "cache"),
	compiledCacheRoot: resolve(compiledArg),
});
oracle.selectSchema(schema);
oracle.setOptions({
	popping: true,
	buffered: false,
	character: characterMode,
	ascii_mode: false,
	full_shape: false,
	traditionalization: false,
});
const startupMs = performance.now() - start;
const fingerprint = oracle.cacheDirectory().split(/[\\/]/u).at(-1)!;
const fingerprintPath = join(output, "fingerprint.txt");
const optionsPath = join(output, "query-options.json");
const observationPath = join(output, "results/observations.jsonl");
type Result = ReturnType<RimeCandidateOracle["observeUncached"]>;
const records = new Map<string, Result>();
let executions = 0;
let appended = 0;
try {
	if (existsSync(observationPath)) {
		assert.equal(
			existsSync(optionsPath)
				? JSON.parse(readFileSync(optionsPath, "utf8")).character
				: false,
			characterMode,
			"查询模式变化，不能复用旧缓存",
		);
		assert.equal(
			readFileSync(fingerprintPath, "utf8").trim(),
			fingerprint,
			"引擎缓存指纹变化，请使用新输出目录",
		);
		let content = readFileSync(observationPath, "utf8");
		if (content && !content.endsWith("\n")) {
			const boundary = content.lastIndexOf("\n") + 1;
			const tail = content.slice(boundary);
			try {
				JSON.parse(tail);
				appendFileSync(observationPath, "\n");
				content += "\n";
			} catch {
				// 仅截断中断留下的不完整末行，完整观测继续复用。
				content = content.slice(0, boundary);
				truncateSync(observationPath, Buffer.byteLength(content));
			}
		}
		for (const line of content.trimEnd().split("\n")) {
			if (!line) continue;
			const row = JSON.parse(line);
			assert.equal(row.schema, schema);
			records.set(row.code, {
				candidates: row.candidates.map((c: { text: string }) => c.text),
				commit: row.commit ?? "",
				completed: row.completed,
			});
		}
	}
	writeFileSync(fingerprintPath, fingerprint + "\n");
	writeFileSync(
		optionsPath,
		JSON.stringify({ character: characterMode }) + "\n",
	);
	const cachedBefore = records.size;
	// 同版本缓存仍抽查首尾路径，重建会话确认无跨查询状态残留。
	for (const code of [
		...new Set(
			[...records.keys()].slice(0, 3).concat([...records.keys()].slice(-3)),
		),
	]) {
		assert.deepEqual(
			oracle.observeUncached(code, true),
			records.get(code),
			`缓存独立复查失败：${schema}/${code}`,
		);
	}
	const save = (code: string, result: Result) => {
		if (!required.has(code)) return;
		const previous = records.get(code);
		if (previous) {
			assert.deepEqual(result, previous, `前缀观测不一致：${schema}/${code}`);
			return;
		}
		records.set(code, result);
		appendFileSync(
			observationPath,
			JSON.stringify({
				label: "local-dll",
				schema,
				variant: "default",
				code,
				commit: result.commit || null,
				completed: result.completed,
				candidates: result.candidates.map((text) => ({ text })),
			}) + "\n",
		);
		appended++;
	};
	const queryStart = performance.now();
	console.log(
		`${schema}: ready ${(startupMs / 1000).toFixed(2)} s, ${codes.length} inputs, ${cachedBefore} cached`,
	);
	const consumers = new Map<string, Set<string>>();
	for (const [text, target] of Object.entries(entry.targets) as [
		string,
		{ routes: string[]; rank: number },
	][]) {
		for (const route of target.routes)
			for (let length = 1; length <= route.length; length++) {
				const prefix = route.slice(0, length);
				const texts = consumers.get(prefix) ?? new Set<string>();
				texts.add(text);
				consumers.set(prefix, texts);
			}
	}
	const found = new Map<string, string>();
	for (const code of codes.sort(
		(a, b) => physicalKeys(a) - physicalKeys(b) || a.localeCompare(b),
	)) {
		const targets = consumers.get(code);
		if (!targets || [...targets].every((text) => found.has(text))) continue;
		if (!records.has(code)) {
			save(code, oracle.observeUncached(code, false, save));
			executions++;
			if (executions % 5000 === 0)
				console.log(
					`${schema}: ${executions} paths, ${records.size}/${codes.length} observations`,
				);
		}
		const result = records.get(code)!;
		const first = result.completed
			? result.commit || result.candidates[0]
			: undefined;
		if (first && targets.has(first) && !found.has(first))
			found.set(first, code);
	}
	const queryMs = performance.now() - queryStart;
	const auditedTargets: Record<string, unknown> = {};
	for (const [text, target] of Object.entries(entry.targets) as [
		string,
		{ routes: string[]; rank: number },
	][]) {
		const checkedRoutes = new Set<string>();
		for (const route of target.routes) {
			let checked = "";
			for (let length = 1; length <= route.length; length++) {
				const prefix = route.slice(0, length);
				if (!records.has(prefix)) {
					assert.ok(
						found.has(text) &&
							physicalKeys(prefix) >= physicalKeys(found.get(text)!),
						`未检查更短路径：${text}/${prefix}`,
					);
					break;
				}
				checked = prefix;
			}
			if (checked) checkedRoutes.add(checked);
		}
		auditedTargets[text] = {
			rank: target.rank,
			previousMinimum: found.get(text) ?? "NA",
			routes: [...checkedRoutes],
		};
	}
	writeFileSync(
		join(output, "input.json"),
		JSON.stringify(
			{
				contract: "local-shortest-enumerated-routes-v1",
				schemas: {
					[schema]: { codes: [...records.keys()], targets: auditedTargets },
				},
			},
			null,
			2,
		) + "\n",
	);
	const manifest = {
		label: "local-dll",
		revision: revision.stdout.trim(),
		runtime: "local-dll-prefix-batch",
		fingerprint,
		queryOptions: { character: characterMode },
		sources,
		probes: [{ schema, variant: "default", codes: [...records.keys()] }],
	};
	writeFileSync(
		join(output, "results/manifest.json"),
		JSON.stringify(manifest, null, 2) + "\n",
	);
	const report = {
		schema,
		targets: Object.keys(entry.targets).length,
		found: found.size,
		possibleInputs: codes.length,
		inputs: records.size,
		cachedBefore,
		appended,
		executions,
		startupMs,
		queryMs,
		elapsedMs: performance.now() - start,
		maxRssKiB: process.resourceUsage().maxRSS,
		fingerprint,
	};
	writeFileSync(
		join(output, "report.json"),
		JSON.stringify(report, null, 2) + "\n",
	);
	console.log(JSON.stringify(report));
} finally {
	oracle.close();
}
