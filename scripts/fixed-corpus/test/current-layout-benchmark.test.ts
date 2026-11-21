import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	formatCurrentMetric,
	latestCurrentBenchmark,
	normalizedCostScore,
	validateProductionContracts,
} from "../../lib/current-layout-benchmark";
import { rootPath } from "../../lib/paths";

const snapshot = latestCurrentBenchmark()!;

test("当前 benchmark 冻结实际生产布局、五辅语义与辅序", () => {
	assert.ok(snapshot);
	validateProductionContracts(snapshot);
	for (const [scheme, path] of [
		["Liandao", "config/snow-jiandao-toned-mapping.json"],
		["Zhudao", "config/snow-zhudao-mapping.json"],
	]) {
		const config = JSON.parse(readFileSync(rootPath(path), "utf8"));
		assert.equal(snapshot.layoutIds[scheme], config.id);
		assert.equal(
			snapshot.native[scheme].contract.shapeKeysByMeaning,
			config.shapeKeysByMeaning,
		);
		assert.equal(snapshot.native[scheme].inventory.legalTonedSyllables, 1407);
	}
});

test("v5.2 在每轨同时缩放候选和参考的认知成本", () => {
	const expected = {
		RC26: 9.086538431214596,
		OC21: 9.56635901445011,
		Liandao: 9.132009149242153,
		Zhudao: 8.640932204060537,
	};
	for (const [scheme, score] of Object.entries(expected)) {
		assert.ok(
			Math.abs(
				normalizedCostScore(
					snapshot.details[scheme].v52,
					snapshot.references.v52,
				) - score,
			) < 1e-10,
		);
	}
	// 页面独立发布的加倍场景，用于抓出「只缩放候选」或「先平均再相除」错误。
	assert.ok(
		Math.abs(snapshot.metrics.cktV52CostDoubled.OC21 - 9.543307183603057) <
			1e-10,
	);
	assert.ok(
		Math.abs(snapshot.metrics.cktV52CostDoubled.Zhudao - 8.234488645251973) <
			1e-10,
	);
	assert.equal(snapshot.metrics.cktV52.S005, 10);
});

test("保留跨合同边界、缺测值和实际零值", () => {
	assert.equal(Object.keys(snapshot.details.Liandao.v52).length, 1);
	assert.equal(snapshot.details.Liandao.v52.sanpin, undefined);
	assert.equal(snapshot.metrics.cktV52.B04, null);
	assert.equal(snapshot.metrics.v52ThirdAuxRate.Zhudao, 0);
	assert.match(
		formatCurrentMetric(snapshot, "cktV52", "B04", "six"),
		/—\[\^zh-benchmark-missing\]/u,
	);
	assert.match(
		formatCurrentMetric(snapshot, "v52ThirdAuxRate", "Zhudao", "percent"),
		/^0\.000%\[\^zh-benchmark-toned\]/u,
	);
	assert.match(
		formatCurrentMetric(snapshot, "M-R2", "Liandao", "integer"),
		/21 \/ 24 \(M-T1\)/u,
	);
	assert.equal(snapshot.metrics.legalSyllables.OC21, 399);
	assert.equal(snapshot.metrics.legalSyllables.Liandao, 1407);
	assert.equal(snapshot.metrics.common399UniqueCodes.Liandao, 433);
	assert.equal(snapshot.metrics.staticVacancies.Zhudao, 20);
	assert.equal(snapshot.metrics.common399CollisionBuckets.Liandao, 392);
	assert.equal(snapshot.metrics.common399AffectedSyllables.Liandao, 1366);
	assert.equal(snapshot.metrics.common399CollisionBuckets.Zhudao, 420);
	assert.equal(snapshot.metrics.common399AffectedSyllables.Zhudao, 1301);
	for (const scheme of ["Liandao", "Zhudao"]) {
		assert.ok(
			Math.abs(
				snapshot.details[scheme].terminalErgonomics.meanKeys -
					snapshot.metrics.v52MeanKeys[scheme],
			) < 1e-9,
		);
		assert.ok(snapshot.metrics.terminalHome[scheme] > 0);
	}
});

test("六张 README benchmark 表都包含两份带调布局与 v5.2 新维度", () => {
	for (const file of ["README.md", "README_CN.md"]) {
		const source = readFileSync(rootPath(file), "utf8");
		const tables = source.match(
			/\| (?:指标|Metric|指標) \| RC26-[^\n]+\n(?:\|[^\n]*\n)+/gu,
		)!;
		assert.equal(tables.length, 3);
		for (const table of tables) {
			assert.match(table, /冰雪莲道 CR-REF-7e650f7a4c/u);
			assert.match(table, /冰雪鹮道 T2126-V52-M4-ec60a3637a99/u);
			assert.match(table, /CKT v5\.2/u);
			assert.match(table, /×2/u);
			assert.match(table, /×3/u);
			assert.match(table, /×5/u);
			assert.match(table, /third auxiliary|第三[辅輔]鍵?率|第三辅键率/u);
			assert.match(table, /benchmark-toned/u);
			for (const row of table.trim().split("\n"))
				assert.equal(row.split("|").length, 10);
		}
		assert.ok(!source.includes("`undefined`"));
	}
});
