#!/usr/bin/env node

/*
 * Measure how far each deployed auxiliary policy stays ahead of its nearest
 * alternative while independently perturbing the five CKT v5 cognitive costs.
 * Unlike the earlier raw-millisecond sensitivity pass, this uses the exact
 * normalized per-mode objective from the nested 144-policy search.
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
const TRACKS = ["character", "word2", "word3", "word4"];
const WEIGHTS = Object.freeze({ character: 1, word2: 3, word3: 1, word4: 1 });
const CASES = Object.freeze([
	{
		id: "21x21-keytao",
		name: "冰雪键道",
		selected: "12/23/24",
		modeFile: "output/ckt5-nested-frontier/modes/21x21-r004-keytao.json",
		reference: "s005-keytao",
	},
	{
		id: "21x21-sanpin",
		name: "冰雪三拼",
		selected: "12/21/23",
		modeFile: "output/ckt5-nested-frontier/modes/21x21-r004-sanpin.json",
		reference: "s005-sanpin",
	},
	{
		id: "21x26-keytao",
		name: "冰雪神韵·形",
		selected: "12/21/42",
		modeFile: "output/ckt5-nested-frontier/modes/21x26-r017-keytao.json",
		reference: "s005-keytao",
	},
	{
		id: "21x26-sanpin",
		name: "冰雪神韵·调",
		selected: "12/21/13",
		modeFile: "output/ckt5-nested-frontier/modes/21x26-r017-sanpin.json",
		reference: "s005-sanpin",
	},
]);

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

function effective(values, multipliers) {
	let value = values[0];
	for (let index = 0; index < multipliers.length; index++)
		value += values[index + 1] * multipliers[index];
	return value;
}

function quantile(sorted, probability) {
	if (!sorted.length) return null;
	const position = (sorted.length - 1) * probability;
	const lower = Math.floor(position);
	const fraction = position - lower;
	return sorted[lower] + (sorted[lower + 1] - sorted[lower] || 0) * fraction;
}

function summarize(values) {
	if (!values.length) return null;
	const sorted = [...values].sort((left, right) => left - right);
	return {
		minimum: sorted[0],
		p05: quantile(sorted, 0.05),
		median: quantile(sorted, 0.5),
		mean: values.reduce((sum, value) => sum + value, 0) / values.length,
		p95: quantile(sorted, 0.95),
		maximum: sorted.at(-1),
	};
}

function policyScore(policy, reference, multipliers) {
	let powerSum = 0;
	for (const track of TRACKS) {
		const numerator = effective(policy.components[track], multipliers);
		const denominator = effective(reference[track], multipliers);
		powerSum += WEIGHTS[track] * (numerator / denominator) ** 4;
	}
	return 10 * (powerSum / 6) ** 0.25;
}

function values(from, to, step) {
	const result = [];
	for (let value = from; value <= to + 1e-12; value += step) result.push(value);
	return result;
}

function analyzeGrid(policies, reference, selectedKey, multipliersPerAxis) {
	const selectedIndex = policies.findIndex(
		(policy) => policy.key === selectedKey,
	);
	if (selectedIndex < 0)
		throw new Error(`selected policy not found: ${selectedKey}`);
	const counts = policies.map(() => ({
		top1: 0,
		top3: 0,
		rankSum: 0,
		worstRank: 0,
	}));
	const signedGaps = [];
	const winningGaps = [];
	const nearest = new Map();
	let points = 0;

	for (const first of multipliersPerAxis)
		for (const second of multipliersPerAxis)
			for (const selection of multipliersPerAxis)
				for (const scan of multipliersPerAxis)
					for (const page of multipliersPerAxis) {
						const multipliers = [first, second, selection, scan, page];
						const scored = policies.map((policy, index) => ({
							index,
							key: policy.key,
							score: policyScore(policy, reference, multipliers),
						}));
						scored.sort(
							(left, right) =>
								left.score - right.score || left.key.localeCompare(right.key),
						);
						let rank = 0;
						let previousScore = null;
						for (let position = 0; position < scored.length; position++) {
							if (
								previousScore === null ||
								Math.abs(scored[position].score - previousScore) > 1e-12
							)
								rank = position + 1;
							const stats = counts[scored[position].index];
							if (rank === 1) stats.top1++;
							if (rank <= 3) stats.top3++;
							stats.rankSum += rank;
							stats.worstRank = Math.max(stats.worstRank, rank);
							previousScore = scored[position].score;
						}
						const selected = scored.find(
							(entry) => entry.index === selectedIndex,
						);
						const competitor = scored.find(
							(entry) => entry.index !== selectedIndex,
						);
						const gap =
							((competitor.score - selected.score) / selected.score) * 100;
						signedGaps.push(gap);
						if (gap >= 0) winningGaps.push(gap);
						nearest.set(competitor.key, (nearest.get(competitor.key) || 0) + 1);
						points++;
					}

	const ranking = policies
		.map((policy, index) => ({
			policy: policy.key,
			top1Rate: counts[index].top1 / points,
			top3Rate: counts[index].top3 / points,
			meanRank: counts[index].rankSum / points,
			worstRank: counts[index].worstRank,
		}))
		.sort(
			(left, right) =>
				left.meanRank - right.meanRank ||
				right.top1Rate - left.top1Rate ||
				left.policy.localeCompare(right.policy),
		);
	const selectedStats = ranking.find((entry) => entry.policy === selectedKey);
	return {
		points,
		selected: selectedStats,
		robustTop5: ranking.slice(0, 5),
		signedGapToBestAlternativePct: summarize(signedGaps),
		winningGapPct: summarize(winningGaps),
		winningPoints: winningGaps.length,
		nearestAlternatives: [...nearest.entries()]
			.map(([policy, count]) => ({ policy, rate: count / points }))
			.sort(
				(left, right) =>
					right.rate - left.rate || left.policy.localeCompare(right.policy),
			)
			.slice(0, 5),
	};
}

function baseline(policies, reference, selectedKey) {
	const scored = policies
		.map((policy) => ({
			policy: policy.key,
			score: policyScore(policy, reference, [1, 1, 1, 1, 1]),
		}))
		.sort(
			(left, right) =>
				left.score - right.score || left.policy.localeCompare(right.policy),
		);
	const selectedIndex = scored.findIndex(
		(entry) => entry.policy === selectedKey,
	);
	const selected = scored[selectedIndex];
	const competitor = scored.find((entry) => entry.policy !== selectedKey);
	return {
		selectedPolicy: selectedKey,
		selectedRank: selectedIndex + 1,
		selectedScore: selected.score,
		nearestAlternative: competitor.policy,
		alternativeScore: competitor.score,
		gapPct: ((competitor.score - selected.score) / selected.score) * 100,
		top5: scored.slice(0, 5),
	};
}

function main() {
	const root = path.resolve(__dirname, "../..");
	const schemeSpecific = JSON.parse(
		fs.readFileSync(
			path.join(root, "output/ckt5-scheme-specific.json"),
			"utf8",
		),
	);
	const results = {};
	for (const specification of CASES) {
		process.stderr.write(`analyzing ${specification.id}\n`);
		const mode = JSON.parse(
			fs.readFileSync(path.join(root, specification.modeFile), "utf8"),
		);
		const policies = mode.results.map((result) => ({
			key: result.policyKey,
			components: Object.fromEntries(
				TRACKS.map((track) => [track, components(result.tracks[track])]),
			),
		}));
		const referenceCase = schemeSpecific.cases[specification.reference];
		const reference = Object.fromEntries(
			TRACKS.map((track) => [track, components(referenceCase.tracks[track])]),
		);
		results[specification.id] = {
			name: specification.name,
			selectedPolicy: specification.selected,
			baseline: baseline(policies, reference, specification.selected),
			practicalGrid: analyzeGrid(
				policies,
				reference,
				specification.selected,
				values(0.5, 1.5, 0.25),
			),
			stressGrid: analyzeGrid(
				policies,
				reference,
				specification.selected,
				values(0, 5, 0.5),
			),
		};
	}
	const output = {
		version: "ckt5-current-policy-gap-1",
		objective:
			"per-mode normalized CKT v5 contribution against the matching S005 mode, with word-length weights 1:3:1:1",
		baselineCostsMs: BASELINE,
		practicalGrid: {
			rangePercent: [50, 150],
			stepPercent: 25,
			pointsPerCoefficient: 5,
			combinations: 5 ** 5,
		},
		stressGrid: {
			rangePercent: [0, 500],
			stepPercent: 50,
			pointsPerCoefficient: 11,
			combinations: 11 ** 5,
		},
		gapDefinition:
			"100 * (best alternative score - selected score) / selected score; positive means the deployed policy leads",
		results,
	};
	const outputFile = path.join(root, "reports/ckt5-current-aux-order-gap.json");
	fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
	process.stdout.write(`${outputFile}\n`);
}

main();
