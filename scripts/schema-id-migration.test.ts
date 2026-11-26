import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	migrateSchemaIds,
	migrateSchemaReferences,
} from "./migrate-schema-ids";

test("rename collisions preserve each scheme and its storage", () => {
	expect(
		migrateSchemaReferences(
			"snow_jiandao snow_jiandao_classic snow_sanpin snow_sanpin_classic snow_zhudao snow_jiandao_ued_3158ce08b5bc",
		),
	).toBe(
		"snow_landao snow_jiandao snow_lanpin snow_sanpin snow_huandao snow_jiandao_ued_3158ce08b5bc",
	);
});

test("custom patches migrate simultaneously, with backup and idempotence", () => {
	const root = mkdtempSync(join(tmpdir(), "snow-schema-migration-"));
	try {
		writeFileSync(
			join(root, "snow_jiandao.custom.yaml"),
			"patch: {label: 兰道}",
		);
		writeFileSync(
			join(root, "snow_jiandao_classic.custom.yaml"),
			"patch: {label: 键道}",
		);
		writeFileSync(
			join(root, "default.custom.yaml"),
			"patch: {schema_list: [{schema: snow_jiandao}, {schema: snow_jiandao_classic}]}",
		);
		migrateSchemaIds(root);
		migrateSchemaIds(root);
		expect(
			readFileSync(join(root, "snow_landao.custom.yaml"), "utf8"),
		).toContain("兰道");
		expect(
			readFileSync(join(root, "snow_jiandao.custom.yaml"), "utf8"),
		).toContain("键道");
		expect(
			readFileSync(
				join(root, "schema-id-migration-backup", "snow_jiandao.custom.yaml"),
				"utf8",
			),
		).toContain("兰道");
		expect(readFileSync(join(root, "default.custom.yaml"), "utf8")).toContain(
			"schema: snow_landao",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
