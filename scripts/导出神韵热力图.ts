import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium, type Page } from "playwright-core";

const args = process.argv.slice(2);
const check = args.includes("--check");
const is21x26 = args.includes("--21x26");
const cdp = args
	.find((arg) => arg.startsWith("--cdp="))
	?.slice("--cdp=".length);
const positional = args.filter(
	(arg) => arg !== "--check" && arg !== "--21x26" && !arg.startsWith("--cdp="),
);
if (!positional[0]) {
	throw new Error(
		"用法：tsx 导出神韵热力图.ts <benchmark.html> [浏览器可执行文件] [--21x26] [--check]",
	);
}

const htmlPath = resolve(positional[0]);
if (!existsSync(htmlPath))
	throw new Error(`找不到 benchmark HTML：${htmlPath}`);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const scheme = JSON.parse(
	readFileSync(
		join(
			root,
			"config",
			is21x26 ? "shenyun-21x26-mapping.json" : "shenyun-21x21-mapping.json",
		),
		"utf8",
	),
) as { id: string; candidateId?: string };
const targetSchemeId = is21x26 ? scheme.id : (scheme.candidateId ?? scheme.id);
const displayName = is21x26
	? "神韵(Overall-17) 21×26 双拼"
	: "无飞键道(U357) 21×21 双拼";
const output = join(
	root,
	"docs",
	is21x26
		? "shenyun-overall17-keyboard-heat.svg"
		: "shenyun-u357-keyboard-heat.svg",
);

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
	if (!browser) throw new Error("找不到 Chrome/Edge/Chromium。");
	return browser;
}

const expression = `(() => {
	R9_MX.corpus = "daily";
	R9_MX.variant = "native-punctuation";
	const wrapper = document.createElement("div");
	wrapper.innerHTML = r9MacroHeat(${JSON.stringify(targetSchemeId)});
	const svg = wrapper.querySelector("#r9MacroSVG svg");
	if (!svg) throw new Error("HTML 中找不到目标方案的文稿热力图");
	svg.setAttribute("role", "img");
	svg.setAttribute("aria-labelledby", "title desc");
	const title = svg.querySelector("title");
	if (title) {
		title.id = "title";
		title.textContent = ${JSON.stringify(`${displayName}日常八场景文稿纯双拼键频图（含标点）`)};
	}
	const description = document.createElementNS("http://www.w3.org/2000/svg", "desc");
	description.id = "desc";
	description.textContent = "直接导出自 benchmark HTML 的 34 键日常文稿热力图；只含双拼与文稿标点，不含五辅键、空格和选重。";
	svg.insertBefore(description, title?.nextSibling ?? svg.firstChild);
	return new XMLSerializer().serializeToString(svg) + "\\n";
})()`;

async function waitUntilReady(
	request: (
		method: string,
		params?: Record<string, unknown>,
	) => Promise<unknown>,
) {
	const deadline = Date.now() + 300_000;
	while (true) {
		const status = (await request("Runtime.evaluate", {
			expression: "Boolean(globalThis.App7?.ready)",
			returnByValue: true,
		})) as { result?: { value?: boolean } };
		if (status.result?.value) return;
		if (Date.now() >= deadline) throw new Error("等待 Benchmark 初始化超时");
		await Bun.sleep(250);
	}
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
		await waitUntilReady(page.request);
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

async function renderWithPage(page: Page) {
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
	return await page.evaluate(expression);
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
			svg = await renderWithPage(await browser.newPage());
		} finally {
			await browser.close();
		}
	}
	const keyCount = [...svg.matchAll(/data-mxkey=/gu)].length;
	if (keyCount !== 34)
		throw new Error(`热力图应有 34 个键，实际 ${keyCount} 个。`);
	if (check) {
		if (!existsSync(output) || readFileSync(output, "utf8") !== svg) {
			throw new Error(`热力图与 benchmark HTML 不一致：${output}`);
		}
		console.log(`热力图校验通过：${displayName}，34 键。`);
	} else {
		writeFileSync(output, svg, "utf8");
		console.log(`已从 benchmark HTML 直接导出：${output}`);
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
