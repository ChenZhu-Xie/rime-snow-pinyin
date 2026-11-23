import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	formatCurrentMetric,
	latestCurrentBenchmark,
	normalizedCostScore,
	validateProductionContracts,
	decorateCurrentValues,
	tonedInitialDisorder,
	orderCurrentSchemes,
	table,
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
	assert.ok(Number.isFinite(snapshot.metrics.cktV52.B04));
	assert.equal(snapshot.metrics.v52ThirdAuxRate.Zhudao, 0);
	assert.match(
		formatCurrentMetric(snapshot, "v52PointOptimalDefault", "B04", "six"),
		/未重选辅序\[\^zh-benchmark-missing\]/u,
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
			/\| (?:指标|Metric|指標) \| 冰雪鹮道[^\n]+\n(?:\|[^\n]*\n)+/gu,
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
			assert.match(table, /★★/u);
			assert.match(table, /🥇/u);
			assert.match(table, /🔷/u);
			for (const row of table.trim().split("\n"))
				assert.equal(row.split("|").length, 10);
		}
		assert.ok(!source.includes("`undefined`"));
		assert.equal(source.split("docs/liandao-keyboard-heat.svg").length - 1, 3);
		assert.equal(source.split("docs/zhudao-keyboard-heat.svg").length - 1, 3);
	}
});

test("当前六列参与 v5.2 四档成本、逐轨耗时与终局负载", () => {
	for (const scheme of Object.keys(snapshot.layoutIds))
		for (const key of [
			"cktV52",
			"cktV52CostDoubled",
			"cktV52CostTripled",
			"cktV52CostQuintupled",
			"v52MotorUpperMs",
			"v52ThirdAuxRate",
			"v52SelectionRate",
			"terminalHome",
			"terminalDifferentKeySameFinger",
		])
			assert.ok(
				Number.isFinite(snapshot.metrics[key][scheme]),
				`${key}/${scheme}`,
			);
	for (const scheme of ["RC26", "OC21", "S005", "B04"])
		assert.deepEqual(Object.keys(snapshot.details[scheme].v52), [
			"keytao",
			"sanpin",
		]);
});

test("星号排除首道与带调、金牌覆盖所有方案、菱形覆盖所有非首道方案", () => {
	const schemes = ["RC26", "OC21", "S005", "B04", "Liandao", "Zhudao"];
	const scores = [3, 4, 7, 0.5, 1, 2];
	const result = decorateCurrentValues(
		schemes.map((scheme, index) => ({
			scheme,
			display: String(scores[index]),
			score: scores[index],
		})),
	);
	assert.equal(result[0], "**3** ★★");
	assert.equal(result[1], "**4** ★");
	assert.equal(result[3], "0.5 🥇");
	assert.equal(result[4], "**1** 🔷");
	assert.equal(result[5], "**2** 🔹");
	const both = decorateCurrentValues([
		{ scheme: "S005", display: "3", score: 3 },
		{ scheme: "Liandao", display: "1[^zh-benchmark-toned]", score: 1 },
		{ scheme: "Zhudao", display: "—", score: null },
	]);
	assert.equal(both[1], "**1**[^zh-benchmark-toned] 🔷 🥇");
	assert.equal(both[2], "—");
});

test("无调方案可同时获星与菱形，首道不获菱形，第三名不标", () => {
	const schemes = ["B04", "RC26", "Liandao", "Zhudao"];
	const result = decorateCurrentValues(
		schemes.map((scheme, index) => ({
			scheme,
			display: String(index),
			score: index,
		})),
	);
	assert.deepEqual(result, ["0 🥇", "**1** ★★ 🔷", "**2** 🔹", "3"]);
	const tied = decorateCurrentValues([
		{ scheme: "RC26", display: "1", score: 1 },
		{ scheme: "OC21", display: "1", score: 1 },
		{ scheme: "Liandao", display: "2", score: 2 },
	]);
	assert.equal(tied[2], "2");
	assert.equal(snapshot.rankingPolicy.diamonds.pool, "all-except-B04");
	assert.equal(snapshot.rankingPolicy.diamonds.recipients, "all-except-B04");
	assert.deepEqual(
		decorateCurrentValues([
			{ scheme: "RC26", display: "1", score: 1 },
			{ scheme: "OC21", display: "2", score: 2 },
			{ scheme: "Liandao", display: "3", score: 3 },
			{ scheme: "Zhudao", display: "4", score: 4 },
		]),
		["**1** ★★ 🔷 🥇", "**2** ★ 🔹", "3", "4"],
	);
});

test("分组使用竞赛排名：并列第一之后没有第二名", () => {
	const result = decorateCurrentValues(
		["RC26", "OC21", "S005"].map((scheme, index) => ({
			scheme,
			display: String(index < 2 ? 1 : 2),
			score: index < 2 ? 1 : 2,
		})),
	);
	assert.deepEqual(result, ["**1** ★★ 🔷 🥇", "**1** ★★ 🔷 🥇", "2"]);
});

test("带调 A/I/D/V 与无调格式统一，按实际映射补算 A/I，排名仍使用 D+V", () => {
	for (const [scheme, expected] of [
		["Liandao", [5, 2, 2, 5]],
		["Zhudao", [7, 4, 2, 5]],
	] as const) {
		const audit = snapshot.native[scheme].initialDisorderAudit;
		assert.deepEqual(tonedInitialDisorder(audit.firstByKey, 5), [...expected]);
		assert.deepEqual(snapshot.metrics.initialDisorderAIDV[scheme], [
			...expected,
		]);
		assert.equal(
			formatCurrentMetric(snapshot, "initialDisorderAIDV", scheme, "disorder"),
			`${expected.join(" / ")}[^zh-benchmark-toned]`,
		);
	}
	const firstByKey = structuredClone(
		snapshot.native.Liandao.initialDisorderAudit.firstByKey,
	);
	firstByKey.P.push("zero-W");
	assert.deepEqual(tonedInitialDisorder(firstByKey, 5), [6, 3, 2, 5]);
});

test("方案列序不移动属性和方向列，单元格跟随鹮道与莲道移动", () => {
	const schemes = ["RC26", "OC21", "S005", "B04", "Liandao", "Zhudao"];
	assert.deepEqual(orderCurrentSchemes(schemes), [
		"Zhudao",
		"Liandao",
		"RC26",
		"OC21",
		"S005",
		"B04",
	]);
	assert.equal(
		table(
			["属性", "冰雪莲道", "冰雪鹮道", "说明"],
			[["声码", "21", "26", "同语料"]],
		),
		"| 属性 | 冰雪鹮道 | 冰雪莲道 | 说明 |\n| --- | --- | --- | --- |\n| 声码 | 26 | 21 | 同语料 |",
	);
	for (const file of [
		"README.md",
		"README_CN.md",
		"reports/shenyun-comparison.md",
	]) {
		const markdown = readFileSync(rootPath(file), "utf8");
		const headers = [
			...markdown.matchAll(/^\|[^\n]*冰雪鹮道 T2126-V52-M4[^\n]*\|$/gm),
		];
		assert.ok(headers.length >= 3, file);
		for (const [line] of headers) {
			const columns = line
				.split("|")
				.slice(1, -1)
				.map((cell) => cell.trim());
			const schemes = columns.filter((cell) =>
				/T2126-V52-M4|CR-REF-|RC26-|UED-|Overall-17|U357|S005|B04/.test(cell),
			);
			assert.match(schemes[0], /T2126-V52-M4/);
			assert.match(schemes[1], /CR-REF-/);
		}
		for (const row of markdown
			.split("\n")
			.filter(
				(line) =>
					line.startsWith("|") &&
					line.includes("A/I/D/V") &&
					line.includes("benchmark-toned"),
			)) {
			assert.ok(!row.includes("D="), row);
			assert.match(row, /7 \/ 4 \/ 2 \/ 5/);
			assert.match(row, /5 \/ 2 \/ 2 \/ 5/);
		}
	}
});

test("两份带调连续双拼键频图逐键等于页面冻结日常文稿", () => {
	for (const [scheme, file] of [
		["Liandao", "liandao"],
		["Zhudao", "zhudao"],
	]) {
		const stat = snapshot.native[scheme].dailyHeat;
		assert.equal(stat.hits, 2149);
		assert.equal(stat.shapeIncluded, false);
		assert.equal(stat.spaceIncluded, false);
		assert.equal(stat.selectionIncluded, false);
		const svg = readFileSync(
			rootPath(`docs/${file}-keyboard-heat.svg`),
			"utf8",
		);
		const cells = [
			...svg.matchAll(
				/data-mxkey="([^"]+)"><title>[^<]*：(\d+) 次，([\d.]+)%/g,
			),
		];
		assert.equal(cells.length, 29);
		assert.equal(
			cells.reduce((sum, cell) => sum + Number(cell[2]), 0),
			2149,
		);
		for (const [, key, count, percent] of cells) {
			assert.equal(Number(count), stat.heat_map[key.toLowerCase()] ?? 0);
			assert.equal(percent, ((100 * Number(count)) / 2149).toFixed(3));
		}
	}
});

test("生产报告只有当前布局快照，脚注均有定义", () => {
	const expected = ["RC26", "OC21", "S005", "B04", "Liandao", "Zhudao"];
	assert.deepEqual(Object.keys(snapshot.layoutIds), expected);
	assert.equal("legacyDetails" in snapshot, false);
	assert.equal("currentLayoutComparisons" in snapshot, false);
	for (const metric of Object.values(snapshot.metrics))
		assert.ok(
			Object.keys(metric as object).every((scheme) =>
				expected.includes(scheme),
			),
		);
	const markdown = readFileSync(
		rootPath("reports/shenyun-comparison.md"),
		"utf8",
	);
	assert.equal(markdown.split("<!-- current-layout-benchmark:").length - 1, 1);
	assert.equal(
		markdown.split("# 当前四布局／六生产双拼方案比较").length - 1,
		1,
	);
	assert.ok(!/Overall-17|U357|R9-21X21/.test(markdown));
	const definitions = new Set(
		[...markdown.matchAll(/^\[\^([^\]]+)\]:/gm)].map((match) => match[1]),
	);
	assert.equal(definitions.size, 3);
	for (const [, id] of markdown.matchAll(/\[\^(zh-benchmark-[^\]]+)\]/g))
		assert.ok(definitions.has(id), id);
});
