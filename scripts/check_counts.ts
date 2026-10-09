import { rawArticlesData, countHan } from "./prepare_10x500_corpus";

for (const a of rawArticlesData) {
	const c = countHan(a.lines);
	console.log(`篇${a.id} [${a.genre}]: 当前 ${c} 汉字, 距离500差额: ${500 - c}`);
}
