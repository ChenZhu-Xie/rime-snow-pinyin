/** 风险特征用于分配验证预算，样本计数不解释为总体错误概率。 */
export interface PredictionFeatures {
	code: string;
	readings: readonly string[];
	fixed: ReadonlyMap<string, readonly string[]>;
	text: string;
}

export function predictionSignature({ code, readings, fixed, text }: PredictionFeatures): string {
	const fixedPrefixes = Array.from({ length: code.length - 1 }, (_, i) => code.slice(0, i + 1))
		.filter(prefix => fixed.has(prefix)).length;
	return [
		`码长=${code.length}`,
		`入口键=${/\d/u.test(code) ? "数字" : /[^a-z]/u.test(code) ? "其他" : "字母"}`,
		`多读音=${new Set(readings).size > 1}`,
		`含轻声=${readings.some(reading => /[05]$/u.test(reading))}`,
		`固顶前缀=${fixedPrefixes}`,
		`当前固顶=${fixed.has(code) ? fixed.get(code)?.[0] === text ? "目标字" : "其他候选" : "无"}`,
	].join("；");
}

export interface RiskClass {
	passed: number;
	failed: number;
	failures: { text: string; code: string; observedCode: string | null }[];
}

export function recordPredictionEvidence(
	profile: Map<string, RiskClass>, signature: string,
	text: string, code: string, observedCode: string | undefined,
) {
	const group = profile.get(signature) ?? { passed: 0, failed: 0, failures: [] };
	if (observedCode === code) group.passed++;
	else {
		group.failed++;
		group.failures.push({ text, code, observedCode: observedCode ?? null });
	}
	profile.set(signature, group);
}
