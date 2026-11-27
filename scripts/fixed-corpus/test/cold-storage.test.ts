import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	renameSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	type ArchiveCatalog,
	archiveStatus,
	findArchives,
	loadCatalog,
	safeRelative,
	verifyBatch,
} from "../../lib/cold-storage";

const hash = (value: string) =>
	createHash("sha256").update(value).digest("hex");

test("保留源文件的冷备份与已迁出的归档显示为不同用途", () => {
	const f = fixture();
	try {
		const entry = f.catalog.batches[0].entries[0];
		entry.state = "verified-backup-source-retained";
		const backup = findArchives(f.catalog, f.locations, entry.original)[0];
		assert.equal(backup.kind, "backup");
		assert.equal("state" in backup && backup.state, entry.state);
		entry.state = "source-removed-after-verified-snapshot";
		assert.equal(
			findArchives(f.catalog, f.locations, entry.original)[0].kind,
			"archive",
		);
	} finally {
		f.cleanup();
	}
});

function fixture() {
	const root = mkdtempSync(join(tmpdir(), "snow-cold-storage-"));
	const locations = {
		repo: join(root, "repo"),
		cold: join(root, "cold"),
		metadata: join(root, "metadata"),
	};
	const id = "test-batch";
	for (const p of [
		locations.repo,
		join(locations.metadata, id),
		join(locations.cold, id, "payload"),
	])
		mkdirSync(p, { recursive: true });
	const payload = "旧记录";
	writeFileSync(join(locations.cold, id, "payload/file.txt"), payload);
	const manifest = `${JSON.stringify({ path: "file.txt", bytes: Buffer.byteLength(payload), sha256: hash(payload) })}\n`;
	for (const base of [locations.cold, locations.metadata]) {
		writeFileSync(join(base, id, "index.json"), "{}");
		writeFileSync(join(base, id, "files.jsonl"), manifest);
	}
	const catalog: ArchiveCatalog = {
		schemaVersion: 1,
		mode: "address-mapping-only",
		coldRoot: locations.cold,
		batches: [
			{
				id,
				archiveBranch: "main",
				archiveHead: "a".repeat(40),
				indexSha256: hash("{}"),
				entries: [
					{
						original: "output/历史 空格",
						coldRelative: `${id}/payload`,
						state: "mapped",
						files: 1,
						bytes: Buffer.byteLength(payload),
						manifest: "files.jsonl",
						manifestSha256: hash(manifest),
					},
				],
				deduplicated: [
					{
						original: "old-dependency",
						retained: { location: "hot", path: "deps/current" },
						files: 1,
						bytes: 9,
					},
				],
			},
		],
	};
	const path = join(root, "catalog.json");
	writeFileSync(path, JSON.stringify(catalog));
	return {
		root,
		locations,
		id,
		catalog,
		path,
		cleanup: () => rmSync(root, { recursive: true, force: true }),
	};
}

test("离线仍可查询历史地址，不能回退到同名热盘文件", async () => {
	const f = fixture();
	try {
		const catalog = loadCatalog(f.path);
		assert.equal(
			findArchives(catalog, f.locations, "output\\历史 空格\\file.txt")[0]
				.target,
			join(f.locations.cold, f.id, "payload/file.txt"),
		);
		assert.equal(
			findArchives(
				catalog,
				f.locations,
				join(f.locations.repo, "output/历史 空格/file.txt"),
			)[0].target,
			join(f.locations.cold, f.id, "payload/file.txt"),
		);
		assert.equal(
			findArchives(catalog, f.locations, "old-dependency/a.txt")[0].target,
			join(f.locations.repo, "deps/current/a.txt"),
		);
		mkdirSync(join(f.locations.repo, "output/历史 空格"), { recursive: true });
		writeFileSync(
			join(f.locations.repo, "output/历史 空格/file.txt"),
			"新记录",
		);
		renameSync(f.locations.cold, `${f.locations.cold}-offline`);
		assert.equal(archiveStatus(catalog, f.locations)[0].state, "offline");
		assert.equal(findArchives(catalog, f.locations, "历史 空格").length, 1);
		await assert.rejects(
			verifyBatch(catalog.batches[0], f.locations, true),
			/冷盘离线/u,
		);
	} finally {
		f.cleanup();
	}
});

test("摘要绑定两边清单，完整核验识别同长度篡改；仅大小检查不冒充哈希核验", async () => {
	const f = fixture();
	try {
		const batch = f.catalog.batches[0];
		assert.equal((await verifyBatch(batch, f.locations, true)).files, 1);
		writeFileSync(join(f.locations.cold, f.id, "payload/file.txt"), "新记录");
		assert.equal(
			(await verifyBatch(batch, f.locations, false)).mode,
			"manifest-and-size",
		);
		await assert.rejects(
			verifyBatch(batch, f.locations, true),
			/SHA-256 不一致/u,
		);
		writeFileSync(join(f.locations.metadata, f.id, "files.jsonl"), "篡改清单");
		await assert.rejects(
			verifyBatch(batch, f.locations, false),
			/SHA-256 不一致/u,
		);
	} finally {
		f.cleanup();
	}
});

test("拒绝跨平台绝对地址、上级目录和伪造的清单路径", async () => {
	for (const path of [
		"../secret",
		"a/../../secret",
		"C:\\secret",
		"C:secret",
		"\\\\server\\share",
		"/secret",
		"a\\..\\secret",
	])
		assert.throws(() => safeRelative(path));
	assert.equal(safeRelative(".", true), ".");
	const f = fixture();
	try {
		const manifest = `${JSON.stringify({ path: "../../secret", bytes: 0, sha256: hash("") })}\n`;
		for (const base of [f.locations.cold, f.locations.metadata])
			writeFileSync(join(base, f.id, "files.jsonl"), manifest);
		f.catalog.batches[0].entries[0].manifestSha256 = hash(manifest);
		await assert.rejects(
			verifyBatch(f.catalog.batches[0], f.locations, false),
			/路径越界/u,
		);
		f.catalog.batches[0].entries[0].coldRelative = "other-batch/payload";
		writeFileSync(f.path, JSON.stringify(f.catalog));
		assert.throws(() => loadCatalog(f.path), /条目不属于批次/u);
	} finally {
		f.cleanup();
	}
});

test("清单内文件不能经目录联接替换，即使替换内容的哈希相同", async () => {
	const f = fixture();
	try {
		const payload = join(f.locations.cold, f.id, "payload");
		const moved = join(f.locations.cold, f.id, "moved");
		renameSync(payload, moved);
		symlinkSync(
			moved,
			payload,
			process.platform === "win32" ? "junction" : "dir",
		);
		await assert.rejects(
			verifyBatch(f.catalog.batches[0], f.locations, true),
			/不能经过链接/u,
		);
	} finally {
		f.cleanup();
	}
});

test("本地清单缺失时使用已绑定摘要的冷盘清单，核验期间不写文件", async () => {
	const f = fixture();
	try {
		const path = join(f.locations.cold, f.id, "index.json");
		const before = readFileSync(path);
		rmSync(join(f.locations.metadata, f.id), { recursive: true });
		assert.equal(
			(await verifyBatch(f.catalog.batches[0], f.locations, true)).state,
			"verified",
		);
		assert.deepEqual(readFileSync(path), before);
		assert.equal(archiveStatus(f.catalog, f.locations)[0].metadata, "cold");
	} finally {
		f.cleanup();
	}
});

test("兼容历史 Windows 路径、大小写哈希和单文件条目，并识别新增文件", async () => {
	const f = fixture();
	try {
		const batch = f.catalog.batches[0];
		const entry = batch.entries[0];
		entry.coldRelative += "/file.txt";
		const manifest = `${JSON.stringify({ path: ".", bytes: entry.bytes, sha256: hash("旧记录").toUpperCase() })}\n`;
		entry.manifestSha256 = hash(manifest).toUpperCase();
		for (const base of [f.locations.cold, f.locations.metadata])
			writeFileSync(join(base, f.id, "files.jsonl"), manifest);
		assert.equal((await verifyBatch(batch, f.locations, true)).files, 1);
		entry.coldRelative = `${f.id}/payload`;
		mkdirSync(join(f.locations.cold, f.id, "payload/nested"));
		renameSync(
			join(f.locations.cold, f.id, "payload/file.txt"),
			join(f.locations.cold, f.id, "payload/nested/file.txt"),
		);
		const legacy = manifest.replace(
			'"path":"."',
			'"path":"nested\\\\file.txt"',
		);
		entry.manifestSha256 = hash(legacy);
		for (const base of [f.locations.cold, f.locations.metadata])
			writeFileSync(join(base, f.id, "files.jsonl"), legacy);
		assert.equal((await verifyBatch(batch, f.locations, true)).files, 1);
		writeFileSync(
			join(f.locations.cold, f.id, "payload/extra.txt"),
			"多余文件",
		);
		await assert.rejects(verifyBatch(batch, f.locations, true), /文件集合/u);
	} finally {
		f.cleanup();
	}
});

test("完整核验也覆盖 Git bundle，同长度改写仍失败", async () => {
	const f = fixture();
	try {
		const path = join(f.locations.cold, f.id, "history.bundle");
		writeFileSync(path, "abc");
		f.catalog.batches[0].bundles = [
			{ coldRelative: `${f.id}/history.bundle`, bytes: 3, sha256: hash("abc") },
		];
		assert.equal(
			(await verifyBatch(f.catalog.batches[0], f.locations, true)).bundles,
			1,
		);
		writeFileSync(path, "xyz");
		await assert.rejects(
			verifyBatch(f.catalog.batches[0], f.locations, true),
			/SHA-256 不一致/u,
		);
	} finally {
		f.cleanup();
	}
});

test("目录内已去重文件优先使用精确映射，不返回不存在的旧副本地址", () => {
	const f = fixture();
	try {
		f.catalog.batches[0].deduplicated?.push({
			original: "output/历史 空格/removed.txt",
			retained: { location: "cold", path: `${f.id}/payload/file.txt` },
			files: 1,
			bytes: 9,
		});
		const results = findArchives(
			f.catalog,
			f.locations,
			"output/历史 空格/removed.txt",
		);
		assert.equal(results.length, 1);
		assert.equal(results[0].kind, "deduplicated");
		assert.equal(
			results[0].target,
			join(f.locations.cold, f.id, "payload/file.txt"),
		);
	} finally {
		f.cleanup();
	}
});
