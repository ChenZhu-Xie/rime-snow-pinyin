# 本机冷存清单

本次批次为 `2026-11-27-main-56ffbc8`，归档开始时仓库为 `D:\C2D\Documents\rime-snow-pinyin`，分支 `main`，HEAD 为 `56ffbc808d0e653f7a89808e4d825e756218b534`。本文件记录本机路径，不是发布包依赖；其他机器无需创建这些目录。

迁移于 2026-11-28 完成：四个目录共 6,258 个文件、12,007,225,579 字节（约 11.18 GiB）逐文件核验通过并建立联接；去掉九份重复文件共 744,034,054 字节（约 0.69 GiB）。合计释放 D 盘约 11.88 GiB，`dust` 在不跟随联接时测得仓库本地占用约 19 GiB。缓存随目录完整迁移。

冷盘根目录为 `N:\snow_pinyin\rime-snow-pinyin\2026-11-27-main-56ffbc8`。两边的详细清单分别位于仓库的 `output/cold-storage/2026-11-27-main-56ffbc8/` 和冷盘根目录：`index.json` 记录对应路径、字节数、状态、历史依据和去重记录，四份 `*.files.jsonl` 逐文件记录相对路径、长度、修改时间及 SHA-256，`git-history.txt` 保存关联提交的日期、标题和归档时的本地分支包含关系，`README.txt` 说明使用与恢复方式。详细清单不提交 Git，避免把数千条本机产物记录加入源码仓库。

## 路径与历史对应

以下原路径都相对于仓库根目录，冷盘路径相对于上述批次目录。原路径使用 Windows 目录联接指向冷盘；它们是同一份数据的两个入口，不是两份备份。所有原有缓存、实验结果、冻结源码与隐藏文件均随目录保存。

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

N 盘在线时继续使用原来的 `output/...` 路径。目录联接不会把路径写入 Git，干净 checkout 也不会自动获得这些本机归档。N 盘离线时四个入口不可用；不要在断开的入口上重建空实验目录。通过原路径运行实验可能直接修改冷盘文件，因此归档清单表示迁移时的快照；后续写入后应另建批次或更新清单。

迁移采用先复制、逐文件核对源与目标 SHA-256、再删除原副本并建立目录联接的流程。`index.json` 中每项的 `state` 为 `verified-and-linked` 表示该目录已完成；中途失败时应依据实际状态恢复，不直接重跑 `transfer.ps1`（脚本会拒绝覆盖已存在的批次）。目录内外部符号链接单独记录，不遍历或删除其目标。

恢复到 D 盘时，先停止使用对应实验，确认原入口确为指向本批次的 Junction，再只移除入口本身（例如用 `[System.IO.Directory]::Delete('完整入口路径')`，不要递归删除链接路径）。将冷盘对应目录复制回原路径，保留其中的符号链接，并按 `*.files.jsonl` 核对文件数、长度和 SHA-256；在核验成功前保留冷盘数据。移动冷盘批次时也须同步更新四个目录联接及两边的清单。
