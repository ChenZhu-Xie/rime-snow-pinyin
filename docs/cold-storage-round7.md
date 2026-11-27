# 第七批：历史实验归档与既有备份的冷副本

本轮从 `main` 的 `947a840e15cd0b98627cd857672627a5da7860d2` 开始，仅迁移创建和修改时间均早于北京时间 `2026-11-27 00:00:00 +08:00` 的十组历史实验目录；三处既有用户资料备份只复制到冷盘，热盘原件保留。28 日资料、所有「追加是」相关资料、长语料、连接字研究和实际依赖继续保留。缓存随迁移目录完整保存，冷热关系仅记录地址映射，不创建联接。

本批次 ID 为 `20261127T202610Z-947a840-a9104d`（UTC 时间）；本地清单 `output/cold-storage/20261127T202610Z-947a840-a9104d/`，冷盘 `N:\snow_pinyin\rime-snow-pinyin\20261127T202610Z-947a840-a9104d`。十项迁移释放 493,963,139 字节（约 471.08 MiB），三项源保留备份增加 65,242,086 字节（约 62.22 MiB）的独立冷副本。本批共 1,020 个文件，备份不计入释放量。

## 历史实验范围

| 原地址（相对仓库） | 历史时期与用途 |
| --- | --- |
| `output/oracle-comparison/` | 2026-11-25 的本地 DLL 会话、逐键前缀和并行采集比较，含编译缓存。原报告、输入和各方案指纹完整保存，没有可靠的整体源码提交／分支记录时明确标为未知。 |
| `output/ckt5-nested-frontier/` | 2026-11-02 的布局搜索；原 manifest 保存配置、createdAt、updatedAt、completedModes 和失败项，不据此推断源码 commit。 |
| `output/keymap-launch-fix/` | 2026-11-21 的桌面启动验证，图像、日志和产物原样保留，缺少权威构建提交时不以时间戳代替来源。 |
| `output/character-first-choice-v2/`、`v3/`、`v4/`、`v5-offline/`、`v6-offline/`、`v7-observed/`、`v8-selection/` | 七个完整原路径都以 `output/character-first-choice-` 开头，属于 2026-11-25 的中间评测与修订稿，含曾作废的算法估计和后续观测修订。按各自原文件和哈希保留，不混作正式结果，不因版本名相近而删除或合并。 |

源目录、子目录、普通文件及链接均检查创建和修改时间，任意一项不早于截止时间即中止；时间审计、文件集合和 SHA-256 保存于两边相同的 plan 与 index。来源提交和分支未知时明确保留未知，归档时 main HEAD 单独记录。迁移前检查本仓库和既有冷存中的链接，没有发现依赖这些旧地址的链接；没有发现对应采集或迁移进程正在运行。

## 既有备份的独立冷副本

| 热盘原件（继续保留） | 内容与边界 |
| --- | --- |
| `output/userdb-reset-20261109-004923/` | 2026-11-09 用户词典重置前后文本、已有 userdb 备份、沙箱及当时的运行库。复制历史资料，不重置活动用户词典或调整词频。 |
| `schema-id-migration-backup/` | 方案 ID 迁移前的 default.custom.yaml、user.yaml 与 complete 标记，全部原样保存，不重跑迁移或改当前配置。 |
| `output/weasel-upgrade-backup-20261111-181151.zip` | 2026-11-11 已有的小狼毫升级备份 ZIP，只增加冷副本，原 ZIP 保留。 |

三项独立普通文件副本位于批次内 `backups/<原地址>`；文件清单中的 `.` 表示条目本身是独立 ZIP。历史备份可能含私有配置和词典，载荷与逐文件清单留在本地／冷盘，Git 只保存地址、数量、清单摘要和说明，不提交私有内容。源 commit／branch 未可靠记录时明确未知。

## 核验与恢复

复制后逐文件核对目标 SHA-256，再整批重读源与目标核对完整集合、大小、修改时间、目录集合及哈希；移除各迁移源之前再次核验。只有 action=move 的十个明确绝对路径进入删除分支，action=backup 的三处原件保持原位，最终再次核对原件内容、创建与修改时间。旧依赖链接只记录类型与目标，不跟随复制，也不建立冷热链接。

两边保存 index.json、plan.json、逐项 files.jsonl、SUMMARY.md、README、规范和操作脚本；Git 总索引绑定详细索引与文件清单摘要。最终操作提交、两远端核验和完成时间单独写 completion.json，避免自引用提交号。

```powershell
just cold-storage find output/oracle-comparison
just cold-storage find output/character-first-choice-v2
just cold-storage find schema-id-migration-backup
just cold-storage verify all
just cold-storage verify <本批次ID> --full
```

kind=archive 表示源已迁移，kind=backup 表示热盘原件保留。文档旧路径继续表示历史来源，先通过映射查找；重跑前复制到独立且不存在的目录并核验，不在冷盘归档上运行会写文件的脚本。后续在原 output 路径生成的是新数据。

`benchmark-character-oracle.ps1` 默认使用 `output/oracle-comparison/compiled`，重跑时重新生成或显式配置恢复副本；`export-character-observed-corrections.ts`、`export-character-selection-report.ts` 默认读取 v2／v3，运行前恢复所需中间稿并显式传入读写目录。用户资料恢复也先复制到独立目录核验，不覆盖活动 userdb 或迁移标记。完整来源与恢复信息以本批索引为准。

完成本批后停止以瘦身为目的扩大迁移范围。剩余受保护研究、正式证据、编译／候选缓存和依赖保持原状，后续按新的明确需要另建批次。
