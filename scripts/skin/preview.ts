import { Resvg } from "@resvg/resvg-js";
import { makeHamsterSkin } from "./render";
import type {
	Cell,
	Config,
	GeometryStyle,
	SystemImageStyle,
	TextStyle,
} from "./types";

function escapeXml(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

// 预览使用实际生成的按键样式；系统图标用文字替代，无需依赖 iOS 字体。
const iconLabels: Record<string, string> = {
	globe: "中/英",
	shift: "⇧",
	"delete.left": "⌫",
	return: "↵",
};

export function makeSkinPreview(config: Omit<Config, "dark">): Buffer {
	const width = 390;
	const header = 32;
	const height = 256;
	const panels = [false, true].map((dark, index) => {
		const skin = makeHamsterSkin({ ...config, dark });
		const parts = [
			`<g transform="translate(${index * width},0)">`,
			`<rect width="${width}" height="${header + height}" fill="${dark ? "#2c2c2c" : "#d1d1d1"}"/>`,
			`<text x="${width / 2}" y="22" fill="${dark ? "white" : "black"}" font-size="14" text-anchor="middle">${dark ? "暗色" : "浅色"}</text>`,
		];
		const rowHeight = height / config.keyInfos.length;
		for (const [rowIndex, row] of config.keyInfos.entries()) {
			let x = 0;
			const y = header + rowIndex * rowHeight;
			for (const key of row) {
				const cell = skin[key.name ?? key.action] as Cell;
				const [numerator, denominator] = (key.width ?? `1/${row.length}`)
					.split("/")
					.map(Number);
				const keyWidth = (width * numerator) / denominator;
				const background = skin[
					cell.backgroundStyle ?? "mainBackground"
				] as GeometryStyle;
				const color = background.normalColor.replace(/^#/, "");
				parts.push(
					`<rect x="${x + 2}" y="${y + 2}" width="${keyWidth - 4}" height="${rowHeight - 4}" rx="${background.cornerRadius}" fill="#${color}"/>`,
				);
				const foregrounds = Array.isArray(cell.foregroundStyle)
					? cell.foregroundStyle
					: [cell.foregroundStyle];
				for (const reference of foregrounds) {
					const style = skin[reference] as TextStyle | SystemImageStyle;
					const center =
						style.buttonStyleType === "text" ? style.center : undefined;
					const text =
						style.buttonStyleType === "text"
							? style.text
							: (iconLabels[key.label ?? key.action] ?? key.action);
					parts.push(
						`<text x="${x + keyWidth * (center?.x ?? 0.5)}" y="${y + rowHeight * (center?.y ?? 0.5)}" dy="0.35em" text-anchor="middle" font-size="${style.fontSize}" fill="#${style.normalColor.replace(/^#/, "")}">${escapeXml(text)}</text>`,
					);
				}
				x += keyWidth;
			}
		}
		return [...parts, "</g>"].join("");
	});
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 2}" height="${header + height}" font-family="sans-serif">${panels.join("")}</svg>`;
	return new Resvg(svg, { fitTo: { mode: "zoom", value: 2 } }).render().asPng();
}
