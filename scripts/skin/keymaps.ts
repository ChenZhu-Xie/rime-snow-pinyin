import type { KeyboardCollection } from "./types";

const jiandaoKeys = [
	["snow_jiandao_classic", "键道"],
	["snow_jiandao", "健道"],
	["snow_jiandao_toned", "剑道"],
	["snow_shenyun_shape", "简道"],
] as const;

const sanpinKeys = [
	["snow_sanpin_classic", "三拼"],
	["snow_sanpin", "弎拼"],
	["snow_shenyun_tone", "散拼"],
] as const;

export const keymapSchemes = [
	["snow_sipin", "四拼"],
	...jiandaoKeys,
	["snow_jiandao_first", "健初"],
	["snow_shenyun_shape_first", "简初"],
	...sanpinKeys,
	["snow_sanpin_first", "弎初"],
	["snow_shenyun_tone_first", "散初"],
] as const;

export function withKeymaps(keyboards: KeyboardCollection): KeyboardCollection {
	return {
		...keyboards,
		keymaps: {
			colorful: false,
			label: true,
			keyInfos: [
				[
					{ action: "!keymap_snow_sipin", label: "四拼" },
					{ action: "!pinyin", label: "返回" },
				],
				[
					...jiandaoKeys.map(([id, name]) => ({
						action: `!keymap_${id}`,
						label: name,
					})),
					{
						action: "!keymap_snow_jiandao_first",
						stack: [
							{ action: "!keymap_snow_jiandao_first", label: "健初" },
							{ action: "!keymap_snow_shenyun_shape_first", label: "简初" },
						],
					},
				],
				[
					...sanpinKeys.map(([id, name]) => ({
						action: `!keymap_${id}`,
						label: name,
					})),
					{
						action: "!keymap_snow_sanpin_first",
						stack: [
							{ action: "!keymap_snow_sanpin_first", label: "弎初" },
							{ action: "!keymap_snow_shenyun_tone_first", label: "散初" },
						],
					},
				],
			],
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
