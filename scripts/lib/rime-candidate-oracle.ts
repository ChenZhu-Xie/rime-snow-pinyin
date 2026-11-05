import { CString, dlopen, FFIType, ptr, read, type Library } from "bun:ffi";
import { spawnSync } from "node:child_process";
import {
	appendFileSync,
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { copyRimeDependencies } from "./rime-dependencies";
import { ROOT } from "./paths";

const definitions = {
	RimeSetup: { args: [FFIType.ptr], returns: FFIType.void },
	RimeInitialize: { args: [FFIType.ptr], returns: FFIType.void },
	RimeFinalize: { args: [], returns: FFIType.void },
	RimeStartMaintenance: { args: [FFIType.int], returns: FFIType.int },
	RimeJoinMaintenanceThread: { args: [], returns: FFIType.void },
	RimeCreateSession: { args: [], returns: FFIType.u64 },
	RimeDestroySession: { args: [FFIType.u64], returns: FFIType.int },
	RimeProcessKey: {
		args: [FFIType.u64, FFIType.int, FFIType.int],
		returns: FFIType.int,
	},
	RimeClearComposition: { args: [FFIType.u64], returns: FFIType.void },
	RimeGetContext: { args: [FFIType.u64, FFIType.ptr], returns: FFIType.int },
	RimeFreeContext: { args: [FFIType.ptr], returns: FFIType.int },
	RimeSelectSchema: {
		args: [FFIType.u64, FFIType.cstring],
		returns: FFIType.int,
	},
} as const;

type RimeLibrary = Library<typeof definitions>;

const encoder = new TextEncoder();
const cString = (value: string) => encoder.encode(`${value}\0`);

function candidateDlls(): string[] {
	const configured = process.env.RIME_DLL;
	const result = configured ? [resolve(configured)] : [];
	if (process.platform === "win32") {
		for (const key of [
			"HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
			"HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
			"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
		]) {
			const query = spawnSync(
				"reg",
				["query", key, "/s", "/v", "UninstallString"],
				{
					encoding: "utf8",
				},
			);
			for (const line of query.stdout.split(/\r?\n/u)) {
				const match = line.match(/REG_\w+\s+"?(.+?\\uninstall\.exe)"?\s*$/iu);
				if (match?.[1] && /(?:weasel|rime)/iu.test(match[1]))
					result.push(join(dirname(match[1]), "rime.dll"));
			}
		}
		for (const base of [
			process.env.ProgramFiles,
			process.env["ProgramFiles(x86)"],
		]) {
			if (!base) continue;
			const rime = join(base, "Rime");
			if (!existsSync(rime)) continue;
			for (const name of readdirSync(rime))
				result.push(join(rime, name, "rime.dll"));
		}
	}
	return result;
}

function findRimeDll(): string {
	const dll = candidateDlls().find(existsSync);
	if (dll) return dll;
	throw new Error(
		"benchmark 必须用空白部署的真实 Rime 候选；找不到 rime.dll。请设置 RIME_DLL 后重试。",
	);
}

function findSharedData(dll: string): string {
	const configured = process.env.RIME_SHARED_DATA;
	const candidates = [
		...(configured ? [resolve(configured)] : []),
		join(dirname(dll), "data"),
	];
	const shared = candidates.find((path) => existsSync(join(path, "essay.txt")));
	if (shared) return shared;
	throw new Error(
		"benchmark 必须用真实 Rime 部署；找不到含 essay.txt 的共享数据目录。请设置 RIME_SHARED_DATA 后重试。",
	);
}

function prepareData(
	destination: string,
	shared: string,
	schemas: string[],
): void {
	for (const name of readdirSync(ROOT)) {
		if (/^snow_.*\.(?:yaml|txt)$/u.test(name) && !name.endsWith(".custom.yaml"))
			cpSync(join(ROOT, name), join(destination, name));
	}
	cpSync(join(ROOT, "lua"), join(destination, "lua"), { recursive: true });
	cpSync(
		join(ROOT, "spec", "fixtures", "default.yaml"),
		join(destination, "default.yaml"),
	);
	copyRimeDependencies(ROOT, destination);
	cpSync(join(shared, "essay.txt"), join(destination, "essay.txt"));
	const opencc = join(shared, "opencc");
	if (existsSync(opencc))
		cpSync(opencc, join(destination, "opencc"), { recursive: true });
	writeFileSync(
		join(destination, "default.custom.yaml"),
		`patch:\n  schema_list:\n${schemas.map((schema) => `    - schema: ${schema}`).join("\n")}\n`,
	);
}

const SBXH_SOURCE_FILES = [
	"default.yaml",
	"sbfh.yaml",
	"sbpy.dict.yaml",
	"sbpy.schema.yaml",
	"sbpy.unihan.dict.yaml",
	"sbxh.dict.yaml",
	"sbxh.schema.yaml",
	"sbxlm.ico",
	"sbxlm.yaml",
	"sbyp.schema.yaml",
] as const;

const SBXH_BUILD_PATTERN =
	/^(?:bihua|sbpy(?:\.(?:base|ext|tencent))?|sbxh(?:\.extended)?|sbxh2|sbyp|zhlf)\.(?:prism\.bin|reverse\.bin|schema\.yaml|table\.bin)$/u;

function prepareSbxhData(
	destination: string,
	shared: string,
	schemas: string[],
	source: string,
	reverseWords: readonly string[] = [],
): void {
	for (const name of SBXH_SOURCE_FILES) {
		const path = join(source, name);
		if (existsSync(path)) cpSync(path, join(destination, name));
	}
	if (!existsSync(join(destination, "default.yaml")))
		cpSync(
			join(ROOT, "spec", "fixtures", "default.yaml"),
			join(destination, "default.yaml"),
		);
	for (const directory of ["lua", "opencc"]) {
		const path = join(source, directory);
		if (existsSync(path))
			cpSync(path, join(destination, directory), { recursive: true });
	}
	const destinationBuild = join(destination, "build");
	mkdirSync(destinationBuild, { recursive: true });
	for (const name of readdirSync(join(source, "build"))) {
		if (SBXH_BUILD_PATTERN.test(name))
			cpSync(join(source, "build", name), join(destinationBuild, name));
	}
	cpSync(join(shared, "essay.txt"), join(destination, "essay.txt"));
	const sharedOpencc = join(shared, "opencc");
	if (existsSync(sharedOpencc))
		cpSync(sharedOpencc, join(destination, "opencc"), { recursive: true });
	if (reverseWords.length > 0) {
		writeFileSync(
			join(destination, "benchmark_reverse_words.tsv"),
			reverseWords
				.map((word, index) => `w${index.toString(36)}\t${word}`)
				.join("\n") + "\n",
		);
		writeFileSync(
			join(destination, "lua", "benchmark_reverse.lua"),
			`local translator = {}\n\nfunction translator.init(env)\n  env.reverse = ReverseLookup("sbxh.extended")\n  env.words = {}\n  local path = rime_api.get_user_data_dir() .. "/benchmark_reverse_words.tsv"\n  local file = io.open(path, "r")\n  if not file then return end\n  for line in file:lines() do\n    local input, word = line:match("([^\\t]+)\\t([^\\t]+)")\n    if input and word then env.words[input] = word end\n  end\n  file:close()\nend\n\nfunction translator.func(input, segment, env)\n  local word = env.words[input]\n  if not word then return end\n  for code in env.reverse:lookup(word):gmatch("[^ ]+") do\n    yield(Candidate("reverse", segment.start, segment._end, code, ""))\n  end\nend\n\nreturn translator\n`,
		);
		writeFileSync(
			join(destination, "sbxh_reverse_benchmark.schema.yaml"),
			`schema:\n  schema_id: sbxh_reverse_benchmark\n  name: 声笔小鹤反查测评\n  version: "1"\n  dependencies: [sbxh]\n\nengine:\n  processors:\n    - speller\n    - selector\n    - navigator\n    - express_editor\n  segmentors:\n    - abc_segmentor\n    - fallback_segmentor\n  translators:\n    - lua_translator@*benchmark_reverse\n\nspeller:\n  alphabet: "abcdefghijklmnopqrstuvwxyz0123456789"\n  initials: "w"\n  auto_clear: none\n\nmenu:\n  page_size: 100\n`,
		);
	}
	writeFileSync(
		join(destination, "default.custom.yaml"),
		`patch:\n  schema_list:\n${schemas.map((schema) => `    - schema: ${schema}`).join("\n")}\n`,
	);
}

const CACHE_FORMAT = "rime-candidate-oracle-v1";
const BENCHMARK_DATA_PREFIXES = [
	"snow_bihua.",
	"snow_bushou.",
	"snow_jiandao",
	"snow_pinyin.",
	"snow_sanpin",
	"snow_shenyun_",
	"snow_xingpang.",
] as const;

function affectsBenchmarkCandidates(relativePath: string): boolean {
	const name = relativePath.replaceAll("\\", "/");
	return (
		!name.startsWith("snow_") ||
		BENCHMARK_DATA_PREFIXES.some((prefix) => name.startsWith(prefix))
	);
}

function dataFingerprint(dataDirectory: string, dll: string): string {
	const hash = new Bun.CryptoHasher("sha256");
	const add = (base: string, relativePath: string): void => {
		const path = join(base, relativePath);
		if (statSync(path).isDirectory()) {
			for (const name of readdirSync(path).sort())
				add(base, join(relativePath, name));
			return;
		}
		hash.update(`${relativePath.replaceAll("\\", "/")}\0`);
		hash.update(readFileSync(path));
		hash.update("\0");
	};
	hash.update(`${CACHE_FORMAT}\0`);
	for (const name of readdirSync(dataDirectory).sort()) {
		// 方案清单只控制部署入口，不改变被选方案的候选；忽略后可复用单方案预热结果。
		if (name === "default.custom.yaml" || !affectsBenchmarkCandidates(name))
			continue;
		add(dataDirectory, name);
	}
	add(dirname(dll), basename(dll));
	return hash.digest("hex");
}

interface PersistentCacheRecord {
	code: string;
	candidates: string[];
}

/** 空白用户目录中的真实 librime 候选查询；不提交候选，因此不会产生调频。 */
export class RimeCandidateOracle {
	private readonly library: RimeLibrary;
	private readonly session: bigint;
	private readonly originalDirectory: string;
	private readonly dataDirectory: string;
	private readonly persistentCacheDirectory: string;
	private readonly cache = new Map<string, string[]>();
	private readonly loadedSchemas = new Set<string>();
	private cacheHits = 0;
	private cacheMisses = 0;
	private schema = "";

	constructor(
		schemas: string[],
		options: {
			externalSbxhDirectory?: string;
			externalSbxhReverseWords?: readonly string[];
		} = {},
	) {
		const dll = findRimeDll();
		const shared = findSharedData(dll);
		this.dataDirectory = mkdtempSync(join(tmpdir(), "snow-benchmark-rime-"));
		if (options.externalSbxhDirectory)
			prepareSbxhData(
				this.dataDirectory,
				shared,
				schemas,
				resolve(options.externalSbxhDirectory),
				options.externalSbxhReverseWords,
			);
		else prepareData(this.dataDirectory, shared, schemas);
		const fingerprint = dataFingerprint(this.dataDirectory, dll);
		this.persistentCacheDirectory = join(
			ROOT,
			"output",
			"benchmark-rime-cache",
			fingerprint,
		);
		mkdirSync(this.persistentCacheDirectory, { recursive: true });
		this.originalDirectory = process.cwd();
		process.chdir(this.dataDirectory);
		process.env.PATH = `${dirname(dll)};${process.env.PATH ?? ""}`;
		this.library = dlopen(dll, definitions);
		const traits = new Uint8Array(96);
		const view = new DataView(traits.buffer);
		view.setInt32(0, 92, true);
		const current = cString(".");
		const app = cString("rime.snow.benchmark");
		view.setBigUint64(8, BigInt(ptr(current)), true);
		view.setBigUint64(16, BigInt(ptr(current)), true);
		view.setBigUint64(48, BigInt(ptr(app)), true);
		view.setInt32(64, 2, true);
		this.library.symbols.RimeSetup(traits);
		this.library.symbols.RimeInitialize(null);
		if (this.library.symbols.RimeStartMaintenance(1))
			this.library.symbols.RimeJoinMaintenanceThread();
		this.session = this.library.symbols.RimeCreateSession();
		if (!this.session) throw new Error("无法建立空白 Rime benchmark 会话");
	}

	selectSchema(schema: string): void {
		if (schema === this.schema) return;
		if (!this.library.symbols.RimeSelectSchema(this.session, cString(schema)))
			throw new Error(`空白 Rime 部署无法选择方案：${schema}`);
		this.schema = schema;
		this.loadPersistentCache(schema);
	}

	private cachePath(schema: string): string {
		return join(this.persistentCacheDirectory, `${schema}.jsonl`);
	}

	private loadPersistentCache(schema: string): void {
		if (this.loadedSchemas.has(schema)) return;
		this.loadedSchemas.add(schema);
		const path = this.cachePath(schema);
		if (!existsSync(path)) return;
		const content = readFileSync(path, "utf8");
		for (const line of content.split(/\r?\n/u)) {
			if (!line) continue;
			try {
				const record = JSON.parse(line) as Partial<PersistentCacheRecord>;
				if (
					typeof record.code === "string" &&
					Array.isArray(record.candidates) &&
					record.candidates.every((candidate) => typeof candidate === "string")
				)
					this.cache.set(`${schema}\t${record.code}`, record.candidates);
			} catch {
				// 中断可能留下不完整的末行；忽略它，缺失编码会重新查询。
			}
		}
		// 防止下次追加记录与中断留下的不完整末行粘连。
		if (content !== "" && !content.endsWith("\n")) appendFileSync(path, "\n");
	}

	candidates(code: string): string[] {
		const key = `${this.schema}\t${code}`;
		const cached = this.cache.get(key);
		if (cached) {
			this.cacheHits += 1;
			return cached;
		}
		this.cacheMisses += 1;
		this.library.symbols.RimeClearComposition(this.session);
		for (const character of code)
			this.library.symbols.RimeProcessKey(
				this.session,
				character.codePointAt(0) ?? 0,
				0,
			);
		const context = new Uint8Array(88);
		new DataView(context.buffer).setInt32(0, 84, true);
		const result: string[] = [];
		if (this.library.symbols.RimeGetContext(this.session, context)) {
			const contextPointer = ptr(context);
			const count = read.i32(contextPointer, 48);
			const list = read.ptr(contextPointer, 56);
			for (let index = 0; index < count; index += 1) {
				const text = read.ptr(list, index * 24);
				result.push(String(new CString(text)));
			}
			this.library.symbols.RimeFreeContext(context);
		}
		this.cache.set(key, result);
		appendFileSync(
			this.cachePath(this.schema),
			`${JSON.stringify({ code, candidates: result } satisfies PersistentCacheRecord)}\n`,
		);
		return result;
	}

	close(): void {
		this.library.symbols.RimeDestroySession(this.session);
		this.library.symbols.RimeFinalize();
		this.library.close();
		process.chdir(this.originalDirectory);
		rmSync(this.dataDirectory, { recursive: true, force: true });
	}

	description(): string {
		return `${basename(this.dataDirectory)}（空白 user dict，无提交、无调频）`;
	}

	cacheStats(): { hits: number; misses: number } {
		return { hits: this.cacheHits, misses: this.cacheMisses };
	}
}
