# 键位图

冰雪四拼、冰雪弎拼、冰雪健道、冰雪简道、冰雪散拼、冰雪键道和冰雪三拼提供随时可查的键位图。冰雪一拼与冰雪清韵目前不接入此功能。

## 使用

- Windows、macOS 与 Linux 桌面端：在中文模式、输入框为空时，冰雪四拼、冰雪简道和冰雪散拼按 `e`，其余四个方案按 `v`。切换方案时，已打开的浮窗跟随显示新方案的键位图；短按浮窗只获取焦点，长按后拖动可移动，长按但不拖动、按 `Esc`、单击右键或再次按当前方案的键位图键可隐藏。浮窗获得焦点后可用鼠标滚轮缩放，macOS 也支持触控板双指捏合。
- 元书输入法（iOS、Android）：使用本项目发布的 `.cskin` 皮肤，在工具栏“中文”按钮上滑，选择方案；短按键位图不退出，上滑或长按键位图返回中文键盘。
- 同文输入法（Android）：使用本项目发布的 `.trime.yaml` 主题，长按工具栏“中文”按钮，选择方案；短按键位图不退出，上滑或长按键位图返回中文键盘。

移动端不把 `e`／`v` 的单击改成界面操作，因为两键仍参与正常编码。元书和同文的皮肤配置只提供静态键盘页及按键手势，不能把该图片变成可拖动、可双指缩放的原生视图；这两项交互需要输入法应用增加原生组件支持。第三方皮肤不会自动获得键位图页。

## 实现

Rime 的候选接口只有文本与注释，没有跨前端的图片接口，因此 Lua 只判断触发条件并发送命令，显示工作由平台层完成。

桌面端的 `tools/keymap-helper/` 是无控制台、单实例、常驻的 Rust GUI 程序。它轮询用户临时目录中的命令文件，直接把 `lua/snow/keymaps/*.svg` 栅格化到无边框、置顶且不抢焦点的窗口。窗口首次创建后持续复用，显隐热路径不启动 PowerShell、CMD 或新的 helper 进程。发布工作流分别生成 Windows x64、macOS x64 和 Linux x64 可执行文件，再放入安装包的 `lua/snow/bin/`。

移动端由 `scripts/skin/keymaps.ts` 向每套元书和同文皮肤注入统一选择页。元书使用各明暗资源目录中的 PNG 与图片描述文件；同文使用 `backgrounds/` 中的 PNG。七份 PNG 与桌面 SVG 均由 `scripts/generate-keymaps.ts` 从同一份原生矢量定义生成，包括冰雪键道，不再包装旧键位截图。图形定义沿用 README 两份“声韵辅-键映射”图的莫兰迪语义：声韵占用、纯辅键与多韵键使用独立背景、纹理和边框，韵母前景色按音系族区分。

本机开发时运行：

```powershell
cargo build --release --locked --manifest-path tools/keymap-helper/Cargo.toml
New-Item -ItemType Directory -Path lua/snow/bin -Force | Out-Null
Copy-Item tools/keymap-helper/target/release/snow-keymap.exe lua/snow/bin/snow-keymap-windows.exe
```

macOS 和 Linux 构建产物分别命名为 `snow-keymap-macos` 与 `snow-keymap-linux`。修改 helper 后运行 `cargo test --locked --manifest-path tools/keymap-helper/Cargo.toml`；修改皮肤入口或资源后运行 `bun test --cwd scripts fixed-corpus/test/keymaps.test.ts` 并实际生成两种皮肤。
