import { exact500Articles } from "./exact_500_articles";

for (const a of exact500Articles) {
	const count = a.lines.reduce(
		(sum, line) =>
			sum + [...line].filter((c) => /\p{Script=Han}/u.test(c)).length,
		0,
	);
	console.log(`篇${a.id} [${a.genre}]: 当前 ${count} 汉字, 差额 ${500 - count}`);
}
