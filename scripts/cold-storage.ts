import { resolve } from "node:path";
import {
	archiveStatus,
	findArchives,
	loadCatalog,
	verifyBatch,
} from "./lib/cold-storage";
import { ROOT } from "./lib/paths";

const help = `冷存查询与核验（只读，不创建联接，不执行历史迁移脚本）
  just cold-storage status
  just cold-storage find <历史路径、批次或提交关键字>
  just cold-storage verify <批次ID|all> [--full]
可选：--json --cold-root <实际冷盘根> --catalog <索引文件> --metadata-root <本地批次清单根>
默认 verify 校验两边清单摘要、文件存在与大小；--full 逐文件重读 SHA-256。
status 中 available-unverified 只表示路径可用，不代表通过核验。`;

async function main() {
	const args = process.argv.slice(2);
	if (args.length === 0 || args.includes("--help")) {
		console.log(help);
		return;
	}
	const flags = new Set<string>();
	const options = new Map<string, string>();
	const positional: string[] = [];
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (["--json", "--full"].includes(arg)) flags.add(arg);
		else if (["--cold-root", "--catalog", "--metadata-root"].includes(arg)) {
			const value = args[++i];
			if (!value || value.startsWith("--")) throw new Error(`${arg} 缺少值`);
			options.set(arg, value);
		} else if (arg.startsWith("--")) throw new Error(`未知参数：${arg}`);
		else positional.push(arg);
	}
	const [command, ...rest] = positional;
	const catalog = loadCatalog(
		resolve(
			options.get("--catalog") ??
				resolve(ROOT, "docs/cold-storage/catalog.json"),
		),
	);
	const locations = {
		repo: ROOT,
		cold: resolve(options.get("--cold-root") ?? catalog.coldRoot),
		metadata: resolve(
			options.get("--metadata-root") ?? resolve(ROOT, "output/cold-storage"),
		),
	};
	let result: unknown;
	if (command === "status" && rest.length === 0)
		result = archiveStatus(catalog, locations);
	else if (command === "find" && rest.length > 0)
		result = findArchives(catalog, locations, rest.join(" "));
	else if (command === "verify" && rest.length === 1) {
		const batches =
			rest[0] === "all"
				? catalog.batches
				: catalog.batches.filter((batch) => batch.id === rest[0]);
		if (!batches.length) throw new Error(`批次不存在：${rest[0]}`);
		const results = [];
		for (const batch of batches)
			results.push(await verifyBatch(batch, locations, flags.has("--full")));
		result = results;
	} else throw new Error(help);
	if (flags.has("--json")) console.log(JSON.stringify(result, null, 2));
	else console.table(result);
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
