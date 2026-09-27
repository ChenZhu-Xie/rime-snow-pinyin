import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEvidenceSnapshot, corpusLines } from "./fixed-corpus/evidence";
import { writeJson } from "./fixed-corpus/json-writer";
import { mergeDictionaries, readDictionary } from "./固顶编译器";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDirectory, "..");
const corpusPath = join(root, "cache", "fixed-corpus", "corpus.jsonl");
const outputPath = join(root, "config", "shenyun-fixed-evidence.json");

if (!existsSync(corpusPath)) {
	throw new Error(`候选语料不存在：${corpusPath}；请先运行 corpus:collect。`);
}

const dictionaryFiles = [
	"snow_pinyin.dict.yaml",
	"snow_pinyin.base.dict.yaml",
	"snow_pinyin.ext.dict.yaml",
	"snow_pinyin.tencent.dict.yaml",
	"snow_pinyin.user.dict.yaml",
];
const allowedWords = new Set(
	mergeDictionaries(
		dictionaryFiles.flatMap((file) => readDictionary(join(root, file))),
	).map((entry) => entry.word),
);

async function main() {
	const snapshot = await buildEvidenceSnapshot(corpusLines(corpusPath), {
		allowedWords,
	});
	writeJson(snapshot, outputPath);
	console.log(
		`神韵固顶证据已生成：${snapshot.statistics.inputRecords.toLocaleString()} 条输入，` +
			`${snapshot.statistics.eligibleRecords.toLocaleString()} 条有效简码证据，` +
			`${snapshot.statistics.words.toLocaleString()} 个候选词。`,
	);
}

void main();
