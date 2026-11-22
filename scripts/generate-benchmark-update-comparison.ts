import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { ALL_BENCHMARK_SCHEMES } from "./lib/benchmark-schemes";
import { readBenchmarkReplayCache } from "./lib/benchmark-replay";
import { rootPath } from "./lib/paths";

interface Report {
	schemes: Record<
		string,
		{
			name: string;
			total: { keys: number; averageLength: number };
			scenes: Array<{ keys: number }>;
		}
	>;
}
const arg = (name: string) => {
	const index = process.argv.indexOf(name);
	return index < 0 ? undefined : process.argv[index + 1];
};
const previousRef = arg("--previous-ref") ?? "b6f356e";
const productionRef = arg("--production-ref") ?? "4ddd603";
const withoutPath = arg("--without-report");
assert.ok(
	withoutPath,
	"需指定 --without-report，以同一批新候选移除直选后的对照结果",
);
const withoutRun = arg("--without-run");
if (withoutRun) {
	const manifest = JSON.parse(
		readFileSync(`${withoutRun}/manifest.json`, "utf8"),
	);
	assert.equal(manifest.wordLengthSelection, false, "对照必须只移除词长直选");
	assert.ok(manifest.completed.includes("summary"));
	assert.ok(readFileSync(`${withoutRun}/success.json`, "utf8"));
}
const reportPath = "reports/5500字_当前十二方案最优切分实测结果.json";
const previous: Report = JSON.parse(
	execFileSync("git", ["show", `${previousRef}:${reportPath}`], {
		cwd: rootPath(),
		encoding: "utf8",
		maxBuffer: 32 * 1024 * 1024,
	}),
);
const current: Report = JSON.parse(readFileSync(rootPath(reportPath), "utf8"));
const without: Report = JSON.parse(readFileSync(withoutPath, "utf8"));
const verificationPath = arg("--verification-report");
const verification = verificationPath
	? JSON.parse(readFileSync(verificationPath, "utf8"))
	: undefined;
const replays = readBenchmarkReplayCache(
	rootPath("output/benchmark-replays/combined.json"),
);
const schemes = Object.entries(current.schemes)
	.sort(([, a], [, b]) => a.total.keys - b.total.keys)
	.map(([id, scheme]) => {
		const codes = [
			...replays.schemes[id].flatMap((article) =>
				article.flatMap((line) => line.map(([, code]) => code)),
			),
			...replays.schemes[id][9].flatMap((line) => line.map(([, code]) => code)),
		];
		const left = codes.filter((c) => c.includes("<")).length;
		const right = codes.filter((c) => c.includes(">")).length;
		const changed = !["sipin", "qingyun", "sbxh", "flypy"].includes(id);
		assert.ok(
			scheme.total.keys <= without.schemes[id].total.keys,
			`${id}/移除可选入口不得更优`,
		);
		if (!changed) {
			assert.deepEqual(
				scheme.total,
				previous.schemes[id].total,
				`${id}/未变化方案总指标`,
			);
			assert.deepEqual(
				scheme.scenes,
				previous.schemes[id].scenes,
				`${id}/未变化方案逐场景指标`,
			);
		}
		return {
			id,
			name:
				ALL_BENCHMARK_SCHEMES.find((s) => s.id === id)?.shortName ??
				scheme.name,
			changed,
			previousKeys: previous.schemes[id].total.keys,
			keys: scheme.total.keys,
			delta: scheme.total.keys - previous.schemes[id].total.keys,
			mean: scheme.total.averageLength,
			withoutSelectionKeys: without.schemes[id].total.keys,
			selectionSavings: without.schemes[id].total.keys - scheme.total.keys,
			lengthSelections: { left, right, total: left + right },
		};
	});
const evidence = {
	previousReportRef: previousRef,
	previousMeasurementRef: "c369ff7",
	productionRef,
	corpus: "5500 汉字＋392 标点；第十一场景重复第十篇",
	selectionKeyCost: 2,
	selectionPolicy:
		"类别首词直选不计数字选重，Shift＋逗号／句号均计两键；两套对照均使用新固顶及新长词规则",
	coldRun: arg("--cold-run"),
	warmRun: arg("--warm-run"),
	withoutRun,
	verification,
	schemes,
};
writeFileSync(
	rootPath("reports/5500字_双拼更新前后与词长直选对照.json"),
	`${JSON.stringify(evidence, null, 2)}\n`,
);
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const lines = [
	"# 5500 字：双拼固顶、长词与词长直选更新对照",
	"",
	`本轮生产规则冻结于 \`${productionRef}\`；上一轮真实测量冻结于 \`c369ff7\`，对照数值取自报告提交 \`${previousRef}\`。八个双拼方案重新查询真实候选并重新求最优切分；冰雪四拼、冰雪清韵、声笔小鹤和小鹤音形（清风版）复用经来源核对的候选／词库缓存，重新汇总后全部总指标及逐场景指标不变。`,
	"",
	"## 更新前后",
	"",
	"口径为全部实际按键／5500 汉字，包含 Shift、Space、选重和 392 个标点；仍先最少化数字选重，再最少化总按键。额外 500 字与第十篇相同，按第十一场景再计一次。负的键数差表示本轮更省键。",
	"",
	"| 方案 | 上轮总按键 | 本轮总按键 | 键数差 | 本轮总均码／字 |",
	"| --- | ---: | ---: | ---: | ---: |",
	...schemes.map(
		(s) =>
			`| ${s.name} | ${s.previousKeys} | ${s.keys} | ${signed(s.delta)} | ${s.mean.toFixed(4)} |`,
	),
	"",
	"## 《／》的实际收益",
	"",
	"从同一批新候选中仅移除词长直选，再重新求解。新固顶、长词补全、大写续写、结构略码验证和所有其他按键成本保持一致；差值因此只衡量是否允许该入口。回放 `<`／`>` 分别表示 Shift＋逗号／句号，每次两键；成功后不再追加 Space。它们选择类别内首词，使用次数独立列出，不混入数字选重。",
	"",
	"| 方案 | 不用词长直选 | 允许词长直选 | 省键 | 直选使用次数 |",
	"| --- | ---: | ---: | ---: | ---: |",
	...schemes
		.filter((s) => s.changed)
		.map(
			(s) =>
				`| ${s.name} | ${s.withoutSelectionKeys} | ${s.keys} | ${s.selectionSavings} | ${s.lengthSelections.total} |`,
		),
	"",
	"直选使用次数不等于省键数：有些路径只与补辅打平，总体还会重新切分。选择键更贵时仍保留普通码；不预设新增入口必然改善。",
	"",
	"## 缓存与复跑",
	"",
	...(verification
		? [
				`原目录完整复跑命中八方案缓存 ${verification.cachedQueries} 次，新增查询 ${verification.newQueries} 次，另作 ${verification.independentAudits} 次独立实查；全部十二方案数据与首轮一致，四个未变方案与上一轮逐项一致。新协议共保留 ${verification.persistentRecords} 条记录，包含预备探针及中断续跑记录。`,
				"",
				`原目录候选缓存：\`${verification.rootCache}\`。冻结工作树与原目录已逐文件核对 123 个相关输入，差异仅为 CRLF／LF 及本轮不调用的键位图程序；重新构造冻结指纹确认 DLL 与共享词库未变，再按原目录指纹保存等价记录，并通过上述完整复跑核验。`,
				"",
			]
		: []),
	"旧候选顺序和旧最优切分不能用于已更新的八方案。新候选缓存为 v3，记录候选、提交文本和是否完整处理全部输入；只有最后一键完成的目标词提交可作直选，途中顶屏的探针继续排除。真实候选、实际选择键、结构略码和尾字键组合均在关闭学习的独立会话内验证；后测方案不会继承前测方案的用户词频。",
	"",
	"缓存命中也独立实查首尾候选／提交记录，并保留冰雪莲道 `xkd`、冰雪鹮道 `yvd` 反例。`--reuse-unchanged` 仅可在核对来源后使用；缺任何旧候选即失败，不能猜测补齐。用 `just benchmark-5500 --reuse-unchanged` 重跑；另加 `--without-word-length-selection` 可重复不含词长直选的对照。",
	"",
	"旧独立 500 字求解器已统一为第十篇实测路径导出，避免功能与全语料求解器分叉。最新汇总与每方案六列分布表见[主报告](./十一场景_5500字_当前十二方案对比评测.md)，完整逐场景记录见[5500 字 JSON](./5500字_当前十二方案最优切分实测结果.json)。",
	"",
];
writeFileSync(
	rootPath("reports/5500字评测_双拼固顶及词长直选更新.md"),
	lines.join("\n"),
);
console.log(lines.join("\n"));
