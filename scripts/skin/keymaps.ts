import type { KeyboardCollection } from "./types";

export const keymapSchemes = [
	["snow_sipin", "冰雪四拼"],
	["snow_sanpin", "冰雪弎拼"],
	["snow_jiandao", "冰雪健道"],
	["snow_shenyun_shape", "冰雪简道"],
	["snow_shenyun_tone", "冰雪散拼"],
	["snow_jiandao_classic", "冰雪键道"],
	["snow_sanpin_classic", "冰雪三拼"],
] as const;

export function withKeymaps(keyboards: KeyboardCollection): KeyboardCollection {
	return {
		...keyboards,
		keymaps: {
			colorful: false,
			label: true,
			keyInfos: [
				keymapSchemes.slice(0, 4).map(([id, name]) => ({
					action: `!keymap_${id}`,
					label: name,
				})),
				keymapSchemes.slice(4).map(([id, name]) => ({
					action: `!keymap_${id}`,
					label: name,
				})),
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
								hold: "!pinyin",
							},
						],
					],
				},
			]),
		),
	};
}
