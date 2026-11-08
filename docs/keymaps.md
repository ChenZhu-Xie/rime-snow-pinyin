# 键位图

冰雪四拼、冰雪弎拼、冰雪健道、冰雪简道、冰雪散拼、冰雪键道和冰雪三拼提供随时可查的键位图。冰雪一拼与冰雪清韵目前不接入此功能。

## 使用

- Windows、macOS 与 Linux 桌面端：在中文模式、输入框为空时，冰雪四拼、冰雪简道和冰雪散拼按 `e`，其余四个方案按 `v`。Windows 首次打开时居中于当前焦点窗口，无法读取跨应用窗口边界的平台回退到当前显示器中心；切换方案时，已打开的浮窗跟随显示新方案的键位图且不改变位置。按住左键即可直接拖动，普通左键单击不关闭；按 `Esc`、单击右键或再次按当前方案的键位图键可隐藏。浮窗获得焦点后可用鼠标滚轮缩放，macOS 也支持触控板双指捏合；缩放会复用已解析的 SVG，不再为每个滚轮事件重新读取文件、扫描系统字体和解析图形。
- 元书输入法（iOS、Android）：使用本项目发布的 `.cskin` 皮肤，在工具栏“中文”按钮上滑，选择方案；短按或长按键位图不退出，上滑键位图返回中文键盘。
- 同文输入法（Android）：使用本项目发布的 `.trime.yaml` 主题，长按工具栏“中文”按钮，选择方案；短按或长按键位图不退出，上滑键位图返回中文键盘。

移动端不把 `e`／`v` 的单击改成界面操作，因为两键仍参与正常编码。键位图以保持宽高比的方式居中在输入法键盘区域；iOS 与 Android 输入法皮肤不能越过输入法区域、在宿主应用的焦点窗口中心弹出。元书和同文的皮肤配置也不能把该图片变成可拖动、可双指缩放的原生视图；这些交互需要输入法应用增加原生组件支持。第三方皮肤不会自动获得键位图页。

## 安装

桌面用户原则上不需要单独安装 helper。由当前发布工作流生成的 `snow-pinyin.zip` 会把 Windows x64、macOS x64 和 Linux x64 三个便携构建产物放在压缩包根目录下的 `lua/snow/bin/`；把压缩包内容合并覆盖到现有 Rime 用户目录后重新部署即可，不要额外套一层 `rime-snow-pinyin/` 目录，也不要删除整个用户目录，以免丢失私有配置和用户词典。Lua 读取 `rime_api.get_user_data_dir()` 后拼出 `<Rime 用户目录>/lua/snow/bin/snow-keymap-平台文件名` 的绝对路径，再按当前前端选择并启动对应文件；用户不需要安装 Rust 或配置 `PATH`。

Windows 更新已有安装时，先在任务管理器结束 `snow-keymap-windows.exe`，再合并覆盖新版压缩包并重新部署。键位图隐藏后 helper 仍会常驻，重新部署只重载 Rime 方案与 Lua，不会替换或重启正在运行的 EXE；若跳过停进程这一步，Windows 可能保留旧 helper，表现为新版交互没有生效。覆盖完成后首次打开键位图会自动启动新版 helper。

截至 `v0.3.13`，已经公开的 `snow-pinyin.zip` 仍早于 helper 注入流程，尚不含 `lua/snow/bin/`；上述免安装方式从按当前工作流重新构建或替换该附件后才成立。GitHub 的“Code → Download ZIP”源码包与普通 Git 克隆同样不含发布时注入的二进制文件，开发者使用源码时需要自行构建。

手机端不会调用 Rust helper。通过链接导入本仓库只安装 Rime 方案文件；键位图页来自独立的移动皮肤资源。元书需要另外安装 Release 中 `snow-pinyin-skins-hamster.zip` 内的 `.cskin`，同文需要安装 `snow-pinyin-skins-trime.zip` 中的主题。移动端皮肤直接使用随包 PNG，不执行 `lua/snow/bin/` 下的任何桌面程序。

## 实现

Rime 的候选接口只有文本与注释，没有跨前端的图片接口，因此 Lua 只判断触发条件并发送命令，显示工作由平台层完成。

桌面端的 `tools/keymap-helper/` 是无控制台、单实例、常驻的 Rust GUI 程序。它轮询用户临时目录中的命令文件，直接把 `lua/snow/keymaps/*.svg` 栅格化到无边框、置顶且不抢焦点的窗口，并通过同目录心跳文件让重新部署后的 Lua 复用现有进程。方案初始化和切换只写跟随命令，helper 未运行时也不会自动启动或预加载 SVG；只有用户实际按键打开键位图时才按需启动。窗口首次创建后持续复用，后续显隐与方案切换路径不启动 PowerShell、CMD 或新的 helper 进程。发布工作流分别生成 Windows x64、macOS x64 和 Linux x64 可执行文件，再放入安装包的 `lua/snow/bin/`。

移动端由 `scripts/skin/keymaps.ts` 向每套元书和同文皮肤注入统一选择页。元书使用各明暗资源目录中的 PNG 与图片描述文件；同文使用 `backgrounds/` 中的 PNG。七份 PNG 与桌面 SVG 均由 `scripts/generate-keymaps.ts` 从同一份原生矢量定义生成，包括冰雪键道，不再包装旧键位截图。图形定义沿用 README 两份“声韵辅-键映射”图的莫兰迪语义：声韵占用、纯辅键与多韵键使用独立背景、纹理和边框，韵母前景色按音系族区分；七图的五笔辅统一使用键帽右上角绿框，五调辅与单双码形辅在键中无框显示，冰雪四拼的韵腹、韵尾、声调和笔画使用四种前景色。声调中文首选霞鹜文楷并回退到平台楷体或衬线体，桌面包不捆绑字体；移动端 PNG 在发布构建时已经栅格化，不依赖手机字体。

本机开发时运行：

```powershell
cargo build --release --locked --manifest-path tools/keymap-helper/Cargo.toml
New-Item -ItemType Directory -Path lua/snow/bin -Force | Out-Null
Copy-Item tools/keymap-helper/target/release/snow-keymap.exe lua/snow/bin/snow-keymap-windows.exe
```

若 `snow-keymap-windows.exe` 已在运行，先结束该进程再执行 `Copy-Item`。重新部署不会替开发者执行构建、复制或进程重启。

macOS 和 Linux 构建产物分别命名为 `snow-keymap-macos` 与 `snow-keymap-linux`。修改 helper 后运行 `cargo test --locked --manifest-path tools/keymap-helper/Cargo.toml`；修改皮肤入口或资源后运行 `bun test --cwd scripts fixed-corpus/test/keymaps.test.ts` 并实际生成两种皮肤。
