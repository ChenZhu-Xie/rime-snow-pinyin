# Selection and Benchmark Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一九方案单字定字行为，修正 benchmark 的首选与选重优化口径，阻止未审计冻结轨继续进入十方案报告，并刷新本机小狼毫部署。

**Architecture:** 单字行为继续由 `select_character.lua` 统一承担，冰雪一拼只补处理器接线。benchmark 新增纯数据策略模块供两个报告生成器共用，候选排名仍由现有 `benchmark-ranking.ts` 负责；外部冻结轨通过独立合同校验器失败关闭。

**Tech Stack:** Lua、Rime schema YAML、TypeScript、Bun/tsx、node:test、Mira、小狼毫部署器。

**Spec:** `docs/superpowers/specs/2026-11-04-selection-and-benchmark-fixes-design.md`

## Global Constraints

- 始终用中文回复，方案名遵循仓库 `AGENTS.md`。
- 本轮不重生成 `reports/`，不运行 GitHub Actions，不改版本号与 release tag。
- 所有生产改动先有失败测试；不清理或覆盖用户私有配置、用户词典和无关改动。
- 九方案处理器相对顺序继续遵守仓库约定，冰雪一拼的 `select_character` 位于 `chord_composer` 后、`combo_popping` 前。
- 最终只部署当前小狼毫用户目录，不同步 iCloud，不发布压缩包。

## Review Focus

- 单字候选不是首选但由用户选中时，`[`/`]` 必须针对当前选中候选。
- 冰雪一拼的按下/松开并击状态不能吞掉随后输入的方括号。
- 已有首选短码需要 Space、较长首选码可顶屏时，仍应选择短码加 Space。
- 由次选基础候选派生的结构略码或尾字键必须保留一次选重成本。
- 外部冻结文件即使排版内容可解析，只要缺少审计合同也必须失败。

---

### Task 1: 九方案单字定字行为

**Files:**
- Modify: `spec/snow_sipin.test.yaml`
- Modify: `spec/snow_sanpin.test.yaml`
- Modify: `spec/snow_yipin.test.yaml`
- Modify: `spec/snow_jiandao.test.yaml`
- Modify: `spec/snow_qingyun.test.yaml`
- Modify: `spec/snow_shenyun_shape.test.yaml`
- Modify: `spec/snow_shenyun_tone.test.yaml`
- Modify: `spec/snow_jiandao_classic.test.yaml`
- Modify: `spec/snow_sanpin_classic.test.yaml`
- Modify: `lua/snow/select_character.lua`
- Modify: `snow_yipin.schema.yaml`

**Interfaces:**
- Consumes: `snow.commit_text(engine, text)`、`Context:get_selected_candidate()` 和现有 `key_binder/select_*_character` 配置。
- Produces: 九方案一致的单字 `[` → `字字`、`]` → `字得`，多字行为不变。

- [ ] **Step 1: 写九方案失败用例**

每份 spec 各增加两个实际候选用例，断言单字 `[` 的 `commit` 为“候选字候选字”，单字 `]` 的 `commit` 为“候选字得”；保留现有多字首尾断言。

- [ ] **Step 2: 运行九方案测试确认 RED**

Run: `bun scripts/test.ts`

Expected: 至少非 21×26 方案的新增用例失败；冰雪一拼因没有处理器而失败，失败原因是实际上屏不符合断言。

- [ ] **Step 3: 实现单字分支并接入冰雪一拼**

在 `processor.func(key_event, env)` 中，取得当前候选后先识别首、末定字键；候选长度为一时，首键提交 `text .. text`，末键提交 `text .. "得"`，随后清空 context 并返回 `snow.kAccepted`。在冰雪一拼 processors 中于 `chord_composer` 后、`combo_popping` 前加入 `lua_processor@*snow.select_character`。

- [ ] **Step 4: 运行九方案测试确认 GREEN**

Run: `bun scripts/test.ts`

Expected: 九方案全部通过，现有多字首尾用例仍通过。

### Task 2: benchmark 首选候选与路径优化策略

**Files:**
- Create: `scripts/lib/benchmark-paths.ts`
- Create: `scripts/fixed-corpus/test/benchmark-paths.test.ts`
- Modify: `scripts/lib/benchmark-schemes.ts`
- Modify: `scripts/生成神韵500字实战测评.ts`
- Modify: `scripts/generate_full_benchmark_reports.ts`

**Interfaces:**
- Consumes: `RankedBenchmarkCode`、`BenchmarkSchemeId`、`isPoppableFixedCode()` 和两个报告生成器已有的字词候选。
- Produces: `preferredRankedCodes(codes: RankedBenchmarkCode[]): RankedBenchmarkCode[]`、`supportsStructuralAbbreviations(id: BenchmarkSchemeId): boolean`、`optimizeBenchmarkLine(text: string, alternatives: Map<string, BenchmarkAlternative[]>): BenchmarkPathResult`；`BenchmarkAlternative` 含 `selectionCount`，`BenchmarkPathResult` 含累计 `selectionCount` 与 `codeLength`。

- [ ] **Step 1: 写候选筛选与路径排序失败测试**

用手工字面量夹具覆盖：短二选与长首选并存时只留长首选；完全无首选时保留前三选兜底；零选重长路径胜过含选重短路径；总按键相同时短标准码加 Space 胜过长一码的可顶屏编码；四个 21×21 ID 不支持结构略码，两个 21×26 ID 支持。

- [ ] **Step 2: 运行聚焦测试确认 RED**

Run: `bunx --cwd scripts tsx --test fixed-corpus/test/benchmark-paths.test.ts`

Expected: FAIL，因为共用策略模块与导出函数尚不存在。

- [ ] **Step 3: 实现最小共用策略模块**

`preferredRankedCodes` 按 word 分组；存在 rank 1 时只保留最短标准码长度的 rank 1 路径，不存在时保留 rank 2/3。`optimizeBenchmarkLine` 依次比较 `selectionCount`、`keys`、`codeLength`、分词段数、固顶数、Space、Shift。标点保持一键即时上屏。

- [ ] **Step 4: 运行聚焦测试确认 GREEN**

Run: `bunx --cwd scripts tsx --test fixed-corpus/test/benchmark-paths.test.ts`

Expected: PASS。

- [ ] **Step 5: 接入两个报告生成器并保留派生选重成本**

删除两个脚本各自的重复路径类型与 `optimizeLine`，改用共用模块；普通排名候选经 `preferredRankedCodes` 后加入，rank 2/3 的 `selectionCount` 为 1；结构略码和尾字键从基础候选继承 `selectionCount`；只有 `supportsStructuralAbbreviations(scheme)` 为真时生成结构略码。

- [ ] **Step 6: 运行类型与 corpus 测试**

Run: `bun run --cwd scripts typecheck; bun run --cwd scripts test:corpus`

Expected: 两条命令退出码均为 0，且不生成 reports。

### Task 3: 外部冻结轨审计合同

**Files:**
- Create: `scripts/lib/frozen-benchmark-contract.ts`
- Create: `scripts/fixed-corpus/test/frozen-benchmark-contract.test.ts`
- Modify: `scripts/生成神韵500字实战测评.ts`

**Interfaces:**
- Consumes: 四条外部冻结回放的原始文本。
- Produces: `assertFrozenBenchmarkContract(content: string, source: string): void`，要求输入含固定合同版本和“空白用户词典、关闭调频、逐标准码首选截断”声明。

- [ ] **Step 1: 写冻结合同失败测试**

断言旧格式文本抛出包含 source 的错误；含完整合同标记的文本通过；缺少任一候选状态声明仍失败。

- [ ] **Step 2: 运行聚焦测试确认 RED**

Run: `bunx --cwd scripts tsx --test fixed-corpus/test/frozen-benchmark-contract.test.ts`

Expected: FAIL，因为校验器尚不存在。

- [ ] **Step 3: 实现校验器并在解析前调用**

合同版本使用单一常量 `snow-benchmark-frozen-v2`；两个外部输入在 `parseAlignedFive` / `parseSbxh` 前均校验，错误说明如何重新生成带审计声明的冻结回放。不得提供静默绕过开关。

- [ ] **Step 4: 运行聚焦与完整 corpus 测试**

Run: `bunx --cwd scripts tsx --test fixed-corpus/test/frozen-benchmark-contract.test.ts; bun run --cwd scripts test:corpus`

Expected: 全部 PASS，未调用 `benchmark:500` 或 `benchmark:reports`。

### Task 4: 格式、全量本地验证与小狼毫部署

**Files:**
- Verify: `lua/snow/select_character.lua`
- Verify: `snow_yipin.schema.yaml`
- Verify: `scripts/lib/benchmark-paths.ts`
- Verify: `scripts/lib/frozen-benchmark-contract.ts`
- Verify: `build/default.yaml`
- Verify: `build/snow_jiandao_classic.schema.yaml`
- Verify: `build/snow_sanpin_classic.schema.yaml`

**Interfaces:**
- Consumes: Tasks 1–3 的源码及当前小狼毫安装。
- Produces: 格式化且通过本地测试的源码，以及包含九方案现名和两个经典方案编译产物的本机部署。

- [ ] **Step 1: 格式化并检查 diff**

Run: `bun run --cwd scripts format; git diff --check; git diff --stat`

Expected: 格式命令成功，`git diff --check` 无输出，reports 无改动。

- [ ] **Step 2: 运行静态与九方案验证**

Run: `bun run --cwd scripts check:format; bun run --cwd scripts typecheck; bun run --cwd scripts test:corpus; bun scripts/check-pinyin-dict.ts; bun scripts/test.ts`

Expected: 所有命令退出码为 0。

- [ ] **Step 3: 部署当前小狼毫用户目录**

先用 `Get-Command WeaselDeployer.exe` 解析部署器，再运行其部署命令；不删除 `build/`、用户词典或 custom 配置。

- [ ] **Step 4: 验证部署产物**

检查 `build/default.yaml` 的 schema_list，以及六个现名；确认 `build/snow_jiandao_classic.schema.yaml` 与 `build/snow_sanpin_classic.schema.yaml` 存在，并对两个经典方案运行聚焦 Mira 测试。

- [ ] **Step 5: 最终自审**

对照 spec 六条逐项检查，确认没有 reports、版本号、release tag 或 GitHub Actions 改动；审阅 `git diff` 中所有生产逻辑和测试。

