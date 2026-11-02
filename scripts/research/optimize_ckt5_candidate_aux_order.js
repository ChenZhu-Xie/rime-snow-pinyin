#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const {
	buildRowsForOrder,
	orderedDistinctPairs,
	semanticMapping,
} = require("./evaluate_ckt_v4_word_aux_order.js");

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ[]\\;',./";
const trackWeights = Object.freeze({
	character: 1,
	word2: 3,
	word3: 1,
	word4: 1,
});
const trackKinds = Object.keys(trackWeights);
const wordKinds = ["word2", "word3", "word4"];
const referencePolicies = Object.freeze({
	keytao: { word2: "12", word3: "21", word4: "24" },
	sanpin: { word2: "12", word3: "21", word4: "23" },
});
const sources = Object.freeze({
	"21x21": {
		gitObject:
			"11713b652cd6a2350d8bf6d0a16d3383d8f0038f:research/notes/2026-10-29-prodgate-directed-repair-pareto.json",
		array: "candidates",
		templateId: "gen0107-p5-f1h-11_13-d2-f25_26-d3-f4_22-d4-f11_13",
	},
	"21x26": {
		gitObject:
			"7a7e154f3f7d0c86653ee15e755ccd72e866e5e2:research/milestones/strict-d0/strict-d0-pareto-frontier-20261030.json",
		array: "topFrontier",
		templateId: "SNOW-SHENYUN-21X26-PRODUCTION",
	},
});

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

function atomicWrite(file, value) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const temporary = `${file}.${process.pid}.tmp`;
	fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
	fs.renameSync(temporary, file);
}

function selectArray(payload, dottedPath) {
	const selected = dottedPath
		.split(".")
		.reduce((value, key) => value?.[key], payload);
	if (!Array.isArray(selected)) {
		throw new Error(`source field is not an array: ${dottedPath}`);
	}
	return selected;
}

function loadSourceCandidate(benchmark, domain, sourceRank) {
	const source = sources[domain];
	const payload = JSON.parse(
		execFileSync("git", ["show", source.gitObject], {
			cwd: benchmark,
			encoding: "utf8",
			maxBuffer: 32 * 1024 * 1024,
		}),
	);
	const candidates = selectArray(payload, source.array);
	const ranked = candidates.map((candidate, index) => ({
		candidate,
		sourceRank: candidate.rank ?? index + 1,
	}));
	const selected = ranked.find((item) => item.sourceRank === sourceRank);
	if (!selected) {
		throw new Error(
			`source rank ${sourceRank} not found in ${domain}; available: ${ranked
				.map((item) => item.sourceRank)
				.join(",")}`,
		);
	}
	return { ...selected, source, candidateCount: candidates.length };
}

function decodeState(stateKey) {
	const bytes = Buffer.from(stateKey, "hex");
	if (bytes.length !== 69) throw new Error(`bad state length ${bytes.length}`);
	return {
		capacity: [bytes[0], bytes[1]],
		headKeys: [...bytes.subarray(2, 29)],
		finalKeys: [...bytes.subarray(29, 64)],
		toneKeysByTone: [...bytes.subarray(64, 69)]
			.map((index) => alphabet[index])
			.join(""),
	};
}

function entryFromCandidate(candidate, data, template, splitPinyin) {
	const state = decodeState(candidate.stateKey);
	return {
		id: candidate.candidateId || candidate.layoutId || "source-candidate",
		name: candidate.candidateId || candidate.layoutId || "source-candidate",
		capacity: state.capacity,
		tone: state.toneKeysByTone,
		codeList: data.pinyin.map((pinyin, index) => {
			if (template.codeList[index] == null) return null;
			const [head, final] = splitPinyin(pinyin);
			if (head === 0xff || final === 0xff) return null;
			return alphabet[state.headKeys[head]] + alphabet[state.finalKeys[final]];
		}),
	};
}

function compactTrack(track) {
	return Object.fromEntries(
		[
			"count",
			"totalWeight",
			"motorUpperMs",
			"cognitiveMs",
			"effectiveMs",
			"firstAuxRate",
			"secondAuxRate",
			"selectionRate",
			"meanRejectedCandidates",
			"meanPageActions",
			"meanKeys",
		].map((field) => [field, track[field]]),
	);
}

function summarizePolicy({
	entry,
	data,
	words,
	strokes,
	mode,
	toneKeysByTone,
	policy,
	motor,
	model,
	scorer,
}) {
	const characterRows = scorer
		.buildRows({ ...entry, tone: toneKeysByTone }, data, strokes, words, mode)
		.filter((row) => row.kind === "character");
	const wordRows = wordKinds.flatMap((kind) =>
		buildRowsForOrder(
			entry,
			data,
			words,
			mode,
			toneKeysByTone,
			kind,
			policy[kind],
			model,
		),
	);
	const outcomes = model.resolveCompetition([...characterRows, ...wordRows], {
		motorCost: motor,
	});
	const summary = model.summarizeOutcomes(outcomes, {
		...model.DEFAULT_COGNITIVE_PRIOR,
		pageSize: 6,
	});
	return Object.fromEntries(
		trackKinds.map((kind) => [kind, compactTrack(summary[kind])]),
	);
}

function parsePolicy(value) {
	const [word2, word3, word4, ...extra] = String(value).split(/[\/,]/);
	const policy = { word2, word3, word4 };
	if (
		extra.length > 0 ||
		!orderedDistinctPairs(2).includes(word2) ||
		!orderedDistinctPairs(3).includes(word3) ||
		!orderedDistinctPairs(4).includes(word4)
	) {
		throw new Error(
			`invalid --policy ${value}; expected word2/word3/word4, for example 12/23/24`,
		);
	}
	return policy;
}

function policiesToEvaluate(limit, requestedPolicy) {
	if (requestedPolicy) return [requestedPolicy];
	const all = [];
	for (const word2 of orderedDistinctPairs(2)) {
		for (const word3 of orderedDistinctPairs(3)) {
			for (const word4 of orderedDistinctPairs(4)) {
				all.push({ word2, word3, word4 });
			}
		}
	}
	return Number.isFinite(limit) ? all.slice(0, limit) : all;
}

function policyKey(policy) {
	return `${policy.word2}/${policy.word3}/${policy.word4}`;
}

function optimizeMode({
	entry,
	data,
	words,
	strokes,
	mode,
	toneKeysByTone,
	reference,
	motor,
	model,
	scorer,
	policyLimit,
	requestedPolicy,
	progressEvery,
}) {
	const policies = policiesToEvaluate(policyLimit, requestedPolicy);
	const requiredOrders = Object.fromEntries(
		wordKinds.map((kind) => [
			kind,
			[...new Set(policies.map((policy) => policy[kind]))],
		]),
	);
	let peakRssBytes = process.memoryUsage().rss;
	const sampleMemory = () => {
		peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
	};
	const characterRows = scorer
		.buildRows({ ...entry, tone: toneKeysByTone }, data, strokes, words, mode)
		.filter((row) => row.kind === "character");
	const rowsByKind = {};
	for (const kind of wordKinds) {
		rowsByKind[kind] = new Map();
		for (const order of requiredOrders[kind]) {
			rowsByKind[kind].set(
				order,
				buildRowsForOrder(
					entry,
					data,
					words,
					mode,
					toneKeysByTone,
					kind,
					order,
					model,
				),
			);
			sampleMemory();
		}
	}
	const results = [];
	for (let index = 0; index < policies.length; index++) {
		const policy = policies[index];
		const rows = [
			...characterRows,
			...rowsByKind.word2.get(policy.word2),
			...rowsByKind.word3.get(policy.word3),
			...rowsByKind.word4.get(policy.word4),
		];
		const outcomes = model.resolveCompetition(rows, { motorCost: motor });
		const summary = model.summarizeOutcomes(outcomes, {
			...model.DEFAULT_COGNITIVE_PRIOR,
			pageSize: 6,
		});
		const tracks = Object.fromEntries(
			trackKinds.map((kind) => [kind, compactTrack(summary[kind])]),
		);
		const powerSum = trackKinds.reduce((sum, kind) => {
			const ratio = tracks[kind].effectiveMs / reference[kind].effectiveMs;
			return sum + trackWeights[kind] * ratio ** 4;
		}, 0);
		results.push({
			policy,
			policyKey: policyKey(policy),
			powerSum,
			modeCktV5: 10 * (powerSum / 6) ** 0.25,
			tracks,
		});
		sampleMemory();
		if ((index + 1) % progressEvery === 0 || index + 1 === policies.length) {
			process.stderr.write(
				`mode=${mode} policies=${index + 1}/${policies.length} rssGiB=${(
					process.memoryUsage().rss / 1024 ** 3
				).toFixed(3)}\n`,
			);
		}
	}
	results.sort(
		(left, right) =>
			left.powerSum - right.powerSum ||
			left.policyKey.localeCompare(right.policyKey),
	);
	return { results, peakRssBytes };
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const domain = String(args.domain || "");
	const mode = String(args.mode || "");
	const benchmark = args.benchmark ? path.resolve(args.benchmark) : null;
	const sourceRank = Number(args["source-rank"]);
	if (
		!benchmark ||
		!Object.hasOwn(sources, domain) ||
		!["keytao", "sanpin"].includes(mode) ||
		!Number.isInteger(sourceRank) ||
		sourceRank < 1
	) {
		throw new Error(
			"usage: --benchmark DIR --domain 21x21|21x26 --source-rank N --mode keytao|sanpin [--output FILE] [--policy-limit N | --policy 12/23/24]",
		);
	}
	const startedAt = new Date();
	const repo = path.resolve(__dirname, "..", "..");
	const model = require(path.join(benchmark, "tools/ckt_v4_model.js"));
	const scorer = require(
		path.join(benchmark, "tools/score_completion_ckt_v4.js"),
	);
	const { splitPinyin } = require(
		path.join(benchmark, "tools/ckt_v4_scheme_fixture.js"),
	);
	const data = scorer.loadPayload(path.join(benchmark, "a7_CKT_R11.html"));
	const strokes = scorer.strokeOptions(
		path.join(repo, "rime-stroke", "stroke.dict.yaml"),
	);
	const words = scorer.multiwords(
		path.join(repo, "snow_pinyin.base.dict.yaml"),
		data,
		0.99,
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
	const sourceCandidate = loadSourceCandidate(benchmark, domain, sourceRank);
	const template = data.entries.find(
		(item) => item.id === sourceCandidate.source.templateId,
	);
	if (!template) {
		throw new Error(`template not found: ${sourceCandidate.source.templateId}`);
	}
	const entry = entryFromCandidate(
		sourceCandidate.candidate,
		data,
		template,
		splitPinyin,
	);
	const referenceEntry = data.entries.find((item) => item.id === "S005");
	const reference = summarizePolicy({
		entry: referenceEntry,
		data,
		words,
		strokes,
		mode,
		toneKeysByTone: "IVUAO",
		policy: referencePolicies[mode],
		motor,
		model,
		scorer,
	});
	if (global.gc) global.gc();
	const policyLimit = args["policy-limit"] ? Number(args["policy-limit"]) : 144;
	const requestedPolicy = args.policy ? parsePolicy(args.policy) : null;
	const progressEvery = Number(args["progress-every"] || 12);
	if (
		(!requestedPolicy &&
			(!Number.isInteger(policyLimit) ||
				policyLimit < 1 ||
				policyLimit > 144)) ||
		!Number.isInteger(progressEvery) ||
		progressEvery < 1
	) {
		throw new Error(
			"--policy-limit must be an integer from 1 to 144 and --progress-every must be positive",
		);
	}
	const optimized = optimizeMode({
		entry,
		data,
		words,
		strokes,
		mode,
		toneKeysByTone: entry.tone,
		reference,
		motor,
		model,
		scorer,
		policyLimit,
		requestedPolicy,
		progressEvery,
	});
	const endedAt = new Date();
	const result = {
		version: "ckt5-candidate-aux-order-optimize-1",
		domain,
		mode,
		sourceRank,
		candidateCount: sourceCandidate.candidateCount,
		layoutId: entry.id,
		stateKey: sourceCandidate.candidate.stateKey.toLowerCase(),
		candidate: {
			cktV4: sourceCandidate.candidate.cktV4,
			memory: sourceCandidate.candidate.memory,
			displacedInitials: sourceCandidate.candidate.displacedInitials,
			displacedVowels: sourceCandidate.candidate.displacedVowels,
			ergonomics:
				sourceCandidate.candidate.ergonomics ||
				(sourceCandidate.candidate.loads
					? {
							loads: sourceCandidate.candidate.loads,
							mxScore: sourceCandidate.candidate.mxScore,
						}
					: null),
		},
		contract: {
			pageSize: 6,
			trackWeights,
			referencePolicy: referencePolicies[mode],
			toneKeysByTone: entry.tone,
			semanticMapping: semanticMapping(mode, entry.tone),
			objective:
				"minimize the mode contribution to normalized CKT v5 after full character/word2/word3/word4 competition",
		},
		corpus: {
			character: reference.character.count,
			word2: words.word2.length,
			word3: words.word3.length,
			word4: words.word4.length,
		},
		startedAt: startedAt.toISOString(),
		endedAt: endedAt.toISOString(),
		elapsedSeconds: (endedAt - startedAt) / 1000,
		peakRssBytes: optimized.peakRssBytes,
		expectedPolicyCount: 144,
		resultCount: optimized.results.length,
		complete: !requestedPolicy && optimized.results.length === 144,
		reference,
		best: optimized.results[0],
		results: optimized.results,
	};
	if (args.output) atomicWrite(path.resolve(args.output), result);
	process.stdout.write(
		`${JSON.stringify({
			domain,
			mode,
			sourceRank,
			output: args.output ? path.resolve(args.output) : null,
			resultCount: result.resultCount,
			complete: result.complete,
			bestPolicy: result.best.policyKey,
			modeCktV5: result.best.modeCktV5,
			elapsedSeconds: result.elapsedSeconds,
			peakRssGiB: result.peakRssBytes / 1024 ** 3,
		})}\n`,
	);
}

main();
