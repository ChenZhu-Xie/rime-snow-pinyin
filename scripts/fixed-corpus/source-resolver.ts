import { createHash } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
} from "node:fs";
import { relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import type {
	GlobalSourcePolicy,
	SourceDefinition,
	SourceInput,
} from "./manifest";
import { isAllowedSourcePath } from "./manifest";

const execFileAsync = promisify(execFile);

export interface SourceDiagnostic {
	code: string;
	message: string;
}

export interface ResolvedSource {
	definition: SourceDefinition;
	root: string | null;
	revision: string | null;
	resolution: "local" | "cache" | "cloned" | "missing";
	diagnostics: SourceDiagnostic[];
}

export interface ResolveSourceOptions {
	cacheRoot: string;
	offline?: boolean;
	cloneRepository?: (
		repository: string,
		destination: string,
		ref?: string,
	) => Promise<void>;
}

function listAllFiles(root: string, current = root): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
		a.name.localeCompare(b.name, "en"),
	)) {
		if (entry.name === ".git") continue;
		const path = resolve(current, entry.name);
		if (entry.isDirectory()) files.push(...listAllFiles(root, path));
		else if (entry.isFile()) files.push(relative(root, path).split(sep).join("/"));
	}
	return files;
}

export function readSourceRevision(root: string, selectedFiles?: string[]): string {
	try {
		return execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		const hash = createHash("sha256");
		const files = (selectedFiles ?? listAllFiles(root)).slice().sort();
		for (const relativePath of files) {
			const fullPath = resolve(root, relativePath);
			if (!existsSync(fullPath) || !statSync(fullPath).isFile()) continue;
			hash.update(relativePath.replace(/\\/gu, "/"));
			hash.update("\0");
			hash.update(readFileSync(fullPath));
			hash.update("\0");
		}
		return `sha256:${hash.digest("hex")}`;
	}
}

export function listSourceFiles(
	source: ResolvedSource,
	input: SourceInput,
	policy: GlobalSourcePolicy,
): string[] {
	if (!source.root) return [];
	return listAllFiles(source.root).filter((path) =>
		isAllowedSourcePath(path, input, policy),
	);
}

async function defaultCloneRepository(
	repository: string,
	destination: string,
	ref?: string,
): Promise<void> {
	const args = ["clone", "--depth", "1"];
	if (ref) args.push("--branch", ref);
	args.push("--", repository, destination);
	await execFileAsync("git", args, { windowsHide: true });
}

function exactSelectedFiles(definition: SourceDefinition): string[] {
	return definition.inputs
		.flatMap((input) => input.include)
		.filter((path) => !/[*?]/u.test(path));
}

function hasGitHead(root: string): boolean {
	try {
		execFileSync("git", ["-C", root, "rev-parse", "--verify", "HEAD"], {
			stdio: ["ignore", "ignore", "ignore"],
			windowsHide: true,
		});
		return true;
	} catch {
		return false;
	}
}

export async function resolveSource(
	definition: SourceDefinition,
	options: ResolveSourceOptions,
): Promise<ResolvedSource> {
	for (const candidate of definition.localPaths) {
		if (/%[^%]+%|\$\{[^}]+\}/u.test(candidate)) continue;
		const root = resolve(candidate);
		if (existsSync(root) && statSync(root).isDirectory()) {
			return {
				definition,
				root,
				revision: readSourceRevision(root, exactSelectedFiles(definition)),
				resolution: "local",
				diagnostics: [],
			};
		}
	}

	if (!/^[a-z0-9][a-z0-9._-]*$/u.test(definition.id)) {
		throw new Error(`不安全的来源 id：${definition.id}`);
	}
	const cacheRoot = resolve(options.cacheRoot);
	const repositoryRoot = resolve(cacheRoot, "repositories");
	const destination = resolve(repositoryRoot, definition.id);
	if (!destination.startsWith(`${repositoryRoot}${sep}`)) {
		throw new Error(`来源缓存路径越界：${definition.id}`);
	}
	if (
		existsSync(destination) &&
		statSync(destination).isDirectory() &&
		!hasGitHead(destination)
	) {
		return {
			definition,
			root: null,
			revision: null,
			resolution: "missing",
			diagnostics: [
				{
					code: "SOURCE_CACHE_INCOMPLETE",
					message: `来源 ${definition.id} 的 Git 缓存不完整，请移走后重新收集`,
				},
			],
		};
	}
	if (existsSync(destination) && statSync(destination).isDirectory()) {
		return {
			definition,
			root: destination,
			revision: readSourceRevision(destination, exactSelectedFiles(definition)),
			resolution: "cache",
			diagnostics: [],
		};
	}

	if (options.offline || !definition.repository) {
		return {
			definition,
			root: null,
			revision: null,
			resolution: "missing",
			diagnostics: [
				{
					code: options.offline ? "SOURCE_MISSING_OFFLINE" : "SOURCE_MISSING",
					message: `未找到来源 ${definition.id}`,
				},
			],
		};
	}

	mkdirSync(repositoryRoot, { recursive: true });
	const cloneRepository = options.cloneRepository ?? defaultCloneRepository;
	await cloneRepository(definition.repository, destination, definition.ref);
	return {
		definition,
		root: destination,
		revision: readSourceRevision(destination, exactSelectedFiles(definition)),
		resolution: "cloned",
		diagnostics: [],
	};
}
