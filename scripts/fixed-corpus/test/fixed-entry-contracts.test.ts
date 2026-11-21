import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	ALL_BENCHMARK_SCHEMES,
	pronunciationCodes,
} from "../../lib/benchmark-schemes";
import { SpellingAlgebra } from "../../lib/algebra";
import { rootPath } from "../../lib/paths";
import { numeralReadings } from "../../lib/fixed-number-aliases";

const read = (path: string) => readFileSync(rootPath(path), "utf8");
const schemes = ALL_BENCHMARK_SCHEMES.filter((s) =>
	["classic", "oc21", "rc26", "liandao", "zhudao"].includes(s.soundLayout),
);
const readings = new Map<string, string[]>();
for (const line of read("snow_pinyin.dict.yaml").split(/\r?\n/u)) {
	const [word, reading] = line.split("\t");
	if (!reading || !/^\p{Script=Han}$/u.test(word)) continue;
	readings.set(word, [...(readings.get(word) ?? []), reading]);
}
const norm = new Set(
	read("scripts/data/tygf-pinyin.tsv")
		.split(/\r?\n/u)
		.map((l) => l.split("\t")[0]),
);

for (const scheme of schemes) {
	// snow.read_dictionary 对历史重复码采用最后一行；候选合同必须检查实际生效的行。
	const effective = new Map(
		read(scheme.fixedFile)
			.split(/\r?\n/u)
			.filter((l) => l && !l.startsWith("#"))
			.map((l) => {
				const [code, ...words] = l.split(/\s+/u);
				return [code, words] as const;
			}),
	);
	const rows = [...effective].map(([code, words]) => [code, ...words]);
	test(`${scheme.schemaId}：全表字母和数字入口完整且采用本方案编码`, () => {
		const algebra = new SpellingAlgebra(
			rootPath(`${scheme.schemaId}.schema.yaml`),
			"speller/algebra",
		);
		for (const letter of "abcdefghijklmnopqrstuvwxyz") {
			const matches = rows.filter(([, ...words]) => words.includes(letter));
			assert.equal(matches.length, 1, letter);
			const [code, ...words] = matches[0];
			assert.ok(
				words.indexOf(letter.toUpperCase()) < words.indexOf(letter),
				code,
			);
			if (scheme.capacity === "21x26") {
				// 21×26 由 shenyun 翻译器从占用桶表注入字母，不经过拼写代数。
				const file =
					scheme.id === "zhudao"
						? "snow-zhudao-letter-buckets"
						: "shenyun-21x26-letter-buckets";
				const mapping = JSON.parse(read(`config/${file}.json`)) as {
					letters: Array<{ letter: string; code: string }>;
				};
				assert.equal(
					mapping.letters.find((e) => e.letter === letter)?.code,
					code,
				);
				assert.equal(words[1], letter.toUpperCase());
				assert.equal(words[2], letter);
			} else {
				assert.ok(
					algebra.applyAll(`~${letter}`).includes(code),
					`${letter} ${code}`,
				);
				assert.ok(
					algebra.applyAll(`~~${letter}`).includes(code),
					`${letter.toUpperCase()} ${code}`,
				);
			}
		}
		for (const [digit, [han, pinyin]] of numeralReadings.entries()) {
			const matches = rows.filter(([, ...words]) =>
				words.includes(String(digit)),
			);
			assert.equal(matches.length, 1, `${digit}`);
			const [code] = matches[0];
			assert.ok(
				pronunciationCodes(scheme.id, han, [pinyin]).some(
					(entry) => entry.code === code,
				),
				`${digit} ${code} 必须符合对应汉字数字的实际辅码`,
			);
			assert.ok(
				algebra
					.applyAll(pinyin)
					.some(
						(sound) =>
							sound.startsWith(code) || code.startsWith(sound.slice(0, 2)),
					),
				`${digit} ${code}`,
			);
		}
	});
	test(`${scheme.schemaId}：生僻字及繁体原字固顶逐条有真实读音和合法辅码`, () => {
		const bad: string[] = [];
		let normative = 0;
		for (const [code, ...words] of rows)
			for (const word of words) {
				if (!/^\p{Script=Han}$/u.test(word)) continue;
				if (norm.has(word)) normative++;
				const valid = (readings.get(word) ?? []).some((reading) =>
					pronunciationCodes(scheme.id, word, [reading]).some(
						(c) => c.code === code,
					),
				);
				if (!valid) bad.push(`${code} ${word}`);
			}
		assert.ok(normative > 300, "应覆盖常用与生僻规范字，而非只验证几个例子");
		assert.deepEqual(bad, []);
	});
}
