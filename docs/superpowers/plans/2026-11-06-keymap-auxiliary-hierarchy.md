# Keymap Auxiliary Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让形码键位图中的笔画、单辅键码根、双辅键码根以三种不同莫兰迪前景色和更易读字号显示。

**Architecture:** 在键位图生成器中把形辅说明建模为三类独立语义行，由共用渲染函数分别赋色和排版；七份 SVG 仍由同一生成器输出，固定语料测试约束三类语义和视觉属性。

**Tech Stack:** TypeScript、Bun、SVG、Rust helper。

**Spec:** 本轮用户请求（对话）。

## Global Constraints

- 三类前景色必须两两不同并沿用莫兰迪风格。
- 三类字号均须明显大于现有小字，同时不得压过韵母主标签。
- 只改变形码方案的形辅信息，声调和冰雪四拼辅助信息保持原语义。
- 生成器、七份 SVG、固定语料测试和移动皮肤产物保持同步。

## Review Focus

- 21×21 与 21×26 两种布局中的双辅键码必须分别保留正确物理码。
- 没有韵母标签的键位不得发生三行溢出。
- 带韵母标签的键位须保持韵母为最大视觉层级。
- 冰雪四拼与声调图不得被错误套用形码三分类。
- 所有生成 SVG 必须仍能由桌面 helper 与皮肤生成器渲染。

---

### Task 1: 约束三类形辅视觉语义

**Files:**
- Modify: `scripts/fixed-corpus/test/keymaps.test.ts`

**Interfaces:**
- Consumes: 已生成的形码 SVG。
- Produces: 对三种语义标记、两两不同前景色和放大字号的回归断言。

- [x] **Step 1:** 添加固定语料断言并运行，确认因缺少三分类而失败。

### Task 2: 拆分并渲染三类形辅信息

**Files:**
- Modify: `scripts/generate-keymaps.ts`
- Modify: `lua/snow/keymaps/*.svg`

**Interfaces:**
- Consumes: Task 1 的 SVG 行为契约。
- Produces: `stroke`、`single-root`、`double-root` 三类文本层。

- [x] **Step 1:** 增加形辅专用数据结构和共用渲染函数。
- [x] **Step 2:** 生成七份 SVG 并运行固定语料测试至通过。
- [x] **Step 3:** 目视检查三份形码 PNG。
- [x] **Step 4:** 运行格式、helper、固定语料和实际皮肤生成验证。
- [x] **Step 5:** 提交生成器、测试、SVG 与本计划。
