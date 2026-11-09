export type ZeroCarrier = "W" | "Y";

export type KeymapLinkStyle = {
	ink: string;
	fill?: string;
	stroke?: string;
};

export type KeymapLinkState = {
	letterKeys: string[];
	semantics: Record<string, { roles: string[] }>;
	ordinaryTargets: Record<string, string[]>;
	ordinaryMoved: Record<string, boolean>;
	zeroTargets: Record<ZeroCarrier, string[]>;
	zeroMoved: Record<ZeroCarrier, boolean>;
	isDirectOnset: (key: string, role: string) => boolean;
};

export type KeymapLinkColorContract = {
	traditionalInitials: Set<string>;
	minimumDistance: number;
	defaultKeycapInk: string;
	defaultInitialInk: string;
	defaultZeroInitialInk: string;
	initialLinkInk: Record<string, string>;
	zeroLinkStyle: Record<ZeroCarrier, KeymapLinkStyle>;
	ordinaryCandidates: readonly string[];
	zeroCandidates: readonly KeymapLinkStyle[];
};

export const DEFAULT_INITIAL_INK: string;
export const DEFAULT_KEYCAP_INK: string;
export const DEFAULT_ZERO_INITIAL_INK: string;
export const INITIAL_LINK_INK: Readonly<Record<string, string>>;
export const KEYMAP_LINK_COLOR_CONTRACT: KeymapLinkColorContract;
export const MINIMUM_OKLAB_DISTANCE: number;
export const ORDINARY_LINK_CANDIDATES: readonly string[];
export const TRADITIONAL_INITIALS: string;
export const ZERO_LINK_CANDIDATES: readonly KeymapLinkStyle[];
export const ZERO_LINK_STYLE: Readonly<Record<ZeroCarrier, KeymapLinkStyle>>;

export function keymapLinkColorDistance(left: string, right: string): number;
export function keymapLinkLegendHtml(
	contract?: KeymapLinkColorContract,
): string;
export function keymapLinkOklab(hex: string): [number, number, number];
export function resolveKeymapLinkColors(
	state: KeymapLinkState,
	contract?: KeymapLinkColorContract,
): KeymapLinkColorContract;
export function validateKeymapLinkContrast(
	state: KeymapLinkState,
	contract?: KeymapLinkColorContract,
): void;
