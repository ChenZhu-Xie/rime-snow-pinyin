// 本程序基于拼写规则和固顶词码表来模拟实际输入时的动态码长
// 生成的码表可以用于评测和大竹查询

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SpellingAlgebra } from "./lib/algebra";
import { readDictionary } from "./lib/dictionary";
import { rootPath } from "./lib/paths";

function 获取固顶词(file: string) {
	const fixed = readFileSync(file, "utf8").trim().split("\n");
	const fixedMap = new Map<string, string>();
	for (const line of fixed) {
		if (line.startsWith("#")) continue;
		const [code, words] = line.split("\t");
		const firstWord = words?.split(" ")[0];
		if (firstWord) fixedMap.set(code, firstWord);
	}
	return fixedMap;
}

function 获取拼音词典() {
	const singleRaw = readDictionary(rootPath("snow_pinyin.dict.yaml"));
	const base = readDictionary(rootPath("snow_pinyin.base.dict.yaml"));
	const ext = readDictionary(rootPath("snow_pinyin.ext.dict.yaml"));
	const tencent = readDictionary(rootPath("snow_pinyin.tencent.dict.yaml"));
	const wordTotalWeight = new Map<string, number>();
	const process = (list: string[][]) => {
		const info: {
			word: string;
			reading: string;
			weight: number;
			importance: number;
		}[] = [];
		for (const [word, reading, weight_s] of list) {
			if (/^[a-zA-Z0-9]/.test(word)) continue;
			const weight = parseInt(weight_s ?? "0", 10);
			info.push({ word, reading, weight, importance: 0 });
			wordTotalWeight.set(word, (wordTotalWeight.get(word) ?? 0) + weight);
		}
		return info.sort((a, b) => b.weight - a.weight);
	};
	const single = process(singleRaw).slice(0, maxSingle);
	const multiple = process(base)
		.concat(process(ext), process(tencent))
		.slice(0, maxMultiple);
	const all = single.concat(multiple);
	all.forEach((x) => {
		const totalWeight = wordTotalWeight.get(x.word);
		if (totalWeight !== undefined) x.importance = x.weight / totalWeight;
	});
	return all;
}

/**
 * 得到全码
 */
function assemble(syllables: string[], algebra: SpellingAlgebra) {
	const transformed = syllables.map((x) => algebra.apply(x));
	if (transformed.length === 1) return transformed[0];
	const first = transformed[0];
	const last = transformed.at(-1);
	if (first === undefined || last === undefined) {
		throw new Error("词典读音为空");
	}
	let base = transformed
		.map((x, i) => (useCapital && i >= 4 ? x[0].toUpperCase() : x[0]))
		.join("");
	base += last.slice(1, 3);
	base += first.slice(1, 3);
	return base;
}

function simulate() {
	const fixedMenu = 获取固顶词(rootPath("snow_sipin.fixed.txt"));
	const mainMenu = new Map<string, string>();
	const codes = 获取拼音词典();
	const rules = new SpellingAlgebra(
		rootPath("snow_sipin.schema.yaml"),
		"sipin_algebra",
	);
	const finalize = (s: string) =>
		/^[bpmfdtnlgkhjqxzcsrwyv]{1,3}$/.test(s) ? `${s}_` : s;
	const encoded: { word: string; code: string; importance: number }[] = [];
	for (const { word, reading, importance } of codes) {
		if (word === "的") {
			encoded.push({ word, code: ";", importance });
			continue;
		} else if (word === "了") {
			encoded.push({ word, code: "/", importance });
			continue;
		}
		const syllables = reading.split(" ");
		const full = assemble(syllables, rules);
		let short: string | undefined;
		for (let i = syllables.length; i < full.length; i++) {
			const maybeShort = full.slice(0, i);
			const maybeFixed = fixedMenu.get(maybeShort);
			const maybeMain = mainMenu.get(maybeShort);
			if (maybeFixed) {
				if (maybeFixed === word) {
					short = maybeShort;
					break;
				}
			} else if (maybeMain === undefined || maybeMain === word) {
				short = maybeShort;
				mainMenu.set(maybeShort, word);
				break;
			}
		}
		const code = short ? finalize(short) : full;
		encoded.push({ word, code, importance });
	}
	// 去除编码列表中的重复项，重要度累加
	const codeMap = new Map<string, number>();
	for (const { word, code, importance } of encoded) {
		const hash = `${word}\t${code}`;
		codeMap.set(hash, (codeMap.get(hash) ?? 0) + importance);
	}
	const deduped = [...codeMap].map(([hash, importance]) => {
		const [word, code] = hash.split("\t");
		return { word, code, importance };
	});
	return deduped;
}

const maxSingle = Infinity;
const maxMultiple = Infinity;
const useCapital = true;

function main() {
	const output = resolve(process.argv[2] ?? rootPath("output", "word-codes"));
	mkdirSync(output, { recursive: true });
	const encoded = simulate();

	const stats = new Map<number, number>();
	const finalized: { word: string; code: string; importance: number }[] = [];
	for (const { word, code, importance } of encoded) {
		const final = code.replaceAll("_", "").slice(0, 4);
		if (final.includes(";") || final.includes("/")) continue;
		finalized.push({ word, code: final, importance });
		const len = [...word].length;
		stats.set(len, (stats.get(len) ?? 0) + 1);
	}
	writeFileSync(
		join(output, "simulated.txt"),
		finalized
			.map(
				({ word, code, importance }) =>
					`${word}\t${[...code].join(" ")}\t${Math.round(importance * 100)}`,
			)
			.join("\n"),
		"utf8",
	);

	writeFileSync(
		join(output, "dazhu.txt"),
		encoded.map(({ word, code }) => `${code}\t${word}`).join("\n"),
		"utf8",
	);

	const sorted = [...stats].sort((a, b) => a[0] - b[0]);
	sorted.forEach(([v, k]) => {
		console.log(`${v} 字词数量为 ${k}`);
	});
}

if (import.meta.main) main();
