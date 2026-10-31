import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const cropWidth = 1040;
const cropHeight = 590;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDirectory, "..");
const args = process.argv.slice(2);
const is21x26 = args.includes("--21x26");
const scheme = JSON.parse(
	readFileSync(
		join(
			root,
			"config",
			is21x26 ? "shenyun-21x26-mapping.json" : "shenyun-21x21-mapping.json",
		),
		"utf8",
	),
) as {
	id: string;
	candidateId?: string;
	name: string;
	capacity: [number, number];
	toneKeys: string;
	initialMap: Record<string, string>;
	finalMap: Record<string, string>;
};
const targetSchemeId = is21x26 ? scheme.id : (scheme.candidateId ?? scheme.id);
const displayName = is21x26
	? "神韵(Overall-17) 21×26 双拼"
	: "无飞键道(U357) 21×21 双拼";
const outputPath = join(
	root,
	"docs",
	is21x26 ? "shenyun-overall17-keyboard.svg" : "shenyun-u357-keyboard.svg",
);

const check = args.includes("--check");
const cdp = args
	.find((arg) => arg.startsWith("--cdp="))
	?.slice("--cdp=".length);
const positional = args.filter(
	(arg) => arg !== "--check" && arg !== "--21x26" && !arg.startsWith("--cdp="),
);
if (!positional[0]) {
	throw new Error(
		"用法：tsx 生成神韵键盘图.ts <benchmark.html> [浏览器可执行文件] [--21x26] [--check]",
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
	type CdpResponse = { id?: number; result?: unknown; error?: unknown };
	const connect = async (url: string) => {
		const socket = new WebSocket(url);
		const pending = new Map<
			number,
			{ resolve: (value: unknown) => void; reject: (reason: unknown) => void }
		>();
		let requestId = 0;
		await new Promise<void>((resolve, reject) => {
			socket.addEventListener("open", () => resolve(), { once: true });
			socket.addEventListener("error", (event) => reject(event), {
				once: true,
			});
		});
		socket.addEventListener("message", (event) => {
			const message = JSON.parse(String(event.data)) as CdpResponse;
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
		return { socket, request };
	};
	const base = endpoint.replace(/\/$/u, "");
	const version = (await fetch(`${base}/json/version`).then((response) =>
		response.json(),
	)) as { webSocketDebuggerUrl: string };
	const browser = await connect(version.webSocketDebuggerUrl);
	const created = (await browser.request("Target.createTarget", {
		url: pathToFileURL(htmlPath).href,
	})) as { targetId: string };
	browser.socket.close();
	const targets = (await fetch(`${base}/json/list`).then((response) =>
		response.json(),
	)) as Array<{ id: string; webSocketDebuggerUrl: string }>;
	const target = targets.find(({ id }) => id === created.targetId);
	if (!target) throw new Error("CDP 未返回新建页面");
	const page = await connect(target.webSocketDebuggerUrl);
	try {
		await page.request("Runtime.enable");
		const deadline = Date.now() + 300_000;
		while (true) {
			const status = (await page.request("Runtime.evaluate", {
				expression: "Boolean(globalThis.App7?.ready)",
				returnByValue: true,
			})) as { result?: { value?: boolean } };
			if (status.result?.value) break;
			if (Date.now() >= deadline) throw new Error("等待 Benchmark 初始化超时");
			await Bun.sleep(250);
		}
		const expression = `(() => {
			const entry = App7.data.entries.find(({ id }) => id === ${JSON.stringify(targetSchemeId)});
			if (!entry) throw new Error("HTML 中找不到目标方案");
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
			const title = root.querySelector("title");
			if (title) title.textContent = ${JSON.stringify(`${displayName} 声韵映射图`)};
			const description = root.querySelector("desc");
			if (description) description.textContent = ${JSON.stringify(`${displayName} 的声母、韵母与辅键映射。`)};
			const heading = root.querySelector('text[x="24"][y="34"]');
			if (heading) heading.textContent = ${JSON.stringify(displayName)};
			return new XMLSerializer().serializeToString(root) + "\\n";
		})()`;
		const evaluated = (await page.request("Runtime.evaluate", {
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
		void page.request("Page.close").catch(() => undefined);
		page.socket.close();
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
			timeout: 120_000,
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

			const nativeSvg = await page.evaluate((targetId) => {
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
				const entry = scope.App7.data.entries.find(({ id }) => id === targetId);
				if (!entry) throw new Error(`HTML 中找不到目标方案 ${targetId}`);
				return scope.keyboardSVG(entry, null, 28, 21, 20);
			}, targetSchemeId);

			svg = await page.evaluate(
				({ source, width, height, name }) => {
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
					title.textContent = `${name} 声韵映射图`;
					const description = document.createElementNS(namespace, "desc");
					description.id = "desc";
					description.textContent = `${name} 的声母、韵母与辅键映射。`;
					const heading = root.querySelector('text[x="24"][y="34"]');
					if (heading) heading.textContent = name;
					root.insertBefore(description, root.firstChild);
					root.insertBefore(title, description);

					return `${new XMLSerializer().serializeToString(root)}\n`;
				},
				{
					source: nativeSvg,
					width: cropWidth,
					height: cropHeight,
					name: displayName,
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
