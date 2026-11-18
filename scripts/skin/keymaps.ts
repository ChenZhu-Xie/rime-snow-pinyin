import type { KeyboardCollection } from "./types";

const keymapRows = [
	[
		["snow_sipin", "四拼"],
		["snow_jiandao_toned", "莲道"],
		["snow_zhudao", "鹮道"],
	],
	[
		["snow_jiandao_classic", "键道"],
		["snow_jiandao", "兰道"],
		["snow_shenyun_shape", "鹤道"],
	],
	[
		["snow_sanpin_classic", "三拼"],
		["snow_sanpin", "兰拼"],
		["snow_shenyun_tone", "鹤拼"],
	],
] as const;

export const keymapSchemes = keymapRows.flat();

export function withKeymaps(keyboards: KeyboardCollection): KeyboardCollection {
	return {
		...keyboards,
		keymaps: {
			colorful: false,
			label: true,
			keyInfos: keymapRows.map((row) =>
				row.map(([id, name]) => ({
					action: `!keymap_${id}`,
					label: name,
					width: "1/3",
				})),
			),
		},
		...Object.fromEntries(
			keymapSchemes.map(([id]) => [
				`keymap_${id}`,
				{
					colorful: false,
					label: false,
					keyInfos: [
						[
							{
								action: "#空操作",
								name: `${id}_image`,
								image: id,
								up: "!pinyin",
								hold: "#空操作",
							},
						],
					],
				},
			]),
		),
	};
}
