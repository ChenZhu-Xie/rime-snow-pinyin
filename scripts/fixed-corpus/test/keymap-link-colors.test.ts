import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
	KEYMAP_LINK_COLOR_CONTRACT,
	keymapLinkColorDistance,
	resolveMappingLinkColors,
} from "../../lib/keymap-link-colors";

const root = join(import.meta.dirname, "..", "..", "..");

test("D3/V1 keeps the shared core preferred link colors", () => {
	const mapping = JSON.parse(
		readFileSync(join(root, "config", "shenyun-21x26-mapping.json"), "utf8"),
	) as { initialMap: Record<string, string> };
	const { state, colors } = resolveMappingLinkColors(mapping.initialMap);
	assert.deepEqual(
		Object.fromEntries(
			["q", "s", "x"].map((initial) => [
				initial,
				colors.initialLinkInk[initial],
			]),
		),
		{ q: "#e83e8c", s: "#00a651", x: "#005bd8" },
	);
	assert.equal(colors.zeroLinkStyle.W.ink, "#3e98b0");
	assert.equal(colors.zeroLinkStyle.Y.ink, "#b67747");
	assert.equal(state.ordinaryTargets.q[0], "F");
	assert.equal(state.zeroTargets.W[0], "J");
});

test("the Mapping adapter lets the shared solver change conflicting preferred colors", () => {
	const { state, colors } = resolveMappingLinkColors({ f: "K", k: "F" });
	const f = colors.initialLinkInk.f;
	const k = colors.initialLinkInk.k;
	assert.ok(keymapLinkColorDistance(f, k) >= colors.minimumDistance);
	assert.notEqual(f, k);
	assert.ok(
		f !== KEYMAP_LINK_COLOR_CONTRACT.initialLinkInk.f ||
			k !== KEYMAP_LINK_COLOR_CONTRACT.initialLinkInk.k,
	);
	assert.deepEqual(state.ordinaryTargets, {
		b: [],
		p: [],
		m: [],
		f: ["K"],
		d: [],
		t: [],
		n: [],
		l: [],
		g: [],
		k: ["F"],
		h: [],
		j: [],
		q: [],
		x: [],
		r: [],
		z: [],
		c: [],
		s: [],
	});
});
