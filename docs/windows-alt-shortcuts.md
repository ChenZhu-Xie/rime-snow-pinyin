# Windows 左 Alt 快捷键调查记录

2026-11-27；上游跟踪：[rime/weasel #1994](https://github.com/rime/weasel/issues/1994)。

## 结论与适用范围

本机普通应用中的左 Alt+A 到达窗口消息层，却没有进入 Weasel 的 TSF 按下回调，因此 librime 和方案 Lua 无法处理。在独立测试进程中注册 TSF preserved key 并转发后，同一方案成功收到 `Alt+a` 并执行略码。修复方向是 Weasel 的 Windows 按键接入层，不是更换 librime 或调整 Lua 处理器顺序。

目前仅完成进程内概念验证，没有发布、安装或替换修复版 Weasel。仅下载部署本仓库方案，不能保证普通 Weasel 收到 Alt 快捷键。冰雪四拼保留实验性 `abbreviation/alt_repeat_key: a`，仅在前端实际传入 `Alt+a` 时复用大写 `A` 的完整重复略码；原有大写略码不变。Lua 修饰符只表示 Alt，不区分左右；本次左 Alt 限定由 Windows 注册层实现。

## 环境

- Windows 11 25H2，26200.9974，x64。
- Weasel 部署版本 `0.17.4.98.f96ed24`；librime `1.17.0`。
- 方案为冰雪四拼；输入 `wg`，候选「这个」，完整重复应上屏「这个这个」。
- 用户在 Ghostty Windows、QQ、Chrome 均观察到无效；详细 TSF 回调记录来自独立 .NET Framework WinForms TextBox，不能据此声称逐一跟踪了这些应用。
- Kanata 左 Alt 有映射；没有停用 Kanata 做完整对照。它运行不变时，应用确实收到 Alt+A，增加 TSF 注册后成功，说明不能简单归因于「Kanata 没发出按键」。

## 实验顺序与证据

1. 增加冰雪四拼的 Alt+A 实验入口，保留 Shift+A；部署后左 Alt+A 无效。
2. 低层键盘记录确认左 Alt 和 A 的按下事件存在。驱动映射产生的事件不一定标注为 injected，不能据此判断是否来自物理键盘。
3. 在方案第一个 processor 放置临时日志探针，返回 `kNoop`，不改变输入。仅收到 Alt 按下及松开、A 松开，缺少 Alt+A 按下。
4. 初版独立窗口异常退出，废弃；v2 使用独立 C# EXE，确认窗口收到 `WM_SYSKEYDOWN` 的 Alt+A。
5. v3 在测试进程内包装 Weasel `ITfKeyEventSink` 的四个按键回调，记录调用并保留原函数。普通 `wg`、Shift+A 均经过 Weasel，Alt+A 的 A 按下不经过。
6. v4 在同一进程内观察 `AdviseKeyEventSink`，使用 Weasel 的 client id 注册 `{ VK_A, TF_MOD_LALT }`，用独立 GUID 识别 `OnPreservedKey`，再转交原按键处理。注册返回 `S_OK`，两次触发均被 Rime 处理，用户确认输出正确。

v3 失败样本（22:37:05）：

```text
ENTER OnTestKeyDown vk=18 flags=20380001
LEAVE OnTestKeyDown vk=18 eaten=0
msg=0x104 vk=18 modifiers=Alt
ProcessCmdKey=A, Alt
msg=0x104 vk=65 modifiers=Alt
ENTER OnTestKeyUp vk=18 flags=C0380001
ENTER OnTestKeyUp vk=65 flags=C01E0001
```

有 A 的窗口消息，没有 A 的 `OnTestKeyDown` / `OnKeyDown`。对应 Rime 记录只有 `Alt+Alt_L`、`Release+Alt_L`、`Release+a`。Shift+A 对照返回 `eaten=1`，正常完成略码。

v4 成功样本（22:46:28；22:46:30 重复成功）：

```text
REGISTER LeftAlt+A tid=142 hr=0
PRESERVED LeftAlt+A entered Weasel; forwarding to original OnTestKeyDown
PRESERVED forwarded hr=0 eaten=1
key=Alt+a code=97 modifier=8 input_len=2 ascii=false
key=Release+Alt_L code=65513 modifier=1073741824 input_len=0 ascii=false
```

## 实现观察与未解决问题

在 [Weasel f96ed24 的 KeyEventSink.cpp](https://github.com/rime/weasel/blob/f96ed24/WeaselTSF/KeyEventSink.cpp) 中，`_InitPreservedKey()` 直接返回 TRUE，注册代码位于 `#if 0`；`OnPreservedKey()` 直接返回不处理。微软的 [PreserveKey](https://learn.microsoft.com/en-us/windows/win32/api/msctf/nf-msctf-itfkeystrokemgr-preservekey) 和 [TF_MOD_LALT](https://learn.microsoft.com/en-us/windows/win32/tsf/tf-mod--constants) 提供了可验证的接入方向。

概念验证通过改写测试进程内的 COM vtable 完成，没有替换系统 DLL；效果不扩散到其他进程，退出测试程序即消失。不能将它作为通用补丁。正式实现需要检查配置、注册与注销生命周期、composition 更新、ASCII 模式、未消费事件放行、应用菜单冲突、长按重复、焦点切换及多架构兼容。直接复用 `OnTestKeyDown` 的做法仅用于实验，不代表生产实现建议。

单独的 Lua/YAML 无法修复缺失的前端事件。外部工具把左 Alt+A 映射成另一个组合键再由 Lua 处理是绕行方案，本次没有实现或推广。已向上游提交 issue，暂停本机 Weasel 构建。

## 验证与产物管理

纯 Lua 回归覆盖 Alt+A 与大写 A 的等价行为，以及未配置、其他修饰符、松开、ASCII 模式和四码边界的放行；Mira 候选用例增加 `wg{Alt+a}`，只能证明 librime 接收到事件后的行为，不能证明 Windows 能分发该事件。Mira 仅在 GitHub Actions 运行，不在本机运行。

本报告保存必要日志摘录；完整原始日志、issue 正文和有效实验源码归档在已忽略的 `output/alt-shortcuts-20261127/`。编译 EXE、失败窗口脚本、未完成下载的 ZIP 和请求临时文件已清理；未完成 clone 的目录残留仍在已忽略的 `output/weasel-alt-src/`，不进入版本控制。临时首位 Lua 探针及其专用 custom patch 移除并重新部署，避免持续记录用户按键。

收尾检查：纯 Lua 略码回归通过，`luacheck lua/snow/abbreviation.lua` 为零警告、零错误，十一个发布方案的离线拼音词典校验通过，Gitee README 同步检查和 `git diff --check` 通过。Windows GUI 行为以本报告中的人工实验为准，Mira 候选测试由推送后的 CI 验证。
