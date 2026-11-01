#!/usr/bin/env node
"use strict";

/* Calculate scheme-specific CKT v5 values for the selected robust word orders. */

const fs = require("node:fs");
const path = require("node:path");
const {
	DEFAULT_CASES,
	buildRowsForOrder,
} = require("./evaluate_ckt_v4_word_aux_order.js");

const DEFAULT_BENCHMARK =
	"D:/C2D/Desktop/Code/Lua/inputMethod/shuangpin-layout-benchmark";
const PAGE_SIZE = 6;
const TRACK_WEIGHTS = Object.freeze({
	character: 1,
	word2: 3,
	word3: 1,
	word4: 1,
});
const ROBUST_POLICIES = Object.freeze({
	"21x21-keytao": { word2: "12", word3: "23", word4: "24" },
	"21x21-sanpin": { word2: "12", word3: "21", word4: "23" },
	"21x26-keytao": { word2: "12", word3: "12", word4: "24" },
	"21x26-sanpin": { word2: "12", word3: "21", word4: "13" },
});

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
		meanRejectedCandidates: track.meanRejectedCandidates,
		meanPageActions: track.meanPageActions,
		meanKeys: track.meanKeys,
	};
}

function weightedMetrics(tracks) {
	const total = Object.values(TRACK_WEIGHTS).reduce(
		(sum, weight) => sum + weight,
		0,
	);
	const fields = [
		"motorUpperMs",
		"cognitiveMs",
		"effectiveMs",
		"firstAuxRate",
		"secondAuxRate",
		"selectionRate",
		"meanRejectedCandidates",
		"meanPageActions",
		"meanKeys",
	];
	return Object.fromEntries(
		fields.map((field) => [
			field,
			Object.entries(TRACK_WEIGHTS).reduce(
				(sum, [kind, weight]) => sum + weight * tracks[kind][field],
				0,
			) / total,
		]),
	);
}

function evaluateCase(context, specification) {
	const { data, words, strokes, model, scorer, snapshot } = context;
	const policy = ROBUST_POLICIES[specification.label];
	const entry = data.entries.find((value) => value.id === specification.id);
	if (!entry || !policy) throw new Error(`missing case ${specification.label}`);
	const nativeMotor = model.upstreamMotor(snapshot);
	const motor = model.projectedMotor(
		nativeMotor,
		snapshot.keys,
		data.ckt.calibration.extension_maps,
	);
	const cloned = { ...entry, tone: specification.auxiliaryKeys };
	const characterRows = scorer
		.buildRows(cloned, data, strokes, words, specification.mode)
		.filter((row) => row.kind === "character");
	const wordRows = Object.entries(policy).flatMap(([kind, order]) =>
		buildRowsForOrder(
			entry,
			data,
			words,
			specification.mode,
			specification.auxiliaryKeys,
			kind,
			order,
			model,
		),
	);
	const outcomes = model.resolveCompetition([...characterRows, ...wordRows], {
		motorCost: motor,
	});
	const tracks = model.summarizeOutcomes(outcomes, {
		...model.DEFAULT_COGNITIVE_PRIOR,
		pageSize: PAGE_SIZE,
	});
	return {
		label: specification.label,
		schemeId: specification.id,
		schemeName: entry.name,
		mode: specification.mode,
		auxiliaryKeys: specification.auxiliaryKeys,
		policy,
		tracks: Object.fromEntries(
			Object.keys(TRACK_WEIGHTS).map((kind) => [
				kind,
				compactTrack(tracks[kind]),
			]),
		),
		ckt5: weightedMetrics(tracks),
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
	const context = { data, words, strokes, model, scorer, snapshot };
	const cases = Object.fromEntries(
		DEFAULT_CASES.map((specification) => {
			process.stderr.write(`evaluating ${specification.label}\n`);
			const result = evaluateCase(context, specification);
			return [specification.label, result];
		}),
	);
	const output = {
		version: "ckt5-scheme-specific-1",
		pageSize: PAGE_SIZE,
		trackWeights: TRACK_WEIGHTS,
		formula: "(character + 3*word2 + word3 + word4) / 6",
		cognitivePrior: {
			...model.DEFAULT_COGNITIVE_PRIOR,
			pageSize: PAGE_SIZE,
		},
		corpus: {
			mass: Number(args.mass || 0.99),
			word2: words.word2.length,
			word3: words.word3.length,
			word4: words.word4.length,
		},
		cases,
	};
	const outputFile = path.resolve(
		args.output || path.join(repo, "output", "ckt5-scheme-specific.json"),
	);
	fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
	process.stdout.write(`${outputFile}\n`);
}

if (require.main === module) main();
