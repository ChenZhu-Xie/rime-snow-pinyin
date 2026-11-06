# 七方案莫兰迪语义键位图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将七个发布方案的键位图统一为 benchmark 两份“声韵辅-键映射”图的莫兰迪语义视觉，并将冰雪键道改成原生 SVG。

**Architecture:** 继续由 `scripts/generate-keymaps.ts` 作为 SVG 与 PNG 的唯一图形定义；先把键位映射归一为“声、韵、辅”语义，再按 benchmark 的占用分类、音系族颜色和纹理生成键帽。七个方案均进入同一渲染管线，生成产物继续写入 `lua/snow/keymaps/`。

**Tech Stack:** TypeScript、Bun、`@resvg/resvg-js`、Node test runner、SVG。

**Spec:** 用户本轮需求；`README.md` 中两处“声韵辅-键 映射”；`D:/C2D/Desktop/Code/Lua/inputMethod/shuangpin-layout-benchmark/a7_CKT_R11_integrated_materials/a7_CKT_R11.html` 中 `keyboardSVG` 与 `semanticColor`。

## Global Constraints

- 七份键位图保持各方案现有声、韵、调、形语义，不改输入编码。
- `shapeKeysByMeaning` 与 `toneKeysByTone` 必须继续分别按形义和声调顺序解释。
- 冰雪键道不再嵌入 `xkjd-qwerty.png`，改用 `classic` 映射与形辅说明生成原生 SVG/PNG。
- 莫兰迪颜色、元素含义、前景色、边框、背景纹理、背景色和不透明度以两份 README 参考 SVG 的 benchmark 定义为准。
- 生成器、SVG、PNG、测试与文档说明保持同步。

## Review Focus

- 仅声、仅韵、声韵兼用、双拼未用及纯辅键必须落入正确的背景与边框分支；Task 1 的生成产物断言覆盖。
- 多韵键必须保留独立强调，不能被普通占用边框覆盖；Task 1 的多韵键断言覆盖。
- 韵母族颜色须按 `i/u/ü/a/e/o/*n/*ng` 优先级着色；Task 1 的代表性韵母断言覆盖。
- 冰雪四拼没有完整 `Mapping`，仍须正确表达声码、韵腹、韵尾、声调和五笔画；Task 1 的四拼语义断言覆盖。
- 冰雪键道必须是可检索文本的原生 SVG，不能残留 base64 PNG；Task 1 的原生 SVG 断言覆盖。

---

### Task 1: 七方案统一语义渲染

**Files:**
- Modify: `scripts/fixed-corpus/test/keymaps.test.ts`
- Modify: `scripts/generate-keymaps.ts`
- Regenerate: `lua/snow/keymaps/*.svg`
- Regenerate: `lua/snow/keymaps/*.png`

**Interfaces:**
- Consumes: `Mapping`、`Diagram`、现有 `initialLabels()` / `invert()` 以及 benchmark 的颜色与纹理常量。
- Produces: `render(diagram: Diagram): string` 生成七份原生语义 SVG；Resvg 从同一字符串生成 PNG。

- [ ] **Step 1: 写失败测试**

在 `keymaps.test.ts` 中运行真实生成产物，断言七份 SVG 都包含语义纹理定义与可访问标题；分别用代表键验证占用分类、多韵边框、音系前景色、纯辅键样式与冰雪四拼内容；断言冰雪键道含经典映射文本且不含 `data:image/png;base64`。

- [ ] **Step 2: 运行测试并确认按预期失败**

Run: `bun test --cwd scripts fixed-corpus/test/keymaps.test.ts`
Expected: FAIL，旧产物缺少 `nf4-ionly` 等语义纹理，冰雪键道仍是嵌入 PNG。

- [ ] **Step 3: 实现统一 SVG 渲染**

在 `generate-keymaps.ts` 增加占用类型、音系族颜色、零声母/非直映声母、辅键徽标、多韵键与定位纹理渲染；将冰雪键道加入 `diagrams`，删除旧 PNG 包装分支与源图片依赖。

- [ ] **Step 4: 重新生成七份 SVG/PNG**

Run: `bun run --cwd scripts keymaps:generate`
Expected: 输出“已生成七份键位图”，七份 SVG 均为文本与矢量元素。

- [ ] **Step 5: 运行聚焦测试并确认通过**

Run: `bun test --cwd scripts fixed-corpus/test/keymaps.test.ts`
Expected: PASS。

### Task 2: 生成一致性与移动皮肤验证

**Files:**
- Modify: `docs/keymaps.md`
- Verify: `lua/snow/keymaps/*.svg`
- Verify: `lua/snow/keymaps/*.png`

**Interfaces:**
- Consumes: Task 1 的七份原生 SVG/PNG。
- Produces: 更新后的实现说明与通过的生成/皮肤回归。

- [ ] **Step 1: 更新实现说明**

在 `docs/keymaps.md` 说明七份 SVG/PNG 均由统一的莫兰迪声韵辅语义定义生成，冰雪键道不再使用旧截图包装。

- [ ] **Step 2: 检查格式与生成一致性**

Run: `bun run --cwd scripts check:format`
Run: `bun run --cwd scripts keymaps:check`
Expected: 两条命令均成功。

- [ ] **Step 3: 实际生成两种移动皮肤**

Run: `bun scripts/generate-skins.ts output/keymap-morandi-review --backend all`
Expected: Hamster 与 Trime 皮肤均成功生成，键位图资源完整。

- [ ] **Step 4: 运行完整固定语料测试**

Run: `bun run --cwd scripts test:corpus`
Expected: PASS。

