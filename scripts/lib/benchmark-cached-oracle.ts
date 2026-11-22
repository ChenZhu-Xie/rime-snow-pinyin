import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** 显式复用已审计、规则未变化的方案；缺记录即失败，绝不猜测候选。 */
export class BenchmarkCachedOracle {
	private readonly records = new Map<string, string[]>();
	private hits = 0;
	constructor(
		private readonly directory: string,
		schema: string,
	) {
		for (const line of readFileSync(
			join(directory, `${schema}.jsonl`),
			"utf8",
		).split(/\r?\n/u)) {
			if (!line) continue;
			const row = JSON.parse(line);
			assert.equal(typeof row.code, "string");
			assert.equal(typeof row.commit, "string");
			assert.ok(
				Array.isArray(row.candidates) &&
					row.candidates.every((v: unknown) => typeof v === "string"),
			);
			assert.ok(row.commit === "" || row.candidates.length === 0);
			this.records.set(row.code, row.candidates);
		}
	}
	candidates(code: string): string[] {
		const result = this.records.get(code);
		assert.ok(result, `已验证缓存缺少 ${code}；必须重新测量该方案`);
		this.hits++;
		return result;
	}
	cacheStats() {
		return { hits: this.hits, misses: 0, audits: 0, rejected: 0 };
	}
	cacheDirectory() {
		return resolve(this.directory);
	}
	auditCachedQueries() {
		/* 调用者先验证源文件与已完成测量一致；此模式不伪称真实复查。 */
	}
	close() {}
}
