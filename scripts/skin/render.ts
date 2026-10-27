import type {
	Action,
	CandidateContextMenu,
	CandidateStyle,
	Cell,
	Config,
	GeometryStyle,
	HamsterSkinConfig,
	HorizontalCandidateStyle,
	Keyboard,
	KeyboardCollection,
	KeyboardConfig,
	KeyboardStyle,
	Layout,
	LayoutElement,
	PreeditStyle,
	SystemImageName,
	SystemImageStyle,
	TextStyle,
	ToolbarStyle,
	VerticalCandidateStyle,
} from "./types";

type Collection = Record<string, unknown>;

// 保留 iOS 的 SF Symbols，为 Android 显式指定对应的 Material Icon。
// https://ihsiao.com/apps/hamster/v3/docs/guides/skins/styles/#systemimage
const materialIcons: Record<string, string> = {
	globe: "language",
	shift: "shift",
	"delete.left": "backspace",
	return: "keyboard_return",
	"r.circle": "settings",
	"chevron.down.circle": "expand_circle_down",
	"characters.uppercase": "match_case",
	character: "language_pinyin",
	function: "functions",
	"doc.on.clipboard": "content_paste",
	"text.quote": "text_snippet",
	"chevron.forward": "chevron_right",
	"chevron.down": "expand_more",
	"chevron.up": "expand_less",
};

function systemImageName(ios: string): SystemImageName {
	const android = materialIcons[ios];
	if (!android) throw new Error(`缺少 Android 图标映射：${ios}`);
	return { ios, android };
}

function parseAction(raw: string, symbol?: boolean): Action {
	if (raw.length === 1) {
		return symbol ? { symbol: raw } : { character: raw };
	} else if (raw.startsWith("#")) {
		return { shortcut: raw };
	} else if (raw.startsWith("*")) {
		return { sendKeys: raw.slice(1) };
	} else if (raw.startsWith("!")) {
		return { keyboardType: raw.slice(1) };
	} else {
		return raw as Action;
	}
}

function makeKeyboardLayoutStyles(config: Config): Collection {
	const baseColor = config.dark ? "707070" : "f7f7f7";
	const altColor = config.dark ? "4c4c4c" : "e7e7e7";
	const mainBackground: GeometryStyle = {
		buttonStyleType: "geometry",
		insets: { left: 2, right: 2, top: 2, bottom: 2 },
		normalColor: baseColor,
		highlightColor: altColor,
		cornerRadius: 2,
	};
	const fnBackground: GeometryStyle = {
		...mainBackground,
		normalColor: altColor,
		highlightColor: baseColor,
	};
	const styles: Collection = { mainBackground, fnBackground };
	const mainColor = config.dark ? "ffffff" : "000000";
	const mainLabel: Omit<TextStyle, "text"> = {
		buttonStyleType: "text",
		normalColor: mainColor,
		highlightColor: mainColor,
		fontSize: 20,
		fontWeight: "regular",
		center: { y: 0.45 },
	};
	const fnLabel: Omit<SystemImageStyle, "systemImageName"> = {
		buttonStyleType: "systemImage",
		normalColor: mainColor,
		highlightColor: mainColor,
		fontSize: 16,
	};
	const swipeColor = config.dark ? "e5e5e5" : "575757";
	const upSwipe: Omit<TextStyle, "text"> = {
		buttonStyleType: "text",
		normalColor: swipeColor,
		highlightColor: swipeColor,
		fontSize: 10,
		fontWeight: "regular",
		center: { y: 0.2 },
	};
	const downSwipe: Omit<TextStyle, "text"> = {
		...upSwipe,
		center: { y: 0.8 },
	};
	const rainbow = [
		{ dark: "#893E3E", dark2: "#AC5353", light: "#ECB6B6", light2: "#DA7171" },
		{ dark: "#7A5329", dark2: "#AE753A", light: "#F3D9C9", light2: "#E8B696" },
		{ dark: "#636321", dark2: "#959537", light: "#F5F0C2", light2: "#F4E98B" },
		{ dark: "#3E6F49", dark2: "#5E9A6B", light: "#BCE6C5", light2: "#8FD69F" },
		{ dark: "#366872", dark2: "#4C8F9D", light: "#B2E6F0", light2: "#8ADAEA" },
		{ dark: "#205C83", dark2: "#418CBE", light: "#A5D4F3", light2: "#81C3EF" },
		{ dark: "#605388", dark2: "#8174AA", light: "#C7BAF2", light2: "#B3A1ED" },
	];
	for (const [index, color] of rainbow.entries()) {
		const baseColor = config.dark ? color.dark : color.light;
		const altColor = config.dark ? color.dark2 : color.light2;
		const backgroundStyle: GeometryStyle = {
			...structuredClone(mainBackground),
			normalColor: baseColor,
			highlightColor: altColor,
		};
		styles[`color${index}`] = backgroundStyle;
		const altBackgroundStyle: GeometryStyle = {
			...structuredClone(mainBackground),
			normalColor: altColor,
			highlightColor: baseColor,
		};
		styles[`color${index}Alt`] = altBackgroundStyle;
	}
	for (const row of config.keyInfos) {
		for (const [keyIndex, key] of row.entries()) {
			const isCharacter = key.action.length === 1;
			const isAlphabet = /^[a-zA-Z]$/.test(key.action);
			const name = key.name ?? key.action;
			const action = parseAction(key.action, config.symbol);
			const foregroundStyle: string[] = [];
			if (action !== "space") {
				// label
				const labelName = `${name}Label`;
				foregroundStyle.push(labelName);
				if (isCharacter) {
					styles[labelName] = {
						...structuredClone(mainLabel),
						text: key.label ?? key.action,
					};
				} else {
					styles[labelName] = {
						...structuredClone(fnLabel),
						systemImageName: systemImageName(key.label ?? key.action),
					};
				}
			}
			let swipeUpAction: Action | undefined;
			let swipeDownAction: Action | undefined;
			if (key.up || isAlphabet) {
				const up = key.up ?? key.action.toUpperCase();
				const swipeUpName = `${name}SwipeUp`;
				foregroundStyle.push(swipeUpName);
				styles[swipeUpName] = {
					...structuredClone(upSwipe),
					text: key.upLabel ?? up,
				};
				swipeUpAction = parseAction(up, config.symbol);
			}
			if (key.down) {
				const swipeDownName = `${name}SwipeDown`;
				foregroundStyle.push(swipeDownName);
				styles[swipeDownName] = {
					...structuredClone(downSwipe),
					text: key.downLabel ?? key.down,
				};
				swipeDownAction = parseAction(key.down, config.symbol);
			}
			let backgroundStyle: string;
			if (isCharacter) {
				if (isAlphabet && config.colorful) {
					const specialCharacters = config.specialCharacters ?? "aeiou";
					backgroundStyle = specialCharacters.includes(key.action)
						? `color${keyIndex}Alt`
						: `color${keyIndex}`;
				} else {
					backgroundStyle = "mainBackground";
				}
			} else {
				backgroundStyle = "fnBackground";
			}
			const c: Cell = {
				size: { width: key.width ?? `1/${row.length}` },
				backgroundStyle,
				foregroundStyle: config.label ? foregroundStyle : [],
				action,
				swipeUpAction,
				swipeDownAction,
			};
			if (isAlphabet) {
				const shiftName = `${name}Shift`;
				styles[shiftName] = {
					...structuredClone(mainLabel),
					text: key.action.toUpperCase(),
				};
				const foreground = [...c.foregroundStyle];
				foreground[0] = shiftName;
				c.uppercasedStateForegroundStyle = config.label ? foreground : [];
				c.capsLockedStateForegroundStyle = config.label
					? structuredClone(foreground)
					: [];
				c.uppercasedStateAction = parseAction(
					key.action.toUpperCase(),
					config.symbol,
				);
			}
			styles[name] = c;
		}
	}
	return styles;
}

function makeGeneralStyles(config: Config): Collection {
	const background: GeometryStyle = {
		buttonStyleType: "geometry",
		normalColor: config.dark ? "2C2C2C03" : "D1D1D1FC",
	};
	return { background };
}

function makePreeditStyle(config: Config): [PreeditStyle, Collection] {
	const preedit = {
		insets: { left: 1, right: 1, top: 1, bottom: 1 },
		backgroundStyle: "background",
		foregroundStyle: "preeditForeground",
	};
	const preeditForeground: TextStyle = {
		buttonStyleType: "text",
		normalColor: config.dark ? "ffffff" : "000000",
		fontSize: 16,
		fontWeight: "regular",
		text: "",
	};
	return [preedit, { preeditForeground }];
}

function makeToolbar(
	config: Config,
): [ToolbarStyle, LayoutElement[], Collection] {
	const buttonColor = config.dark ? "E5E5E5" : "575757";
	const toolbar: ToolbarStyle = {
		backgroundStyle: "background",
	};
	const cellBase = {
		backgroundStyle: "buttonBackground",
		size: { width: "1/7" },
	};
	const styleBase = {
		buttonStyleType: "systemImage",
		normalColor: buttonColor,
		highlightColor: buttonColor,
		fontSize: 16,
	} as const;
	const hamster: Cell = {
		foregroundStyle: "hamsterImage",
		action: { openURL: "hamster3://" },
		...cellBase,
	};
	const hamsterImage: SystemImageStyle = {
		systemImageName: systemImageName("r.circle"),
		...styleBase,
	};
	const dismiss: Cell = {
		foregroundStyle: "dismissImage",
		action: "dismissKeyboard",
		...cellBase,
	};
	const dismissImage: SystemImageStyle = {
		systemImageName: systemImageName("chevron.down.circle"),
		...styleBase,
	};
	const alphabetic: Cell = {
		foregroundStyle: "alphabeticImage",
		action: { keyboardType: "alphabetic" },
		...cellBase,
	};
	const alphabeticImage: SystemImageStyle = {
		systemImageName: systemImageName("characters.uppercase"),
		...styleBase,
	};
	const pinyin: Cell = {
		foregroundStyle: "pinyinImage",
		action: { keyboardType: "pinyin" },
		...cellBase,
	};
	const pinyinImage: SystemImageStyle = {
		systemImageName: systemImageName("character"),
		...styleBase,
	};
	const script: Cell = {
		foregroundStyle: "scriptImage",
		action: { shortcut: "#toggleScriptView" },
		...cellBase,
	};
	const scriptImage: SystemImageStyle = {
		systemImageName: systemImageName("function"),
		...styleBase,
	};
	const clipboard: Cell = {
		foregroundStyle: "clipboardImage",
		action: { shortcut: "#showPasteboardView" },
		...cellBase,
	};
	const clipboardImage: SystemImageStyle = {
		systemImageName: systemImageName("doc.on.clipboard"),
		...styleBase,
	};
	const phrase: Cell = {
		foregroundStyle: "phraseImage",
		action: { shortcut: "#showPhraseView" },
		...cellBase,
	};
	const phraseImage: SystemImageStyle = {
		systemImageName: systemImageName("text.quote"),
		...styleBase,
	};
	const styles = {
		hamster,
		hamsterImage,
		dismiss,
		dismissImage,
		alphabetic,
		alphabeticImage,
		pinyin,
		pinyinImage,
		script,
		scriptImage,
		clipboard,
		clipboardImage,
		phrase,
		phraseImage,
	};
	const toolbarLayout: LayoutElement[] = [
		{
			HStack: {
				subviews: [
					{ Cell: "hamster" },
					{ Cell: "phrase" },
					{ Cell: "clipboard" },
					{ Cell: "script" },
					{ Cell: "pinyin" },
					{ Cell: "alphabetic" },
					{ Cell: "dismiss" },
				],
			},
		},
	];
	return [toolbar, toolbarLayout, styles];
}

function makeCandidates(
	config: Config,
): [
	Pick<
		Keyboard,
		| "horizontalCandidatesStyle"
		| "horizontalCandidatesLayout"
		| "verticalCandidatesStyle"
		| "verticalCandidatesLayout"
		| "candidateContextMenu"
	>,
	Collection,
] {
	const backgroundColor = config.dark ? "000000" : "ffffff";
	const textColor = config.dark ? "ffffff" : "000000";
	const expandButton = {
		action: { shortcut: "#candidatesBarStateToggle" },
		foregroundStyle: "expandButtonForegroundStyle",
		size: { width: 44 },
	};
	const expandButtonForegroundStyle = {
		buttonStyleType: "systemImage",
		fontSize: 20,
		normalColor: textColor,
		highlightColor: textColor,
		systemImageName: systemImageName("chevron.forward"),
	};
	const horizontalCandidatesStyle: HorizontalCandidateStyle = {
		backgroundStyle: "background",
	};
	const horizontalCandidates = {
		candidateStyle: "horizontalCandidateStyle",
		type: "horizontalCandidates",
	};
	const horizontalCandidateStyle: CandidateStyle = {
		highlightBackgroundColor: backgroundColor,
		preferredBackgroundColor: backgroundColor,
		preferredIndexColor: textColor,
		preferredTextColor: textColor,
		preferredCommentColor: textColor,
		indexColor: textColor,
		textColor: textColor,
		commentColor: textColor,
		indexFontSize: 12,
		textFontSize: 16,
		commentFontSize: 14,
	};
	const horizontalCandidatesLayout: LayoutElement[] = [
		{
			HStack: {
				subviews: [{ Cell: "horizontalCandidates" }, { Cell: "expandButton" }],
			},
		},
	];
	const verticalCandidatesStyle: VerticalCandidateStyle = {
		backgroundStyle: "background",
	};
	const verticalCandidatesLayout: LayoutElement[] = [
		{ HStack: { subviews: [{ Cell: "verticalCandidates" }] } },
		{
			HStack: {
				style: "verticalLastRowStyle",
				subviews: [
					{ Cell: "verticalPageUpButtonStyle" },
					{ Cell: "verticalPageDownButtonStyle" },
					{ Cell: "verticalReturnButtonStyle" },
					{ Cell: "verticalBackspaceButtonStyle" },
				],
			},
		},
	];
	const verticalPageDownButtonStyle = {
		action: { shortcut: "#verticalCandidatesPageDown" },
		backgroundStyle: "systemButtonBackgroundStyle",
		foregroundStyle: "verticalPageDownButtonStyleForegroundStyle",
	};
	const verticalPageDownButtonStyleForegroundStyle = {
		buttonStyleType: "systemImage",
		fontSize: 20,
		highlightColor: textColor,
		normalColor: textColor,
		systemImageName: systemImageName("chevron.down"),
	};
	const verticalPageUpButtonStyle = {
		action: { shortcut: "#verticalCandidatesPageUp" },
		backgroundStyle: "systemButtonBackgroundStyle",
		foregroundStyle: "verticalPageUpButtonStyleForegroundStyle",
	};
	const verticalPageUpButtonStyleForegroundStyle = {
		buttonStyleType: "systemImage",
		fontSize: 20,
		normalColor: textColor,
		highlightColor: textColor,
		systemImageName: systemImageName("chevron.up"),
	};
	const verticalReturnButtonStyle = {
		action: { shortcut: "#candidatesBarStateToggle" },
		backgroundStyle: "systemButtonBackgroundStyle",
		foregroundStyle: "verticalReturnButtonStyleForegroundStyle",
	};
	const verticalReturnButtonStyleForegroundStyle = {
		buttonStyleType: "systemImage",
		fontSize: 20,
		normalColor: textColor,
		highlightColor: textColor,
		systemImageName: systemImageName("return"),
	};
	const verticalLastRowStyle = {
		size: { height: 45 },
	};
	const verticalCandidates = {
		candidateStyle: "verticalCandidateStyle",
		insets: { bottom: 8, left: 8, right: 8, top: 8 },
		maxColumns: 6,
		maxRows: 5,
		separatorColor: "#C6C6C8",
		type: "verticalCandidates",
	};
	const verticalCandidateStyle = {
		commentColor: textColor,
		commentFontSize: 14,
		highlightBackgroundColor: backgroundColor,
		indexColor: textColor,
		indexFontSize: 12,
		insets: { bottom: 4, left: 6, right: 6, top: 4 },
		preferredBackgroundColor: backgroundColor,
		preferredCommentColor: textColor,
		preferredIndexColor: textColor,
		preferredTextColor: textColor,
		textColor: textColor,
		textFontSize: 16,
	};
	const verticalBackspaceButtonStyle = {
		action: "backspace",
		backgroundStyle: "systemButtonBackgroundStyle",
		foregroundStyle: "verticalBackspaceButtonStyleForegroundStyle",
	};
	const verticalBackspaceButtonStyleForegroundStyle = {
		buttonStyleType: "systemImage",
		fontSize: 20,
		highlightColor: textColor,
		normalColor: textColor,
		systemImageName: systemImageName("delete.left"),
	};
	const candidateContextMenu: CandidateContextMenu = [
		{ name: "固定", action: { sendKeys: "Control+semicolon" } },
		{ name: "前移", action: { sendKeys: "Control+bracketleft" } },
		{ name: "后移", action: { sendKeys: "Control+bracketright" } },
		{ name: "加词", action: { sendKeys: "Control+apostrophe" } },
		{ name: "重置", action: { sendKeys: "Control+backslash" } },
	];
	const values = {
		horizontalCandidatesStyle,
		horizontalCandidatesLayout,
		verticalCandidatesStyle,
		verticalCandidatesLayout,
		candidateContextMenu,
	};
	const styles = {
		expandButton,
		expandButtonForegroundStyle,
		horizontalCandidates,
		horizontalCandidateStyle,
		verticalCandidates,
		verticalCandidateStyle,
		verticalLastRowStyle,
		verticalPageDownButtonStyle,
		verticalPageDownButtonStyleForegroundStyle,
		verticalPageUpButtonStyle,
		verticalPageUpButtonStyleForegroundStyle,
		verticalReturnButtonStyle,
		verticalReturnButtonStyleForegroundStyle,
		verticalBackspaceButtonStyle,
		verticalBackspaceButtonStyleForegroundStyle,
	};
	return [values, styles];
}

function makeKeyboardLayout(
	config: Config,
): [Layout, KeyboardStyle, Collection] {
	const styles: Collection = makeKeyboardLayoutStyles(config);
	const keyboardStyle: KeyboardStyle = {
		backgroundStyle: "backgroundOriginalStyle",
	};
	const keyboardLayout: Layout = config.keyInfos.map((row) => {
		return {
			HStack: { subviews: row.map((x) => ({ Cell: x.name ?? x.action })) },
		};
	});
	return [keyboardLayout, keyboardStyle, styles];
}

export function makeHamsterSkin(config: Config): Keyboard {
	const styles = makeGeneralStyles(config);
	const [preeditStyle, styles1] = makePreeditStyle(config);
	const [toolbarStyle, toolbarLayout, styles2] = makeToolbar(config);
	const [candidates, styles3] = makeCandidates(config);
	const [keyboardLayout, keyboardStyle, styles4] = makeKeyboardLayout(config);
	return {
		preeditHeight: 24,
		preeditStyle,
		toolbarHeight: 32,
		toolbarStyle,
		toolbarLayout,
		...candidates,
		keyboardHeight: 256,
		keyboardLayout,
		keyboardStyle,
		...styles,
		...styles1,
		...styles2,
		...styles3,
		...styles4,
	};
}

export function makeHamsterSkinConfig(
	name: string,
	keyboards: KeyboardCollection,
): HamsterSkinConfig {
	const make = (name: string): KeyboardConfig => ({
		iPhone: {
			portrait: name,
			landscape: name,
		},
		iPad: {
			portrait: name,
			landscape: name,
			floating: name,
		},
	});
	return {
		name,
		author: "谭淞宸 <i@tansongchen.com>",
		pinyin: make("pinyin"),
		numeric: "numeric" in keyboards ? make("numeric") : make("pinyin"),
		symbolic: "symbolic" in keyboards ? make("symbolic") : make("pinyin"),
		...Object.fromEntries(
			Object.keys(keyboards)
				.filter((key) => !["pinyin", "numeric", "symbolic"].includes(key))
				.map((key) => [key, make(key)]),
		),
	};
}
