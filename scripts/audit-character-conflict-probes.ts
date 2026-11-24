/** 离线核对新采集：不把旧缓存、不完整前缀或尾段候选当作真实首选。 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	observedMinimum,
	type CharacterObservation,
} from "./lib/character-observed-choice";
import { writeOutput } from "./lib/paths";

const directory = resolve(
	process.argv[2] ?? "output/character-conflict-probes",
);
const input = JSON.parse(
	readFileSync(join(directory, "input.json"), "utf8"),
) as {
	schemas: Record<
		string,
		{
			codes: string[];
			targets: Record<
				string,
				{
					routes: string[];
					previousMinimum: string;
					userCode?: string;
					rank: number;
				}
			>;
		}
	>;
};
const manifest = JSON.parse(
	readFileSync(join(directory, "results/manifest.json"), "utf8"),
);
const rows = readFileSync(join(directory, "results/observations.jsonl"), "utf8")
	.trim()
	.split("\n")
	.map(
		(line) =>
			JSON.parse(line) as CharacterObservation & {
				schema: string;
				variant: string;
			},
	);
const results = [];
for (const [schema, entry] of Object.entries(input.schemas)) {
	const records = new Map<string, CharacterObservation>();
	for (const row of rows)
		if (row.schema === schema && row.variant === "default") {
			assert.ok(!records.has(row.code), `重复观测：${schema}/${row.code}`);
			records.set(row.code, row);
		}
	const expected = manifest.probes.find(
		(item: { schema: string; variant: string }) =>
			item.schema === schema && item.variant === "default",
	);
	assert.ok(expected, `缺少清单：${schema}`);
	assert.equal(records.size, expected.codes.length, `缺少观测：${schema}`);
	for (const code of expected.codes)
		assert.ok(records.has(code), `${schema}/${code}`);
	const targets = Object.entries(entry.targets).map(([text, target]) => {
		const choice = observedMinimum(text, target.routes, records);
		const old =
			target.previousMinimum === "NA"
				? undefined
				: observedMinimum(text, [target.previousMinimum], records);
		const user = target.userCode
			? observedMinimum(text, [target.userCode], records)
			: undefined;
		return {
			text,
			rank: target.rank,
			previousMinimum: target.previousMinimum,
			choice: choice ?? null,
			previousCodeActuallyFirst: old?.code === target.previousMinimum,
			userCode: target.userCode,
			userRouteChoice: user ?? null,
		};
	});
	const summary = {
		schema,
		targets: targets.length,
		found: targets.filter((t) => t.choice).length,
		missing: targets.filter((t) => !t.choice).length,
		changed: targets.filter(
			(t) => (t.choice?.code ?? "NA") !== t.previousMinimum,
		).length,
		invalidOld: targets.filter(
			(t) => t.previousMinimum !== "NA" && !t.previousCodeActuallyFirst,
		).length,
	};
	console.log(JSON.stringify(summary));
	results.push({ ...summary, characters: targets });
}
writeOutput(
	join(directory, "audit.json"),
	JSON.stringify(
		{
			contract: "character-first-choice-real-probe-audit-v1",
			revision: manifest.revision,
			runtime: manifest.runtime,
			sources: manifest.sources,
			results,
		},
		null,
		2,
	) + "\n",
);
