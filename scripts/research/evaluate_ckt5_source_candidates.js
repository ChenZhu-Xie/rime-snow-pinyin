#!/usr/bin/env bun
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { buildRowsForOrder } = require("./evaluate_ckt_v4_word_aux_order.js");

function parseArgs(argv) {
	const result = {};
	for (let index = 0; index < argv.length; index++) {
		if (!argv[index].startsWith("--")) continue;
		result[argv[index].slice(2)] = argv[index + 1]?.startsWith("--")
			? true
			: argv[++index];
	}
	return result;
}

const args = parseArgs(process.argv.slice(2));
if (!args.benchmark) {
	throw new Error(
		"usage: --benchmark DIR (--db FILE | --git-object COMMIT:PATH) --domain 21x21|21x26 [--array PATH] [--limit N] [--offset N] [--threshold N]",
	);
}

const benchmark = path.resolve(args.benchmark);
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ[]\\;',./";
const { splitPinyin } = require(
	path.join(benchmark, "tools/ckt_v4_scheme_fixture.js"),
);
const scorer = require(
	path.join(benchmark, "tools/score_completion_ckt_v4.js"),
);
const model = require(path.join(benchmark, "tools/ckt_v4_model.js"));
const trackWeights = { character: 1, word2: 3, word3: 1, word4: 1 };

// These are the robust policies selected for the three current layout families.
// They are intentionally fixed during this source-frontier replay; this script
// does not re-optimize the 144 order combinations for every candidate layout.
const policies = {
	s005: {
		keytao: { word2: "12", word3: "21", word4: "24" },
		sanpin: { word2: "12", word3: "21", word4: "23" },
	},
	"21x21": {
		keytao: { word2: "12", word3: "23", word4: "24" },
		sanpin: { word2: "12", word3: "21", word4: "23" },
	},
	"21x26": {
		keytao: { word2: "12", word3: "21", word4: "14" },
		sanpin: { word2: "12", word3: "21", word4: "13" },
	},
};

function decodeState(state) {
	const bytes = Buffer.from(state);
	if (bytes.length !== 69) throw new Error(`bad state length ${bytes.length}`);
	return {
		capacity: [bytes[0], bytes[1]],
		headKeys: [...bytes.subarray(2, 29)],
		finalKeys: [...bytes.subarray(29, 64)],
		tone: [...bytes.subarray(64, 69)].map((index) => alphabet[index]).join(""),
	};
}

function entryFromState(row, data, template) {
	const state = decodeState(row.state_key);
	return {
		id: row.layout_id,
		name: row.layout_id,
		capacity: state.capacity,
		tone: state.tone,
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

function evaluateMode(context, entry, domain, mode) {
	const policy = policies[domain][mode];
	const characterRows = scorer
		.buildRows(entry, context.data, context.strokes, context.words, mode)
		.filter((row) => row.kind === "character");
	const wordRows = Object.entries(policy).flatMap(([kind, order]) =>
		buildRowsForOrder(
			entry,
			context.data,
			context.words,
			mode,
			entry.tone,
			kind,
			order,
			model,
		),
	);
	const outcomes = model.resolveCompetition([...characterRows, ...wordRows], {
		motorCost: context.motor,
	});
	const summary = model.summarizeOutcomes(outcomes, {
		...model.DEFAULT_COGNITIVE_PRIOR,
		pageSize: 6,
	});
	return Object.fromEntries(
		Object.keys(trackWeights).map((kind) => [
			kind,
			compactTrack(summary[kind]),
		]),
	);
}

function normalizedScore(modes, reference) {
	let sum = 0;
	let weightSum = 0;
	for (const mode of ["keytao", "sanpin"]) {
		for (const [kind, weight] of Object.entries(trackWeights)) {
			const ratio =
				modes[mode][kind].effectiveMs / reference[mode][kind].effectiveMs;
			sum += weight * ratio ** 4;
			weightSum += weight;
		}
	}
	return 10 * (sum / weightSum) ** 0.25;
}

function loadRowsFromGitObject() {
	const payload = JSON.parse(
		execFileSync("git", ["show", args["git-object"]], {
			cwd: benchmark,
			encoding: "utf8",
			maxBuffer: 32 * 1024 * 1024,
		}),
	);
	const selected = args.array
		? args.array.split(".").reduce((value, key) => value[key], payload)
		: payload;
	if (!Array.isArray(selected)) {
		throw new Error(
			"git object selection is not an array; pass --array with its dotted field path",
		);
	}
	const archiveByState = new Map(
		selected.map((item) => [item.stateKey.toLowerCase(), item]),
	);
	const threshold = Number(args.threshold ?? Number.POSITIVE_INFINITY);
	const offset = Number(args.offset ?? 0);
	const limit = Number(args.limit ?? Number.MAX_SAFE_INTEGER);
	const rows = selected
		.filter(
			(item) =>
				item.cktV4 < threshold &&
				(args.domain === "21x21"
					? item.memory <= 43 && item.displacedInitials === 0
					: item.displacedInitials === 1),
		)
		.slice(offset, offset + limit)
		.map((item) => ({
			state_key: Buffer.from(item.stateKey, "hex"),
			layout_id: item.candidateId || item.layoutId,
			ckt_v4: item.cktV4,
			memory: item.memory,
			displaced_initials: item.displacedInitials,
			displaced_vowels: item.displacedVowels,
			ergonomics_json: JSON.stringify(
				item.ergonomics ||
					(item.loads ? { loads: item.loads, mxScore: item.mxScore } : null),
			),
		}));
	return { rows, archiveByState };
}

function loadRowsFromDatabase() {
	const { Database } = require("bun:sqlite");
	const predicate =
		args.domain === "21x21"
			? "memory <= 43 AND displaced_initials = 0"
			: "displaced_initials = 1";
	const threshold = Number(args.threshold ?? Number.POSITIVE_INFINITY);
	const limit = Number(args.limit ?? Number.MAX_SAFE_INTEGER);
	const database = new Database(path.resolve(args.db), { readonly: true });
	const rows = database
		.query(
			`SELECT state_key, layout_id, ckt_v4, memory, displaced_initials, displaced_vowels, ergonomics_json
			 FROM states WHERE ${predicate} AND ckt_v4 < ? ORDER BY ckt_v4, state_key LIMIT ?`,
		)
		.all(threshold, limit);
	return { rows, archiveByState: new Map() };
}

function main() {
	if ((!args.db && !args["git-object"]) || !policies[args.domain]) {
		throw new Error(
			"usage: --benchmark DIR (--db FILE | --git-object COMMIT:PATH) --domain 21x21|21x26 [--array PATH] [--limit N] [--offset N] [--threshold N]",
		);
	}
	const repo = path.resolve(__dirname, "..", "..");
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
	const context = { data, strokes, words, motor };
	const referenceEntry = data.entries.find((entry) => entry.id === "S005");
	const reference = {
		keytao: evaluateMode(context, referenceEntry, "s005", "keytao"),
		sanpin: evaluateMode(context, referenceEntry, "s005", "sanpin"),
	};
	const { rows, archiveByState } = args["git-object"]
		? loadRowsFromGitObject()
		: loadRowsFromDatabase();
	const offset = Number(args.offset ?? 0);
	const results = [];
	for (let index = 0; index < rows.length; index++) {
		const row = rows[index];
		const stateKey = Buffer.from(row.state_key).toString("hex");
		const archive = archiveByState.get(stateKey);
		const template = data.entries.find((candidate) =>
			args.domain === "21x21"
				? candidate.id === "gen0107-p5-f1h-11_13-d2-f25_26-d3-f4_22-d4-f11_13"
				: candidate.id === "SNOW-SHENYUN-21X26-PRODUCTION",
		);
		const entry = entryFromState(row, data, template);
		const modes = {
			keytao: evaluateMode(context, entry, args.domain, "keytao"),
			sanpin: evaluateMode(context, entry, args.domain, "sanpin"),
		};
		results.push({
			sourceRank: archive?.rank ?? index + offset + 1,
			stateKey,
			layoutId: row.layout_id,
			cktV4: row.ckt_v4,
			cktV5: normalizedScore(modes, reference),
			memory: row.memory,
			displacedInitials: row.displaced_initials,
			displacedVowels: row.displaced_vowels,
			ergonomics: row.ergonomics_json ? JSON.parse(row.ergonomics_json) : null,
			archive,
			modes,
		});
		if ((index + 1) % 10 === 0 || index + 1 === rows.length) {
			process.stderr.write(`${index + 1}/${rows.length}\n`);
		}
	}
	process.stdout.write(
		`${JSON.stringify(
			{
				domain: args.domain,
				auxOrderScope:
					"fixed by layout family and mode; not re-optimized per candidate layout",
				policies: {
					reference: policies.s005,
					candidate: policies[args.domain],
				},
				results,
			},
			null,
			2,
		)}\n`,
	);
}

main();
