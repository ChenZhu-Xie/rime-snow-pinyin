import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

// One simultaneous substitution: old 兰道 must never become new 键道.
export const schemaRenames: Record<string, string> = {
	snow_jiandao_toned: "snow_liandao",
	snow_jiandao_classic: "snow_jiandao",
	snow_sanpin_classic: "snow_sanpin",
	snow_shenyun_shape: "snow_hedao",
	snow_shenyun_tone: "snow_hepin",
	snow_zhudao: "snow_huandao",
	snow_jiandao: "snow_landao",
	snow_sanpin: "snow_lanpin",
};

export function migrateSchemaReferences(text: string): string {
	return text.replace(
		/\bsnow_(?:jiandao_toned|jiandao_classic|sanpin_classic|shenyun_shape|shenyun_tone|zhudao|jiandao|sanpin)\b/g,
		(id) => schemaRenames[id],
	);
}

export function migrateSchemaIds(directory: string) {
	const root = resolve(directory);
	const backup = join(root, "schema-id-migration-backup");
	const marker = join(backup, "complete");
	if (existsSync(marker)) return;
	if (existsSync(backup))
		throw new Error(`发现未完成的迁移，请先检查备份：${backup}`);
	const writes = new Map<string, string>();
	for (const file of ["default.custom.yaml", "user.yaml"]) {
		const path = join(root, file);
		if (existsSync(path))
			writes.set(file, migrateSchemaReferences(readFileSync(path, "utf8")));
	}
	for (const [oldId, newId] of Object.entries(schemaRenames)) {
		const source = join(root, `${oldId}.custom.yaml`);
		if (!existsSync(source)) continue;
		const target = `${newId}.custom.yaml`;
		if (existsSync(join(root, target)) && !(newId in schemaRenames)) {
			throw new Error(`新旧补丁同时存在，请先合并：${source} / ${target}`);
		}
		writes.set(target, migrateSchemaReferences(readFileSync(source, "utf8")));
	}
	mkdirSync(backup);
	for (const file of new Set([
		...writes.keys(),
		...Object.keys(schemaRenames).map((id) => `${id}.custom.yaml`),
	])) {
		if (existsSync(join(root, file)))
			copyFileSync(join(root, file), join(backup, file));
	}
	for (const oldId of Object.keys(schemaRenames)) {
		const file = `${oldId}.custom.yaml`;
		if (!writes.has(file) && existsSync(join(root, file)))
			unlinkSync(join(root, file));
	}
	for (const [file, contents] of writes)
		writeFileSync(join(root, file), contents);
	writeFileSync(marker, "schema IDs migrated; user dictionaries retained\n");
	console.log(`已迁移配置；原文件备份在 ${backup}。请重新部署。`);
}

if (import.meta.main) {
	if (process.argv.length !== 3)
		throw new Error(
			"用法：bun scripts/migrate-schema-ids.ts <旧版 Rime 用户目录>",
		);
	migrateSchemaIds(process.argv[2]);
}
