import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { SpellingAlgebra } from "./algebra";
import { rootPath } from "./paths";

export interface ShenyunHint {
	code: string;
	text: string;
	weight: number;
}

const dictionaryFiles = [
	"snow_pinyin.dict.yaml",
	"snow_pinyin.base.dict.yaml",
	"snow_pinyin.ext.dict.yaml",
	"snow_pinyin.tencent.dict.yaml",
	"snow_pinyin.user.dict.yaml",
];

const schemes = ["snow_hedao", "snow_hepin"] as const;

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

export function readShenyunHints(zhudao = false) {
	const common = load(
		readFileSync(rootPath("snow_shenyun_common.yaml"), "utf8"),
	) as {
		translator: { shenyun_initial_keys: string; shenyun_final_keys: string };
	};
	const initialKeys = common.translator.shenyun_initial_keys;
	const finalKeys = common.translator.shenyun_final_keys;
	const algebra = new SpellingAlgebra(
		rootPath(zhudao ? "snow_huandao.schema.yaml" : "snow_shenyun_common.yaml"),
		"shenyun_algebra",
		{ derive: false },
	);
	const fallbackSource = readFileSync(rootPath("lua/snow/vacancy.lua"), "utf8");
	const fallbacks = new Set(
		[
			...fallbackSource.matchAll(/^\s+(?:\["([^"]+)"\]|([a-z]+)) = true,$/gmu),
		].map((match) => match[1] ?? match[2]),
	);
	const encoded = new Map<string, string>();
	const encode = (syllable: string): string => {
		let code = encoded.get(syllable);
		if (code === undefined) {
			code = algebra.apply(syllable);
			encoded.set(syllable, code);
		}
		return code;
	};
	const occupied = new Set<string>();
	const characters = new Map<string, ShenyunHint>();
	const words = new Map<string, Map<string, number>>();
	for (const file of dictionaryFiles) {
		for (const line of readFileSync(rootPath(file), "utf8").split(/\r?\n/u)) {
			if (line.startsWith("#") || !line.includes("\t")) continue;
			const [text, spelling, rawWeight] = line.split("\t");
			if (!/^[\p{Script=Han}]{1,2}$/u.test(text) || !spelling) continue;
			const weight = Number(rawWeight) || 0;
			const syllables = spelling.split(" ");
			const codes = syllables.map(encode);
			if (codes.some((code) => !/^[a-z]{2}$/u.test(code))) continue;
			if ([...text].length === 1 && codes.length === 1) {
				const code = codes[0];
				if (!fallbacks.has(syllables[0].replace(/[0-9]$/u, ""))) {
					occupied.add(code);
				}
				const key = code[0] + text;
				if (weight > (characters.get(key)?.weight ?? -1)) {
					characters.set(key, { code, text, weight });
				}
			} else if ([...text].length === 2 && codes.length === 2) {
				if (/[的了是]$/u.test(text)) continue;
				const code = codes.map((part) => part[0]).join("");
				const bucket = words.get(code) ?? new Map<string, number>();
				bucket.set(text, Math.max(bucket.get(text) ?? 0, weight));
				words.set(code, bucket);
			}
		}
	}
	const vacant = [...initialKeys]
		.flatMap((first) => [...finalKeys].map((second) => first + second))
		.filter((code) => !occupied.has(code));
	const vacantAA = vacant.filter((code) => initialKeys.includes(code[1]));
	const hints: Record<string, ShenyunHint[]> = {};
	for (const schema of zhudao ? ["snow_huandao"] : schemes) {
		const fixed = new Map(
			readFileSync(rootPath(`${schema}.fixed.txt`), "utf8")
				.split(/\r?\n/u)
				.filter((line) => !line.startsWith("#") && line.includes("\t"))
				.map((line) => {
					const [code, value] = line.split("\t");
					return [code, value.split(" ")[0]] as const;
				}),
		);
		hints[schema] = vacantAA.flatMap((code) => {
			const candidates = [...(words.get(code) ?? [])].sort(
				(left, right) => right[1] - left[1] || compareText(left[0], right[0]),
			);
			const text = fixed.get(code) ?? candidates[0]?.[0];
			if (!text) return [];
			const weight = words.get(code)?.get(text);
			if (weight === undefined) {
				throw new Error(`${schema} 的 ${code} 固顶词「${text}」不在声声桶中。`);
			}
			return [{ code, text, weight }];
		});
		hints[schema].sort(
			(left, right) =>
				compareText(left.code[0], right.code[0]) ||
				right.weight - left.weight ||
				compareText(left.code, right.code),
		);
	}
	return {
		initialKeys,
		vacant,
		vacantAA,
		hints,
		characters: [...characters.values()],
	};
}
