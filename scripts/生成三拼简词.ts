import { readFileSync, writeFileSync } from "fs";
import { SpellingAlgebra } from "./utils";

const algebra = new SpellingAlgebra("snow_sanpin.schema.yaml", "sanpin_algebra");
const dict = readFileSync("snow_pinyin.base.dict.yaml", "utf-8").trim().split("\n");
const frequency = readFileSync("/Users/tansongchen/Documents/160 - 汉字信息工程/资料/词频/社交媒体词频.txt", "utf-8").trim().split("\n");
const frequencyMap = new Map<string, number>();
for (const line of frequency) {
  const [word, weightStr] = line.split("\t");
  const weight = parseInt(weightStr ?? "0", 10) || 0;
  frequencyMap.set(word, weight);
}

const MAX_WORDS_PER_CODE = 10;
const groups = new Map<string, { word: string; weight: number }[]>();

for (const line of dict) {
	if (line.startsWith("#") || !line.includes("\t")) continue;
	const [word, pinyin] = line.split("\t");
	const syllables = pinyin.split(" ");
	if (syllables.length < 2) continue;
  const weight = frequencyMap.get(word);
  if (weight === undefined) continue;

	// 首字声母 + 次字声调 + 首字声调
	const code1 = algebra.apply(syllables[0]);
	const code2 = algebra.apply(syllables[1]);
  const 二码 = code1[0] + code2.at(-1);
	let 三码;
  if (syllables.length === 2) 三码 = code1[0] + code2.at(-1) + code1.at(-1);
  else {
    const code3 = algebra.apply(syllables[2]);
    三码 = code1[0] + code2.at(-1) + code3.at(-1);
  }

  for (const code of [二码, 三码]) {
    const list = groups.get(code) ?? [];
    list.push({ word, weight });
    groups.set(code, list);
  }
}

const sortedGroups = [...groups].sort((a, b) => a[0].localeCompare(b[0]));
const entries: Map<string, string[]> = new Map();
for (const [code, words] of sortedGroups) {
	const top = words
		.sort((a, b) => b.weight - a.weight)
		.slice(0, MAX_WORDS_PER_CODE)
		.map((entry) => entry.word);
	entries.set(code, top);
}

writeFileSync("snow_sanpin.fixed.630.txt", [...entries].map(([code, words]) => `${code}\t${words.join(" ")}`).join("\n"), "utf-8");
