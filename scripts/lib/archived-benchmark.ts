import { spawnSync } from "node:child_process";
import { ROOT } from "./paths";

/** 历史产物已从 reports 清理；旧图复现工具只读固定 Git 快照。 */
export const ARCHIVED_BENCHMARK_REF =
	"362a041eb357b926fc0c2655e12351a19bddbd14";

function git(args: string[]): string {
	const result = spawnSync("git", args, {
		cwd: ROOT,
		encoding: "utf8",
		maxBuffer: 32 * 1024 * 1024,
	});
	if (result.status !== 0)
		throw new Error(
			`历史 benchmark 仅保存在 Git，请确保本地含提交 ${ARCHIVED_BENCHMARK_REF}。\n${result.stderr}`,
		);
	return result.stdout;
}

export function readArchivedBenchmark(path: string): string {
	return git([
		"show",
		`${ARCHIVED_BENCHMARK_REF}:${path.replaceAll("\\", "/")}`,
	]);
}

export function listArchivedBenchmarkFiles(directory: string): string[] {
	return git([
		"ls-tree",
		"--name-only",
		"-z",
		`${ARCHIVED_BENCHMARK_REF}:${directory.replaceAll("\\", "/")}`,
	])
		.split("\0")
		.filter(Boolean);
}
