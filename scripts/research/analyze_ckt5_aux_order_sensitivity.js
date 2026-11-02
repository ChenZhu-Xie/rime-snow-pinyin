#!/usr/bin/env node
"use strict";

/*
 * Analyze auxiliary-order stability while independently perturbing the five
 * cognitive-cost coefficients from 0% through 500% of their baseline values.
 * Candidate pages are already summarized at six candidates by the evaluator.
 */

const fs = require("node:fs");
const path = require("node:path");

const BASELINE = Object.freeze({
	firstAuxMs: 300,
	secondAuxMs: 300,
	selectionDecisionMs: 600,
	scanPerCandidateMs: 50,
	pageActionMs: 300,
});
const KINDS = ["word2", "word3", "word4"];
const TRACK_WEIGHTS = Object.freeze({
	word2: 3,
	word3: 1,
	word4: 1,
});
const DEFAULT_FILES = [
	"ckt-v4-word-aux-order-2121-keytao.json",
	"ckt-v4-word-aux-order-2121-sanpin.json",
	"ckt-v4-word-aux-order-2126-keytao.json",
	"ckt-v4-word-aux-order-2126-sanpin.json",
	"ckt-v4-word-aux-order-b04-keytao.json",
	"ckt-v4-word-aux-order-b04-sanpin.json",
];

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

function components(track) {
	return [
		track.motorUpperMs,
		BASELINE.firstAuxMs * track.firstAuxRate,
		BASELINE.secondAuxMs * track.secondAuxRate,
		BASELINE.selectionDecisionMs * track.selectionRate,
		BASELINE.scanPerCandidateMs * track.meanRejectedCandidates,
		BASELINE.pageActionMs * track.meanPageActions,
	];
}

function score(values, multipliers) {
	let result = values[0];
	for (let index = 0; index < multipliers.length; index++)
		result += values[index + 1] * multipliers[index];
	return result;
}

function dominates(left, right) {
	let strict = false;
	for (let index = 0; index < left.length; index++) {
		if (left[index] > right[index] + 1e-12) return false;
		if (left[index] < right[index] - 1e-12) strict = true;
	}
	return strict;
}

function compactVectors(vectors) {
	const unique = [];
	const seen = new Set();
	for (const vector of vectors) {
		const key = vector.map((value) => value.toPrecision(15)).join("/");
		if (!seen.has(key)) {
			seen.add(key);
			unique.push(vector);
		}
	}
	return unique.filter(
		(vector, index) =>
			!unique.some(
				(other, otherIndex) => otherIndex !== index && dominates(other, vector),
			),
	);
}

function groupsForKind(caseResult, kind) {
	const grouped = new Map();
	for (const result of caseResult.results) {
		const order = result.policy[kind];
		if (!grouped.has(order)) grouped.set(order, []);
		grouped.get(order).push(components(result.tracks[kind]));
	}
	return [...grouped.entries()]
		.map(([order, vectors]) => ({ order, vectors: compactVectors(vectors) }))
		.sort((left, right) => left.order.localeCompare(right.order));
}

function aggregateComponents(result) {
	const totalWeight = Object.values(TRACK_WEIGHTS).reduce(
		(sum, value) => sum + value,
		0,
	);
	const tracks = Object.entries(TRACK_WEIGHTS).map(([kind, weight]) => ({
		weight,
		values: components(result.tracks[kind]),
	}));
	return tracks[0].values.map(
		(_, index) =>
			tracks.reduce(
				(sum, track) => sum + track.weight * track.values[index],
				0,
			) / totalWeight,
	);
}

function groupsForAggregate(caseResult) {
	return caseResult.results.map((result) => ({
		order: [result.policy.word2, result.policy.word3, result.policy.word4].join(
			"/",
		),
		vectors: [aggregateComponents(result)],
	}));
}

function ranksFor(groups, multipliers) {
	const values = groups.map((group) => ({
		order: group.order,
		score: Math.min(...group.vectors.map((value) => score(value, multipliers))),
	}));
	values.sort(
		(left, right) =>
			left.score - right.score || left.order.localeCompare(right.order),
	);
	let previous = null;
	let rank = 0;
	for (let index = 0; index < values.length; index++) {
		if (previous === null || Math.abs(values[index].score - previous) > 1e-9)
			rank = index + 1;
		values[index].rank = rank;
		previous = values[index].score;
	}
	return values;
}

function makeStats(groups) {
	return Object.fromEntries(
		groups.map((group) => [
			group.order,
			{ top1: 0, top3: 0, rankSum: 0, worstRank: 0 },
		]),
	);
}

function addRanks(stats, ranked) {
	for (const value of ranked) {
		const target = stats[value.order];
		if (value.rank === 1) target.top1++;
		if (value.rank <= 3) target.top3++;
		target.rankSum += value.rank;
		target.worstRank = Math.max(target.worstRank, value.rank);
	}
}

function finishStats(stats, count) {
	return Object.entries(stats)
		.map(([order, value]) => ({
			order,
			top1Rate: value.top1 / count,
			top3Rate: value.top3 / count,
			meanRank: value.rankSum / count,
			worstRank: value.worstRank,
		}))
		.sort(
			(left, right) =>
				right.top1Rate - left.top1Rate ||
				left.meanRank - right.meanRank ||
				left.order.localeCompare(right.order),
		);
}

function byRobustRank(ranking) {
	return [...ranking].sort(
		(left, right) =>
			left.meanRank - right.meanRank ||
			right.top3Rate - left.top3Rate ||
			right.top1Rate - left.top1Rate ||
			left.worstRank - right.worstRank ||
			left.order.localeCompare(right.order),
	);
}

function independentGrid(groups) {
	const stats = makeStats(groups);
	let count = 0;
	for (let first = 0; first <= 10; first++)
		for (let second = 0; second <= 10; second++)
			for (let selection = 0; selection <= 10; selection++)
				for (let scan = 0; scan <= 10; scan++)
					for (let page = 0; page <= 10; page++) {
						const multipliers = [first, second, selection, scan, page].map(
							(value) => value / 2,
						);
						addRanks(stats, ranksFor(groups, multipliers));
						count++;
					}
	const ranking = finishStats(stats, count);
	return {
		count,
		stepPercent: 50,
		ranking,
		robustRanking: byRobustRank(ranking),
	};
}

function synchronizedSweep(groups) {
	const stats = makeStats(groups);
	let count = 0;
	for (let percent = 0; percent <= 500; percent++) {
		const multiplier = percent / 100;
		addRanks(stats, ranksFor(groups, Array(5).fill(multiplier)));
		count++;
	}
	const ranking = finishStats(stats, count);
	return {
		count,
		stepPercent: 1,
		ranking,
		robustRanking: byRobustRank(ranking),
	};
}

function baseline(groups) {
	return ranksFor(groups, Array(5).fill(1));
}

function analyzeCase(caseResult) {
	const byKind = Object.fromEntries(
		KINDS.map((kind) => {
			const groups = groupsForKind(caseResult, kind);
			return [
				kind,
				{
					orders: groups.map((group) => ({
						order: group.order,
						frontierVectors: group.vectors.length,
					})),
					baseline: baseline(groups),
					synchronized: synchronizedSweep(groups),
					independent: independentGrid(groups),
				},
			];
		}),
	);
	const aggregateGroups = groupsForAggregate(caseResult);
	return {
		aggregate: {
			baseline: baseline(aggregateGroups),
			synchronized: synchronizedSweep(aggregateGroups),
			independent: independentGrid(aggregateGroups),
		},
		...byKind,
	};
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const repo = path.resolve(__dirname, "../..");
	const inputDir = path.resolve(args["input-dir"] || path.join(repo, "output"));
	const files = args.files
		? String(args.files)
				.split(",")
				.map((value) => path.resolve(value))
		: DEFAULT_FILES.map((value) => path.join(inputDir, value));
	const cases = {};
	for (const file of files) {
		const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
		for (const [label, caseResult] of Object.entries(parsed.cases)) {
			process.stderr.write(`analyzing ${label}\n`);
			cases[label] = analyzeCase(caseResult);
		}
	}
	const output = {
		version: "ckt5-aux-order-sensitivity-2",
		pageSize: 6,
		trackWeights: TRACK_WEIGHTS,
		baselineCostsMs: BASELINE,
		independentGrid: {
			rangePercent: [0, 500],
			stepPercent: 50,
			pointsPerCoefficient: 11,
			combinations: 11 ** 5,
		},
		synchronizedSweep: { rangePercent: [0, 500], stepPercent: 1 },
		method:
			"The aggregate ranks complete policies at word2/word3/word4 weights 3:1:1. For each individual word length and source order, minimize over companion orders in the unchanged joint candidate pool, then rank source orders.",
		cases,
	};
	const outputFile = path.resolve(
		args.output || path.join(repo, "output", "ckt5-aux-order-sensitivity.json"),
	);
	fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
	process.stdout.write(`${outputFile}\n`);
}

if (require.main === module) main();
