import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const schemeId = "R8-21X21-M40-01";
const cropWidth = 1040;
const cropHeight = 590;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = join(
	scriptDirectory,
	"..",
	"docs",
	"shenyun-v2-keyboard.svg",
);

const args = process.argv.slice(2);
const check = args.includes("--check");
const positional = args.filter((arg) => arg !== "--check");
if (!positional[0]) {
	throw new Error(
		"用法：tsx 生成神韵键盘图.ts <a7_CKT_R10_integrated.html> [浏览器可执行文件] [--check]",
	);
}

const htmlPath = resolve(positional[0]);
if (!existsSync(htmlPath)) {
	throw new Error(`找不到 benchmark HTML：${htmlPath}`);
}

function findBrowser(explicit?: string) {
	const candidates = [
		explicit,
		process.env.CHROME_PATH,
		"C:/Program Files/Google/Chrome/Application/chrome.exe",
		"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
		"C:/Program Files/Microsoft/Edge/Application/msedge.exe",
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
		"/usr/bin/google-chrome",
		"/usr/bin/chromium",
		"/usr/bin/chromium-browser",
	].filter((candidate): candidate is string => Boolean(candidate));
	const browser = candidates.find((candidate) => existsSync(candidate));
	if (!browser) {
		throw new Error(
			"找不到 Chrome/Edge/Chromium；可将浏览器路径作为第二个参数传入，或设置 CHROME_PATH。",
		);
	}
	return browser;
}

async function main() {
	const browser = await chromium.launch({
		executablePath: findBrowser(positional[1]),
		headless: true,
		timeout: 30_000,
	});

	let svg: string;
	try {
		const page = await browser.newPage();
		await page.goto(pathToFileURL(htmlPath).href, {
			waitUntil: "load",
			timeout: 300_000,
		});
		await page.waitForFunction(
			() =>
				(globalThis as typeof globalThis & { App7?: { ready?: boolean } }).App7
					?.ready === true,
			undefined,
			{ timeout: 300_000 },
		);

		const nativeSvg = await page.evaluate((targetId) => {
			const scope = globalThis as typeof globalThis & {
				App7: { data: { entries: Array<{ id: string }> } };
				keyboardSVG: (
					entry: { id: string },
					loads: null,
					fonts: { final: number; onset: number; alias: number },
				) => string;
			};
			const entry = scope.App7.data.entries.find(({ id }) => id === targetId);
			if (!entry) throw new Error(`HTML 中找不到方案 ${targetId}`);
			return scope.keyboardSVG(entry, null, {
				final: 28,
				onset: 21,
				alias: 20,
			});
		}, schemeId);

		svg = await page.evaluate(
			({ source, width, height }) => {
				const document = new DOMParser().parseFromString(
					source,
					"image/svg+xml",
				);
				const root = document.documentElement;
				if (root.tagName.toLowerCase() === "parsererror") {
					throw new Error("HTML 导出的键盘 SVG 无法解析");
				}

				for (const group of root.querySelectorAll("g[data-key]")) {
					if (!/^[A-Z]$/.test(group.getAttribute("data-key") ?? ""))
						group.remove();
				}
				root.setAttribute("viewBox", `0 0 ${width} ${height}`);
				root.setAttribute("role", "img");
				root.setAttribute("aria-labelledby", "title desc");
				const background = Array.from(root.children).find(
					(element) => element.tagName.toLowerCase() === "rect",
				);
				background?.setAttribute("width", String(width));

				const namespace = "http://www.w3.org/2000/svg";
				const title = document.createElementNS(namespace, "title");
				title.id = "title";
				title.textContent = "无飞键道·神韵声韵映射图";
				const description = document.createElementNS(namespace, "desc");
				description.id = "desc";
				description.textContent = "无飞键道·神韵的声母、韵母与辅键映射。";
				const heading = root.querySelector('text[x="24"][y="34"]');
				if (heading) heading.textContent = "无飞键道·神韵";
				root.insertBefore(description, root.firstChild);
				root.insertBefore(title, description);

				return `${new XMLSerializer().serializeToString(root)}\n`;
			},
			{
				source: nativeSvg,
				width: cropWidth,
				height: cropHeight,
			},
		);
	} finally {
		await browser.close();
	}

	const keyCount = [...svg.matchAll(/data-key="([A-Z])"/g)].length;
	if (keyCount !== 26 || /data-key="[^A-Z]"/.test(svg)) {
		throw new Error(`裁剪结果异常：应有 26 个字母键，实际 ${keyCount} 个。`);
	}
	if (check) {
		if (!existsSync(outputPath) || readFileSync(outputPath, "utf8") !== svg) {
			throw new Error(`声韵图与 benchmark HTML 不一致：${outputPath}`);
		}
		console.log(
			`声韵图校验通过：${schemeId}，26 个字母键，${cropWidth}×${cropHeight}。`,
		);
	} else {
		writeFileSync(outputPath, svg, "utf8");
		console.log(`已从 benchmark HTML 导出并裁剪：${outputPath}`);
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
