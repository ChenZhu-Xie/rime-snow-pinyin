#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const domains = Object.freeze({
	"21x21": { candidateCount: 6, baselineRank: 4 },
	"21x26": { candidateCount: 50, baselineRank: 17 },
});
const modeNames = ["keytao", "sanpin"];

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

function readJson(file) {
	return JSON.parse(fs.readFileSync(file, "utf8"));
}

function modeFile(outputDir, domain, sourceRank, mode) {
	return path.join(
		outputDir,
		"modes",
		`${domain}-r${String(sourceRank).padStart(3, "0")}-${mode}.json`,
	);
}

function pairFile(outputDir, domain, sourceRank) {
	return path.join(
		outputDir,
		"pairs",
		`${domain}-r${String(sourceRank).padStart(3, "0")}.json`,
	);
}

function usableResult(file, targetPolicyCount) {
	if (!fs.existsSync(file)) return false;
	try {
		const result = readJson(file);
		return (
			result.resultCount === targetPolicyCount &&
			(targetPolicyCount < 144 || result.complete === true)
		);
	} catch {
		return false;
	}
}

function runWorker(worker, workerArgs, heapMib) {
	return new Promise((resolve, reject) => {
		const child = spawn(
			process.execPath,
			["--expose-gc", `--max-old-space-size=${heapMib}`, worker, ...workerArgs],
			{ stdio: ["ignore", "pipe", "inherit"], windowsHide: true },
		);
		let stdout = "";
		child.stdout.on("data", (chunk) => {
			stdout += chunk;
		});
		child.on("error", reject);
		child.on("exit", (code, signal) => {
			if (code !== 0) {
				reject(
					new Error(
						`worker failed with code=${code} signal=${signal || "none"}`,
					),
				);
				return;
			}
			const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
			try {
				resolve(JSON.parse(lines.at(-1)));
			} catch {
				reject(new Error(`worker returned invalid JSON: ${stdout}`));
			}
		});
	});
}

function combinePair(outputDir, domain, sourceRank, targetPolicyCount) {
	const modeResults = Object.fromEntries(
		modeNames.map((mode) => [
			mode,
			readJson(modeFile(outputDir, domain, sourceRank, mode)),
		]),
	);
	const powerSum = modeNames.reduce(
		(sum, mode) => sum + modeResults[mode].best.powerSum,
		0,
	);
	const pair = {
		version: "ckt5-nested-source-frontier-pair-1",
		domain,
		sourceRank,
		layoutId: modeResults.keytao.layoutId,
		stateKey: modeResults.keytao.stateKey,
		candidate: modeResults.keytao.candidate,
		policyCountPerMode: targetPolicyCount,
		complete: modeNames.every(
			(mode) => modeResults[mode].complete && targetPolicyCount === 144,
		),
		bestPolicies: Object.fromEntries(
			modeNames.map((mode) => [mode, modeResults[mode].best.policy]),
		),
		modeCktV5: Object.fromEntries(
			modeNames.map((mode) => [mode, modeResults[mode].best.modeCktV5]),
		),
		powerSum,
		cktV5: 10 * (powerSum / 12) ** 0.25,
		elapsedSeconds: modeNames.reduce(
			(sum, mode) => sum + modeResults[mode].elapsedSeconds,
			0,
		),
		peakRssBytes: Math.max(
			...modeNames.map((mode) => modeResults[mode].peakRssBytes),
		),
	};
	atomicWrite(pairFile(outputDir, domain, sourceRank), pair);
	return pair;
}

function updateSummary(outputDir) {
	const pairsDir = path.join(outputDir, "pairs");
	const pairs = fs.existsSync(pairsDir)
		? fs
				.readdirSync(pairsDir)
				.filter((name) => name.endsWith(".json"))
				.map((name) => readJson(path.join(pairsDir, name)))
		: [];
	const grouped = {};
	for (const domain of Object.keys(domains)) {
		const values = pairs
			.filter((pair) => pair.domain === domain)
			.sort((left, right) => left.sourceRank - right.sourceRank);
		const baseline = values.find(
			(pair) => pair.sourceRank === domains[domain].baselineRank,
		);
		grouped[domain] = values.map((pair) => ({
			...pair,
			deltaVsBaseline: baseline ? pair.cktV5 - baseline.cktV5 : null,
			relativePctVsBaseline: baseline
				? (100 * (pair.cktV5 - baseline.cktV5)) / baseline.cktV5
				: null,
		}));
	}
	const summary = {
		version: "ckt5-nested-source-frontier-summary-1",
		updatedAt: new Date().toISOString(),
		baselines: {
			"21x21": "source rank 4, U357",
			"21x26": "source rank 17, Overall-17",
		},
		domains: grouped,
	};
	atomicWrite(path.join(outputDir, "summary.json"), summary);
	return summary;
}

function selectedDomains(value) {
	if (!value || value === "all") return Object.keys(domains);
	if (!Object.hasOwn(domains, value)) {
		throw new Error(`unknown domain: ${value}`);
	}
	return [value];
}

function selectedModes(value) {
	const modes = value ? String(value).split(",").filter(Boolean) : modeNames;
	for (const mode of modes) {
		if (!modeNames.includes(mode)) throw new Error(`unknown mode: ${mode}`);
	}
	return modes;
}

function makePlan(args) {
	const startRank = Number(args["start-rank"] || 1);
	const endRank = args["end-rank"]
		? Number(args["end-rank"])
		: Number.POSITIVE_INFINITY;
	const maxLayouts = args["max-layouts"]
		? Number(args["max-layouts"])
		: Number.POSITIVE_INFINITY;
	const plan = [];
	for (const domain of selectedDomains(args.domain)) {
		for (
			let sourceRank = startRank;
			sourceRank <= Math.min(endRank, domains[domain].candidateCount);
			sourceRank++
		) {
			plan.push({ domain, sourceRank });
		}
	}
	return plan.slice(0, maxLayouts);
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (!args.benchmark) {
		throw new Error(
			"usage: --benchmark DIR [--domain all|21x21|21x26] [--output-dir DIR] [--max-layouts N] [--policy-limit N]",
		);
	}
	const repo = path.resolve(__dirname, "..", "..");
	const benchmark = path.resolve(args.benchmark);
	const worker = path.join(__dirname, "optimize_ckt5_candidate_aux_order.js");
	const outputDir = path.resolve(
		args["output-dir"] || path.join(repo, "output", "ckt5-nested-frontier"),
	);
	const heapMib = Number(args["heap-mib"] || 4096);
	const minFreeGiB = Number(args["min-free-gib"] || 8);
	const policyLimit = args["policy-limit"]
		? Math.min(144, Number(args["policy-limit"]))
		: 144;
	const progressEvery = Number(args["progress-every"] || 12);
	const modes = selectedModes(args.modes);
	const plan = makePlan(args);
	if (
		!Number.isInteger(heapMib) ||
		heapMib < 1024 ||
		!Number.isFinite(minFreeGiB) ||
		minFreeGiB < 0 ||
		!Number.isInteger(policyLimit) ||
		policyLimit < 1 ||
		!Number.isInteger(progressEvery) ||
		progressEvery < 1
	) {
		throw new Error(
			"invalid resource or policy limits: heap must be >=1024 MiB; policy/progress limits must be positive integers",
		);
	}
	const manifestFile = path.join(outputDir, "manifest.json");
	const manifest = fs.existsSync(manifestFile)
		? readJson(manifestFile)
		: {
				version: "ckt5-nested-source-frontier-run-1",
				createdAt: new Date().toISOString(),
				completedModes: [],
				failures: [],
			};
	manifest.configuration = {
		benchmark,
		outputDir,
		heapMib,
		minFreeGiB,
		policyLimit,
		modes,
		plan,
	};
	manifest.updatedAt = new Date().toISOString();
	atomicWrite(manifestFile, manifest);
	process.stdout.write(
		`plan layouts=${plan.length} modes=${modes.length} policyLimit=${policyLimit} output=${outputDir}\n`,
	);
	if (args["dry-run"]) return;

	for (const item of plan) {
		for (const mode of modes) {
			const outputFile = modeFile(
				outputDir,
				item.domain,
				item.sourceRank,
				mode,
			);
			if (!args.force && usableResult(outputFile, policyLimit)) {
				process.stdout.write(
					`skip domain=${item.domain} rank=${item.sourceRank} mode=${mode}\n`,
				);
				continue;
			}
			const freeGiB = os.freemem() / 1024 ** 3;
			if (freeGiB < minFreeGiB) {
				throw new Error(
					`free physical memory ${freeGiB.toFixed(2)} GiB is below --min-free-gib ${minFreeGiB}; stop safely and resume later`,
				);
			}
			process.stdout.write(
				`start domain=${item.domain} rank=${item.sourceRank} mode=${mode} freeGiB=${freeGiB.toFixed(2)}\n`,
			);
			try {
				const workerArgs = [
					"--benchmark",
					benchmark,
					"--domain",
					item.domain,
					"--source-rank",
					String(item.sourceRank),
					"--mode",
					mode,
					"--output",
					outputFile,
					"--progress-every",
					String(progressEvery),
				];
				if (policyLimit < 144) {
					workerArgs.push("--policy-limit", String(policyLimit));
				}
				const workerSummary = await runWorker(worker, workerArgs, heapMib);
				manifest.completedModes.push({
					...item,
					mode,
					completedAt: new Date().toISOString(),
					...workerSummary,
				});
				manifest.updatedAt = new Date().toISOString();
				atomicWrite(manifestFile, manifest);
				process.stdout.write(
					`done domain=${item.domain} rank=${item.sourceRank} mode=${mode} best=${workerSummary.bestPolicy} seconds=${workerSummary.elapsedSeconds.toFixed(1)} peakRssGiB=${workerSummary.peakRssGiB.toFixed(3)}\n`,
				);
			} catch (error) {
				manifest.failures.push({
					...item,
					mode,
					failedAt: new Date().toISOString(),
					message: error.message,
				});
				manifest.updatedAt = new Date().toISOString();
				atomicWrite(manifestFile, manifest);
				throw error;
			}
		}
		if (
			modeNames.every((mode) =>
				usableResult(
					modeFile(outputDir, item.domain, item.sourceRank, mode),
					policyLimit,
				),
			)
		) {
			const pair = combinePair(
				outputDir,
				item.domain,
				item.sourceRank,
				policyLimit,
			);
			process.stdout.write(
				`pair domain=${item.domain} rank=${item.sourceRank} cktV5=${pair.cktV5.toFixed(9)} complete=${pair.complete}\n`,
			);
			updateSummary(outputDir);
		}
	}
	updateSummary(outputDir);
}

main().catch((error) => {
	process.stderr.write(`${error.stack || error.message}\n`);
	process.exitCode = 1;
});
