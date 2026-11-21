# 键位图

冰雪四拼、冰雪兰拼、冰雪兰道、冰雪鹤道、冰雪鹤拼、冰雪鹮道、冰雪莲道、冰雪键道和冰雪三拼提供随时可查的键位图。冰雪一拼与冰雪清韵目前不接入此功能。

## 使用

- Windows、macOS 与 Linux 桌面端：在中文模式、输入框为空时，冰雪四拼、冰雪鹤道、冰雪鹤拼和冰雪鹮道按 `e`，其余五个方案按 `v`。Windows 首次打开时居中于当前焦点窗口，macOS 与 Linux X11 回退到当前显示器中心，原生 Wayland 的位置由合成器决定；切换方案时，已打开的浮窗跟随显示新方案的键位图且不主动改变位置。按住左键即可直接拖动，普通左键单击不关闭；按 `Esc`、单击右键或再次按当前方案的键位图键可隐藏。浮窗获得焦点后可用鼠标滚轮缩放，macOS 也支持触控板双指捏合；缩放会复用已解析的 SVG，不再为每个滚轮事件重新读取文件、扫描系统字体和解析图形。
- 元书输入法（iOS、Android）：使用本项目发布的 `.cskin` 皮肤，在工具栏“中文”按钮上滑，选择方案；短按或长按键位图不退出，上滑键位图返回中文键盘。
- 同文输入法（Android）：使用本项目发布的 `.trime.yaml` 主题，长按工具栏“中文”按钮，选择方案；短按或长按键位图不退出，上滑键位图返回中文键盘。

移动端不把 `e`／`v` 的单击改成界面操作，因为两键仍参与正常编码。键位图以保持宽高比的方式居中在输入法键盘区域；iOS 与 Android 输入法皮肤不能越过输入法区域、在宿主应用的焦点窗口中心弹出。元书和同文的皮肤配置也不能把该图片变成可拖动、可双指缩放的原生视图；这些交互需要输入法应用增加原生组件支持。第三方皮肤不会自动获得键位图页。

## 安装

桌面用户原则上不需要单独安装 helper。由当前发布工作流生成的 `snow-pinyin.zip` 会把 Windows x64、macOS 双架构（Intel／Apple silicon）和 Linux x64 三个便携构建产物以及 Windows 启动 DLL 放在压缩包根目录下的 `lua/snow/bin/`；把压缩包内容合并覆盖到现有 Rime 用户目录后重新部署即可，不要额外套一层 `rime-snow-pinyin/` 目录，也不要删除整个用户目录，以免丢失私有配置和用户词典。Lua 读取 `rime_api.get_user_data_dir()` 后拼出 `<Rime 用户目录>/lua/snow/bin/snow-keymap-平台文件名` 的绝对路径，再按当前前端选择并启动对应文件；用户不需要安装 Rust 或配置 `PATH`。

Windows 更新已有安装时，先在任务管理器结束 `snow-keymap-windows.exe`，再合并覆盖新版压缩包并重新部署。键位图隐藏后 helper 仍会常驻，重新部署只重载 Rime 方案与 Lua，不会替换或重启正在运行的 EXE；若跳过停进程这一步，Windows 可能保留旧 helper，表现为新版交互没有生效。覆盖时同时更新 `lua/snow/bin/snow_keymap_launcher.dll`；若 DLL 正被旧 Lua 状态占用，退出小狼毫后再覆盖并启动。覆盖完成后首次打开键位图会自动启动新版 helper。

截至 `v0.3.13`，已经公开的 `snow-pinyin.zip` 仍早于 helper 注入流程，尚不含 `lua/snow/bin/`；上述免安装方式从按当前工作流重新构建或替换该附件后才成立。GitHub 的“Code → Download ZIP”源码包与普通 Git 克隆同样不含发布时注入的二进制文件，开发者使用源码时需要自行构建。

手机端不会调用 Rust helper。通过链接导入本仓库只安装 Rime 方案文件；键位图页来自独立的移动皮肤资源。元书需要另外安装 Release 中 `snow-pinyin-skins-hamster.zip` 内的 `.cskin`，同文需要安装 `snow-pinyin-skins-trime.zip` 中的主题。移动端皮肤直接使用随包 PNG，不执行 `lua/snow/bin/` 下的任何桌面程序。

## 实现

Rime 的候选接口只有文本与注释，没有跨前端的图片接口，因此 Lua 只判断触发条件并发送命令，显示工作由平台层完成。

桌面端的 `tools/keymap-helper/` 是无控制台、单实例、常驻的 Rust GUI 程序。它轮询用户临时目录中的命令文件，直接把 `lua/snow/keymaps/*.svg` 栅格化到无边框、置顶且不抢焦点的窗口，并通过同目录心跳文件让重新部署后的 Lua 复用现有进程；Windows 窗口同时声明 `WS_EX_TOOLWINDOW`，避免任务栏、窗口边框工具和普通应用窗口管理误收录。方案初始化和切换只写跟随命令，helper 未运行时也不会自动启动或预加载 SVG；只有用户实际按键打开键位图时才按需启动。Windows 通过同包的 `snow_keymap_launcher.dll` 直接调用 `CreateProcessW`，不创建 CMD 控制台或同步等待 helper 初始化；DLL 导出不访问 Lua C API，因此不依赖前端的 Lua 版本。启动前保存接收快捷键的前台窗口句柄，helper 在首次显示前完成居中，避免启动过程中的焦点变化影响定位。Windows、macOS 与 X11 的窗口首次创建后持续复用，后续显隐与方案切换路径不启动 PowerShell、CMD 或新的 helper 进程。发布工作流分别生成 Windows x64、macOS 双架构（Intel／Apple silicon）和 Linux x64 可执行文件，再将它们及 Windows 启动 DLL 放入安装包的 `lua/snow/bin/`。

新输入会话首次初始化时不发送跟随命令，避免 helper 或其他应用新建会话时，用默认方案覆盖另一会话刚请求的键位图。同一会话的方案切换仍立即跟随；显隐命令始终使用接收触发键的会话方案。键位图模块不会调用方案切换接口。

Windows 的工具窗口样式通过原生 `WM_STYLECHANGING` 子类过程持续保护，同时清除 `WS_EX_APPWINDOW`。不能只在创建时设置一次：winit 在显隐、置顶等状态变化时会重写扩展样式，使工具窗口标记丢失，随后可能被平铺窗口管理器当作普通应用排版。重新显示时也会核对原生窗口与缓存图片的尺寸，修复隐藏期间被外部改成横条的窗口；此检查继续复用缓存，不重新解析或栅格化 SVG。

无边框窗口还会从原生 `GWL_STYLE` 中持续移除标题栏、系统菜单及缩放按钮，并覆盖 `WM_NCCALCSIZE` 的 `RECT` 与 `NCCALCSIZE_PARAMS` 两种形式，让客户区始终覆盖整个窗口。winit 默认保留 `WS_CAPTION`，只在后一种消息中隐藏标题栏，单靠 `with_decorations(false)` 不能覆盖所有原生拖动和边框刷新路径。此外跳过 `WM_NCPAINT` 的系统边框绘制，将 `WM_NCACTIVATE` 以 `lParam = -1` 传给原窗口过程，保留激活状态更新但禁止系统将标题栏直接画到图片上。Windows 实窗回归同时核对样式、两种边框计算、移动前后的客户区位置与尺寸，以及激活后的图像像素；只校验样式和尺寸无法发现覆盖图片的标题栏。

九份键位图的整图背景统一使用 14 SVG 单位的圆角，移动端 PNG 保留外角透明度。Windows helper 使用原生窗口区域裁去四角，随图片缩放和显示器 DPI 同比例更新，避免不透明的矩形窗口填平图片圆角；抗锯齿边缘与图内背景同色。更新 helper 后需结束旧进程并覆盖新版程序，重新部署不会替换常驻进程。

移动端由 `scripts/skin/keymaps.ts` 向每套元书和同文皮肤注入统一选择页。元书使用各明暗资源目录中的 PNG 与图片描述文件；同文使用 `backgrounds/` 中的 PNG。九份 PNG 与桌面 SVG 均由 `scripts/generate-keymaps.ts` 从同一份原生矢量定义生成，包括冰雪键道、冰雪三拼和冰雪莲道，不再包装旧键位截图。未在主码内嵌入声调的方案沿用 README 两份「声韵辅-键映射」图的莫兰迪语义：声韵占用、纯辅键与多韵键使用独立背景、纹理和边框，韵母前景色按音系族区分。九图的五笔辅统一使用键帽右上角绿框，五调辅与单双码形辅在键中无框显示，冰雪四拼的韵腹、韵尾、声调和笔画使用四种前景色。声调中文首选霞鹜文楷并回退到平台楷体或衬线体，桌面包不捆绑字体；移动端 PNG 在发布构建时已经栅格化，不依赖手机字体。

选择页采用九宫格，从上到下依次为「四拼、莲道、鹮道」「键道、兰道、鹤道」「三拼、兰拼、鹤拼」，每行从左到右排列，每个按钮占整行宽度的 `1/3`。

声母位移 link 的纯算法核心来自 benchmark 仓库，并以 `scripts/vendor/keymap-link-colors.js` 固定快照进入本仓库；共享范围仅包括首选色与候选池、OKLab `0.18` 门槛、同图 link 颜色不重复、DSATUR 动态求解及最终验证。本仓库自己的 `scripts/lib/keymap-link-colors.ts` 把 `Mapping.initialMap` 适配成核心所需的语义状态，SVG/PNG 渲染、键帽粗细、W/Y 卡片样式和产物测试仍由本仓库负责；benchmark 的 HTML 注入器与浏览器全量审计器不属于共享核心。

冰雪鹮道与冰雪莲道的声调已进入主码，键位图改用与 benchmark 一致的声调分区底色：二三声绿、四声蓝、一轻声黄，每键标注实际可用声调，`0` 表示轻声；同一韵组跨排保持同一前景色。冰雪鹮道兼作韵键的五辅键保持所属声调色，将 RGB 通道统一乘以 `0.88` 加深；冰雪莲道的纯形辅键使用淡紫。冰雪鹮道的实际调值取自冻结的完整音节码表，因此 B 键随 R2 布局标「1/0」，使用一轻声区的黄色。其他方案继续以声韵占用区分底色，独立调辅与主码内的声调分区分别表达。

更新共享核心时，在 benchmark 仓库先完成测试与提交，再运行 `bun scripts/sync-keymap-link-colors.ts --source <shuangpin-layout-benchmark 路径>`；脚本复制上游文件并更新来源提交和 SHA-256。普通生成和 CI 只运行 `bun scripts/sync-keymap-link-colors.ts --check`，只校验仓库内快照，不依赖相邻工作树；本机需要核对两仓库时可额外传入 `--source`。

README 的两张活动声韵图与九份浮窗 SVG/PNG 共用本仓库的原生生成器；纯双拼热力图直接读取 benchmark 的压缩 payload 中已冻结的日常文稿键频，不依赖浏览器。

```powershell
$benchmark = "D:\path\to\shuangpin-layout-benchmark"
bun scripts/generate-keymaps.ts
bun scripts/导出神韵热力图.ts "$benchmark\a7_CKT_R11.html" --21x26
bun scripts/导出神韵热力图.ts "$benchmark\a7_CKT_R11.html"
bun test --cwd scripts fixed-corpus/test/keymap-link-colors.test.ts fixed-corpus/test/keymaps.test.ts
```

本机开发时运行：

```powershell
cargo build --release --locked --manifest-path tools/keymap-helper/Cargo.toml
New-Item -ItemType Directory -Path lua/snow/bin -Force | Out-Null
Copy-Item tools/keymap-helper/target/release/snow-keymap.exe lua/snow/bin/snow-keymap-windows.exe
Copy-Item tools/keymap-helper/target/release/snow_keymap_launcher.dll lua/snow/bin/
```

若 `snow-keymap-windows.exe` 已在运行，先结束该进程再执行 `Copy-Item`。重新部署不会替开发者执行构建、复制或进程重启。

macOS 和 Linux 构建产物分别命名为 `snow-keymap-macos` 与 `snow-keymap-linux`。修改 helper 后运行 `cargo test --locked --manifest-path tools/keymap-helper/Cargo.toml`；修改皮肤入口或资源后运行 `bun test --cwd scripts fixed-corpus/test/keymaps.test.ts` 并实际生成两种皮肤。

Windows 发布构建后运行 `./tools/keymap-helper/tests/windows-launch.ps1`，使用独立的中文及空格临时路径检查 DLL 直接启动、首帧绘制、首次居中及前台焦点不变；脚本只关闭自己启动的测试进程并清理本次临时目录，不访问真实输入法的命令文件。该检查同时接入 Windows Actions。

macOS 与 Linux 发布构建后运行 `python3 tools/keymap-helper/tests/unix-launch.py --helper tools/keymap-helper/target/release/snow-keymap --output output/keymap-desktop`，检查后台 shell 返回、首次提交图像、原生窗口可见性、显示器居中、前台焦点、连续三次缓存显隐及方案跟随。macOS 用 `bash tools/keymap-helper/build-macos.sh` 生成并以临时签名校验双架构产物，测试时把 `--helper` 指向 `tools/keymap-helper/target/universal/snow-keymap`。Actions 在 Intel Mac、Apple 芯片 Mac 与 Xvfb／Openbox 的 X11 桌面运行此检查；另在无 X11 的 headless Weston 中加 `--wayland`，检查真实 Wayland 协议中的 surface 销毁与重开，后者不验证桌面位置或键盘焦点。测量从测试命令写入及 shell 启动开始，窗口可见性由轮询观察，提交图像表示 `softbuffer` 成功提交缓冲区；这些时间不等于实际输入法的硬件按键到屏幕亮起延迟，也不代表清空系统文件缓存后的冷启动。每次结果与日志随 Actions 构件保存。

macOS 显式使用 Accessory 激活策略并关闭启动时强制激活，避免 helper 按普通应用的默认策略抢走前台。原生 Wayland 不支持 winit 的 `set_visible` 与绝对定位：隐藏时释放窗口及显示 surface，后续按键重建窗口，保留字体、已解析 SVG 和栅格图缓存；隐藏期间的方案跟随不建窗口。位置和置顶行为由 Wayland 合成器决定，不能保证显示器或宿主窗口居中。X11、macOS 与 Windows 仍复用原生窗口。

可设置 `SNOW_KEYMAP_TRACE` 为日志路径，记录事件循环创建、字体加载、SVG 解析、栅格化、窗口创建、显隐与缓冲区提交的相对时间；默认不创建或写入日志文件。
