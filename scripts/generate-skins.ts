import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { generateHamsterSkin } from "./skin/hamster";
import { jiandao, qpkr, qwerty, qwrt, shufu } from "./skin/layouts";
import { generateTrimeSkin } from "./skin/trime";
import type { KeyboardCollection } from "./skin/types";

function main() {
	const { values, positionals } = parseArgs({
		args: process.argv.slice(2),
		options: {
			backend: { type: "string", default: "all" },
			help: { type: "boolean", short: "h" },
		},
		allowPositionals: true,
	});
	if (values.help) {
		console.log(
			"用法：bun scripts/generate-skins.ts [输出目录] [--backend hamster|trime|all]（默认 all）",
		);
		return;
	}
	const backend = values.backend;
	if (!["hamster", "trime", "all"].includes(backend ?? "")) {
		throw new Error(`未知的皮肤后端：${backend}`);
	}
	if (positionals.length > 1) throw new Error("只能指定一个输出目录");
	const prefix = resolve(
		positionals[0] ??
			(backend === "hamster"
				? join(
						homedir(),
						"Library/Mobile Documents/iCloud~com~ihsiao~apps~Hamster3/Documents/Skins",
					)
				: "output/skins"),
	);
	const generateSkinFolder = (name: string, keyboards: KeyboardCollection) => {
		if (backend === "hamster" || backend === "all") {
			generateHamsterSkin(
				backend === "all" ? join(prefix, "hamster") : prefix,
				name,
				keyboards,
			);
		}
		if (backend === "trime" || backend === "all") {
			generateTrimeSkin(
				backend === "all" ? join(prefix, "trime") : prefix,
				name,
				keyboards,
			);
		}
	};
	const snow_sipin = {
		colorful: true,
		label: true,
		keyInfos: qpkr,
	};
	const snow_qingyun = {
		colorful: true,
		label: true,
		keyInfos: qwrt,
	};
	const snow_sipin_nolabel = {
		colorful: true,
		label: false,
		keyInfos: qpkr,
	};
	const snow_qingyun_nolabel = {
		colorful: true,
		label: false,
		keyInfos: qwrt,
	};
	const general = {
		colorful: false,
		label: true,
		keyInfos: qwerty,
		symbol: true,
	};
	const snow_jiandao = {
		colorful: true,
		label: true,
		keyInfos: jiandao,
		specialCharacters: "avuio",
	};
	const snow_jiandao_nolabel = {
		colorful: true,
		label: false,
		keyInfos: jiandao,
		specialCharacters: "avuio",
	};
	const snow_shufu = {
		colorful: false,
		label: true,
		keyInfos: shufu,
	};

	generateSkinFolder("俏皮可爱・七色", {
		pinyin: snow_sipin,
		alphabetic: general,
	});
	generateSkinFolder("俏皮可爱・七色・无刻", {
		pinyin: snow_sipin_nolabel,
		alphabetic: general,
	});
	generateSkinFolder("直列 35 键", {
		pinyin: snow_qingyun,
		alphabetic: general,
	});
	generateSkinFolder("直列 35 键・无刻", {
		pinyin: snow_qingyun_nolabel,
		alphabetic: general,
	});
	generateSkinFolder("键道 35 键", {
		pinyin: snow_jiandao,
		alphabetic: general,
		numeric: snow_shufu,
		symbolic: snow_shufu,
	});
	generateSkinFolder("键道 35 键・无刻", {
		pinyin: snow_jiandao_nolabel,
		alphabetic: general,
		numeric: snow_shufu,
		symbolic: snow_shufu,
	});
	generateSkinFolder("直列 45 键", {
		pinyin: { ...general, symbol: false },
	});

	console.log(`已生成 ${backend} 皮肤到 ${prefix}`);
}

if (import.meta.main) main();
