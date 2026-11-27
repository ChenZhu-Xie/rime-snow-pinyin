import { createHash } from "node:crypto";
import {
	createReadStream,
	existsSync,
	lstatSync,
	readdirSync,
	readFileSync,
	realpathSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, win32 } from "node:path";

export interface ArchiveEntry {
	original: string;
	coldRelative: string;
	state: string;
	files: number;
	bytes: number;
	manifest: string;
	manifestSha256: string;
	sourceHead?: string | null;
	provenance?: Record<string, unknown>;
}

export interface DeduplicatedEntry {
	original: string;
	retained: { location: "hot" | "cold"; path: string };
	files: number;
	bytes: number;
}

export interface ArchiveBatch {
	id: string;
	archiveBranch: string;
	archiveHead: string;
	indexSha256: string;
	entries: ArchiveEntry[];
	deduplicated?: DeduplicatedEntry[];
	evidenceManifestSha256?: string;
	bundles?: Array<{ coldRelative: string; bytes: number; sha256: string }>;
}

export interface ArchiveCatalog {
	schemaVersion: 1;
	mode: "address-mapping-only";
	coldRoot: string;
	batches: ArchiveBatch[];
}

export interface ArchiveLocations {
	repo: string;
	cold: string;
	metadata: string;
}

const normalized = (value: string) => value.replaceAll("\\", "/");
const hashPattern = /^[0-9a-f]{64}$/iu;

/** Reject both Windows and POSIX escapes, even when inspecting another platform's catalog. */
export function safeRelative(value: string, allowDot = false): string {
	if (typeof value !== "string" || value.includes("\0"))
		throw new Error("路径必须为相对地址");
	const path = normalized(value);
	if (path === "." && allowDot) return path;
	if (
		!path ||
		isAbsolute(path) ||
		win32.isAbsolute(value) ||
		path.includes(":") ||
		path.split("/").some((part) => !part || part === "." || part === "..")
	)
		throw new Error(`路径越界或格式无效：${value}`);
	return path;
}

export function contained(root: string, path: string, allowDot = false) {
	return resolve(root, safeRelative(path, allowDot));
}

/** Existing ancestors must stay under the explicit root; offline roots never fall back to hot files. */
function assertContained(root: string, target: string) {
	const rootReal = realpathSync(root);
	let path = target;
	while (!existsSync(path)) {
		const parent = resolve(path, "..");
		if (parent === path) throw new Error(`路径不可用：${target}`);
		path = parent;
	}
	const rel = relative(rootReal, realpathSync(path));
	if (
		rel === ".." ||
		rel.startsWith(`..${win32.sep}`) ||
		rel.startsWith("../") ||
		isAbsolute(rel)
	)
		throw new Error(`链接目标越出指定根目录：${target}`);
}

function assertPlainPath(root: string, target: string) {
	assertContained(root, target);
	let current = target;
	while (current !== resolve(root)) {
		if (lstatSync(current).isSymbolicLink())
			throw new Error(`清单路径不能经过链接：${current}`);
		const parent = resolve(current, "..");
		if (parent === current) throw new Error(`路径越界：${target}`);
		current = parent;
	}
}

function payloadFiles(root: string): string[] {
	if (lstatSync(root).isFile()) return ["."];
	const files: string[] = [];
	const visit = (directory: string) => {
		for (const item of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, item.name);
			// Historical dependency links are evidence, not included payload files; never follow them.
			if (lstatSync(path).isSymbolicLink()) continue;
			if (item.isDirectory()) visit(path);
			else if (item.isFile())
				files.push(normalized(relative(root, path)).toLowerCase());
		}
	};
	visit(root);
	return files;
}

export function loadCatalog(path: string): ArchiveCatalog {
	const catalog = JSON.parse(readFileSync(path, "utf8")) as ArchiveCatalog;
	if (
		catalog.schemaVersion !== 1 ||
		catalog.mode !== "address-mapping-only" ||
		!Array.isArray(catalog.batches)
	)
		throw new Error("不支持的冷存索引格式");
	const ids = new Set<string>();
	for (const batch of catalog.batches) {
		if (!/^[a-z0-9][a-z0-9._-]*$/iu.test(batch.id) || ids.has(batch.id))
			throw new Error(`批次 ID 无效或重复：${batch.id}`);
		ids.add(batch.id);
		if (!hashPattern.test(batch.indexSha256) || !Array.isArray(batch.entries))
			throw new Error(`批次摘要或条目无效：${batch.id}`);
		for (const entry of batch.entries) {
			safeRelative(entry.original);
			const cold = safeRelative(entry.coldRelative);
			if (!cold.startsWith(`${batch.id}/`))
				throw new Error(`条目不属于批次：${cold}`);
			safeRelative(entry.manifest);
			if (
				!hashPattern.test(entry.manifestSha256) ||
				!Number.isSafeInteger(entry.files) ||
				entry.files < 0 ||
				!Number.isSafeInteger(entry.bytes) ||
				entry.bytes < 0
			)
				throw new Error(`条目摘要或数量无效：${entry.original}`);
		}
		for (const entry of batch.deduplicated ?? []) {
			safeRelative(entry.original);
			safeRelative(entry.retained.path);
			if (!["hot", "cold"].includes(entry.retained.location))
				throw new Error("保留位置无效");
		}
		for (const bundle of batch.bundles ?? []) {
			if (
				!safeRelative(bundle.coldRelative).startsWith(`${batch.id}/`) ||
				!hashPattern.test(bundle.sha256) ||
				!Number.isSafeInteger(bundle.bytes) ||
				bundle.bytes < 0
			)
				throw new Error(`Git bundle 记录无效：${batch.id}`);
		}
		if (
			batch.evidenceManifestSha256 &&
			!hashPattern.test(batch.evidenceManifestSha256)
		)
			throw new Error(`证据清单摘要无效：${batch.id}`);
	}
	return catalog;
}

export async function sha256(path: string) {
	const hash = createHash("sha256");
	for await (const chunk of createReadStream(path)) hash.update(chunk);
	return hash.digest("hex");
}

async function checkHash(path: string, expected: string) {
	if ((await sha256(path)) !== expected.toLowerCase())
		throw new Error(`SHA-256 不一致：${path}`);
}

export function archiveStatus(
	catalog: ArchiveCatalog,
	locations: ArchiveLocations,
) {
	const online = existsSync(locations.cold);
	return catalog.batches.map((batch) => {
		let available = 0;
		let escaped = 0;
		if (online)
			for (const entry of batch.entries) {
				const target = contained(locations.cold, entry.coldRelative);
				try {
					assertContained(locations.cold, target);
					if (existsSync(target)) available++;
				} catch {
					escaped++;
				}
			}
		return {
			batch: batch.id,
			archiveBranch: batch.archiveBranch,
			archiveHead: batch.archiveHead,
			entries: batch.entries.length,
			files: batch.entries.reduce((n, e) => n + e.files, 0),
			bytes: batch.entries.reduce((n, e) => n + e.bytes, 0),
			available,
			state: !online
				? "offline"
				: escaped
					? "invalid-location"
					: available !== batch.entries.length
						? "missing-payload"
						: "available-unverified",
			metadata: existsSync(join(locations.metadata, batch.id, "index.json"))
				? "local"
				: online && existsSync(join(locations.cold, batch.id, "index.json"))
					? "cold"
					: "missing",
		};
	});
}

export function findArchives(
	catalog: ArchiveCatalog,
	locations: ArchiveLocations,
	query: string,
) {
	let term = normalized(query).replace(/\/$/u, "");
	const repo = normalized(resolve(locations.repo));
	if (term.toLowerCase().startsWith(`${repo.toLowerCase()}/`))
		term = term.slice(repo.length + 1);
	if (!term) throw new Error("请输入历史路径、批次、分支或提交关键字");
	const lower = term.toLowerCase();
	const results = [];
	for (const batch of catalog.batches) {
		for (const entry of batch.entries) {
			if (
				!JSON.stringify([
					batch.id,
					batch.archiveBranch,
					batch.archiveHead,
					entry,
				])
					.toLowerCase()
					.includes(lower) &&
				!lower.startsWith(`${entry.original.toLowerCase()}/`)
			)
				continue;
			const suffix = lower.startsWith(`${entry.original.toLowerCase()}/`)
				? term.slice(entry.original.length + 1)
				: "";
			const target = contained(
				locations.cold,
				entry.coldRelative + (suffix ? `/${suffix}` : ""),
			);
			results.push({
				batch: batch.id,
				original: entry.original,
				target,
				kind: "archive",
				sourceHead: entry.sourceHead ?? entry.provenance?.sourceCommit ?? null,
				archiveBranch: batch.archiveBranch,
				archiveHead: batch.archiveHead,
				provenance: entry.provenance ?? null,
			});
		}
		for (const entry of batch.deduplicated ?? []) {
			if (
				!entry.original.toLowerCase().includes(lower) &&
				!lower.startsWith(`${entry.original.toLowerCase()}/`)
			)
				continue;
			const suffix = lower.startsWith(`${entry.original.toLowerCase()}/`)
				? term.slice(entry.original.length + 1)
				: "";
			const base =
				entry.retained.location === "cold" ? locations.cold : locations.repo;
			results.push({
				batch: batch.id,
				original: entry.original,
				target: contained(
					base,
					entry.retained.path + (suffix ? `/${suffix}` : ""),
				),
				kind: "deduplicated",
				retainedLocation: entry.retained.location,
			});
		}
	}
	// A removed ZIP inside an archived directory has its own, more precise mapping.
	// Keep historical generations, but never present the absent broad-path copy as its target.
	const direct = results.filter((result) => {
		const original = result.original.toLowerCase();
		return lower === original || lower.startsWith(`${original}/`);
	});
	if (!direct.length) return results;
	return direct.filter(
		(result) =>
			!direct.some(
				(other) =>
					other.batch === result.batch &&
					other.original.length > result.original.length,
			),
	);
}

export async function verifyBatch(
	batch: ArchiveBatch,
	locations: ArchiveLocations,
	full: boolean,
) {
	if (!existsSync(locations.cold))
		throw new Error(`冷盘离线：${locations.cold}`);
	const coldBatch = contained(locations.cold, batch.id);
	assertPlainPath(locations.cold, coldBatch);
	const localBatch = contained(locations.metadata, batch.id);
	const metadata = existsSync(join(localBatch, "index.json"))
		? localBatch
		: coldBatch;
	if (metadata === localBatch) assertPlainPath(locations.metadata, localBatch);
	const indexPath = join(metadata, "index.json");
	assertPlainPath(metadata, indexPath);
	assertPlainPath(coldBatch, join(coldBatch, "index.json"));
	await checkHash(indexPath, batch.indexSha256);
	await checkHash(join(coldBatch, "index.json"), batch.indexSha256);
	let files = 0;
	let bytes = 0;
	for (const entry of batch.entries) {
		const manifestPath = contained(metadata, entry.manifest);
		assertPlainPath(metadata, manifestPath);
		await checkHash(manifestPath, entry.manifestSha256);
		const coldManifest = contained(coldBatch, entry.manifest);
		assertPlainPath(coldBatch, coldManifest);
		await checkHash(coldManifest, entry.manifestSha256);
		const target = contained(locations.cold, entry.coldRelative);
		assertContained(coldBatch, target);
		const rows = readFileSync(manifestPath, "utf8")
			.split(/\r?\n/u)
			.filter(Boolean)
			.map(
				(line) =>
					JSON.parse(line) as { path: string; bytes: number; sha256: string },
			);
		let entryBytes = 0;
		const seen = new Set<string>();
		for (const row of rows) {
			const path = safeRelative(row.path, true);
			if (
				seen.has(path.toLowerCase()) ||
				!Number.isSafeInteger(row.bytes) ||
				row.bytes < 0 ||
				!hashPattern.test(row.sha256)
			)
				throw new Error(`文件清单记录无效：${row.path}`);
			seen.add(path.toLowerCase());
			const file = path === "." ? target : contained(target, path);
			assertPlainPath(coldBatch, file);
			// A manifest file may never be substituted with a link, including a link within the cold root.
			if (
				lstatSync(file).isSymbolicLink() ||
				!lstatSync(file).isFile() ||
				lstatSync(file).size !== row.bytes
			)
				throw new Error(`文件类型或大小不一致：${file}`);
			if (full) await checkHash(file, row.sha256);
			entryBytes += row.bytes;
		}
		if (rows.length !== entry.files || entryBytes !== entry.bytes)
			throw new Error(`条目合计不一致：${entry.original}`);
		const actual = payloadFiles(target);
		if (actual.length !== seen.size || actual.some((path) => !seen.has(path)))
			throw new Error(`文件集合与清单不一致：${entry.original}`);
		files += rows.length;
		bytes += entryBytes;
	}
	let evidenceFiles = 0;
	if (batch.evidenceManifestSha256) {
		for (const base of new Set([metadata, coldBatch])) {
			const manifest = join(base, "evidence.files.jsonl");
			assertPlainPath(base, manifest);
			await checkHash(manifest, batch.evidenceManifestSha256);
		}
		for (const line of readFileSync(
			join(metadata, "evidence.files.jsonl"),
			"utf8",
		)
			.split(/\r?\n/u)
			.filter(Boolean)) {
			const row = JSON.parse(line) as {
				path: string;
				bytes: number;
				sha256: string;
			};
			if (
				!Number.isSafeInteger(row.bytes) ||
				row.bytes < 0 ||
				!hashPattern.test(row.sha256)
			)
				throw new Error("证据记录无效");
			const file = contained(coldBatch, row.path);
			assertPlainPath(coldBatch, file);
			if (!lstatSync(file).isFile() || lstatSync(file).size !== row.bytes)
				throw new Error(`证据文件大小不一致：${file}`);
			if (full) await checkHash(file, row.sha256);
			evidenceFiles++;
		}
	}
	for (const bundle of batch.bundles ?? []) {
		const file = contained(locations.cold, bundle.coldRelative);
		assertPlainPath(coldBatch, file);
		if (!lstatSync(file).isFile() || lstatSync(file).size !== bundle.bytes)
			throw new Error(`Git bundle 大小不一致：${file}`);
		if (full) await checkHash(file, bundle.sha256);
	}
	return {
		batch: batch.id,
		files,
		bytes,
		evidenceFiles,
		bundles: batch.bundles?.length ?? 0,
		mode: full ? "full-sha256" : "manifest-and-size",
		state: "verified",
	};
}
