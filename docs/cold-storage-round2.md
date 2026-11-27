# 第二批历史资料冷存与工作树整理

批次为 `2026-11-28-main-e3fde76`，操作开始于 `main` 的 `e3fde765afd497b7bf59adcb2aa92df381240bf4`。冷盘根目录为 `N:\snow_pinyin\rime-snow-pinyin\2026-11-28-main-e3fde76`，本地清单目录为 `output/cold-storage/2026-11-28-main-e3fde76/`。第一批路径与恢复说明见 [本机冷存清单](cold-storage.md)。

本轮已完成 66 项、23,088 个文件的迁移和核验，共 9,434,194,261 字节（约 8.79 GiB）：历史资料约 7.63 GiB，三个工作树及专属管理数据快照约 1.16 GiB。D 盘仓库本地占用由约 19 GiB 降至约 10 GiB（`dust` 不跟随联接）。原有缓存全部保留在对应冷存目录或工作树快照内。

两边均保存 `README.txt`、`index.json` 和逐文件 `*.files.jsonl`；`index.json` 的每项记录原路径、冷盘路径、分类、字节数、清单文件、符号链接及原有历史元数据。逐文件清单记录相对路径、长度、修改时间和 SHA-256；清单文件名由原相对路径摘要生成，以 `index.json` 为对应表。`transfer.py` 保存本次执行逻辑，`git-history.txt` 保存工作树提交、当前分支和操作锚点。运行状态以 `index.json` 为准，只有 `completedAt` 存在才表示整批完成。

## 冷存范围

以下源路径均相对于主仓库，历史产物在冷盘保持同样的相对目录结构。历史产物迁移后原路径建立目录联接；唯一保留的 payload 文件使用符号链接。原路径与冷盘是同一份数据的两个入口，不是两份备份。缓存、编译产物、隐藏文件和原有符号链接均保存，复制后逐文件核对源与目标 SHA-256，成功后才移除源副本。

| 原路径范围 | 用途与历史依据 |
| --- | --- |
| `output/` 顶层名称含 `latency` 的目录 | 历次性能采样、日志与报告。存在 `report.json` 时保留其 `metadata`，其中的提交、运行环境和日期比目录名更可靠；未记录的来源不推断。 |
| `output/` 顶层名称含 `skins` 的目录 | 历次皮肤生成和审阅产物。多数未独立记录创建分支、提交；本次 HEAD 仅为归档锚点，不能当作产物来源。 |
| `output/production-fork-prepare/` | 历史 fork 部署副本，来源以目录内 `manifest.json` 和清单提取的原有元数据为准。 |
| `output/character-first-choice-upstream-prepare/` | 历史上游首选验证部署副本，保留原 manifest；上游提交不能误认为 fork 提交。 |
| `output/keymap-bitblt-probe/` | 桌面键位图实验及 Rust 编译缓存；保留完整目录，不删除缓存。 |
| `output/readme-benchmark-payload.json` | 第一批去重后保留的唯一 payload，移到冷盘并保留原文件入口。 |
| `.worktrees/word-length-selection/.superpowers/sdd/2026-11-22-word-length-selection/latency*` | `feat/word-length-selection` 的 `4ddd60336b32d573fdf2079e65b5df7e4d82ad53` 工作树中的五组性能记录；具体 CI 提交以各报告元数据为准。 |

原文件没有记录的创建分支、提交明确视为未知；工作树 HEAD、报告所测提交、归档时主仓库 HEAD 分开记录，不能相互代替。实验文件也可能包含未提交的隔离变体，不承诺是某个提交的纯净检出。冷存文件内保存的绝对路径不批量改写，以免破坏历史证据；旧路径通过联接继续访问。

## 工作树处理

先确认 `git status --porcelain --ignore-submodules=all`、提交是否在 `main` 历史中，再保存完整文件快照（含忽略文件和依赖）及对应 `.git/worktrees/<名称>/` 管理数据快照。对确认可移除的检出，完成文件校验后通过 `git worktree remove` 移除；分支、主仓库对象库和已合入的提交均保留。快照中的 `.git` 指针属于历史记录，冷盘快照不登记为活动工作树，不直接作为 Git 工作目录使用。

词长选择工作树的整体快照单独位于冷盘 `worktree-snapshots/word-length-selection/`，其中性能目录以链接指向冷盘 `.worktrees/word-length-selection/.superpowers/sdd/2026-11-22-word-length-selection/latency*`。这样源码快照与已独立归档的性能数据各有明确入口，具体映射以 `index.json` 的 `coldPath` 为准。移除工作树后，它在 D 盘的性能入口也随检出移除，保留入口位于冷盘工作树快照中；清单的 `originalPath` 表示迁移前路径，`retainedEntryPath` 表示最终可用入口。原路径下的五组目录及一份同前缀日志均已冷存。

| 工作树 | HEAD 与分支 | 处理依据 |
| --- | --- | --- |
| `.kilo/worktrees/olive-galliform` | detached `722ad83f3d386e6cb841ac4ba5ff8d4f465bb219` | 无主仓库未提交改动，提交已在 `main` 历史中；核验完整快照后移除。 |
| `.worktrees/benchmark-postpone-c369ff7` | detached `c369ff7cc0ce1829aa4c7c3241ddab1a8728e2ec` | 保留活动检出：移除前复查确认存在未提交报告，完整状态保存在清单。 |
| `.worktrees/next-generation-shuangpin` | `codex/next-generation-shuangpin`，`fb89a7457eb0bdf72933cbfed5993fc63f721e96` | 无主仓库未提交改动，提交已在 `main` 历史中；核验完整快照后移除，保留分支。 |
| `.worktrees/word-length-selection` | `feat/word-length-selection`，`4ddd60336b32d573fdf2079e65b5df7e4d82ad53` | 无主仓库未提交改动，提交已在 `main` 历史中；性能记录先独立冷存，随后保存其他文件和管理数据再移除，保留分支。 |
| `.worktrees/benchmark-word-length-4ddd603` | detached `4ddd60336b32d573fdf2079e65b5df7e4d82ad53` | 保留活动检出：存在未提交代码、报告和未跟踪文件，不覆盖或清理。 |
| `.worktrees/fix-qingyun-reverse` | `fix/qingyun-reverse`，`78ccdbc2dbca5966887142d2c1eb7011d845b633` | 保留活动检出：HEAD 尚未合入 `main`。 |

对子模块不依赖主仓库状态判断其内容是否可丢弃：工作树的全部文件和专属 Git 管理数据均随快照保存，包含可能存在的子模块状态及对象。一处旧工作树的子模块 Git 指针失效，完整快照仍保留该指针和文件，不在本次整理中修复历史检出。

## 使用与恢复

N 盘在线时原实验路径继续有效；通过旧路径写入也会修改冷盘资料。文件清单表示迁移时的状态，后续重新实验应使用新批次，避免覆盖历史证据。N 盘离线时不要在断开的路径上重新创建实验目录。

移回历史产物时，先停止相关程序，核对入口的链接类型和目标，只移除链接本身，再复制冷盘目录回原路径并按文件清单核验；在确认成功前保留冷盘副本。子目录可能含外部依赖链接，其目标记录在 `index.json`，不能把链接目标当作可删内容。

恢复已移除工作树时，在主仓库执行 `git worktree add --detach <新路径> <清单中的完整HEAD>`，或指定保留的分支。初始化需要的子模块，再从冷盘快照复制所需源码和本地资料；不要覆盖新工作树或子模块的 `.git` 指针。管理数据快照用于历史查证和必要时找回私有子模块对象，不直接覆盖当前 `.git/worktrees/`。快照内原性能目录的链接继续指向本批次冷盘位置。

本轮保留当前长语料目录、用户词典备份、`output/connection-study/`、本机 `build/`、主 helper 的 `target/`，以及三处上述仍需保留的工作树。全部逐项状态和最终统计见两边相同的 `index.json`。
