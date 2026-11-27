# 本机冷存清单

当前统一使用地址映射，迁移创建的目录与文件别名已移除。后续规范见 [周期冷存规范](cold-storage-policy.md)，逐项地址见 [Git 总索引](cold-storage/catalog.json)。

后续批次及闲置工作树处理见 [第二批历史资料冷存与工作树整理](cold-storage-round2.md)。本页只描述第一批操作范围。

本次批次为 `2026-11-27-main-56ffbc8`，归档开始时仓库为 `D:\C2D\Documents\rime-snow-pinyin`，分支 `main`，HEAD 为 `56ffbc808d0e653f7a89808e4d825e756218b534`。本文件记录本机路径，不是发布包依赖；其他机器无需创建这些目录。

迁移于 2026-11-28 完成：四个目录共 6,258 个文件、12,007,225,579 字节（约 11.18 GiB）逐文件核验通过；去掉九份重复文件共 744,034,054 字节（约 0.69 GiB）。合计释放 D 盘约 11.88 GiB，当时本地占用约 19 GiB。缓存完整迁移。本批次创建的四个联接现已移除，当前仅保留地址映射。

冷盘根目录为 `N:\snow_pinyin\rime-snow-pinyin\2026-11-27-main-56ffbc8`。两边的详细清单分别位于仓库的 `output/cold-storage/2026-11-27-main-56ffbc8/` 和冷盘根目录：`index.json` 记录对应路径、字节数、状态、历史依据和去重记录，四份 `*.files.jsonl` 逐文件记录相对路径、长度、修改时间及 SHA-256，`git-history.txt` 保存关联提交的日期、标题和归档时的本地分支包含关系，`README.txt` 说明使用与恢复方式。详细清单不提交 Git，避免把数千条本机产物记录加入源码仓库。

## 路径与历史对应

以下原路径相对于仓库根目录，冷盘路径相对于本批次根目录。原路径仅作历史查找，不保留目录或文件链接；按映射显式读取冷盘，运行实验前先恢复到独立工作目录。缓存、实验结果、冻结源码和隐藏文件全部保存。

| 原路径 | 冷盘路径 | 历史时期与依据 |
| --- | --- | --- |
| `output/bracket-experiment/` | `output/bracket-experiment/` | 2026-11-26 至 2026-11-27 追加字及双键交换实验；早期基于 `sipin-production-fix/source`，包含不同阶段的隔离修改与较新生产副本；阶段报告提交为 `3cf6a8e196bf3a422e520a16f3739ddc50122a68`，见 `docs/bracket-append-research.md` 和目录内的 `run.ts`。 |
| `output/prepend-experiment/` | `output/prepend-experiment/` | 2026-11-26 前插与追加对比；使用四拼更正后的冻结来源，并注入实验处理器；报告提交为 `0c0d783890d4993c2d2e94e6e07def99e4e21732`，见 `docs/prepend-benchmark.md` 和 `sipin-summary.json` 的 `source`。 |
| `output/character-first-choice-probes-prepare/` | `output/character-first-choice-probes-prepare/` | 原 `manifest.json` 明确记录 `revision: 75f64876cb34698c6af1377e412cbc74bb647dce`（2026-11-24），`runtime: prepare-only`；保留不同探针部署变体及原来源摘要。 |
| `output/sipin-production-fix/` | `output/sipin-production-fix/` | 2026-11-26 四拼单字编码评测修正；生产数据基于 `bed395f61681884199439633b8e840af0902e692`，叠加评测生成器修正，报告提交为 `3a9720e51add9b61fe32ef0300784768cbaf1763`，见 `docs/long-corpus-benchmark.md`。 |

这些关联提交目前均在 `main` 历史中。原实验创建时的分支名未独立记录，不能从当前分支包含关系反推；报告提交只表示结论进入版本控制的时期，不代表每个实验文件都来自该提交。需要复现时应以保留的冻结源码、原始 manifest、选项与缓存摘要为准，不直接用当前 HEAD 替代。

## 保留的外部依赖

`sipin-production-fix/source/deps/rime-radical-pinyin` 和 `sipin-production-fix/source/scripts/node_modules` 原本就是符号链接，分别指向主仓库的 `deps/rime-radical-pinyin` 与 `scripts/node_modules`；归档保留链接及目标记录，不把主仓库依赖重复复制进冷盘。因此这套冷存不是完全独立的运行环境。其他实验还会读取原有 `output/corpus-benchmark-current/`、`output/append-generalization/` 等目录，详见实验脚本和对应研究文档。

## 去重与保留范围

`output/ued-payload.json` 与 `output/readme-benchmark-payload.json` 的 SHA-256 相同，保留后者。`output/release-v0.3.14-current/verify-github/` 和 `verify-gitee/` 中的四种 ZIP 与 `artifacts/` 对应文件哈希一致，保留 `artifacts/` 以及原验证记录，移除八份重复 ZIP。具体文件、哈希和释放字节数见 `index.json` 的 `deduplicated`。

本次不移动其他实验目录、工作树、`.git/`、本机 `build/`、Rust `target/`、当前长语料评测目录和用户词典备份。不删除缓存；四个实验目录中的缓存只改变实际存储位置。

## 使用、校验与恢复

N 盘在线时按映射读取冷盘路径。旧脚本若要求原绝对路径，先恢复到独立工作目录并调整运行配置。以后重新生成的同名 output 路径属于新数据，不能覆盖旧批次。

迁移采用先复制、逐文件核对源与目标 SHA-256、再删除源副本的流程。当前 `index.json` 的 `verified-and-mapped` 表示核验完成且仅保留映射；`index.before-address-mapping.json` 保留原始迁移回执，`address-mapping-receipt.json` 记录别名移除和目标保留。历史迁移脚本仅作证据，不直接重跑。原有依赖链接及目标单独记录。

恢复到 D 盘时选择尚不存在的独立目录，复制并按文件清单核验数量、长度和 SHA-256，再显式配置依赖；冷盘原件保留。原有外部依赖链接不表示归档可独立运行，跨机器恢复需按记录重新安装依赖。冷盘位置变化只更新地址映射和位置回执，不改写来源信息。
