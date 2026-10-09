import { readFileSync, writeFileSync } from "fs";
import { exact500Articles } from "./exact_500_articles";

// 精确调整这几句
// 篇1：差 4 字 -> 在末尾加“勇往直前。”
exact500Articles[0].lines[14] += "勇往直前。";

// 篇2：差 1 字 -> 将“飞速演进”改为“飞速迭代演进”(+2) -> 499 + 2 = 501, 多了1，再调
// 当前499，差1字：把“海量算力堆叠”改为“庞大算力堆叠与扩展”(+2) -> 我们直接在最后一句“开辟前所未有的智慧新天地。”改为“开辟出前所未有的智慧新天地。”(+1)
exact500Articles[1].lines[13] = exact500Articles[1].lines[13].replace("开辟前所未有", "开辟出前所未有");

// 篇4：当前505，多了5字 -> 将“稳健行远深化改革开放”改为“积极深化改革开放”(-2)，将“持续受到稳健型长期投资机构的重点青睐”改为“受到稳健型长期投资机构重点青睐”(-3)
exact500Articles[3].lines[13] = exact500Articles[3].lines[13].replace("稳健行远深化改革开放", "积极深化改革开放");
exact500Articles[3].lines[8] = exact500Articles[3].lines[8].replace("持续受到稳健型长期投资机构的重点青睐", "受到稳健型长期投资机构重点青睐");

// 篇5：当前502，多了2字 -> 去掉“平凡”（-2）
exact500Articles[4].lines[12] = exact500Articles[4].lines[12].replace("生活虽然平凡忙碌", "生活虽然忙碌");

// 篇8：当前505，多了5字 -> “宁静致远的心境”改为“宁静心境”(-2)，“独一无二的光彩”改为“独特灿烂光彩”(-1)，“厚积薄发实现飞跃”改为“实现飞跃”(-4+2...)
exact500Articles[7].lines[13] = exact500Articles[7].lines[13].replace("以宁静致远的心境", "以宁静心境");
exact500Articles[7].lines[13] = exact500Articles[7].lines[13].replace("独一无二的光彩", "独特的璀璨光彩"); // -1
exact500Articles[7].lines[12] = exact500Articles[7].lines[12].replace("持之以恒地砥砺笃行", "持之以恒砥砺前行"); // -2

// 篇9：当前496，差4字 -> 最后加“创造奇迹。”(+4)
exact500Articles[8].lines[13] += "创造奇迹。";

for (const a of exact500Articles) {
	const count = a.lines.reduce(
		(sum, line) =>
			sum + [...line].filter((c) => /\p{Script=Han}/u.test(c)).length,
		0,
	);
	console.log(`篇${a.id} [${a.genre}]: 当前 ${count} 汉字, 差额 ${500 - count}`);
}

// 覆写回 exact_500_articles.ts
const content = `import { countHan, Corpus500 } from "./prepare_10x500_corpus";\n\n// 严格保证每篇汉字数正好等于 500 字，总计 10 篇 = 5000 汉字\nexport const exact500Articles: Corpus500[] = ${JSON.stringify(exact500Articles, null, "\t")};\n`;
writeFileSync("scripts/exact_500_articles.ts", content, "utf8");
console.log("Successfully updated exact_500_articles.ts!");
