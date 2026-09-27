import { load } from "js-yaml";

export type AlgebraOperator = "erase" | "xform" | "derive" | "xlit";

export interface AlgebraRule {
	operator: AlgebraOperator;
	pattern: string;
	replacement?: string;
}

export interface AlgebraResult {
	canonical: string | null;
	accepted: string[];
}

function splitFields(expression: string): string[] {
	const firstSlash = expression.indexOf("/");
	if (firstSlash < 1 || !expression.endsWith("/")) {
		throw new Error(`无效的拼写代数规则：${expression}`);
	}
	const fields = [expression.slice(0, firstSlash)];
	let field = "";
	for (let index = firstSlash + 1; index < expression.length; index += 1) {
		const character = expression[index];
		if (character === "/" && expression[index - 1] !== "\\") {
			fields.push(field);
			field = "";
			continue;
		}
		field += character;
	}
	if (field !== "") throw new Error(`无效的拼写代数结尾：${expression}`);
	return fields;
}

function parseRule(expression: unknown): AlgebraRule {
	if (typeof expression !== "string") {
		throw new Error("拼写代数规则必须是字符串");
	}
	const [operator, pattern, replacement, ...extra] = splitFields(expression);
	if (
		operator !== "erase" &&
		operator !== "xform" &&
		operator !== "derive" &&
		operator !== "xlit"
	) {
		throw new Error(`不支持的拼写代数操作：${operator}`);
	}
	if (pattern === undefined || extra.length > 0) {
		throw new Error(`无效的拼写代数规则：${expression}`);
	}
	if (operator === "erase") {
		if (replacement !== undefined) throw new Error(`erase 规则不能包含替换串：${expression}`);
		return { operator, pattern };
	}
	if (replacement === undefined) throw new Error(`规则缺少替换串：${expression}`);
	if (operator === "xlit" && [...pattern].length !== [...replacement].length) {
		throw new Error(`xlit 字符表长度不一致：${expression}`);
	}
	return { operator, pattern, replacement };
}

export function parseAlgebraRules(yaml: string, section: string): AlgebraRule[] {
	const document = load(yaml);
	if (!document || typeof document !== "object") {
		throw new Error("拼写代数 YAML 必须是映射");
	}
	const value = (document as Record<string, unknown>)[section];
	if (!Array.isArray(value)) throw new Error(`找不到拼写代数数组：${section}`);
	return value.map(parseRule);
}

function replaceRegex(value: string, pattern: string, replacement: string): string {
	return value.replace(new RegExp(pattern, "u"), replacement);
}

function transliterate(value: string, source: string, target: string): string {
	const replacements = new Map([...source].map((character, index) => [character, [...target][index]]));
	return [...value].map((character) => replacements.get(character) ?? character).join("");
}

function transform(value: string, rule: AlgebraRule): string | null {
	if (rule.operator === "erase") {
		return new RegExp(rule.pattern, "u").test(value) ? null : value;
	}
	const replacement = rule.replacement ?? "";
	return rule.operator === "xlit"
		? transliterate(value, rule.pattern, replacement)
		: replaceRegex(value, rule.pattern, replacement);
}

function deduplicate(values: Array<string | null>): string[] {
	const result: string[] = [];
	const seen = new Set<string>();
	for (const value of values) {
		if (value === null || seen.has(value)) continue;
		seen.add(value);
		result.push(value);
	}
	return result;
}

export function applyAlgebra(input: string, rules: AlgebraRule[]): AlgebraResult {
	let canonical: string | null = input;
	let accepted = [input];
	for (const rule of rules) {
		if (rule.operator === "derive") {
			accepted = deduplicate(
				accepted.flatMap((value) => [value, transform(value, rule)]),
			);
			continue;
		}
		canonical = canonical === null ? null : transform(canonical, rule);
		accepted = deduplicate(accepted.map((value) => transform(value, rule)));
	}
	return { canonical, accepted };
}
