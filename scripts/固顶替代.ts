export type ReplacementMechanism = "尾字键" | "结构略码" | "结构略码+尾字键";

export interface FixedReplacement {
	word: string;
	base: string;
	code: string;
	cost: number;
	mechanism: ReplacementMechanism;
}

interface GeneratedWord {
	word: string;
	trigger: string;
}

const suffixKeys = [
	["的", ";"],
	["了", "/"],
] as const;

function characters(word: string) {
	return [...word];
}

/** 与 lua/snow/abbreviation.lua 保持逐项一致。 */
export function generateAbbreviations(base: string): GeneratedWord[] {
	const values = characters(base);
	if (values.length === 0 || values.length >= 4) return [];
	const first = values[0];
	const last = values.at(-1) as string;
	const generated: GeneratedWord[] = [];
	const add = (word: string, trigger: string) =>
		generated.push({ word, trigger });

	if (values.length === 1) add(base + base, "[");
	for (const [trigger, insertion] of [
		["D", "的"],
		["L", "了"],
		["B", "不"],
		["F", "一"],
		["R", "啊"],
		["U", "呀"],
		["K", "了一"],
	] as const) {
		add(base + insertion + base, trigger);
	}
	for (const [trigger, insertion] of [
		["J", "了"],
		["P", "不"],
		["N", "里"],
	] as const) {
		add(first + insertion + base, trigger);
	}
	add(
		values.length === 1 ? `${base}个` : `${first}个${values.slice(1).join("")}`,
		"G",
	);
	add(first + base, "E");
	add(last + base, "T");
	add(base + first, "Y");
	add(base + last, "I");
	add(base + base, "A");
	if (values.length === 2) add(first + base + last, "O");
	add(`${base}着${base}着`, "W");
	add(`${base}来${base}去`, "Q");

	return generated;
}

function compareReplacement(a: FixedReplacement, b: FixedReplacement) {
	return (
		a.cost - b.cost ||
		a.code.localeCompare(b.code) ||
		a.base.localeCompare(b.base, "zh-CN")
	);
}

/**
 * 记录当前方案已经稳定固顶的字词，并推导可由尾字键或结构略码完成的打法。
 * cost 是逻辑按键数；大写略码仍另有 Shift 和手感成本，因此调用方只在它
 * 不长于原固顶码时才回收码位。
 */
export class FixedReplacementIndex {
	private readonly alternatives = new Map<string, FixedReplacement[]>();

	private add(alternative: FixedReplacement) {
		const values = this.alternatives.get(alternative.word) ?? [];
		if (!values.some((value) => value.code === alternative.code)) {
			values.push(alternative);
			values.sort(compareReplacement);
			this.alternatives.set(alternative.word, values);
		}
	}

	addFixed(code: string, base: string) {
		const directOutputs: FixedReplacement[] = [];
		for (const [suffix, trigger] of suffixKeys) {
			directOutputs.push({
				word: base + suffix,
				base,
				code: code + trigger,
				cost: code.length + 1,
				mechanism: "尾字键",
			});
		}
		for (const value of directOutputs) this.add(value);

		for (const generated of generateAbbreviations(base)) {
			const abbreviation: FixedReplacement = {
				word: generated.word,
				base,
				code: code + generated.trigger,
				cost: code.length + 1,
				mechanism: "结构略码",
			};
			this.add(abbreviation);
			// 略码会立即提交；随后输入标点映射仍可补“的/了”。
			for (const [suffix, trigger] of suffixKeys) {
				this.add({
					word: generated.word + suffix,
					base,
					code: code + generated.trigger + trigger,
					cost: code.length + 2,
					mechanism: "结构略码+尾字键",
				});
			}
		}
	}

	find(word: string, maximumCost: number) {
		return this.alternatives
			.get(word)
			?.find((alternative) => alternative.cost <= maximumCost);
	}

	get(word: string) {
		return [...(this.alternatives.get(word) ?? [])];
	}
}
