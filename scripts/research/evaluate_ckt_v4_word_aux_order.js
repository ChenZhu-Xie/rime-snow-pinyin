#!/usr/bin/env node
"use strict";

/*
 * Exhaustively compare ordered auxiliary-source positions for two-, three-,
 * and four-character words while keeping the CKT v4 corpus, competition
 * graph, terminal ranking, motor model, and cognitive scenarios unchanged.
 *
 * This is intentionally a within-layout experiment. It does not normalize to
 * S005 and does not combine Keytao and Sanpin into a cross-mode layout score.
 */

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_BENCHMARK =
	"D:/C2D/Desktop/Code/Lua/inputMethod/shuangpin-layout-benchmark";
const DEFAULT_CASES = [
	{
		id: "gen0107-p5-f1h-11_13-d2-f25_26-d3-f4_22-d4-f11_13",
		label: "21x21-keytao",
		mode: "keytao",
		slotKeys: "IVUAO",
		current: { word2: "12", word3: "12", word4: "12" },
	},
	{
		id: "gen0107-p5-f1h-11_13-d2-f25_26-d3-f4_22-d4-f11_13",
		label: "21x21-sanpin",
		mode: "sanpin",
		slotKeys: "IVUAO",
		current: { word2: "21", word3: "31", word4: "41" },
	},
	{
		id: "SNOW-SHENYUN-21X26-PRODUCTION",
		label: "21x26-keytao",
		mode: "keytao",
		slotKeys: "IEUAO",
		current: { word2: "21", word3: "12", word4: "12" },
	},
	{
		id: "SNOW-SHENYUN-21X26-PRODUCTION",
		label: "21x26-sanpin",
		mode: "sanpin",
		slotKeys: "IEUAO",
		current: { word2: "21", word3: "12", word4: "12" },
	},
];
const REFERENCE_CASES = [
	{
		id: "S005",
		label: "s005-keytao",
		mode: "keytao",
		slotKeys: "IVUAO",
		current: { word2: "12", word3: "12", word4: "12" },
	},
	{
		id: "S005",
		label: "s005-sanpin",
		mode: "sanpin",
		slotKeys: "IVUAO",
		current: { word2: "21", word3: "31", word4: "41" },
	},
];

const SHAPE_FROM = "IEUAO";
const SHAPE_SEMANTIC_FROM = "AEUIO";
const TRACK_WEIGHTS = Object.freeze({
	word2: 3,
	word3: 1,
	word4: 1,
});
const TRACK_KINDS = Object.keys(TRACK_WEIGHTS);
const WORD_KINDS = TRACK_KINDS;
const PAGE_SIZE = 6;

function parseArgs(argv) {
	const args = {};
	for (let index = 0; index < argv.length; index++) {
		if (!argv[index].startsWith("--")) continue;
		args[argv[index].slice(2)] =
			argv[index + 1] && !argv[index + 1].startsWith("--")
				? argv[++index]
				: true;
	}
	return args;
}

function orderedDistinctPairs(length) {
	const result = [];
	for (let first = 1; first <= length; first++) {
		for (let second = 1; second <= length; second++) {
			if (first !== second) result.push(`${first}${second}`);
		}
	}
	return result;
}

// The payload stores abstract shape symbols in SHAPE_FROM slot order. slotKeys
// is indexed by those slots; it is not the displayed 折横撇竖点 key sequence.
function physicalShape(abstract, slotKeys) {
	return [...(abstract || "")]
		.map((key) => slotKeys[SHAPE_FROM.indexOf(key)] || "")
		.join("");
}

function semanticMapping(mode, slotKeys) {
	return mode === "keytao"
		? `折横撇竖点→${physicalShape(SHAPE_SEMANTIC_FROM, slotKeys)}`
		: `一二三四轻→${slotKeys}`;
}

function stage(code) {
	return { length: [...code].length, codes: [code] };
}

function wordRow(model, contract, id, text, kind, weight, baseLength, codes) {
	return {
		id,
		text,
		kind,
		weight,
		baseLength,
		stages: model.makeStages(contract, kind, codes.map(stage)),
	};
}

function auxiliaryFor(item, chars, position, mode, slotKeys, shape) {
	const index = position - 1;
	if (mode === "keytao") return physicalShape(shape[chars[index]], slotKeys)[0];
	return slotKeys[item.tones[index] - 1];
}

function buildRowsForOrder(
	entry,
	data,
	words,
	mode,
	slotKeys,
	kind,
	order,
	model,
) {
	const contract = model.classifyContract(entry.capacity);
	const shape = data.shapes.snowshape;
	const codes = entry.codeList;
	const firstPosition = Number(order[0]);
	const secondPosition = Number(order[1]);
	const rows = [];

	for (let index = 0; index < words[kind].length; index++) {
		const item = words[kind][index];
		if (item.py.some((py) => !codes[py])) continue;
		const chars = [...item.text];
		const first = auxiliaryFor(
			item,
			chars,
			firstPosition,
			mode,
			slotKeys,
			shape,
		);
		const second = auxiliaryFor(
			item,
			chars,
			secondPosition,
			mode,
			slotKeys,
			shape,
		);
		if (!first || !second) continue;

		if (kind === "word2") {
			const base = codes[item.py[0]] + codes[item.py[1]];
			rows.push(
				wordRow(
					model,
					contract,
					`w2:${index}`,
					item.text,
					kind,
					item.weight,
					4,
					[base, base + first, base + first + second],
				),
			);
			continue;
		}

		const stem = item.py.map((py) => codes[py][0]).join("");
		if (kind === "word3" && contract === "four-code-top") {
			const routed = stem + codes[item.py[2]][1];
			rows.push(
				wordRow(
					model,
					contract,
					`word3:${index}`,
					item.text,
					kind,
					item.weight,
					4,
					[stem, routed, routed + first, routed + first + second],
				),
			);
		} else {
			rows.push(
				wordRow(
					model,
					contract,
					`${kind}:${index}`,
					item.text,
					kind,
					item.weight,
					chars.length,
					[stem, stem + first, stem + first + second],
				),
			);
		}
	}
	return rows;
}

function weightedTrackMetrics(summary) {
	const result = {};
	const fields = [
		"motorUpperMs",
		"cognitiveMs",
		"effectiveMs",
		"firstAuxRate",
		"secondAuxRate",
		"selectionRate",
		"meanTerminalRank",
		"meanRejectedCandidates",
		"meanPageActions",
		"meanKeys",
	];
	const totalWeight = Object.values(TRACK_WEIGHTS).reduce(
		(sum, value) => sum + value,
		0,
	);
	for (const field of fields) {
		result[field] =
			TRACK_KINDS.reduce(
				(sum, kind) => sum + TRACK_WEIGHTS[kind] * summary[kind][field],
				0,
			) / totalWeight;
	}
	return result;
}

function samePolicy(left, right) {
	return WORD_KINDS.every((kind) => left[kind] === right[kind]);
}

function compactTrack(track) {
	return {
		count: track.count,
		totalWeight: track.totalWeight,
		motorUpperMs: track.motorUpperMs,
		cognitiveMs: track.cognitiveMs,
		effectiveMs: track.effectiveMs,
		firstAuxRate: track.firstAuxRate,
		secondAuxRate: track.secondAuxRate,
		selectionRate: track.selectionRate,
		meanTerminalRank: track.meanTerminalRank,
		meanRejectedCandidates: track.meanRejectedCandidates,
		meanPageActions: track.meanPageActions,
		meanKeys: track.meanKeys,
	};
}

function compareNumbers(left, right, name, tolerance = 1e-9) {
	if (Math.abs(left - right) > tolerance) {
		throw new Error(`${name} mismatch: ${left} versus ${right}`);
	}
}

function verifyCurrentPolicy({
	entry,
	data,
	words,
	strokes,
	mode,
	slotKeys,
	current,
	motor,
	model,
	scorer,
	rowsByKind,
}) {
	const cloned = { ...entry, tone: slotKeys };
	const upstreamRows = scorer
		.buildRows(cloned, data, strokes, words, mode)
		.filter((row) => WORD_KINDS.includes(row.kind));
	const expected = model.summarizeOutcomes(
		model.resolveCompetition(upstreamRows, { motorCost: motor }),
	);
	const actualRows = WORD_KINDS.flatMap((kind) =>
		rowsByKind[kind].get(current[kind]),
	);
	const actual = model.summarizeOutcomes(
		model.resolveCompetition(actualRows, { motorCost: motor }),
	);
	for (const kind of TRACK_KINDS) {
		for (const field of [
			"count",
			"totalWeight",
			"effectiveMs",
			"selectionRate",
			"meanRejectedCandidates",
			"meanPageActions",
			"meanKeys",
		]) {
			compareNumbers(
				actual[kind][field],
				expected[kind][field],
				`${mode}/${kind}/${field}`,
			);
		}
	}
}

function scenarioParameters(model) {
	return {
		rankAwareDefault: {
			...model.DEFAULT_COGNITIVE_PRIOR,
			pageSize: PAGE_SIZE,
		},
		historical300_300_600: {
			...model.HISTORICAL_COGNITIVE_PRIOR,
			pageSize: PAGE_SIZE,
		},
		motorOnly: {
			firstAuxMs: 0,
			secondAuxMs: 0,
			selectionDecisionMs: 0,
			scanPerCandidateMs: 0,
			selectionActionMs: 0,
			pageSize: PAGE_SIZE,
			pageActionMs: 0,
		},
	};
}

function bestBy(results, selector) {
	return [...results].sort((left, right) => {
		for (const value of selector(left, right)) if (value !== 0) return value;
		return JSON.stringify(left.policy).localeCompare(
			JSON.stringify(right.policy),
		);
	})[0];
}

function summaryOfResults(results, currentPolicy) {
	const current = results.find((result) =>
		samePolicy(result.policy, currentPolicy),
	);
	const bestEffective = bestBy(results, (a, b) => [
		a.scenarios.rankAwareDefault.effectiveMs -
			b.scenarios.rankAwareDefault.effectiveMs,
		a.scenarios.rankAwareDefault.selectionRate -
			b.scenarios.rankAwareDefault.selectionRate,
	]);
	const bestSelection = bestBy(results, (a, b) => [
		a.scenarios.rankAwareDefault.selectionRate -
			b.scenarios.rankAwareDefault.selectionRate,
		a.scenarios.rankAwareDefault.meanRejectedCandidates -
			b.scenarios.rankAwareDefault.meanRejectedCandidates,
		a.scenarios.rankAwareDefault.effectiveMs -
			b.scenarios.rankAwareDefault.effectiveMs,
	]);
	const bestRejected = bestBy(results, (a, b) => [
		a.scenarios.rankAwareDefault.meanRejectedCandidates -
			b.scenarios.rankAwareDefault.meanRejectedCandidates,
		a.scenarios.rankAwareDefault.selectionRate -
			b.scenarios.rankAwareDefault.selectionRate,
		a.scenarios.rankAwareDefault.effectiveMs -
			b.scenarios.rankAwareDefault.effectiveMs,
	]);
	const bestHistorical = bestBy(results, (a, b) => [
		a.scenarios.historical300_300_600.effectiveMs -
			b.scenarios.historical300_300_600.effectiveMs,
	]);
	const bestMotor = bestBy(results, (a, b) => [
		a.scenarios.motorOnly.effectiveMs - b.scenarios.motorOnly.effectiveMs,
	]);
	const ranks = {};
	for (const [name, selector] of Object.entries({
		effective: (result) => result.scenarios.rankAwareDefault.effectiveMs,
		selection: (result) => result.scenarios.rankAwareDefault.selectionRate,
		rejected: (result) =>
			result.scenarios.rankAwareDefault.meanRejectedCandidates,
	})) {
		const sorted = [...results].sort((a, b) => selector(a) - selector(b));
		ranks[name] =
			sorted.findIndex((result) => samePolicy(result.policy, currentPolicy)) +
			1;
	}
	return {
		current,
		currentRanks: ranks,
		bestEffective,
		bestSelection,
		bestRejected,
		bestHistorical,
		bestMotor,
	};
}

function evaluateCase(context, specification) {
	const { data, words, strokes, model, scorer, snapshot } = context;
	const entry = data.entries.find((value) => value.id === specification.id);
	if (!entry) throw new Error(`unknown scheme: ${specification.id}`);
	const nativeMotor = model.upstreamMotor(snapshot);
	const motor = model.projectedMotor(
		nativeMotor,
		snapshot.keys,
		data.ckt.calibration.extension_maps,
	);
	const orders = {
		word2: orderedDistinctPairs(2),
		word3: orderedDistinctPairs(3),
		word4: orderedDistinctPairs(4),
	};
	const rowsByKind = {};
	for (const kind of WORD_KINDS) {
		rowsByKind[kind] = new Map(
			orders[kind].map((order) => [
				order,
				buildRowsForOrder(
					entry,
					data,
					words,
					specification.mode,
					specification.slotKeys,
					kind,
					order,
					model,
				),
			]),
		);
	}
	verifyCurrentPolicy({
		entry,
		data,
		words,
		strokes,
		mode: specification.mode,
		slotKeys: specification.slotKeys,
		current: specification.current,
		motor,
		model,
		scorer,
		rowsByKind,
	});

	const parameters = scenarioParameters(model);
	const results = [];
	const total = orders.word2.length * orders.word3.length * orders.word4.length;
	let completed = 0;
	for (const word2 of orders.word2) {
		for (const word3 of orders.word3) {
			for (const word4 of orders.word4) {
				const rows = [
					...rowsByKind.word2.get(word2),
					...rowsByKind.word3.get(word3),
					...rowsByKind.word4.get(word4),
				];
				const outcomes = model.resolveCompetition(rows, { motorCost: motor });
				const scenarios = {};
				let defaultTracks;
				for (const [name, values] of Object.entries(parameters)) {
					const tracks = model.summarizeOutcomes(outcomes, values);
					scenarios[name] = weightedTrackMetrics(tracks);
					if (name === "rankAwareDefault") defaultTracks = tracks;
				}
				results.push({
					policy: { word2, word3, word4 },
					scenarios,
					tracks: Object.fromEntries(
						TRACK_KINDS.map((kind) => [
							kind,
							compactTrack(defaultTracks[kind]),
						]),
					),
				});
				completed++;
				if (completed % 24 === 0 || completed === total) {
					process.stderr.write(
						`${specification.label}: ${completed}/${total}\n`,
					);
				}
			}
		}
	}

	return {
		label: specification.label,
		schemeId: specification.id,
		schemeName: entry.name,
		capacity: entry.capacity,
		mode: specification.mode,
		slotKeys: specification.slotKeys,
		semanticMapping: semanticMapping(
			specification.mode,
			specification.slotKeys,
		),
		currentPolicy: specification.current,
		policySpace: Object.fromEntries(
			WORD_KINDS.map((kind) => [kind, orders[kind]]),
		),
		resultCount: results.length,
		verification:
			"current policy matches the upstream CKT v4 row builder and kernel",
		summary: summaryOfResults(results, specification.current),
		results,
	};
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const repo = path.resolve(__dirname, "../..");
	const benchmark = path.resolve(args.benchmark || DEFAULT_BENCHMARK);
	const html = path.resolve(
		args.html || path.join(benchmark, "a7_CKT_R11.html"),
	);
	const motorFile = path.resolve(
		args.motor ||
			path.join(benchmark, "tools", "ckt_v4_upstream_role_tables.json"),
	);
	const model = require(path.join(benchmark, "tools", "ckt_v4_model.js"));
	const scorer = require(
		path.join(benchmark, "tools", "score_completion_ckt_v4.js"),
	);
	const data = scorer.loadPayload(html);
	const strokes = scorer.strokeOptions(
		path.join(repo, "rime-stroke", "stroke.dict.yaml"),
	);
	const words = scorer.multiwords(
		path.join(repo, "snow_pinyin.base.dict.yaml"),
		data,
		Number(args.mass || 0.99),
	);
	const snapshot = JSON.parse(fs.readFileSync(motorFile, "utf8"));
	const requested = args.case
		? new Set(String(args.case).split(",").filter(Boolean))
		: null;
	const cases = requested
		? [...DEFAULT_CASES, ...REFERENCE_CASES].filter((value) =>
				requested.has(value.label),
			)
		: DEFAULT_CASES;
	if (requested && cases.length !== requested.size)
		throw new Error(`unknown --case: ${args.case}`);
	const context = { data, words, strokes, model, scorer, snapshot };
	const evaluated = cases.map((specification) =>
		evaluateCase(context, specification),
	);
	const output = {
		version: "ckt5-word-aux-order-1",
		purpose:
			"within-layout and within-mode auxiliary source-order comparison with word2/word3/word4 weights 3:1:1; no S005 normalization and no cross-mode composite",
		benchmark: {
			html,
			upstreamCommit: snapshot.commit,
			artifactVersion: snapshot.artifactVersion,
			sourceSha256: snapshot.sourceSha256,
		},
		corpus: {
			mass: Number(args.mass || 0.99),
			word2: words.word2.length,
			word3: words.word3.length,
			word4: words.word4.length,
		},
		trackWeights: TRACK_WEIGHTS,
		cognitiveScenarios: scenarioParameters(model),
		assumptions: [
			"Each auxiliary uses the first shape code or tone of one source character.",
			"The two source positions must be distinct; repeated positions add no information under this code family.",
			"Candidate pools, early commit, terminal rank, motor tables, and cognitive parameters are otherwise identical to CKT v4.",
			"21x26 Keytao uses deployed AEUIO shape keys; 21x26 Sanpin uses deployed IEUAO tone keys.",
			"Candidate pages contain six candidates.",
		],
		cases: Object.fromEntries(evaluated.map((value) => [value.label, value])),
	};
	const outputFile = path.resolve(
		args.output ||
			path.join(repo, "research-notes", "data", "ckt-v4-word-aux-order.json"),
	);
	fs.mkdirSync(path.dirname(outputFile), { recursive: true });
	fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
	process.stdout.write(
		`${JSON.stringify({ output: outputFile, cases: cases.map((value) => value.label), corpus: output.corpus })}\n`,
	);
}

if (require.main === module) main();

module.exports = {
	DEFAULT_CASES,
	REFERENCE_CASES,
	semanticMapping,
	orderedDistinctPairs,
	buildRowsForOrder,
	weightedTrackMetrics,
};
