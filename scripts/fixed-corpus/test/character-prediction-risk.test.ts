import assert from "node:assert/strict";
import test from "node:test";
import { predictionSignature, recordPredictionEvidence, type RiskClass } from "../../lib/character-prediction-risk";

test("固顶竞争与多读音变化使历史风险分类失配", () => {
	const basic = { text: "什", code: "keiu", readings: ["shen2"], fixed: new Map<string, string[]>() };
	const initial = predictionSignature(basic);
	assert.notEqual(initial, predictionSignature({ ...basic, readings: ["shen2", "shi2"] }));
	assert.notEqual(initial, predictionSignature({ ...basic, fixed: new Map([["keiu", ["侁"]]]) }));
});

test("同特征在不同方案独立积累，较短首选记录为预测差异", () => {
	const first = new Map<string, RiskClass>();
	const second = new Map<string, RiskClass>();
	recordPredictionEvidence(first, "相同特征", "滴", "d1vu", "di1");
	recordPredictionEvidence(second, "相同特征", "滴", "d1vu", "d1vu");
	assert.equal(first.get("相同特征")?.failed, 1);
	assert.equal(second.get("相同特征")?.failed, 0);
	assert.equal(second.get("相同特征")?.passed, 1);
});
