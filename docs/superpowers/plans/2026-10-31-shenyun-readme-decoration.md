# Shenyun README Decoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让神韵 README、四方案报告及热力图在重新生成后稳定保留用户指定的裁剪、背景、比较标记和原地链接。

**Architecture:** 在 `scripts/lib/` 增加纯 Markdown 比较/链接辅助函数，由 README 更新器和四方案报告生成器共同调用；热力图导出器继续调用 HTML 的 `r9MacroHeat`，只在序列化前统一裁剪与背景。生成器提供可重复执行及 `--check` 验证，产物由同一套规则更新。

**Tech Stack:** Bun、TypeScript、Playwright/CDP、Markdown、SVG

**Spec:** `docs/superpowers/specs/2026-10-31-shenyun-readme-decoration-design.md`

## Global Constraints

- 两个专有名词固定为“无飞键道(U357) 21×21 双拼”和“神韵(Overall-17) 21×26 双拼”。
- 星标/粗体只比较 U357 与 S005；奖牌比较四方案并覆盖所有并列最优。
- 图仍直接导出自 `SNOW-SHENYUN-21X26-PRODUCTION`，不得重绘映射或热力数据。
- README.md 使用 GitHub 来源链接，README_CN.md 使用 Gitee 来源链接；本仓库文件使用相对链接。
- 不改方案映射、候选与评分数据。

## Review Focus

- 数值相同的全局最优：所有并列格都应有 `🥇`。
- U357/S005 并列：两格都应加粗并带 `★`，Overall/B04 不参与星标。
- “越接近 50%”不能按简单最大/最小比较。
- 重复运行生成器不得叠加 `**`、`★`、`🥇` 或嵌套链接。
- Overall 热力图必须与 U357 具有相同 viewBox 和背景，并裁为相同的 29 个可见键。

---

### Task 1: 共享表格装饰与原地链接

**Files:**
- Create: `scripts/lib/shenyun-markdown.ts`
- Create: `scripts/fixed-corpus/test/shenyun-docs.test.ts`
- Modify: `scripts/生成神韵对比.ts`

**Interfaces:**
- Produces: `decorateComparison(values, direction, peerIndices)`、`decorateMarkdownTable(...)`、`linkShenyunTerms(...)`。
- Consumes: 四方案顺序固定为 Overall17、U357、S005、B04；指标方向元数据。

- [ ] **Step 1: 写失败测试**：以字面量断言低优、高优、接近 50%、三元组、同值并列、幂等、原地链接，以及报告总览/成本/反事实/非首选率的标记。
- [ ] **Step 2: 运行 `bun test --cwd scripts fixed-corpus/test/shenyun-docs.test.ts`**；预期因模块或标记缺失失败。
- [ ] **Step 3: 实现共享函数并改造 `生成神韵对比.ts`**：所有可比较表调用同一装饰逻辑；复合碰撞桶保持无标记；报告加入标记图例和原地链接。
- [ ] **Step 4: 重新生成报告并运行专项测试**；预期全部通过。

### Task 2: 热力图统一裁剪、背景与标题

**Files:**
- Modify: `scripts/导出神韵热力图.ts`
- Modify: `docs/shenyun-overall17-keyboard-heat.svg`
- Modify: `docs/shenyun-u357-keyboard-heat.svg`
- Test: `scripts/fixed-corpus/test/shenyun-docs.test.ts`

**Interfaces:**
- Consumes: HTML `r9MacroHeat` 返回的 34 键 SVG。
- Produces: 两个相同 viewBox、带背景矩形、简短标题的 SVG。

- [ ] **Step 1: 增加失败测试**：断言两图 viewBox 相同、存在全幅背景、标题为简短形式、各有 29 个可见键。
- [ ] **Step 2: 运行专项测试**；预期 Overall viewBox/背景/标题失败。
- [ ] **Step 3: 在 HTML 页面上下文中裁剪并补背景**，同时对 U357 与 Overall 使用同一输出规则。
- [ ] **Step 4: 从指定 HTML 重新导出两图并以 `--check` 复核；再运行专项测试。**

### Task 3: README 六表、标题与链接可重复生成

**Files:**
- Modify: `scripts/更新神韵README.ts`
- Modify: `README.md`
- Modify: `README_CN.md`
- Test: `scripts/fixed-corpus/test/shenyun-docs.test.ts`

**Interfaces:**
- Consumes: Task 1 的装饰/链接函数和 Task 2 的 SVG 文件。
- Produces: 两份 README 中三种语言的六张四方案表、统一简短热力图标题、稳定链接和 `--check`。

- [ ] **Step 1: 增加失败测试**：执行更新逻辑后断言六表的星标/奖牌、三语言简短标题、关键方案/指标/文件原地链接与二次执行幂等。
- [ ] **Step 2: 运行专项测试**；预期 README 现状缺标记、标题过长和链接不足而失败。
- [ ] **Step 3: 改造 README 更新器**：调用共享装饰/链接函数，增加 `--check`，更新两份 README。
- [ ] **Step 4: 运行更新器两次（第二次 `--check`）、专项测试、定向 Biome、TypeScript 类型检查、SVG `--check`、`git diff --check`。**

### Task 4: 全量验证与交付

**Files:**
- Review: 本计划涉及的全部文件

**Interfaces:**
- Consumes: Tasks 1–3 的生成产物与测试。
- Produces: 可提交、可推送且 CI 可复核的完整变更。

- [ ] **Step 1: 运行 `bun scripts/验证神韵双拼.ts` 与 21×26 专项测试。**
- [ ] **Step 2: 运行完整本地静态检查；Mira 若不在 PATH，则按仓库约定由 GitHub Actions 验证。**
- [ ] **Step 3: 审阅生成差异、链接目标、所有标记和并列结果。**
- [ ] **Step 4: 提交，执行 `git swap auto`，通过 `git push origin main` 推送两个 push URL，并确认两端提交一致。**
- [ ] **Step 5: 若路径过滤未自动触发，手动运行 GitHub Actions“测试”并等待所有作业完成。**
