import {
	KEYMAP_LINK_COLOR_CONTRACT,
	keymapLinkColorDistance,
	resolveKeymapLinkColors,
	validateKeymapLinkContrast,
	type KeymapLinkColorContract,
	type KeymapLinkState,
	type ZeroCarrier,
} from "../vendor/keymap-link-colors.js";

const letterKeys = [..."QWERTYUIOPASDFGHJKLZXCVBNM"];
const zeroCarriers = ["W", "Y"] as const;

export function buildKeymapLinkState(
	initialMap: Record<string, string>,
): KeymapLinkState {
	const traditionalInitials = KEYMAP_LINK_COLOR_CONTRACT.traditionalInitials;
	const semantics = Object.fromEntries(
		letterKeys.map((key) => [key, { roles: [] as string[] }]),
	);
	const ordinaryTargets: Record<string, string[]> = {};
	const ordinaryMoved: Record<string, boolean> = {};
	for (const initial of traditionalInitials) {
		const target = initialMap[initial]?.toUpperCase();
		const targets = target ? [target] : [];
		ordinaryTargets[initial] = targets;
		ordinaryMoved[initial] =
			targets.length > 0 && !targets.includes(initial.toUpperCase());
		if (target && semantics[target]) semantics[target].roles.push(initial);
	}

	const zeroTargets = {} as Record<ZeroCarrier, string[]>;
	const zeroMoved = {} as Record<ZeroCarrier, boolean>;
	for (const carrier of zeroCarriers) {
		const target = (
			initialMap[carrier] ?? initialMap[carrier.toLowerCase()]
		)?.toUpperCase();
		const targets = target ? [target] : [];
		zeroTargets[carrier] = targets;
		zeroMoved[carrier] = targets.length > 0 && !targets.includes(carrier);
		if (target && semantics[target])
			semantics[target].roles.push(`Ø${carrier}`);
	}

	return {
		letterKeys,
		semantics,
		ordinaryTargets,
		ordinaryMoved,
		zeroTargets,
		zeroMoved,
		isDirectOnset: (key, role) =>
			KEYMAP_LINK_COLOR_CONTRACT.traditionalInitials.has(role.toLowerCase()) &&
			key.toLowerCase() === role.toLowerCase(),
	};
}

export function resolveMappingLinkColors(initialMap: Record<string, string>) {
	const state = buildKeymapLinkState(initialMap);
	const colors = resolveKeymapLinkColors(state);
	validateKeymapLinkContrast(state, colors);
	return { state, colors };
}

export {
	KEYMAP_LINK_COLOR_CONTRACT,
	keymapLinkColorDistance,
	resolveKeymapLinkColors,
	validateKeymapLinkContrast,
};
export type { KeymapLinkColorContract, KeymapLinkState };
