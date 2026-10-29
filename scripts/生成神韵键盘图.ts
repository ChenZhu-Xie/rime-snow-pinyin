import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const templateSchemeId = "R9-21X21-M40-02";
const cropWidth = 1040;
const cropHeight = 590;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDirectory, "..");
const scheme = JSON.parse(
	readFileSync(join(root, "config", "shenyun-21x21-mapping.json"), "utf8"),
) as {
	id: string;
	name: string;
	capacity: [number, number];
	initialMap: Record<string, string>;
	finalMap: Record<string, string>;
};
const roles = Object.entries(scheme.initialMap).reduce<
	Record<string, string[]>
>((result, [initial, key]) => {
	const role = ["Y", "YU"].includes(initial)
		? "ØY"
		: initial === initial.toUpperCase()
			? `Ø${initial}`
			: initial;
	result[key] ??= [];
	if (!result[key].includes(role)) result[key].push(role);
	return result;
}, {});
const rhymes = Object.entries(scheme.finalMap).reduce<Record<string, string[]>>(
	(result, [final, key]) => {
		result[key] ??= [];
		result[key].push(final);
		return result;
	},
	{},
);
const renderingScheme = {
	...scheme,
	name: "无飞键道·神韵 U357 综合人体工学前沿",
	roles,
	rhymes,
	tone: "IVUAO",
	zeroOnsetScope: "pure-y",
};
const outputPath = join(root, "docs", "shenyun-u357-keyboard.svg");

const args = process.argv.slice(2);
const check = args.includes("--check");
const cdp = args
	.find((arg) => arg.startsWith("--cdp="))
	?.slice("--cdp=".length);
const positional = args.filter(
	(arg) => arg !== "--check" && !arg.startsWith("--cdp="),
);
if (!positional[0]) {
	throw new Error(
		"用法：tsx 生成神韵键盘图.ts <benchmark.html> [浏览器可执行文件] [--check]",
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

async function renderOverCdp(endpoint: string) {
	const target = (await fetch(
		`${endpoint.replace(/\/$/u, "")}/json/new?${encodeURIComponent(pathToFileURL(htmlPath).href)}`,
		{ method: "PUT" },
	).then((response) => response.json())) as { webSocketDebuggerUrl: string };
	const socket = new WebSocket(target.webSocketDebuggerUrl);
	const pending = new Map<
		number,
		{ resolve: (value: unknown) => void; reject: (reason: unknown) => void }
	>();
	let requestId = 0;
	await new Promise<void>((resolve, reject) => {
		socket.addEventListener("open", () => resolve(), { once: true });
		socket.addEventListener("error", (event) => reject(event), { once: true });
	});
	socket.addEventListener("message", (event) => {
		const message = JSON.parse(String(event.data)) as {
			id?: number;
			result?: unknown;
			error?: unknown;
		};
		if (message.id === undefined) return;
		const handler = pending.get(message.id);
		if (!handler) return;
		pending.delete(message.id);
		if (message.error) handler.reject(message.error);
		else handler.resolve(message.result);
	});
	const request = (method: string, params: Record<string, unknown> = {}) =>
		new Promise<unknown>((resolve, reject) => {
			const id = ++requestId;
			pending.set(id, { resolve, reject });
			socket.send(JSON.stringify({ id, method, params }));
		});
	try {
		await request("Runtime.enable");
		const deadline = Date.now() + 300_000;
		while (true) {
			const status = (await request("Runtime.evaluate", {
				expression: "Boolean(globalThis.App7?.ready)",
				returnByValue: true,
			})) as { result?: { value?: boolean } };
			if (status.result?.value) break;
			if (Date.now() >= deadline) throw new Error("等待 Benchmark 初始化超时");
			await Bun.sleep(250);
		}
		const expression = `(() => {
			const template = App7.data.entries.find(({ id }) => id === ${JSON.stringify(templateSchemeId)});
			if (!template) throw new Error("HTML 中找不到模板方案");
			const sourceConfig = ${JSON.stringify(renderingScheme)};
			const entry = { ...template, ...sourceConfig, actual: sourceConfig.capacity };
			const source = keyboardSVG(entry, null, 28, 21, 20);
			const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
			const root = parsed.documentElement;
			if (root.tagName.toLowerCase() === "parsererror") throw new Error("HTML 导出的键盘 SVG 无法解析");
			for (const group of root.querySelectorAll("g[data-key]")) if (!/^[A-Z]$/.test(group.getAttribute("data-key") || "")) group.remove();
			root.setAttribute("viewBox", "0 0 ${cropWidth} ${cropHeight}");
			root.setAttribute("role", "img");
			root.setAttribute("aria-labelledby", "title desc");
			const background = Array.from(root.children).find((element) => element.tagName.toLowerCase() === "rect");
			if (background) background.setAttribute("width", "${cropWidth}");
			const namespace = "http://www.w3.org/2000/svg";
			const title = parsed.createElementNS(namespace, "title");
			title.id = "title";
			title.textContent = "无飞键道·神韵 U357 声韵映射图";
			const description = parsed.createElementNS(namespace, "desc");
			description.id = "desc";
			description.textContent = "无飞键道·神韵 U357 的声母、韵母与辅键映射。";
			const heading = root.querySelector('text[x="24"][y="34"]');
			if (heading) heading.textContent = "无飞键道·神韵 U357";
			root.insertBefore(description, root.firstChild);
			root.insertBefore(title, description);
			return new XMLSerializer().serializeToString(root) + "\\n";
		})()`;
		const evaluated = (await request("Runtime.evaluate", {
			expression,
			returnByValue: true,
			awaitPromise: true,
		})) as {
			result?: { value?: string };
			exceptionDetails?: { text?: string };
		};
		if (evaluated.exceptionDetails || !evaluated.result?.value) {
			throw new Error(evaluated.exceptionDetails?.text ?? "CDP 未返回 SVG");
		}
		return evaluated.result.value;
	} finally {
		void request("Page.close").catch(() => undefined);
		socket.close();
	}
}

async function main() {
	let svg: string;
	if (cdp) {
		svg = await renderOverCdp(cdp);
	} else {
		const browser = await chromium.launch({
			executablePath: findBrowser(positional[1]),
			headless: true,
			timeout: 30_000,
		});

		try {
			const page = await browser.newPage();
			await page.goto(pathToFileURL(htmlPath).href, {
				waitUntil: "load",
				timeout: 300_000,
			});
			await page.waitForFunction(
				() =>
					(globalThis as typeof globalThis & { App7?: { ready?: boolean } })
						.App7?.ready === true,
				undefined,
				{ timeout: 300_000 },
			);

			const nativeSvg = await page.evaluate(
				({ templateId, source }) => {
					const scope = globalThis as typeof globalThis & {
						App7: {
							data: {
								entries: Array<Record<string, unknown> & { id: string }>;
							};
						};
						keyboardSVG: (
							entry: Record<string, unknown> & { id: string },
							loads: null,
							final: number,
							onset: number,
							alias: number,
						) => string;
					};
					const template = scope.App7.data.entries.find(
						({ id }) => id === templateId,
					);
					if (!template) throw new Error(`HTML 中找不到模板方案 ${templateId}`);
					const entry = { ...template, ...source, actual: source.capacity };
					return scope.keyboardSVG(entry, null, 28, 21, 20);
				},
				{ templateId: templateSchemeId, source: renderingScheme },
			);

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
					title.textContent = "无飞键道·神韵 U357 声韵映射图";
					const description = document.createElementNS(namespace, "desc");
					description.id = "desc";
					description.textContent =
						"无飞键道·神韵 U357 的声母、韵母与辅键映射。";
					const heading = root.querySelector('text[x="24"][y="34"]');
					if (heading) heading.textContent = "无飞键道·神韵 U357";
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
			`声韵图校验通过：${scheme.id}，26 个字母键，${cropWidth}×${cropHeight}。`,
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
