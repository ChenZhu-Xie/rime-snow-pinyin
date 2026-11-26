import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib/paths";

const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

test("发布同时依赖本地功能、性能和键位图门禁", () => {
	const workflow = read(".github/workflows/release.yml");
	expect(workflow).toContain("uses: ./.github/workflows/functional.yml");
	expect(workflow).toContain("needs: [functional, latency, keymap-helper]");
	expect(workflow).toContain(
		"github.event_name == 'workflow_dispatch' && inputs.release_tag || github.ref_name",
	);
});

test("分支与 PR 复用十方案功能门禁并监听门禁实现", () => {
	const workflow = read(".github/workflows/test.yml");
	expect(workflow).toContain("pull_request:");
	expect(workflow).toContain("uses: ./.github/workflows/functional.yml");
	expect(workflow).toContain("uses: ./.github/workflows/latency.yml");
	expect(workflow).toContain("scripts/benchmark-latency*.ts");
	expect(workflow).toContain("scripts/version*.ts");
	expect(workflow).toContain(".github/workflows/**");

	const functional = read(".github/workflows/functional.yml");
	for (const schema of [
		"snow_sipin",
		"snow_lanpin",
		"snow_yipin",
		"snow_landao",
		"snow_qingyun",
		"snow_hedao",
		"snow_hepin",
		"snow_jiandao",
		"snow_sanpin",
		"snow_liandao",
		"snow_huandao",
	])
		expect(functional).toContain(`schema: ${schema}`);
	expect(functional).toContain("asset: mira-rime1.13.1");
	expect(functional).toContain("asset: mira-rime1.17");
});
