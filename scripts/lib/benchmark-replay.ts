import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { BenchmarkPathResult } from "./benchmark-paths";

export type BenchmarkReplayToken = [start: number, code: string];
export type BenchmarkLineReplay = BenchmarkReplayToken[];
export type BenchmarkArticleReplay = BenchmarkLineReplay[];

export interface BenchmarkReplayCache {
	contract: string;
	schemes: Record<string, BenchmarkArticleReplay[]>;
}

export function readBenchmarkReplayCache(path: string): BenchmarkReplayCache {
	return JSON.parse(readFileSync(path, "utf8")) as BenchmarkReplayCache;
}

export function writeBenchmarkReplayCache(
	path: string,
	cache: BenchmarkReplayCache,
): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(cache)}\n`, "utf8");
}

export function assertBenchmarkReplaySchemes(
	cache: BenchmarkReplayCache,
	expectedIds: readonly string[],
	label: string,
): void {
	const actualIds = Object.keys(cache.schemes);
	if (
		actualIds.length !== expectedIds.length ||
		actualIds.some((id, index) => id !== expectedIds[index])
	)
		throw new Error(
			`${label}回放方案顺序不一致：${actualIds.join(",")} / ${expectedIds.join(",")}`,
		);
}

export function benchmarkReplay<Source extends string>(
	path: BenchmarkPathResult<Source>,
): BenchmarkLineReplay {
	return path.tokens.map((token) => [
		token.start,
		token.displayCode + (token.separator ? "_" : ""),
	]);
}

function width(text: string): number {
	return [...text].reduce(
		(sum, character) =>
			sum +
			Number(
				/\p{Script=Han}|[，。；：！？、“”‘’（）《》【】]/u.test(character),
			) +
			1,
		0,
	);
}

export function renderBenchmarkReplays(
	text: string,
	schemes: ReadonlyArray<{
		name: string;
		replay: BenchmarkLineReplay;
	}>,
): string {
	const characters = [...text];
	const positions = new Array<number>(characters.length + 1).fill(0);
	for (let index = 0; index < characters.length; index += 1)
		positions[index + 1] = positions[index] + width(characters[index]) + 1;
	let changed = true;
	while (changed) {
		changed = false;
		for (const { replay } of schemes) {
			for (let index = 0; index + 1 < replay.length; index += 1) {
				const [leftStart, leftCode] = replay[index];
				const [rightStart] = replay[index + 1];
				const required = positions[leftStart] + width(leftCode) + 1;
				if (positions[rightStart] >= required) continue;
				const delta = required - positions[rightStart];
				for (let offset = rightStart; offset < positions.length; offset += 1)
					positions[offset] += delta;
				changed = true;
			}
		}
	}
	const place = (items: ReadonlyArray<BenchmarkReplayToken>) => {
		let output = "";
		let cursor = 0;
		for (const [start, itemText] of items) {
			output += " ".repeat(Math.max(0, positions[start] - cursor));
			output += itemText;
			cursor = positions[start] + width(itemText);
		}
		return output;
	};
	const lines = [
		`原文       ${place(characters.map((character, start) => [start, character]))}`,
	];
	for (const { name, replay } of schemes)
		lines.push(`${name.padEnd(5, "　")} ${place(replay)}`);
	return lines.join("\n");
}
