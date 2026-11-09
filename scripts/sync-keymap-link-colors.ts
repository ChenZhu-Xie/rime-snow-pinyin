import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type SourceManifest = {
	repository: string;
	sourcePath: string;
	sourceCommit: string;
	sha256: string;
};

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const vendorDirectory = join(scriptDirectory, "vendor");
const vendorPath = join(vendorDirectory, "keymap-link-colors.js");
const manifestPath = join(vendorDirectory, "keymap-link-colors.source.json");
const check = process.argv.includes("--check");
const sourceIndex = process.argv.indexOf("--source");
if (sourceIndex >= 0 && !process.argv[sourceIndex + 1]) {
	throw new Error("--source 后必须提供 shuangpin-layout-benchmark 路径");
}
const sourceRoot =
	sourceIndex >= 0
		? resolve(process.argv[sourceIndex + 1])
		: process.env.SHUANGPIN_BENCHMARK_DIR
			? resolve(process.env.SHUANGPIN_BENCHMARK_DIR)
			: undefined;

function sha256(content: Buffer | string) {
	return createHash("sha256")
		.update(content.toString().replace(/\r\n?/gu, "\n").replace(/\n+$/u, "\n"))
		.digest("hex");
}

const manifest = JSON.parse(
	readFileSync(manifestPath, "utf8"),
) as SourceManifest;
const vendor = readFileSync(vendorPath);
const vendorHash = sha256(vendor);
if (vendorHash !== manifest.sha256) {
	throw new Error(
		`vendored keymap link color core has drifted: ${vendorHash} != ${manifest.sha256}`,
	);
}

if (!sourceRoot) {
	if (!check) {
		throw new Error(
			"同步时需要 --source <shuangpin-layout-benchmark> 或 SHUANGPIN_BENCHMARK_DIR",
		);
	}
	console.log(`键位图 link 配色核心快照校验通过：${manifest.sourceCommit}`);
	process.exit(0);
}

const sourcePath = join(sourceRoot, manifest.sourcePath);
if (!existsSync(sourcePath)) throw new Error(`找不到上游核心：${sourcePath}`);
const source = readFileSync(sourcePath);
const sourceHash = sha256(source);
if (check) {
	if (sourceHash !== vendorHash) {
		throw new Error(
			`上游核心与 vendored 快照不一致：${sourceHash} != ${vendorHash}`,
		);
	}
	console.log(`键位图 link 配色核心与上游一致：${sourceHash}`);
	process.exit(0);
}

const sourceCommit = execFileSync(
	"git",
	["-C", sourceRoot, "rev-parse", "HEAD"],
	{
		encoding: "utf8",
	},
).trim();
writeFileSync(vendorPath, source);
writeFileSync(
	manifestPath,
	`${JSON.stringify(
		{
			...manifest,
			sourceCommit,
			sha256: sourceHash,
		},
		null,
		"\t",
	)}\n`,
);
console.log(`已同步键位图 link 配色核心：${sourceCommit} ${sourceHash}`);
