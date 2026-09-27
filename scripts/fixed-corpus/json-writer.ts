import { closeSync, mkdirSync, openSync, writeSync } from "node:fs";
import { dirname } from "node:path";

function* jsonTokens(value: unknown): Generator<string> {
	if (value === null || typeof value !== "object") {
		yield JSON.stringify(value) ?? "null";
		return;
	}
	if (Array.isArray(value)) {
		yield "[";
		for (let index = 0; index < value.length; index += 1) {
			if (index > 0) yield ",";
			yield* jsonTokens(value[index]);
		}
		yield "]";
		return;
	}
	yield "{";
	let first = true;
	for (const [key, item] of Object.entries(value)) {
		if (
			item === undefined ||
			typeof item === "function" ||
			typeof item === "symbol"
		)
			continue;
		if (!first) yield ",";
		first = false;
		yield JSON.stringify(key);
		yield ":";
		yield* jsonTokens(item);
	}
	yield "}";
}

export function* serializeJsonChunks(
	value: unknown,
	maxChunkCharacters = 4 * 1024 * 1024,
): Generator<string> {
	if (!Number.isInteger(maxChunkCharacters) || maxChunkCharacters < 1) {
		throw new Error("maxChunkCharacters 必须是正整数");
	}
	let chunk = "";
	for (const token of jsonTokens(value)) {
		let remaining = token;
		while (remaining.length > 0) {
			const available = maxChunkCharacters - chunk.length;
			chunk += remaining.slice(0, available);
			remaining = remaining.slice(available);
			if (chunk.length === maxChunkCharacters) {
				yield chunk;
				chunk = "";
			}
		}
	}
	if (chunk.length > 0) yield chunk;
}

export function writeJson(value: unknown, path: string): void {
	mkdirSync(dirname(path), { recursive: true });
	const handle = openSync(path, "w");
	try {
		for (const chunk of serializeJsonChunks(value))
			writeSync(handle, chunk, null, "utf8");
		writeSync(handle, "\n", null, "utf8");
	} finally {
		closeSync(handle);
	}
}
