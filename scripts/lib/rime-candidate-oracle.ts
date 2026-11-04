import { CString, dlopen, FFIType, ptr, read, type Library } from "bun:ffi";
import { spawnSync } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	rmSync,
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

/** 空白用户目录中的真实 librime 候选查询；不提交候选，因此不会产生调频。 */
export class RimeCandidateOracle {
	private readonly library: RimeLibrary;
	private readonly session: bigint;
	private readonly originalDirectory: string;
	private readonly dataDirectory: string;
	private readonly cache = new Map<string, string[]>();
	private schema = "";

	constructor(schemas: string[]) {
		const dll = findRimeDll();
		const shared = findSharedData(dll);
		this.dataDirectory = mkdtempSync(join(tmpdir(), "snow-benchmark-rime-"));
		prepareData(this.dataDirectory, shared, schemas);
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
	}

	candidates(code: string): string[] {
		const key = `${this.schema}\t${code}`;
		const cached = this.cache.get(key);
		if (cached) return cached;
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
}
