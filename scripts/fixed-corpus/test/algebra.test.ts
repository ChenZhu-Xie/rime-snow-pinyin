import assert from "node:assert/strict";
import test from "node:test";
import { applyAlgebra, parseAlgebraRules } from "../algebra";

test("algebra applies ordered xform, xlit, and erase rules", () => {
	const rules = parseAlgebraRules(
		[
			"sanpin_algebra:",
			"  - erase/^ng\\d$/",
			"  - xform/^zh/E/",
			"  - xform/ang(?=\\d)/Q/",
			"  - xlit/EQ12345/eqivuao/",
		].join("\n"),
		"sanpin_algebra",
	);

	assert.deepEqual(applyAlgebra("zhang1", rules), {
		canonical: "eqi",
		accepted: ["eqi"],
	});
	assert.deepEqual(applyAlgebra("ng2", rules), {
		canonical: null,
		accepted: [],
	});
});

test("derive retains its source branch while canonical follows the main path", () => {
	const rules = parseAlgebraRules(
		[
			"sanpin_algebra:",
			"  - derive/uang(?=\\d)/M/",
			"  - xform/[iu]ang(?=\\d)/X/",
			"  - xlit/MX12345/mxivuao/",
		].join("\n"),
		"sanpin_algebra",
	);

	assert.deepEqual(applyAlgebra("huang4", rules), {
		canonical: "hxa",
		accepted: ["hxa", "hma"],
	});
});

test("derive branches continue through later transformations and deduplicate stably", () => {
	const rules = parseAlgebraRules(
		[
			"algebra:",
			"  - derive/^zh(?=ao\\d)/Q/",
			"  - xform/^zh/f/",
			"  - xform/ao(?=\\d)/z/",
			"  - xlit/Q12345/qivuao/",
		].join("\n"),
		"algebra",
	);

	assert.deepEqual(applyAlgebra("zhao3", rules), {
		canonical: "fzu",
		accepted: ["fzu", "qzu"],
	});
});
