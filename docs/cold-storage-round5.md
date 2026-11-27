# 第五批历史部署、性能与桌面验证资料冷存

本轮从 `main` 的 `e2a294dff76bb7cafbc3b60643747748504582d9` 开始，冷存已确认闲置的十三项历史目录／文件，使用 [Git 地址映射总索引](cold-storage/catalog.json) 关联本地和冷盘清单。缓存随目录完整保存，没有创建指向冷盘的联接或符号链接，也没有按名称删除相似文件。

本批次 ID 为 `20261127T195621Z-e2a294d-ae5d34`（UTC 时间）；本地详细清单为 `output/cold-storage/20261127T195621Z-e2a294d-ae5d34/`，冷盘根目录为 `N:\snow_pinyin\rime-snow-pinyin\20261127T195621Z-e2a294d-ae5d34`。共冷存 1,744 个文件、1,445,587,296 字节（约 1.35 GiB），这些字节均保留在冷盘，核验后才移除热盘副本。

## 范围及版本依据

| 原路径（相对仓库） | 来源与恢复依据 |
| --- | --- |
| `output/production-upstream-prepare/` | 原始 manifest 标记 upstream、prepare-only，revision 为 `99c1d6010ff7252175f2b373f05ff30e9541f3c3`；这是上游来源，不能当成本 fork 的部署。 |
| `output/full8k-prepare-sipin/` | 原始 manifest 标记 fork、prepare-only，revision 为 `576adbe5d1272ea6344884abace29ccee88629cd`。 |
| `output/aux-rank-prepare/` | 原始 manifest revision 为 `df5f91d81c34b9309020cd02f86a6fc6c2da788b`。 |
| `output/probe-ranktargets-verify/` | 原始 manifest revision 为 `b4b1c94a876c0885f840f166ed82902ddef72164`。 |
| `output/budgeted-probe-prepare/` | 原始 manifest revision 为 `9223de2b25ee990baa41ec9c0cb9dfdac5b288d2`。 |
| `output/probe-conflict-ranktargets-verify/` | 原始 manifest revision 为 `b4b1c94a876c0885f840f166ed82902ddef72164`；与另一探针同提交不代表探针参数、部署和字节相同，分别归档。 |
| `output/append-baseline-27019df/`、`output/append-baseline-27019df.zip` | 名称关联历史基线 `27019df92c87dbdbed52da18f9ded7d8bf5ac031`；这是关联依据，不能证明每份文件是该提交的纯净检出。展开目录和 ZIP 均保留。 |
| `output/append-shi-ci-25e3ea3/` | 原 report metadata 明确记录 `25e3ea3bd04b6de0b6e3b183309eeadccf6970dc`、空 dirty、源摘要 `64fae485d9411b97bca68058bb2d197492bee939fdb86e7e52353289da5eea0a` 和 2026-11-27 的采样时间；报告、样本和十一方案日志一起保存。metadata 的 working-tree ref 不表示分支名。 |
| `output/keymap-desktop/` | Windows helper 的历史窗口、截图与诊断记录，包含多轮前后对照；没有权威的逐轮源码提交记录，来源分支／提交标为未知。 |
| `output/release-v0.3.13/` | 旧发布包原件；版本和目录名不证明打包源码 commit，保持未知并按资产哈希识别。 |
| `output/release-inspect-834fac3cd64f4682b14ac1c2c708ba7c/` | 历史发布包下载检查目录，目录名是标识而非有效的完整 Git SHA；不据此捏造来源。 |
| `output/current-layout-validation.zip` | 历史布局验证压缩包，来源未独立证明；文件名中的 current 只属于当时，不视为当前生产资料。 |

来源的原始分支没有可靠记录，明确保留为未知；归档时 `main` 与 archive HEAD 单独记录。manifest 中的 source hashes、变体和探针参数原样保留，部分部署本身是有意修改的实验版本，不能只用 source commit 取代整个快照。

## 核验与冷热关系

执行前检查了本仓库及现有冷存目录中的链接，没有发现依赖这十三个旧地址的链接；进程检查未发现相应基准／探针正在运行。受跟踪代码和说明中，`output/keymap-desktop` 是测试默认输出位置，移走旧结果不影响后续生成，新结果使用同名热盘路径时属于新一代。

冻结计划记录所有普通文件的相对路径、大小、修改时间和 SHA-256，原有链接只记录类型及目标，不跟随复制。复制后逐文件核对目标哈希，再整批重读源与目标核对集合、时间和哈希；每项删除前再次核验该项的源与目标。仅删除已核验的绝对源路径，缓存和唯一资料仍在冷盘。文件清单中的 `.` 表示该条目本身是一个独立文件。

两边保存相同的 `index.json`、逐项 `*.files.jsonl`、`plan.json`、`SUMMARY.md`、README 和操作脚本。总索引绑定详细索引及文件清单 SHA-256；最终提交与两远端确认另记 `completion.json`，不为回填本次提交号反复改写同一索引。旧批次载荷不变，只更新旁边的当前总索引和规范副本。

## 查找及恢复

```powershell
just cold-storage find output/production-upstream-prepare
just cold-storage find output/append-baseline-27019df.zip
just cold-storage find output/keymap-desktop/windows
just cold-storage verify all
just cold-storage verify <本批次ID> --full
```

`find` 支持历史目录下的具体文件，独立 ZIP 也可直接查询。冷盘离线时只返回映射，不以同名热盘新产物代替。恢复到独立且不存在的目录后按文件清单核验，依赖按链接记录显式初始化，运行和修改只在恢复副本中进行。旧绝对地址、历史报告内容和 source manifest 不在归档时批量改写。

本轮继续保留当前长语料结果、正式单字评测的原始证据、冰雪清韵补证、连接字研究、本机 build、helper target、候选缓存和实际依赖；后续不凭目录名称或修改日期直接删除这些内容。
