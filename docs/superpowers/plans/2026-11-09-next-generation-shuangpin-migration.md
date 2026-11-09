# 下一代双拼布局迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 将冰雪简道、冰雪散拼迁移到 D3/V1 21×26，将冰雪健道、冰雪弎拼迁移到 QZ-e8f37a 21×21，同时冻结四个“·初代”布局并生成包含它们的 12／13／14 方案完整报告。

**Architecture:** 两份活动映射 JSON 是现行布局唯一真源，另存两份只读初代映射快照；活动 schema、fixed、辅助码、键位图、README 与报告都从对应世代输入生成。Rime 的 snow_pinyin 语义用户库继续全方案共享，Lua 固顶 LevelDB 则按方案唯一命名并把四个旧库名转交初代方案。

**Tech Stack:** Rime YAML、Lua 5.4、TypeScript/Bun、Node test、JSON、SVG、Rust keymap helper、GitHub Actions Mira。

**Spec:** docs/superpowers/specs/2026-11-09-next-generation-shuangpin-migration-design.md

## Global Constraints

- 21×26 必须是 SNOW-SHENYUN-21X26-D3V1-BALANCED：M=40、D=3、V=1、Common399 399/399 唯一、CKT v5.1 9.10299979136027；简道 12/12/24，散拼 12/21/13。
- 21×21 必须是 QZ-e8f37a0998f9：M=42、D=2、V=5、QZ/ZQ 空桶、Common399 为 399 个音节／345 个唯一编码／54 个冲突桶／108 个受影响音节／96 个空码、CKT v5.1 9.56789806405906；健道 12/213/24，弎拼 12/213/23。M=42 是 memory 指标，不是空码数。
- 五辅语义保持 21×26 AEUIO ↔ IEUAO、21×21 AVUIO ↔ IVUAO，并通过 42310 往返测试。
- 四个初代方案的布局、fixed、子方案、形辅映射、键位图和既有哈希不得改变；初代主 schema 只允许增加旧固顶库名。
- snow_pinyin 上屏学习频次与用户造词全冰雪系共享；十三个发布方案的 Lua 固顶库名必须全部唯一。
- README 只把新布局作为现行布局；reports 同时保留新旧两代。全量报告为内部 12、加声笔小鹤 13、再加小鹤音形 14；旧 8／9／10 报告不删除、不覆盖。
- 不在本机运行 Mira 或 bun scripts/test.ts；真实候选测试只在推送后的 GitHub Actions 执行。

## Review Focus

- 初代冻结边界：活动生成命令不得改写任何 _first 布局资源；Task 1、3、4、5 的哈希测试覆盖。
- 用户数据边界：语义学习仍落入 snow_pinyin，任意两个发布方案不得共享固顶库；Task 2 覆盖十三方案。
- 空槽与入口：QZ/ZQ、21×21 英数入口、21×26 字母桶与数字入口不得误占普通音节；Task 3、4 覆盖。
- 报告世代隔离：活动与初代必须读取不同 schema/fixed/radical，且 12／13／14 顺序与回放目录一致；Task 6、7 覆盖。
- 可重复生成：映射、fixed、radical、keymap、README 与报告二次运行不得产生差异；Task 8 覆盖。

---

### Task 1: 固化两代映射真源

**Files:**
- Create: config/shenyun-21x21-first-mapping.json
- Create: config/shenyun-21x26-first-mapping.json
- Create: docs/shenyun-qz-e8f37a-mapping.json
- Modify: config/shenyun-21x21-mapping.json
- Modify: config/shenyun-21x26-mapping.json
- Modify: scripts/生成神韵映射.ts
- Modify: scripts/验证神韵双拼.ts
- Test: scripts/fixed-corpus/test/shenyun-21x26.test.ts
- Test: scripts/fixed-corpus/test/scheme-regressions.test.ts
- Test: scripts/fixed-corpus/test/auxiliary-semantics.test.ts

**Interfaces:**
- Consumes: 两份 2026-11-09 benchmark note、集成脚本中的完整映射/stateKey/来源提交。
- Produces: 两份活动映射、两份只读初代快照、QZ 完整音节码快照。

- [ ] **Step 1: 写失败测试。** 断言 D3/V1 与 QZ-e8f37a 的完整 initialMap/finalMap、M/D/V、来源；D3/V1 断言 Common399 399/399 唯一，QZ-e8f37a 断言 399/345、54 个冲突桶、108 个受影响音节、96 个空码及 QZ/ZQ 空桶；断言两份 first 快照等于迁移前配置，四个初代 fixed/radical/keymap 哈希不变。
- [ ] **Step 2: 确认 RED。** Run: bunx --cwd scripts tsx --test fixed-corpus/test/shenyun-21x26.test.ts fixed-corpus/test/scheme-regressions.test.ts fixed-corpus/test/auxiliary-semantics.test.ts。Expected: 旧 ID 或缺少 first/QZ 文件。
- [ ] **Step 3: 实现映射边界。** 先复制当前配置为 first 快照，再替换活动配置；生成器改写 docs/shenyun-qz-e8f37a-mapping.json，验证器校验该文件。旧 docs/shenyun-u357-mapping.json 只读保留。
- [ ] **Step 4: 确认 GREEN。** Run: bun run --cwd scripts mapping:generate; bun run --cwd scripts mapping:check; bunx --cwd scripts tsx --test fixed-corpus/test/shenyun-21x26.test.ts fixed-corpus/test/scheme-regressions.test.ts fixed-corpus/test/auxiliary-semantics.test.ts。Expected: 全部 PASS，42310 往返与初代哈希不变。
- [ ] **Step 5: 提交。** git add 上述文件；git commit -m "feat: freeze legacy shuangpin mappings"。

### Task 2: 分离固顶库并保持语义用户库共享

**Files:**
- Modify: snow_jiandao.schema.yaml, snow_sanpin.schema.yaml
- Modify: snow_shenyun_shape.schema.yaml, snow_shenyun_tone.schema.yaml
- Modify: snow_jiandao_first.schema.yaml, snow_sanpin_first.schema.yaml
- Modify: snow_shenyun_shape_first.schema.yaml, snow_shenyun_tone_first.schema.yaml
- Modify: snow_jiandao_classic.schema.yaml, snow_sanpin_classic.schema.yaml
- Test: scripts/fixed-corpus/test/legacy-benchmark-schemes.test.ts
- Test: scripts/fixed-corpus/test/scheme-regressions.test.ts

**Interfaces:**
- Consumes: translator/user_dict_name 由 lua/snow/user_dict.lua 与 fix.lua 共同读取；Rime Memory 由 dictionary: snow_pinyin 解析共享用户库。
- Produces: 十个双拼发布方案到唯一固顶库名的静态映射。

- [ ] **Step 1: 写失败测试。** 初代四库名为 snow_jiandao、snow_sanpin、snow_shenyun_shape、snow_shenyun_tone；活动四库为 snow_jiandao_qz_e8f37a、snow_sanpin_qz_e8f37a、snow_shenyun_shape_d3v1、snow_shenyun_tone_d3v1；经典两库为各自 schema_id；十三方案固顶库名唯一，学习字典仍为 snow_pinyin。
- [ ] **Step 2: 确认 RED。** Run: bunx --cwd scripts tsx --test fixed-corpus/test/legacy-benchmark-schemes.test.ts fixed-corpus/test/scheme-regressions.test.ts。Expected: 经典仍共享、初代未接管或活动未换库。
- [ ] **Step 3: 实现。** 只改 translator/user_dict_name；不改 dictionary、learned_priority/memory_namespace 或 LevelDB 内容。初代 schema 除该字段外逐字不变。
- [ ] **Step 4: 确认 GREEN。** 重跑 Step 2。Expected: 固顶库唯一，语义学习仍共享 snow_pinyin。
- [ ] **Step 5: 提交。** git add 十份 schema 与两份测试；git commit -m "fix: isolate fixed candidate databases"。

### Task 3: 迁移冰雪健道与冰雪弎拼到 QZ-e8f37a

**Files:**
- Modify: snow_jiandao.schema.yaml, snow_sanpin.schema.yaml
- Modify: snow_jiandao_bihua.schema.yaml, snow_sanpin_bihua.schema.yaml, snow_jiandao_jianpin.schema.yaml
- Modify: snow_jiandao.fixed.txt, snow_sanpin.fixed.txt, snow_sanpin.fixed.630.txt
- Modify: lua/snow/radical_jiandao.txt, lua/snow/radical_sanpin.txt
- Modify: scripts/align-fixed-with-sipin.ts, scripts/generate-radical-codes.ts, scripts/generate-shenyun-letters.ts
- Modify: scripts/生成神韵固顶词.ts, scripts/验证神韵双拼.ts
- Test: scripts/fixed-corpus/test/scheme-regressions.test.ts

**Interfaces:**
- Consumes: Task 1 的 QZ 活动映射、Task 2 的固顶库路由。
- Produces: 一致的 sanpin_algebra、QZ 空桶/入口、健道 12/213/24、弎拼 12/213/23、活动 fixed/radical。

- [ ] **Step 1: 写失败测试。** 覆盖所有移动声韵类别、零声母、ü 系、QZ/ZQ、英数入口、辅序、活动文件不引用 _first；继续断言初代 frozen 资源哈希。
- [ ] **Step 2: 确认 RED。** Run: bunx --cwd scripts tsx --test fixed-corpus/test/scheme-regressions.test.ts fixed-corpus/test/legacy-benchmark-schemes.test.ts。Expected: 编码仍为 U357 或辅序为旧值。
- [ ] **Step 3: 实现。** 更新活动主 schema 与 bihua/jianpin 依赖，重算字母、数字、AA/AAB 空桶、顶功、fixed 与 radical；生成器写入目标明确排除 _first 和 classic。
- [ ] **Step 4: 生成并确认 GREEN。** Run: bun scripts/generate-radical-codes.ts; bun scripts/generate-shenyun-letters.ts; bun scripts/align-fixed-with-sipin.ts; bun run --cwd scripts fixed:generate; bun scripts/验证神韵双拼.ts; bunx --cwd scripts tsx --test fixed-corpus/test/scheme-regressions.test.ts fixed-corpus/test/legacy-benchmark-schemes.test.ts。Expected: 全部 PASS，初代哈希不变。
- [ ] **Step 5: 提交。** git add 本任务文件；git commit -m "feat: migrate 21x21 schemes to qz layout"。

### Task 4: 迁移冰雪简道与冰雪散拼到 D3/V1

**Files:**
- Modify: snow_shenyun_common.yaml, snow_shenyun_shape.schema.yaml, snow_shenyun_tone.schema.yaml
- Modify: snow_shenyun_shape.fixed.txt, snow_shenyun_tone.fixed.txt
- Modify: config/shenyun-21x26-letter-buckets.json, config/shenyun-21x26-number-codes.json
- Modify: scripts/research/calculate_shenyun_21x26_letter_buckets.ts
- Modify: scripts/generate-shenyun-letters.ts, scripts/生成神韵固顶词.ts
- Test: scripts/fixed-corpus/test/shenyun-21x26.test.ts
- Test: scripts/fixed-corpus/test/scheme-regressions.test.ts

**Interfaces:**
- Consumes: Task 1 的 D3/V1 活动映射与 Overall-17 初代快照。
- Produces: D3/V1 shenyun_algebra、字母桶、数字码、简道 12/12/24、散拼 12/21/13、两份活动 fixed。

- [ ] **Step 1: 写失败测试。** 覆盖完整映射、零声母、ü 系、399 唯一、字母桶/数字入口、soft-page-fill-v2、两组辅序；断言 snow_shenyun_first_common.yaml 和初代产物哈希不变。
- [ ] **Step 2: 确认 RED。** Run: bunx --cwd scripts tsx --test fixed-corpus/test/shenyun-21x26.test.ts fixed-corpus/test/scheme-regressions.test.ts。Expected: algebra、桶或辅序仍为 Overall-17。
- [ ] **Step 3: 实现。** 更新活动公共 schema、两份活动说明与生成器；初代继续只读 snow_shenyun_first_common.yaml、*_first.fixed.txt 和初代 radical。
- [ ] **Step 4: 生成并确认 GREEN。** Run: bun scripts/research/calculate_shenyun_21x26_letter_buckets.ts; bun scripts/generate-shenyun-letters.ts; bun run --cwd scripts fixed:generate; bun run --cwd scripts fixed:check; bunx --cwd scripts tsx --test fixed-corpus/test/shenyun-21x26.test.ts fixed-corpus/test/scheme-regressions.test.ts。Expected: 全部 PASS。
- [ ] **Step 5: 提交。** git add 本任务文件；git commit -m "feat: migrate 21x26 schemes to d3v1 layout"。

### Task 5: 更新活动键位图、热力图与移动皮肤

**Files:**
- Modify: scripts/generate-keymaps.ts, scripts/生成神韵键盘图.ts, scripts/生成神韵5500字键频图.ts
- Modify: scripts/skin/keymaps.ts
- Modify: lua/snow/keymaps/snow_jiandao.svg, snow_sanpin.svg, snow_shenyun_shape.svg, snow_shenyun_tone.svg
- Create: docs/shenyun-qz-e8f37a-keyboard.svg, docs/shenyun-d3v1-keyboard.svg
- Create after Task 7: corresponding keyboard-heat.svg and 5500-keyboard-heat.svg
- Test: scripts/fixed-corpus/test/keymaps.test.ts

**Interfaces:**
- Consumes: Task 3/4 活动映射、Task 7 十四方案回放；初代 SVG 只读。
- Produces: 四张活动运行时图、两套文档键位图/热力图、移动皮肤引用。

- [ ] **Step 1: 写失败测试。** 活动 SVG 标题与键位分别为 QZ/D3V1；初代四图 SHA-256 不变；十三 schema_id 各指向自己的图。
- [ ] **Step 2: 确认 RED。** Run: bunx --cwd scripts tsx --test fixed-corpus/test/keymaps.test.ts。Expected: 活动图仍标旧布局或新图不存在。
- [ ] **Step 3: 实现。** generate-keymaps 只重写活动图；benchmark 抽图使用新文件名并保留旧文档图；5500 脚本读取十四方案中的活动 schema_id。
- [ ] **Step 4: 生成并验证。** Run: bun run --cwd scripts keymaps:generate; bun run --cwd scripts keymaps:check; cargo test --manifest-path tools/keymap-helper/Cargo.toml; $skinOut = Join-Path $env:TEMP "snow-skins-next-shuangpin"; bun scripts/generate-skins.ts $skinOut --backend all。Expected: PASS，初代 SVG 哈希不变。热力图待 Task 7 回放生成后补跑。
- [ ] **Step 5: 提交。** git add 本任务文件；git commit -m "docs: update active shuangpin keymaps"。

### Task 6: 扩展 benchmark 注册表与五布局核心比较

**Files:**
- Modify: scripts/lib/benchmark-schemes.ts, scripts/lib/benchmark-ranking.ts
- Modify: scripts/lib/shenyun-markdown.ts, scripts/生成神韵对比.ts
- Modify: reports/shenyun-comparison.json, reports/shenyun-comparison.md, reports/ckt51-aux-order-robustness.json
- Test: scripts/fixed-corpus/test/legacy-benchmark-schemes.test.ts
- Test: scripts/fixed-corpus/test/shenyun-docs.test.ts

**Interfaces:**
- Consumes: 四份世代映射与对应 schema/fixed/radical。
- Produces: INITIAL_BENCHMARK_SCHEMES 四成员、ALL_BENCHMARK_SCHEMES 十二成员、五排名布局加 B04 外部参照。

- [ ] **Step 1: 写失败测试。** 活动 ID 为 qz-shape/qz-tone/d3v1-shape/d3v1-tone，初代 ID 为 u357-first-shape/u357-first-tone/overall17-first-shape/overall17-first-tone；断言十二方案来源。把 decorateComparison(values, direction, rankedCount = 3) 与 decorateMarkdownTable(source, directions, rankedCount = 3) 扩展为前五列排名、全部六列奖牌。
- [ ] **Step 2: 确认 RED。** Run: bunx --cwd scripts tsx --test fixed-corpus/test/legacy-benchmark-schemes.test.ts fixed-corpus/test/shenyun-docs.test.ts。Expected: 仍为八成员或只排名前三列。
- [ ] **Step 3: 实现。** 活动读取新资源，初代读取 _first 与冻结映射，经典保持快照；核心比较顺序为 D3/V1、QZ-e8f37a、Overall-17·初代、U357·初代、S005，B04 为第六列外部参照；追加两份 note 的辅序与 CKT v5.1。
- [ ] **Step 4: 生成并确认 GREEN。** Run: bun scripts/生成神韵对比.ts; bunx --cwd scripts tsx --test fixed-corpus/test/legacy-benchmark-schemes.test.ts fixed-corpus/test/shenyun-docs.test.ts。Expected: 新旧两代同表，五者有星级，B04 只参与奖牌。
- [ ] **Step 5: 提交。** git add 本任务文件；git commit -m "feat: compare five shuangpin layout generations"。

### Task 7: 生成 12／13／14 方案完整报告

**Files:**
- Modify: scripts/生成神韵500字实战测评.ts, scripts/generate_full_benchmark_reports.ts
- Modify: scripts/benchmark-sbxh-5000.ts, scripts/benchmark-flypy-5000.ts
- Modify: scripts/lib/benchmark-paths.ts, scripts/lib/benchmark-replay.ts
- Modify: scripts/生成神韵5500字键频图.ts
- Create: scripts/fixed-corpus/test/benchmark-generation-counts.test.ts
- Create: reports/冰雪十二方案_500字_最短键码实战测评.txt
- Create: reports/5000字_十二方案最优切分实测结果.json
- Create: reports/5000字_十三方案最优切分实测结果.json
- Create: reports/5000字_十四方案最优切分实测结果.json
- Create: 十二／十三／十四方案逐篇回放目录、汇总 Markdown 与文本对齐汇编

**Interfaces:**
- Consumes: Task 6 十二方案注册表。
- Produces: 500 字十二方案；5000 字十二方案 + sbxh 十三方案 + flypy 十四方案；活动 5500 字热力图。

- [ ] **Step 1: 写失败测试。** 内部 JSON 精确 12 schema_id，十三只追加 sbxh，十四只追加 flypy；四个初代代码路径独立；每篇回放顺序一致；旧 8／9／10 产物哈希不变。
- [ ] **Step 2: 确认 RED。** Run: bunx --cwd scripts tsx --test fixed-corpus/test/benchmark-generation-counts.test.ts fixed-corpus/test/benchmark-paths.test.ts fixed-corpus/test/benchmark-replay.test.ts fixed-corpus/test/sbxh-benchmark.test.ts fixed-corpus/test/flypy-benchmark.test.ts。Expected: 新产物不存在且脚本仍写 8→9→10。
- [ ] **Step 3: 实现。** 内部生成器固定十二成员；声笔脚本读 12 写 13；小鹤脚本读 13 写 14；同步改标题、链接、目录、错误信息与缓存合同，不删除旧产物。
- [ ] **Step 4: 依次生成。** Run: bun run --cwd scripts benchmark:500; bun run --cwd scripts benchmark:5000; bun run --cwd scripts benchmark:sbxh:5000; bun run --cwd scripts benchmark:flypy:5000; bun scripts/生成神韵5500字键频图.ts。Expected: 500/5000 全量成功，第 10 篇同时保留在十篇全量与独立赛文数据。
- [ ] **Step 5: 验证并提交。** 重跑 Step 2，Expected: PASS 且旧产物哈希不变；git add scripts reports 新热力图与测试；git commit -m "docs: add twelve fourteen scheme benchmarks"。

### Task 8: 替换 README 并完成全链验证

**Files:**
- Modify: scripts/更新神韵README.ts, scripts/lib/shenyun-markdown.ts
- Modify: README_CN.md, README.md
- Modify: scripts/fixed-corpus/test/shenyun-docs.test.ts
- Modify: 本 spec 与本 plan（只记录执行中确认的偏差）

**Interfaces:**
- Consumes: Task 1–7 新映射、指标、图表、报告链接。
- Produces: 三语 README 中只以 D3/V1、QZ-e8f37a 为现行布局的可重复生成内容，以及可发布分支。

- [ ] **Step 1: 写失败测试。** 简中/英文/繁中均出现新 ID、M/D/V、CKT v5.1、辅序和新图；Overall-17/U357 只允许出现在“·初代”兼容说明与 reports 链接，不能称为现行；README 链接 12／13／14 报告。
- [ ] **Step 2: 确认 RED。** Run: bunx --cwd scripts tsx --test fixed-corpus/test/shenyun-docs.test.ts。Expected: README 仍把旧布局写为现行。
- [ ] **Step 3: 实现并生成。** 更新 README 生成器，替换两组现行章节/表格/图片/来源/数据；初代只保留兼容说明，新旧并列比较统一链接 reports。Run: bun scripts/更新神韵README.ts。
- [ ] **Step 4: 全部本地验证。** Run: bun run --cwd scripts format; bun run --cwd scripts check:format; bun run --cwd scripts typecheck; bun run --cwd scripts mapping:check; bun run --cwd scripts auxiliary:check; bun run --cwd scripts radical:check; bun run --cwd scripts fixed:check; bun run --cwd scripts keymaps:check; bun run --cwd scripts test:corpus; bun scripts/check-pinyin-dict.ts; cargo test --manifest-path tools/keymap-helper/Cargo.toml。Expected: 全部 PASS；不调用本地 Mira。
- [ ] **Step 5: 可重复生成检查。** 再跑映射、radical、fixed、keymap、README、核心比较与 12→13→14 报告命令；Run: git diff --check; git status --short。Expected: 二次生成无新增差异，仅有预期文件。
- [ ] **Step 6: 提交。** git add README、生成器、测试、spec、plan；git commit -m "docs: publish next generation shuangpin layouts"。
- [ ] **Step 7: 双远端与 CI。** Run: git swap auto; git push origin main。Expected: GitHub ChenZhu-Xie/rime-snow-pinyin 与 Gitee xie-chenzhu/rime-snow-pinyin 均成功；等待 GitHub Actions 十三方案 × librime 1.13.1/1.17 全绿；用两个显式 SSH URL 的 git ls-remote 核对远端 main 等于本地 HEAD。任何一步失败立即停止，不推 upstream。

