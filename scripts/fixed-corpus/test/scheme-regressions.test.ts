import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("Three-Code and KeyTao share the Four-Code 23890 selection layout", () => {
	for (const schema of [
		"snow_sanpin.schema.yaml",
		"snow_jiandao.schema.yaml",
	]) {
		assert.match(read(schema), /menu\/alternative_select_keys: "_23890"/u);
	}
	const history = read("lua/snow/history.lua");
	assert.doesNotMatch(history, /char == "[456]"/u);
	for (const key of ["2", "3", "8", "9", "0"])
		assert.match(history, new RegExp(`char == "${key}"`, "u"));
});

test("Three-Code uses v, not e, for the horizontal-stroke assist code", () => {
	const filter = read("lua/snow/shape_filter.lua");
	assert.match(
		filter,
		/elseif id == "snow_sanpin"[\s\S]+stroke_match\(text, shape_input, env, "v"\)/u,
	);
	assert.equal("hshh".replaceAll("h", "v").replaceAll("s", "i"), "vivv");
});

test("default traditional source entries are postponed before conversion and deduplication", () => {
	assert.match(read("lua/snow/simplified.lua"), /Opencc\("t2s\.json"\)/u);
	assert.match(
		read("lua/snow/simplified.lua"),
		/table\.insert\(postponed, candidate\)/u,
	);
	for (const schema of [
		"snow_sanpin.schema.yaml",
		"snow_jiandao.schema.yaml",
	]) {
		const source = read(schema);
		const filter = source.indexOf("lua_filter@*snow.simplified");
		const simplifier = source.indexOf("    - simplifier", filter);
		const uniquifier = source.indexOf("    - uniquifier", simplifier);
		assert.ok(filter >= 0 && simplifier > filter && uniquifier > simplifier);
	}
});

test("reported phrase codes follow the frozen Shenyun mapping", () => {
	const fixture = JSON.parse(read("docs/shenyun-v1-mapping.json")) as {
		codes: Record<string, string>;
	};
	assert.equal(fixture.codes.na + fixture.codes.yang, "nnfq");
	assert.notEqual(fixture.codes.na + fixture.codes.yang, "nnff");
});

test("KeyTao keeps the legacy two-position jump on Ctrl+P", () => {
	assert.match(
		read("snow_jiandao.schema.yaml"),
		/\{ when: composing, accept: "Control\+p", send_sequence: "\{Home\}\{Right\}\{Right\}" \}/u,
	);
});
