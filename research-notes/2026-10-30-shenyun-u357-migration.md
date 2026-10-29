# 神韵 U357 实装迁移

## 目标方案

- 实作标识：`U357-21X21-M40-D0`
- Benchmark 候选：`gen0107-p5-f1h-11_13-d2-f25_26-d3-f4_22-d4-f11_13`
- 约束：严格 `21×21`、`IVUAO`、`M=40`、`D=0`、`V=5`
- 状态键：`1515010f0c0503130d0b060a070910170a160411190212111111121818160a090d0512040c11040b050f09021901130d03030f10070203171306011806110a04081514000e`
- Benchmark 指标：Common399 唯一码 357；CKT v4 9.716420811869073；移动手 143.380；六项人体工学门禁全部通过

候选源配置保存在 [`config/shenyun-21x21-mapping.json`](../config/shenyun-21x21-mapping.json)，由 `scripts/生成神韵映射.ts` 结合冻结的 421 音节域生成 [`docs/shenyun-u357-mapping.json`](../docs/shenyun-u357-mapping.json)。生成快照 SHA256 为 `e8e3a96f7b929e3e947f9f15c11282349a37ea4f980892b35056badc5f9367a3`。

## 映射与空间

- 声母：普通声母保持原键，`zh/ch/sh → K/W/E`，零声母 `AOE/Y/W → R/Y/S`。
- 韵母：`a W, ai K, an J, ang N, ao F, e S, ei E, en M, eng R, er E, i L, ia F, ian P, iang J, iao C, ie Z, in B, ing T, iong N, iu D, o D, ong P, ou Q, u H, ua C, uai D, uan X, uang T, ui G, un B, uo Y, v G, van R, ve K, vn E`。
- Common399：399 个音节编码为 357 个唯一码，42 个二元重码桶，84 个空码。
- 扩展域：416 个可编码音节形成 366 个唯一码、50 个重码桶和 75 个空码；`hng、m、n、ng、ê` 仍不编码。

## 三拼适配

- `snow_sanpin.schema.yaml` 的声母、韵母、零声母和字母入口全部改用 U357，声调键顺序仍为 `IVUAO`。
- 重新生成 `snow_sanpin.fixed.txt` 与 `snow_sanpin.fixed.630.txt`。AA 区由 366 个二码单字和 75 个天然空码二简完整覆盖，不再牺牲冷门音码。
- 三拼 630 固顶为 105 个二码词和 505 个三码词；候选审计表仍有 550/630 个码位可选。
- 字母入口改为 `v/i/u/o/a → xg/xl/xh/xd/xw` 后追加轻声键 `o`；当前与完整音节相撞的字母全码为 `tco/hco/xgo/xlo`，固顶字母保持优先。
- 数字、固定词、略码、全码回归和 Mira 用例均按新声韵码重写。

## 键道适配

- `snow_jiandao.schema.yaml` 与共享 `snow_jiandao_jianpin.schema.yaml` 同步新的元音字母入口。
- 重新生成 `snow_jiandao.fixed.txt`：二简与 AA 单字空间和三拼共用同一 U357 音码域；键道 630 为 105 个二码词和 525 个三码词，另有 1618 个三码单字。
- 数字入口按新布局重新编码；`三` 的完整音码 `sj` 已占 AA 单字位，因此一码 `s` 只追加阿拉伯数字 `3`，避免 `s/sj` 固顶父子码重复。
- 固定词、字母、数字、形码、简拼、全码和 Mira 用例均按新布局适配。

## 验证边界

- `bun run mapping:check`：421 音节和快照统计通过。
- `bun run fixed:check`、`bun run fixed:verify`：生成结果、空间数量、父子码和全局唯一码通过。
- `bun 生成三拼简词.ts --check`：550/630 个三拼码位通过。
- `bun run test:corpus`：74 项通过。
- `bun run typecheck`：通过。
- 本机 Windows 环境没有 `mira` 可执行文件；按仓库约定，三拼、键道及五方案候选级测试需在推送后由 GitHub Actions 运行。
