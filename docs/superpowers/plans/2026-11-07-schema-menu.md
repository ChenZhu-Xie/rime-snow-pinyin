# 可筛选方案选单 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `F4` 与 `Ctrl+grave` 在九个发布方案中打开可按声母串筛选的八方案 Lua 选单，同时让 `Ctrl+Shift+grave` 保持 Rime 原生方案选单。

**Architecture:** 用独立的 `schema_menu` 分段承载静态候选，Lua processor 负责呼出、再次按键关闭及选中后切换方案，Lua translator 负责按有序声母子序列过滤。八项方案资料只在 Lua 模块维护，公共 YAML 声明分段配置，九份发布 schema 仅接入同一组组件；静态回归测试锁定精确文案、热键拆分、组件顺序及冰雪键道 630 契约。

**Tech Stack:** librime-lua、Rime YAML、TypeScript/Bun 固定语料测试、Mira

**Spec:** `docs/superpowers/specs/2026-11-07-schema-menu-design.md`

---

## Task 1：以测试定义菜单资料和筛选语义

**Files:**

- Create: `lua/snow/schema_menu.lua`
- Create: `spec/schema_menu.test.lua`

- [x] 写失败测试，锁定八项固定顺序、schema_id、正文、精确注释及声母别名；冰雪清韵必须显示“`21ᵐ9¹；四码前缀；多字根字王`”。
- [x] 写失败测试，覆盖空查询、连续命中、有序子序列命中、无匹配，以及 `jd`、`jdjd`、`lfjd`、`wzjd` 等关键查询。
- [x] 运行 `lua spec/schema_menu.test.lua`，确认失败原因是模块尚不存在或行为尚未实现；若本机无独立 Lua，则把同一断言移入 Bun 静态测试，由测试读取 Lua 静态表，不跳过契约。
- [x] 实现最小静态目录及纯筛选函数，保持组件表、局部函数、snake_case、strict 注解等仓库 Lua 规范。
- [x] 再次运行单元测试，确认资料与筛选语义通过。

## Task 2：接入 Lua 选单并拆分原生热键

**Files:**

- Modify: `lua/snow/schema_menu.lua`
- Create: `snow_schema_menu_default_patch.yaml`
- Modify: `scripts/lib/mira-default-custom.ts`
- Modify: `snow_pinyin.schema.yaml`
- Modify: `snow_sipin.schema.yaml`
- Modify: `snow_sanpin.schema.yaml`
- Modify: `snow_yipin.schema.yaml`
- Modify: `snow_jiandao.schema.yaml`
- Modify: `snow_qingyun.schema.yaml`
- Modify: `snow_shenyun_shape.schema.yaml`
- Modify: `snow_shenyun_tone.schema.yaml`
- Modify: `snow_jiandao_classic.schema.yaml`
- Modify: `snow_sanpin_classic.schema.yaml`
- Modify: `scripts/fixed-corpus/test/scheme-regressions.test.ts`

- [x] 先在 `scripts/fixed-corpus/test/scheme-regressions.test.ts` 添加失败断言：原生 `switcher/hotkeys` 只含 `Control+Shift+grave`；九份发布 schema 都按约定位置接入 processor、affix segmentor、translator；公共 recognizer 仅把内部前缀路由到 `schema_menu`。
- [x] 运行 `bun test scripts/fixed-corpus/test/scheme-regressions.test.ts`，确认新断言失败。
- [x] 将本机 `default.custom.yaml` 的原生热键收窄为 `[Control+Shift+grave]`，并提供不覆盖用户全局配置的发布示例；不得让 `F4` 或 `Control+grave` 残留在原生 switcher。
- [x] 在公共 schema 声明独立前缀、tag、提示与 recognizer pattern；除冰雪一拼外，在发布 schema 的 `recognizer` 之后、`key_binder` 之前接入 Lua processor；冰雪一拼排在 `ascii_composer` 与 `chord_composer` 之间；并接入 affix segmentor 与 Lua translator。
- [x] 完成 processor：`F4`/`Control+grave` 呼出或关闭；菜单打开时保留字母、退格、导航和选择行为；`Escape` 关闭；不得干扰 `Control+Shift+grave`。
- [x] 完成 translator 与 select notifier：只处理 `schema_menu` tag；无匹配时不回落普通候选；选择当前方案只关闭，选择其他方案调用 `engine:apply_schema(Schema(schema_id))`；`fini` 断开 notifier 并释放持有对象。
- [x] 运行 Lua 单元测试与 `bun test scripts/fixed-corpus/test/scheme-regressions.test.ts`，确认实现通过。

## Task 3：补齐运行时回归与冰雪键道审计契约

**Files:**

- Modify: `spec/snow_jiandao.test.yaml`
- Modify: `spec/snow_yipin.test.yaml`
- Modify: `scripts/fixed-corpus/test/scheme-regressions.test.ts`
- Modify: `scripts/fixed-corpus/test/legacy-benchmark-schemes.test.ts`

- [x] 先添加运行时失败场景：冰雪键道与冰雪一拼均可由 `F4`、`Control+grave` 呼出 Lua 选单，可按声母筛选、取消、选择；`Control+Shift+grave` 仍进入原生选单。若 Mira 不暴露原生 switcher 状态，则以静态热键断言验证该项，并在测试注释说明边界。
- [x] 为冰雪键道与冰雪键道经典版增加 630 码位精确集合断言，不只检查条目数和词条唯一性；保留现有英数规则、固顶级别、辅序与 `42310` 往返测试。
- [x] 运行目标静态测试：`bun test scripts/fixed-corpus/test/scheme-regressions.test.ts scripts/fixed-corpus/test/legacy-benchmark-schemes.test.ts`；不在本机运行 Mira。
- [x] 运行完整静态与生成校验：`bun run --cwd scripts check:format`、`bun scripts/check-pinyin-dict.ts`，以及仓库现有固定语料测试入口。
- [ ] 按项目约定在本地检查通过后提交并推送，由 GitHub Actions 的两个 Mira 版本验证九个发布方案；本机不运行 Mira。
- [x] 检查 `git diff --check` 与最终 diff，确认没有修改八份 schema 的 `schema/name`、没有恢复原生 `F4`/`Ctrl+grave`，也没有混入无关改动。

