import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { dump } from "js-yaml";
import { jiandao, qpkr, qwerty, qwrt, shufu } from "./skin/layouts";
import { makeSkinPreview } from "./skin/preview";
import { makeHamsterSkin, makeHamsterSkinConfig } from "./skin/render";
import type { KeyboardCollection } from "./skin/types";

function generateSkinFolder(
	prefix: string,
	name: string,
	keyboards: KeyboardCollection,
) {
	const folder = join(prefix, name);
	mkdirSync(folder, { recursive: true });
	const skinConfig = makeHamsterSkinConfig(name, keyboards);
	writeFileSync(join(folder, "config.yaml"), dump(skinConfig), "utf8");
	for (const dark of [false, true]) {
		const modeFolder = join(folder, dark ? "dark" : "light");
		mkdirSync(modeFolder, { recursive: true });
		for (const [key, config] of Object.entries(keyboards)) {
			const content = dump(makeHamsterSkin({ ...config, dark }), {
				flowLevel: 2,
			});
			const fileName = join(modeFolder, `${key}.yaml`);
			writeFileSync(fileName, content, "utf8");
		}
	}
	writeFileSync(join(folder, "demo.png"), makeSkinPreview(keyboards.pinyin));

	// 从输出目录打包，将所有皮肤文件放在压缩包内的同名文件夹中。
	// 每次新建压缩包，避免 zip 更新旧包时残留已经删除的条目。
	const temporary = mkdtempSync(join(prefix, ".skin-"));
	try {
		const archive = join(temporary, "skin.cskin");
		execFileSync("zip", ["-qrX", archive, name, "-x", "*.DS_Store"], {
			cwd: prefix,
			stdio: "pipe",
		});
		renameSync(archive, join(prefix, `${name}.cskin`));
	} finally {
		rmSync(temporary, { recursive: true, force: true });
	}
}

function main() {
	const prefix = resolve(
		process.argv[2] ??
			join(
				homedir(),
				"Library/Mobile Documents/iCloud~com~ihsiao~apps~Hamster3/Documents/Skins",
			),
	);
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

	generateSkinFolder(prefix, "俏皮可爱・七色", {
		pinyin: snow_sipin,
		alphabetic: general,
	});
	generateSkinFolder(prefix, "俏皮可爱・七色・无刻", {
		pinyin: snow_sipin_nolabel,
		alphabetic: general,
	});
	generateSkinFolder(prefix, "直列 35 键", {
		pinyin: snow_qingyun,
		alphabetic: general,
	});
	generateSkinFolder(prefix, "直列 35 键・无刻", {
		pinyin: snow_qingyun_nolabel,
		alphabetic: general,
	});
	generateSkinFolder(prefix, "键道 35 键", {
		pinyin: snow_jiandao,
		alphabetic: general,
		numeric: snow_shufu,
		symbolic: snow_shufu,
	});
	generateSkinFolder(prefix, "键道 35 键・无刻", {
		pinyin: snow_jiandao_nolabel,
		alphabetic: general,
		numeric: snow_shufu,
		symbolic: snow_shufu,
	});
	generateSkinFolder(prefix, "直列 45 键", {
		pinyin: { ...general, symbol: false },
	});

	console.log(`已生成皮肤文件夹和 .cskin 压缩包到 ${prefix}`);
}

if (import.meta.main) main();
