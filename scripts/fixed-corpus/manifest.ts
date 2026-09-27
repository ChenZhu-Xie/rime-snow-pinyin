import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { load } from "js-yaml";

export type SourceAdapter =
	| "rime-table"
	| "ordered-fixed"
	| "custom-phrase"
	| "encoder-derived"
	| "plain-word-list";

export interface GlobalSourcePolicy {
	deny: string[];
	requireExplicitInclude: string[];
}

export interface SourceInput {
	adapter: SourceAdapter;
	include: string[];
	codeMarkers?: string[];
	options?: Record<string, unknown>;
}

export interface SourceDefinition {
	id: string;
	name: string;
	family: string;
	required: boolean;
	localPaths: string[];
	repository?: string;
	ref?: string;
	licenseHint?: string;
	inputs: SourceInput[];
}

export interface CorpusManifest {
	schemaVersion: 1;
	globalPolicy: GlobalSourcePolicy;
	sources: SourceDefinition[];
}

type Environment = Record<string, string | undefined>;

export function expandCandidatePath(value: string, environment: Environment): string {
	let expanded = value.replace(/%([^%]+)%/gu, (match, name: string) => {
		return environment[name] ?? environment[name.toUpperCase()] ?? match;
	});
	expanded = expanded.replace(/\$\{([^}]+)\}/gu, (match, name: string) => {
		return environment[name] ?? match;
	});
	return /%[^%]+%|\$\{[^}]+\}/u.test(expanded) ? expanded : resolve(expanded);
}

function normalizeRelativePath(path: string): string | null {
	const normalized = path.replace(/\\/gu, "/").replace(/^\.\//u, "");
	const segments = normalized.split("/");
	if (segments.includes("..") || normalized.startsWith("/")) return null;
	return segments.filter(Boolean).join("/");
}

function globToRegExp(glob: string): RegExp {
	const normalized = glob.replace(/\\/gu, "/");
	let pattern = "^";
	for (let index = 0; index < normalized.length; index += 1) {
		const character = normalized[index];
		if (character === "*" && normalized[index + 1] === "*") {
			if (normalized[index + 2] === "/") {
				pattern += "(?:.*/)?";
				index += 2;
			} else {
				pattern += ".*";
				index += 1;
			}
		} else if (character === "*") {
			pattern += "[^/]*";
		} else if (character === "?") {
			pattern += "[^/]";
		} else {
			pattern += character.replace(/[|\\{}()[\]^$+?.]/gu, "\\$&");
		}
	}
	return new RegExp(`${pattern}$`, "u");
}

function matchesAny(path: string, patterns: string[]): boolean {
	return patterns.some((pattern) => globToRegExp(pattern).test(path));
}

function isExactInclude(path: string, includes: string[]): boolean {
	return includes.some((include) => {
		if (/[*?]/u.test(include)) return false;
		return normalizeRelativePath(include) === path;
	});
}

export function isAllowedSourcePath(
	relativePath: string,
	input: SourceInput,
	globalPolicy: GlobalSourcePolicy,
): boolean {
	const normalized = normalizeRelativePath(relativePath);
	if (!normalized) return false;
	if (matchesAny(normalized, globalPolicy.deny)) return false;
	if (!matchesAny(normalized, input.include)) return false;
	if (
		matchesAny(normalized, globalPolicy.requireExplicitInclude) &&
		!isExactInclude(normalized, input.include)
	) {
		return false;
	}
	return true;
}

function assertStringArray(value: unknown, field: string): asserts value is string[] {
	if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
		throw new Error(`${field} 必须是字符串数组`);
	}
}

export function loadManifest(path: string, environment: Environment): CorpusManifest {
	const raw = load(readFileSync(path, "utf8")) as Partial<CorpusManifest> | undefined;
	if (!raw || raw.schemaVersion !== 1) throw new Error("语料来源清单 schemaVersion 必须为 1");
	if (!raw.globalPolicy || !Array.isArray(raw.sources)) {
		throw new Error("语料来源清单缺少 globalPolicy 或 sources");
	}
	assertStringArray(raw.globalPolicy.deny, "globalPolicy.deny");
	assertStringArray(
		raw.globalPolicy.requireExplicitInclude,
		"globalPolicy.requireExplicitInclude",
	);
	const repoRoot = resolve(dirname(path), "..");
	const expandedEnvironment = { ...environment, REPO_ROOT: environment.REPO_ROOT ?? repoRoot };
	const ids = new Set<string>();
	for (const [index, source] of raw.sources.entries()) {
		if (!source || typeof source !== "object") throw new Error(`sources[${index}] 无效`);
		for (const field of ["id", "name", "family"] as const) {
			if (typeof source[field] !== "string" || source[field].length === 0) {
				throw new Error(`sources[${index}].${field} 必须是非空字符串`);
			}
		}
		if (ids.has(source.id)) throw new Error(`来源 id 重复：${source.id}`);
		ids.add(source.id);
		assertStringArray(source.localPaths, `sources[${index}].localPaths`);
		if (!Array.isArray(source.inputs) || source.inputs.length === 0) {
			throw new Error(`sources[${index}].inputs 不能为空`);
		}
		for (const [inputIndex, input] of source.inputs.entries()) {
			assertStringArray(input.include, `sources[${index}].inputs[${inputIndex}].include`);
		}
		source.required = source.required ?? false;
		source.localPaths = source.localPaths.map((candidate) =>
			expandCandidatePath(candidate, expandedEnvironment),
		);
	}
	return raw as CorpusManifest;
}

