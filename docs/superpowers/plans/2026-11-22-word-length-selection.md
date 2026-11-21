# 四主码词长直选实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 先修复三套 21×26 的大写续写与原生长词补全，再为八套双拼方案实现四主码词长直选。

**Architecture:** 保留现有翻译器与最终候选排序，在 `shenyun` 中新增显式长词路由并修正四声母补全查询。独立 Lua 处理器识别四主码并按类别优先选择最终菜单候选；schema 显式配置布局类别。

**Tech Stack:** Lua 5.4、Rime YAML、Bun 1.3.14、Mira（仅 Actions）。

**Spec:** `docs/superpowers/specs/2026-11-22-word-length-selection-design.md`

## Global Constraints

- Mira 与原生 Rime 验证只能在推送后的 GitHub Actions 运行。
- 不改冻结布局、五辅、辅序、固顶、版本号及无关方案；不覆盖原工作区的其他任务。
- 21×21 为长词优先、二字兜底；21×26 为三字优先、长词兜底；四字单独直选。
- 只在四主码时截键，21×21 补韵不计、补辅继续有效，第五字续写退出。
- 使用标准候选选择路径，保留学习、缓冲、统计和原生词补全。

## Review Focus

- 大写第五声母必须续写；普通小写第五键仍应顶屏，辅键仍应筛选。
- 代理码不能使原生词补全因长度不一致而静默关闭。
- 四主码不能误认成单字四辅、声声空桶四辅、三声母补韵或第五声母。
- 当前翻页位置、简繁转换、首选后置和未消费完整输入不能改变直选合同。
- 优先类别不存在时必须继续找兜底，不能把首页或固定扫描窗口当作整个菜单。

---

### Task 1: 21×26 长词基础

**Files:** `lua/snow/shenyun.lua`、`snow_shenyun_common.yaml`、`spec/shenyun-longwords.test.lua`、`spec/snow_shenyun_{shape,tone}.test.yaml`、`spec/snow_zhudao.test.yaml`、`.github/workflows/functional.yml`。

**Interfaces:** 保持 translator 的 `init/func/fini`；新增显式长词路由，四声母只在该路由保留长补全，普通一至三字路由继续精确过滤。

- [x] 写真实翻译器测试：四码长补全、五／七声母续写、短片段拒绝、其他路由隔离、普通四字控制。
- [x] 运行 Lua 5.4，确认当前实现因上述行为缺失失败。
- [x] 查询四声母和长词时使用不带空格的代理码，开启独立 `enable_word_completion`，加入保留大写续写的拼写与顶功规则。
- [x] 运行新旧路由纯 Lua 回归和相关静态测试，添加各活动布局的真实候选用例，提交本任务。

### Task 2: 四主码词长直选处理器

**Files:** 新建 `lua/snow/select_word_length.lua`、`spec/select_word_length.test.lua`；按需更新 `lua/snow/define.lua` 的已有 API 注解。

**Interfaces:** `processor.init(env)` 从 `word_length/layout` 读取 `21x21|21x26`，`processor.func(key_event, env)` 返回标准处理状态；不要求 translator 改候选类型。

- [x] 写真实处理器测试：两套优先级、跨页、完整输入、补全、无候选、修饰键、缓冲、补韵、辅助码、五字续写及非 abc／英文／非段末退回。
- [x] 运行确认失败，再实现主码识别与正常候选选择／上屏。
- [x] 新测试与既有学习／后置测试全部通过后提交本任务。

### Task 3: 接入、文档与性能语料

**Files:** 四个独立 21×21 schema（莲道继承兰道，合计五套）、21×26 共用 schema、`scripts/fixed-corpus/test/scheme-regressions.test.ts`、八套 Mira spec、`scripts/data/latency-cases.ts`、README 与相关布局文档。

**Interfaces:** 八套 schema 在 `popping` 前加载新处理器，配置布局类别；Mira 用例按当前布局推导，性能用例沿用统一预算。

- [x] 先补静态接入与触发边界测试并观察失败，再接入配置。
- [x] 补齐真实候选直选、标点退回、长词续写与补全用例；在性能语料增加对应代表场景。
- [x] 更新用户文档，运行格式、Lua 严格检查、拼音与生成／语料检查及相关回归，提交本任务。

### Task 4: 审查、推送与 Actions

**Files:** 本分支全部改动。

**Interfaces:** 本地静态与 Lua 通过后提交并向 fork 的两端推送；Actions 同时覆盖 librime 1.13.1／1.17 与统一性能预算。

- [ ] 用独立审查者检查整个分支，对重要发现补失败测试后修复。
- [ ] 推送前 `git swap auto`；逐个验证两个 fork 远端分支提交与本地一致。
- [ ] 等待功能与性能 Actions；只按失败证据修复，直到所有必要门禁通过。
- [ ] 报告实现、验证、分支与保留限制；不发布、不自动合并 main。
