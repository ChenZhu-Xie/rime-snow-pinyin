export interface FlypyLayer {
	id: string;
	baseOrder: number;
	defaultWeight?: number;
}

export interface FlypyEntry {
	text: string;
	code: string;
	weight: number;
	order: number;
	baseOrder: number;
	layer: string;
}

export interface FlypyRankedCode {
	word: string;
	code: string;
	rank: number;
	candidates: string[];
	instant: boolean;
	popppable: boolean;
	layer: string;
}

function effectiveWeight(weight: number, layer: FlypyLayer): number {
	return layer.defaultWeight ?? weight;
}

export function parseFlypyWdatDump(
	content: string,
	layer: FlypyLayer,
): FlypyEntry[] {
	const result: FlypyEntry[] = [];
	for (const line of content.split(/\r?\n/u)) {
		if (!line) continue;
		const [code, text, rawWeight, rawOrder] = line.split("\t");
		if (!code || !text || rawWeight === undefined || rawOrder === undefined)
			throw new Error(`无法解析小鹤音形 wdat 导出行：${line}`);
		const weight = Number(rawWeight);
		const order = Number(rawOrder);
		if (!Number.isFinite(weight) || !Number.isInteger(order))
			throw new Error(`小鹤音形 wdat 数值字段无效：${line}`);
		result.push({
			text,
			code,
			weight: effectiveWeight(weight, layer),
			order,
			baseOrder: layer.baseOrder,
			layer: layer.id,
		});
	}
	return result;
}

export function parseFlypyCodetable(
	content: string,
	layer: FlypyLayer,
): FlypyEntry[] {
	const result: FlypyEntry[] = [];
	let inBody = false;
	let order = 0;
	for (const line of content.split(/\r?\n/u)) {
		if (!inBody) {
			if (line.trim() === "...") inBody = true;
			continue;
		}
		if (!line || line.startsWith("#") || !line.includes("\t")) continue;
		const [text, code, rawWeight] = line.split("\t");
		if (!text || !code) continue;
		const parsedWeight = rawWeight ? Number(rawWeight) : 0;
		if (!Number.isFinite(parsedWeight))
			throw new Error(`小鹤音形附加词库权重无效：${line}`);
		result.push({
			text,
			code,
			weight: effectiveWeight(parsedWeight, layer),
			order,
			baseOrder: layer.baseOrder,
			layer: layer.id,
		});
		order += 1;
	}
	return result;
}

function compareEntries(left: FlypyEntry, right: FlypyEntry): number {
	return (
		right.weight - left.weight ||
		left.baseOrder - right.baseOrder ||
		left.order - right.order ||
		left.code.localeCompare(right.code) ||
		left.text.localeCompare(right.text, "zh-CN")
	);
}

export function rankFlypyEntries(
	entries: readonly FlypyEntry[],
	targetWords: ReadonlySet<string>,
): FlypyRankedCode[] {
	const byCode = new Map<string, FlypyEntry[]>();
	const targetCodes = new Map<string, FlypyEntry[]>();
	const longerPrefixes = new Set<string>();
	for (const entry of entries) {
		const values = byCode.get(entry.code) ?? [];
		values.push(entry);
		byCode.set(entry.code, values);
		if (targetWords.has(entry.text)) {
			const targets = targetCodes.get(entry.text) ?? [];
			targets.push(entry);
			targetCodes.set(entry.text, targets);
		}
		for (let length = 1; length < entry.code.length; length += 1)
			longerPrefixes.add(entry.code.slice(0, length));
	}

	const candidatesByCode = new Map<string, FlypyEntry[]>();
	for (const [code, values] of byCode) {
		const byText = new Map<string, FlypyEntry>();
		for (const value of values) {
			const previous = byText.get(value.text);
			if (!previous || compareEntries(value, previous) < 0)
				byText.set(value.text, value);
		}
		candidatesByCode.set(code, [...byText.values()].sort(compareEntries));
	}

	const ranked: FlypyRankedCode[] = [];
	for (const [word, values] of targetCodes) {
		const seen = new Set<string>();
		for (const value of values) {
			if (seen.has(value.code)) continue;
			seen.add(value.code);
			const candidates = candidatesByCode.get(value.code) ?? [];
			const rank = candidates.findIndex(({ text }) => text === word) + 1;
			if (rank < 1) continue;
			const hasLonger = longerPrefixes.has(value.code);
			ranked.push({
				word,
				code: value.code,
				rank,
				candidates: candidates.slice(0, 5).map(({ text }) => text),
				instant:
					value.code.length >= 4 && candidates.length === 1 && !hasLonger,
				popppable: value.code.length === 4 && !hasLonger,
				layer: value.layer,
			});
		}
	}
	return ranked;
}

export function preferredFlypyCodes(
	ranked: readonly FlypyRankedCode[],
	maximumFallbackRank = 5,
): FlypyRankedCode[] {
	const byWord = new Map<string, FlypyRankedCode[]>();
	for (const item of ranked) {
		const values = byWord.get(item.word) ?? [];
		values.push(item);
		byWord.set(item.word, values);
	}
	const result: FlypyRankedCode[] = [];
	for (const values of byWord.values()) {
		const firstChoices = values.filter(({ rank }) => rank === 1);
		if (firstChoices.length > 0) {
			const minimumLength = Math.min(
				...firstChoices.map(({ code }) => code.length),
			);
			result.push(
				...firstChoices.filter(({ code }) => code.length === minimumLength),
			);
			continue;
		}
		result.push(
			...values.filter(({ rank }) => rank >= 2 && rank <= maximumFallbackRank),
		);
	}
	return result;
}
