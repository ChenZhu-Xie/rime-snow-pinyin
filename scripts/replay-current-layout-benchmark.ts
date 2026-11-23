import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
	currentLayoutIds,
	latestCurrentBenchmark,
} from "./lib/current-layout-benchmark";
import { rootPath } from "./lib/paths";

// biome-ignore-all lint/suspicious/noExplicitAny: 调用用户指定 benchmark 仓库的冻结模型接口。
const html = resolve(process.argv[2]);
const benchmark = dirname(html);
const require = createRequire(import.meta.url);
const tool = (name: string) => require(join(benchmark, "tools", name));
const scorer = tool("score_completion_ckt_v4.js");
const v52 = tool("score_ckt_v52.js");
const model = tool("ckt_v4_model.js");
const counts = tool("compare_u7e_competing_performance.js");
const hash = (path: string) =>
	createHash("sha256").update(readFileSync(path)).digest("hex");
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const frozen = join(
	benchmark,
	"research/.cache/untoned-2126-anneal-100k-20261115/frozen-inputs/external/D/C2D/Documents/rime-snow-pinyin",
);
const wordsPath = join(frozen, "snow_pinyin.base.dict.yaml");
const strokePath = join(frozen, "rime-stroke/stroke.dict.yaml");
const profilePath = join(
	benchmark,
	"research/.cache/ckt-long-code-audit-20261118/error-profile-all-roles.json",
);
const rolePath = join(benchmark, "tools/ckt_v4_upstream_role_tables.json");
const data = scorer.loadPayload(html);
const source = latestCurrentBenchmark()!;
const roles = read(rolePath);
const ctx: any = {
	data,
	legacy: model.projectedMotor(
		model.upstreamMotor(roles),
		roles.keys,
		data.ckt.calibration.extension_maps,
	),
	next: model.projectedMotor(
		tool("ckt_block_error.js").blockErrorMotor(roles, read(profilePath), {
			tailMode: "block",
		}),
		roles.keys,
		data.ckt.calibration.extension_maps,
	),
	words: scorer.multiwords(wordsPath, data, 0.99),
	strokes: scorer.strokeOptions(strokePath),
	...require(rootPath("scripts/research/evaluate_ckt_v4_word_aux_order.js")),
	...require(rootPath("scripts/research/evaluate_ckt51_aux_order.js")),
};
const kinds = ["character", "word2", "word3", "word4"];
const result: any = {
	version: "current-layout-replay-v1",
	sourceSha256: hash(html),
	schemes: {},
	sourceHashes: {},
};
for (const [scheme, id] of Object.entries(currentLayoutIds)) {
	if (scheme === "Liandao" || scheme === "Zhudao") continue;
	const entry = data.entries.find((entry: any) => entry.id === id);
	const saved = source.contracts[scheme];
	const policies = saved.policies?.candidate;
	if (!policies) throw new Error(`缺少当前 ${scheme} 辅序`);
	// S005 是 v5.2 的冻结归一化参考，保持页面参考辅序；另列历史方案的旧版测值。
	const chosen = scheme === "S005" ? data.cktV52.references.policies : policies;
	const captures: any[] = [];
	const summarize = require(
		rootPath("scripts/research/evaluate_ckt51_aux_order.js"),
	).summarize;
	ctx.summarize = (rows: any[]) => {
		captures.push(counts.summarizeCodes(rows));
		return summarize(rows);
	};
	console.log(`复算 ${scheme}：${JSON.stringify(chosen)}`);
	const computed = v52.evaluateUntoned(
		entry,
		chosen,
		entry.capacity[1] === 26
			? { pageSize: 6, maximumCandidates: 120, minimumInputLength: 4 }
			: null,
		ctx,
	);
	const codes = Object.fromEntries(
		["keytao", "sanpin"].map((mode, index) => [
			mode,
			Object.fromEntries(
				kinds.map((kind, j) => [kind, captures[index * 4 + j]]),
			),
		]),
	);
	const described = v52.describe(computed.v52, data.cktV52.references.v52);
	const published = data.cktV52.schemes[id]?.v52;
	if (published && Math.abs(described.score - published.score) > 1e-9)
		throw new Error(
			`${scheme} 与页面冻结分数不符：${described.score} / ${published.score}`,
		);
	if (scheme === "S005" && Math.abs(described.score - 10) > 1e-9)
		throw new Error("S005 参考复算不一致");
	result.schemes[scheme] = {
		id,
		policies: chosen,
		v52: described,
		ergonomics: counts.aggregateCodes(codes),
		routes: computed.routes,
	};
	console.log(`${scheme} CKT v5.2=${described.score}`);
}
for (const path of [
	html,
	wordsPath,
	strokePath,
	profilePath,
	rolePath,
	...[
		"score_ckt_v52.js",
		"score_completion_ckt_v4.js",
		"ckt_v4_model.js",
		"ckt_block_error.js",
		"compare_u7e_competing_performance.js",
	].map((name) => join(benchmark, "tools", name)),
	rootPath("scripts/research/evaluate_ckt_v4_word_aux_order.js"),
	rootPath("scripts/research/evaluate_ckt51_aux_order.js"),
])
	result.sourceHashes[path] = hash(path);
result.scope =
	"same frozen corpus and v5.2 error model; published production policies; historical own v5.1 policies; S005 frozen v5.2 reference policy; terminal loads include auxiliaries, exclude spaces and candidate/page keys; within-code transitions";
writeFileSync(
	rootPath("reports/current-layout-replay.json"),
	`${JSON.stringify(result, null, 2)}\n`,
);
console.log("已保存八轨复算与终局键负载：reports/current-layout-replay.json");
