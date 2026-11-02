#!/usr/bin/env node

/*
 * Build the CKT v5.1 auxiliary-order component table.
 *
 * The v5.1 comparison contract gives every word six total code positions:
 * word2 = four main + two auxiliaries, word3 = three main + three auxiliaries,
 * and word4 = four main + two auxiliaries.  Three-character words use their
 * own pools for all four stages so every layout is compared under the same
 * AAA/AAAB/AAABB/AAABBB routing contract.
 */

const fs = require("node:fs");
const path = require("node:path");
const {
	DEFAULT_CASES,
	REFERENCE_CASES,
	buildRowsForOrder,
	orderedDistinctPairs,
	semanticMapping,
} = require("./evaluate_ckt_v4_word_aux_order.js");

const DEFAULT_BENCHMARK =
	"D:/C2D/Desktop/Code/Lua/inputMethod/shuangpin-layout-benchmark";
const PAGE_SIZE = 6;
const BASELINE = Object.freeze({
	firstAuxMs: 300,
	secondAuxMs: 300,
	thirdAuxMs: 300,
	selectionDecisionMs: 600,
	scanPerCandidateMs: 50,
	pageActionMs: 300,
});
const TRACK_WEIGHTS = Object.freeze({
	character: 1,
	word2: 3,
	word3: 1,
	word4: 1,
});
const TARGET_CASES = new Set([
	"21x21-keytao",
	"21x21-sanpin",
	"21x26-keytao",
	"21x26-sanpin",
	"b04-keytao",
	"b04-sanpin",
]);
const SHAPE_FROM = "IEUAO";

function parseArgs(argv) {
	const result = {};
	for (let index = 0; index < argv.length; index++) {
		if (!argv[index].startsWith("--")) continue;
		result[argv[index].slice(2)] =
			argv[index + 1] && !argv[index + 1].startsWith("--")
				? argv[++index]
				: true;
	}
	return result;
}

function permutations(length) {
	const result = [];
	function visit(prefix, remaining) {
		if (!remaining.length) {
			result.push(prefix.join(""));
			return;
		}
		for (let index = 0; index < remaining.length; index++) {
			visit(
				[...prefix, remaining[index]],
				remaining.filter((_, other) => other !== index),
			);
		}
	}
	visit(
		[],
		Array.from({ length }, (_, index) => index + 1),
	);
	return result;
}

function physicalShape(abstract, slotKeys) {
	return [...(abstract || "")]
		.map((key) => slotKeys[SHAPE_FROM.indexOf(key)] || "")
		.join("");
}

function auxiliaryFor(item, chars, position, mode, slotKeys, shape) {
	const index = position - 1;
	if (mode === "keytao") return physicalShape(shape[chars[index]], slotKeys)[0];
	return slotKeys[item.tones[index] - 1];
}

function stage(code, pool) {
	return {
		order: [...code].length,
		length: [...code].length,
		pool,
		codes: [code],
	};
}

function buildWord3Rows(entry, data, words, mode, slotKeys, order) {
	if (!/^([123])(?!\1)([123])(?!\1|\2)([123])$/u.test(order)) {
		throw new Error(`invalid word3 permutation: ${order}`);
	}
	const rows = [];
	const shape = data.shapes.snowshape;
	for (let index = 0; index < words.word3.length; index++) {
		const item = words.word3[index];
		if (item.py.some((py) => !entry.codeList[py])) continue;
		const chars = [...item.text];
		const auxiliaries = [...order].map((position) =>
			auxiliaryFor(item, chars, Number(position), mode, slotKeys, shape),
		);
		if (auxiliaries.some((value) => !value)) continue;
		const stem = item.py.map((py) => entry.codeList[py][0]).join("");
		const code4 = stem + auxiliaries[0];
		const code5 = code4 + auxiliaries[1];
		const code6 = code5 + auxiliaries[2];
		rows.push({
			id: `word3:${index}`,
			text: item.text,
			kind: "word3",
			weight: item.weight,
			baseLength: 3,
			stages: [
				stage(stem, "word3:three"),
				stage(code4, "word3:four-b"),
				stage(code5, "word3:five-bb"),
				stage(code6, "word3:six-bbb"),
			],
		});
	}
	return rows;
}

function summarize(outcomes) {
	if (!outcomes.length)
		throw new Error("cannot summarize an empty outcome set");
	const totalWeight = outcomes.reduce((sum, row) => sum + row.weight, 0);
	const sums = {
		motorUpperMs: 0,
		firstAuxRate: 0,
		secondAuxRate: 0,
		thirdAuxRate: 0,
		selectionRate: 0,
		meanRejectedCandidates: 0,
		meanPageActions: 0,
		meanKeys: 0,
	};
	for (const row of outcomes) {
		sums.motorUpperMs += row.weight * row.motorUpperMs;
		if (row.auxCount >= 1) sums.firstAuxRate += row.weight;
		if (row.auxCount >= 2) sums.secondAuxRate += row.weight;
		if (row.auxCount >= 3) sums.thirdAuxRate += row.weight;
		if (row.rank > 1) sums.selectionRate += row.weight;
		sums.meanRejectedCandidates += row.weight * Math.max(0, row.rank - 1);
		sums.meanPageActions +=
			row.weight * Math.floor(Math.max(0, row.rank - 1) / PAGE_SIZE);
		sums.meanKeys += row.weight * row.codeLength;
	}
	const result = {
		count: outcomes.length,
		totalWeight,
		...Object.fromEntries(
			Object.entries(sums).map(([key, value]) => [key, value / totalWeight]),
		),
	};
	result.effectiveMs =
		result.motorUpperMs +
		BASELINE.firstAuxMs * result.firstAuxRate +
		BASELINE.secondAuxMs * result.secondAuxRate +
		BASELINE.thirdAuxMs * result.thirdAuxRate +
		BASELINE.selectionDecisionMs * result.selectionRate +
		BASELINE.scanPerCandidateMs * result.meanRejectedCandidates +
		BASELINE.pageActionMs * result.meanPageActions;
	return result;
}

function policyKey(word2, word3, word4) {
	return `${word2}/${word3}/${word4}`;
}

function evaluateCase(context, specification) {
	const { data, words, strokes, model, scorer, motor } = context;
	const entry = data.entries.find((value) => value.id === specification.id);
	if (!entry) throw new Error(`missing scheme ${specification.id}`);
	const cloned = { ...entry, tone: specification.slotKeys };
	const characterRows = scorer
		.buildRows(cloned, data, strokes, words, specification.mode)
		.filter((row) => row.kind === "character");
	const character = summarize(
		model.resolveCompetition(characterRows, { motorCost: motor }),
	);
	const word2Orders = orderedDistinctPairs(2);
	const word3Orders = permutations(3);
	const word4Orders = orderedDistinctPairs(4);
	const wordRows = {
		word2: new Map(
			word2Orders.map((order) => [
				order,
				buildRowsForOrder(
					entry,
					data,
					words,
					specification.mode,
					specification.slotKeys,
					"word2",
					order,
					model,
				),
			]),
		),
		word3: new Map(
			word3Orders.map((order) => [
				order,
				buildWord3Rows(
					entry,
					data,
					words,
					specification.mode,
					specification.slotKeys,
					order,
				),
			]),
		),
		word4: new Map(
			word4Orders.map((order) => [
				order,
				buildRowsForOrder(
					entry,
					data,
					words,
					specification.mode,
					specification.slotKeys,
					"word4",
					order,
					model,
				),
			]),
		),
	};

	const pairTracks = new Map();
	for (const word2 of word2Orders) {
		for (const word4 of word4Orders) {
			const outcomes = model.resolveCompetition(
				[...wordRows.word2.get(word2), ...wordRows.word4.get(word4)],
				{ motorCost: motor },
			);
			pairTracks.set(`${word2}/${word4}`, {
				word2: summarize(outcomes.filter((row) => row.kind === "word2")),
				word4: summarize(outcomes.filter((row) => row.kind === "word4")),
			});
		}
	}
	const word3Tracks = new Map(
		word3Orders.map((order) => [
			order,
			summarize(
				model.resolveCompetition(wordRows.word3.get(order), {
					motorCost: motor,
				}),
			),
		]),
	);
	const results = [];
	for (const word2 of word2Orders) {
		for (const word3 of word3Orders) {
			for (const word4 of word4Orders) {
				const pair = pairTracks.get(`${word2}/${word4}`);
				results.push({
					policy: { word2, word3, word4 },
					policyKey: policyKey(word2, word3, word4),
					tracks: {
						character,
						word2: pair.word2,
						word3: word3Tracks.get(word3),
						word4: pair.word4,
					},
				});
			}
		}
	}
	return {
		label: specification.label,
		schemeId: specification.id,
		schemeName: entry.name,
		mode: specification.mode,
		slotKeys: specification.slotKeys,
		semanticMapping: semanticMapping(
			specification.mode,
			specification.slotKeys,
		),
		policySpace: {
			word2: word2Orders,
			word3: word3Orders,
			word4: word4Orders,
		},
		resultCount: results.length,
		results,
	};
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const repo = path.resolve(__dirname, "../..");
	const benchmark = path.resolve(args.benchmark || DEFAULT_BENCHMARK);
	const model = require(path.join(benchmark, "tools", "ckt_v4_model.js"));
	const scorer = require(
		path.join(benchmark, "tools", "score_completion_ckt_v4.js"),
	);
	const html = path.resolve(
		args.html || path.join(benchmark, "a7_CKT_R11.html"),
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
	const snapshot = JSON.parse(
		fs.readFileSync(
			path.join(benchmark, "tools", "ckt_v4_upstream_role_tables.json"),
			"utf8",
		),
	);
	const motor = model.projectedMotor(
		model.upstreamMotor(snapshot),
		snapshot.keys,
		data.ckt.calibration.extension_maps,
	);
	const specifications = [
		...DEFAULT_CASES.filter((value) => TARGET_CASES.has(value.label)),
		...REFERENCE_CASES,
	];
	const context = { data, words, strokes, model, scorer, motor };
	const cases = {};
	for (const specification of specifications) {
		process.stderr.write(`evaluating ${specification.label}\n`);
		cases[specification.label] = evaluateCase(context, specification);
	}
	const output = {
		version: "ckt5.1-aux-order-components-1",
		contract: {
			name: "unified-six-code",
			word2: "four main plus two auxiliaries",
			word3: "three main plus three auxiliaries from distinct source positions",
			word4: "four main plus two auxiliaries",
			word3Pools: "separate at lengths 3, 4, 5, and 6 for every layout",
			pageSize: PAGE_SIZE,
		},
		trackWeights: TRACK_WEIGHTS,
		baselineCostsMs: BASELINE,
		corpus: {
			mass: Number(args.mass || 0.99),
			word2: words.word2.length,
			word3: words.word3.length,
			word4: words.word4.length,
		},
		policyCount: 144,
		cases,
	};
	const outputFile = path.resolve(
		args.output || path.join(repo, "output", "ckt51-aux-order-components.json"),
	);
	fs.mkdirSync(path.dirname(outputFile), { recursive: true });
	fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
	process.stdout.write(`${outputFile}\n`);
}

if (require.main === module) main();

module.exports = { buildWord3Rows, permutations, summarize };
