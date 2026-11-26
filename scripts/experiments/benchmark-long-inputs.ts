import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
	readFileSync,
	writeFileSync,
	readdirSync,
	existsSync,
	mkdirSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { ROOT, rootPath } from "../lib/paths";
const output = resolve(process.argv[2] ?? "output/corpus-benchmark-current");
mkdirSync(output, { recursive: true });
const files: Record<string, string> = {};
const add = (path: string) => {
	files[path] = createHash("sha256").update(readFileSync(path)).digest("hex");
};
const tree = (dir: string) => {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory() && entry.name !== ".git") tree(path);
		else if (entry.isFile() && /\.(lua|txt|yaml)$/.test(entry.name)) add(path);
	}
};
for (const name of readdirSync(ROOT))
	if (/^snow_.*\.(yaml|txt)$/.test(name) && !name.endsWith(".custom.yaml"))
		add(rootPath(name));
tree(rootPath("lua/snow"));
tree(rootPath("deps/rime-radical-pinyin"));
add(rootPath("output/append-generalization/corpora.json"));
if (process.env.RIME_DLL) add(process.env.RIME_DLL);
if (process.env.RIME_SHARED_DATA)
	add(join(process.env.RIME_SHARED_DATA, "essay.txt"));
const target = join(output, "production-inputs.json");
if (existsSync(target)) {
	const previous = JSON.parse(readFileSync(target, "utf8"));
	for (const [path, hash] of Object.entries(previous.files))
		assert.equal(
			createHash("sha256")
				.update(readFileSync(resolve(ROOT, path)))
				.digest("hex"),
			hash,
			`输入发生变化，请另选输出目录：${path}`,
		);
} else
	writeFileSync(
		target,
		JSON.stringify({ createdAt: new Date().toISOString(), files }, null, 2) +
			"\n",
	);
console.log("生产输入和语料摘要一致");
