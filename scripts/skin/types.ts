export type HamsterSkinConfig = {
	name: string; // 皮肤名称
	author: string; // 作者名称
	fontface?: FontFace; // 字体名称
	pinyin: KeyboardConfig; // 拼音键盘配置
	alphabetic?: KeyboardConfig; // 字母键盘配置
	numeric: KeyboardConfig; // 数字键盘配置
	symbolic: KeyboardConfig; // 符号键盘配置
};

export type FontFaceConfig = {
	url: string; // 字体文件的 URL
	name: string; // 字体名称
	ranges?: { location: number; length: number }[]; // 可选的字体范围
};

export type KeyboardConfig = {
	iPhone: {
		portrait: string;
		landscape: string;
	};
	iPad: {
		portrait: string;
		landscape: string;
		floating: string;
	};
};

export type Keyboard = {
	preeditHeight: Height;
	preeditStyle: PreeditStyle;
	toolbarHeight: Height;
	toolbarStyle: ToolbarStyle;
	toolbarLayout: Layout;
	horizontalCandidatesStyle: HorizontalCandidateStyle;
	horizontalCandidatesLayout: Layout;
	verticalCandidatesStyle: VerticalCandidateStyle;
	verticalCandidatesLayout: Layout;
	candidateContextMenu: CandidateContextMenu;
	keyboardHeight: Height;
	keyboardStyle: KeyboardStyle;
	keyboardLayout: Layout;
	[k: string]: unknown; // 其他样式或属性
};

// 预编辑区 Preedit

export type PreeditStyle = {
	insets: Insets;
	backgroundStyle: Ref<Style>;
	foregroundStyle: Ref<Style>;
};

// 工具栏区 Toolbar

export type ToolbarStyle = {
	backgroundStyle: Ref<Style>;
};

export type HorizontalCandidateStyle = {
	insets?: Insets;
	backgroundStyle?: Ref<Style>;
};

export type HorizontalCandidates = {
	type: "horizontalCandidates";
	size: Size;
	insets: Insets;
	backgroundStyle: Ref<Style>;
	candidateStyle: Ref<CandidateStyle>;
};

export type CandidateStyle = {
	insets?: Insets;
	highlightBackgroundColor?: Color;
	preferredBackgroundColor?: Color;
	preferredIndexColor?: Color;
	preferredTextColor?: Color;
	preferredCommentColor?: Color;
	indexColor?: Color;
	textColor?: Color;
	commentColor?: Color;
	indexFontSize?: number;
	textFontSize?: number;
	commentFontSize?: number;
};

export type CandidateStateButtonStyle = {
	backgroundStyle: Ref<CandidateStateButtonBackgroundStyle>;
	foregroundStyle: Refs<CandidateStateButtonForegroundStyle>;
};

export type CandidateStateButtonBackgroundStyle = {
	normalColor: string;
	highlightColor: string;
};

export type CandidateStateButtonForegroundStyle = {
	normalImage: string;
	highlightImage: string;
};

export type VerticalCandidateStyle = {
	insets?: Insets;
	backgroundStyle?: Ref<Style>;
};

export type VerticalCandidates = {
	type: "verticalCandidates";
	maxRows: number;
	separatorColor: "#33338888";
	backgroundStyle: Ref<Style>;
	candidateStyle: Ref<CandidateStyle>;
};

export type CandidateContextMenu = CandidateContextMenuItem[];

export type CandidateContextMenuItem = {
	name: string;
	action: Action;
};

// 键盘 Keyboard

export type KeyboardStyle = {
	backgroundStyle: Ref<Style>;
};

export type LayoutElement = CellReference | HStack | VStack;

export type CellReference = {
	Cell: Ref<Cell>;
};

export type HStack = {
	HStack: {
		subviews: LayoutElement[];
		style?: Ref<StackStyle>;
	};
};

export type VStack = {
	VStack: {
		subviews: LayoutElement[];
		style?: Ref<StackStyle>;
	};
};

export type StackStyle = {
	size: Size;
};

export type Cell = {
	size?: Size;
	bounds?: Bounds;
	backgroundStyle?: BackgroundStyle;
	foregroundStyle: ForegroundStyle;
	uppercasedStateForegroundStyle?: ForegroundStyle;
	capsLockedStateForegroundStyle?: ForegroundStyle;
	hintStyle?: HintStyle;
	hintSymbolsStyle?: HoldSymbolsStyle;

	action?: Action;
	repeatAction?: Action;
	uppercasedStateAction?: Action;
	swipeUpAction?: Action;
	swipeDownAction?: Action;
	animation?: AnimationConfig;
	notification?: NotificationStyle;
};

export type HintStyle = {
	insets?: Insets;
	backgroundStyle?: string;
	foregroundStyle?: string;
	swipeUpForegroundStyle?: string;
	swipeDownForegroundStyle?: string;
	swipeLeftForegroundStyle?: string;
	swipeRightForegroundStyle?: string;
};

export type HoldSymbolsStyle = {
	insets?: Insets;
	backgroundStyle: string;
	foregroundStyle: string[];
	actions: Action[];
	selectedStyle?: string;
	selectedIndex?: number;
	symbolWidth?: number | string;
};

export type CollectionCellStyle = {
	backgroundStyle: string;
	foregroundStyle: string;
};

/*** 行为 ***/

export type Action =
	| PrimitiveAction
	| {
			character: string;
	  }
	| {
			symbol: string;
	  }
	| {
			sendKeys: string;
	  }
	| {
			openURL: string;
	  }
	| {
			runScript: string;
	  }
	| {
			keyboardType:
				| "pinyin"
				| "alphabetic"
				| "numeric"
				| "symbolic"
				| "emojis"
				| string;
	  }
	| {
			shortcut: string;
	  }
	| {
			switchRimeSchema: string;
	  };

export type PrimitiveAction =
	| "space"
	| "enter"
	| "tab"
	| "shift"
	| "backspace"
	| "dismissKeyboard"
	| "moveCursorBackward"
	| "moveCursorForward"
	| "returnPrimaryKeyboard"
	| "returnLastKeyboard"
	| "symbolicKeyboardLockStateToggle"
	| "settings"
	| "nextKeyboard";

/*** 动画 ***/

export type AnimationConfig = BoundsAnimation | APNGAnimation | EmitAnimation;

export type BoundsAnimation = {
	type: "bounds";
	duration: number;
	fromScale: number;
	toScale: number;
	repeatCount?: number;
};

export type APNGAnimation = {
	type: "apng";
	file: string;
	targetScale?: number;
	useCellVisibleSize?: boolean;
	zPosition?: number | "above" | "below";
};

export type EmitAnimation = {
	type: "emit";
	file: string[];
	duration: number;
	targetScale?: number;
	enableRandomImage?: boolean;
	randomPositionX?: number;
	randomPositionY?: number;
	rotationBegin?: number;
	rotationEnd?: number;
	randomRotation?: number;
	alphaBegin?: number;
	alphaEnd?: number;
};

// 通用定义

export type Ref<_> = string;

export type Refs<T> = Ref<T> | Ref<T>[];

export type Height = number | `${string}vh`;

export type Color = string;

export type FontSize = number | string;

export type TargetScale = number | { x: number; y: number };

export type Layout = LayoutElement[];

export type ContentMode =
	| "center"
	| "scaleToFill"
	| "scaleAspectFit"
	| "scaleAspectFill";

export type ExternalImage = {
	file: string;
	image: string;
};

export type Insets = {
	top?: number;
	bottom?: number;
	left?: number;
	right?: number;
};

export type Size = {
	width?: number | { percentage: number } | string;
	height?: number | { percentage: number } | string;
};

export type Bounds = Size & {
	alignment?:
		| "center"
		| "centerTop"
		| "centerBottom"
		| "left"
		| "right"
		| "leftTop"
		| "leftBottom"
		| "rightTop"
		| "rightBottom";
};

export type Point = {
	x: number;
	y: number;
};

export type Center = Partial<Point>;

export type FontWeight =
	| "ultralight"
	| "thin"
	| "light"
	| "regular"
	| "medium"
	| "semibold"
	| "bold"
	| "heavy"
	| "black";

export type BackgroundStyle = Ref<Style>;

export type ForegroundStyle = Ref<Style> | Refs<Style>;

export type Style =
	| TextStyle
	| GeometryStyle
	| SystemImageStyle
	| AssetImageStyle
	| FileImageStyle;

export type TextStyle = {
	buttonStyleType: "text";
	text: string;
	fontSize?: number;
	fontWeight?: FontWeight;
	normalColor: string;
	highlightColor?: string;
	center?: Center;
};

export type GeometryStyle = {
	buttonStyleType: "geometry";
	insets?: Insets;
	normalColor: string;
	highlightColor?: string;
	colorLocation?: number[];
	colorStartPoint?: Point;
	colorEndPoint?: Point;
	colorGradientType?: "axial" | "conic" | "radial";
	cornerRadius?: number;
	borderSize?: number;
	normalBorderColor?: string;
	highlightBorderColor?: string;
	normalLowerEdgeColor?: string;
	highlightLowerEdgeColor?: string;
	normalShadowColor?: string;
	highlightShadowColor?: string;
	shadowOpacity?: number;
	shadowRadius?: number;
	shadowOffset?: Point;
	animation?: Ref<AnimationConfig>;
};

// 平台映射中的 Android 图标名使用 Material Icon 名称，不加 material: 前缀。
export type SystemImageName = string | { ios?: string; android?: string };

export type SystemImageStyle = {
	buttonStyleType: "systemImage";
	systemImageName: SystemImageName;
	highlightSystemImageName?: SystemImageName;
	contentMode?: ContentMode;
	fontSize?: number;
	fontWeight?: FontWeight;
	normalColor: string;
	highlightColor?: string;
};

export type AssetImageStyle = {
	buttonStyleType: "assetImage";
	assetImageName: string;
	contentMode?: ContentMode;
	normalColor: string;
	highlightColor?: string;
};

export type FileImageStyle = {
	buttonStyleType: "fileImage";
	insets?: Insets;
	contentMode?: ContentMode;
	normalImage: ExternalImage;
	highlightImage?: ExternalImage;
};

/*** 通知 */

export type NotificationStyle = string | string[];

export type NotificationType = "rime" | "keyboardAction" | "returnKeyType";

/*** 图片描述文件 ***/

export type ImageDescriptionFile = Record<
	string,
	{
		rect: {
			x: number;
			y: number;
			width: number;
			height: number;
		};
		insets: Insets;
	}
>;

/*** 数据源 ***/

export type DataSourceValue = string | { label: string; value: string };
export type DataSource = Record<string, DataSourceValue[]>;

export interface Config {
	colorful: boolean;
	dark: boolean;
	label: boolean;
	symbol?: boolean;
	keyInfos: KeyInfo[][];
	specialCharacters?: string;
}

export interface KeyInfo {
	action: string;
	name?: string;
	label?: string;
	up?: string;
	upLabel?: string;
	down?: string;
	downLabel?: string;
	width?: string;
}

export type KeyboardType =
	| "pinyin"
	| "alphabetic"
	| "numeric"
	| "symbolic"
	| string;
export type KeyboardCollection = Record<KeyboardType, Omit<Config, "dark">>;
