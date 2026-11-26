import assert from "node:assert/strict";
import {
	readFileSync,
	writeFileSync,
	mkdirSync,
	cpSync,
	readdirSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
// 只写隔离实验目录；生产固顶仍由 align-fixed-with-sipin.ts 管理。
const root = process.cwd(),
	base = resolve(process.argv[2] ?? "output/classic-fixed-ab"),
	up = resolve(process.argv[3] ?? "../rime-snow-pinyin_upstream");
mkdirSync(base, { recursive: true });
const pairs = [
	["snow_jiandao", "snow_landao"],
	["snow_sanpin", "snow_lanpin"],
];
const han = (s: string) => /^\p{Script=Han}$/u.test(s);
const parse = (s: string) =>
	new Map(
		s
			.split(/\r?\n/)
			.filter((l) => l.includes("\t") && !l.startsWith("#"))
			.map((l) => {
				const [c, t] = l.split("\t");
				return [c, t.split(" ")];
			}),
	);
const input = JSON.parse(
	readFileSync(
		process.argv[4] ?? "output/character-full-local/input.json",
		"utf8",
	),
);
const changes = [];
const replacements = new Map<string, string>();
for (const [local, upId] of pairs) {
	const old = parse(readFileSync(local + ".fixed.txt", "utf8"));
	const incoming = new Map<string, string[]>();
	for (const [code, ts] of parse(
		readFileSync(join(up, upId + ".fixed.txt"), "utf8"),
	)) {
		const single = ts.filter(han);
		if (!single.length) continue;
		const mapped =
			upId === "snow_lanpin" && code.length >= 3
				? code.slice(0, 2) +
					({ v: "i", i: "v", u: "u", o: "a", a: "o" }[code[2]] ?? code[2]) +
					code.slice(3)
				: code;
		assert.ok(!incoming.has(mapped), "mapped collision " + mapped);
		incoming.set(mapped, single);
	}
	const next = new Map<string, string[]>();
	for (const code of new Set([...old.keys(), ...incoming.keys()])) {
		const prev = old.get(code) ?? [];
		const replacement = incoming.get(code) ?? [];
		const result = [];
		let inserted = false;
		for (const t of prev) {
			if (han(t)) {
				if (!inserted) {
					result.push(...replacement);
					inserted = true;
				}
			} else result.push(t);
		}
		if (!inserted) result.push(...replacement);
		assert.deepEqual(
			result.filter((t) => !han(t)),
			prev.filter((t) => !han(t)),
		);
		if (result.length) next.set(code, result);
		if (JSON.stringify(prev.filter(han)) !== JSON.stringify(replacement))
			changes.push({ schema: local, code, before: prev, after: result });
	}
	replacements.set(
		local,
		"# 实验：上游单字固顶按本地声调映射；非单字候选保持原相对顺序\n" +
			[...next].map(([c, t]) => c + "\t" + t.join(" ")).join("\n") +
			"\n",
	);
	// 两组共享原始生产码路及两组固顶码路并集，不因候选分组改变搜索空间。
	for (const table of [old, next])
		for (const [code, ts] of table)
			for (const t of ts) {
				const target = input.schemas[local].targets[t];
				if (target && !target.routes.includes(code)) target.routes.push(code);
			}
	const codes = new Set<string>();
	for (const target of Object.values(input.schemas[local].targets) as any[])
		for (const code of target.routes)
			for (let i = 1; i <= code.length; i++) codes.add(code.slice(0, i));
	input.schemas[local].codes = [...codes].sort();
}
input.schemas = Object.fromEntries(
	pairs.map(([id]) => [id, input.schemas[id]]),
);
writeFileSync(join(base, "input.json"), JSON.stringify(input, null, 2));
writeFileSync(join(base, "changes.json"), JSON.stringify(changes, null, 2));
for (const variant of ["current", "upstream-singles"]) {
	const snap = join(base, variant);
	mkdirSync(join(snap, "scripts/lib"), { recursive: true });
	mkdirSync(join(snap, "scripts/experiments"), { recursive: true });
	mkdirSync(join(snap, "spec/fixtures"), { recursive: true });
	for (const name of readdirSync(root))
		if (/^snow_.*\.(yaml|txt)$/.test(name) && !name.endsWith(".custom.yaml"))
			cpSync(name, join(snap, name));
	cpSync("lua", join(snap, "lua"), { recursive: true });
	cpSync("deps/rime-radical-pinyin", join(snap, "deps/rime-radical-pinyin"), {
		recursive: true,
	});
	cpSync(
		"spec/fixtures/default.yaml",
		join(snap, "spec/fixtures/default.yaml"),
	);
	for (const name of [
		"rime-candidate-oracle.ts",
		"rime-candidate-query.ts",
		"rime-dependencies.ts",
		"paths.ts",
		"character-first-choice.ts",
	])
		cpSync("scripts/lib/" + name, join(snap, "scripts/lib", name));
	cpSync(
		"scripts/collect-character-oracle.ts",
		join(snap, "scripts/collect-character-oracle.ts"),
	);
	cpSync(
		"scripts/experiments/benchmark-character-oracle.ps1",
		join(snap, "scripts/experiments/benchmark-character-oracle.ps1"),
	);
	if (variant === "upstream-singles")
		for (const [id, text] of replacements)
			writeFileSync(join(snap, id + ".fixed.txt"), text);
}
writeFileSync(
	join(base, "provenance.json"),
	JSON.stringify(
		{
			local: spawnSync("git", ["rev-parse", "HEAD"], {
				encoding: "utf8",
			}).stdout.trim(),
			upstream: spawnSync("git", ["-C", up, "rev-parse", "HEAD"], {
				encoding: "utf8",
			}).stdout.trim(),
			changed: changes.length,
		},
		null,
		2,
	),
);
console.log({
	changed: changes.length,
	mixedChanges: changes.filter(
		(c) => c.before.some((t) => !han(t)) || c.after.some((t) => !han(t)),
	).length,
});
