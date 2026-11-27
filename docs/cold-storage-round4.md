# 第四批冷存、重复副本整理与查询工具

本轮从 `main` 的 `d34a0521708c2bf110f83e61868cdfad67b67802` 开始，按已核实的哈希清理重复副本，再冷存六个历史目录。地址以 [Git 总索引](cold-storage/catalog.json) 为准，冷热位置不建立联接。当前长语料结果、单字评测证据、连接字研究、主 helper 编译缓存和本机 build 保留。

本批次为 `20261127T185026Z-d34a052-0ec657`（UTC 时间）；本地清单 `output/cold-storage/20261127T185026Z-d34a052-0ec657/`，冷盘 `N:\snow_pinyin\rime-snow-pinyin\20261127T185026Z-d34a052-0ec657`。冷存 1,634 个文件、1,412,242,741 字节（约 1.32 GiB），另去重 357.63 MiB；合计释放约 1.66 GiB，没有重复累计已删 ZIP。

## 重复副本

根目录 `ice/` 与 `rime-easy-en/` 是迁移到 `deps/` 前的重复检出，其普通文件分别为 98 和 9 份，与 `deps/rime-ice/`、`deps/rime-easy-en/` 的路径集合、长度和 SHA-256 全部相同，对应 Git HEAD 也一致。删除前核对无未提交或未跟踪文件，并检查本仓库与既有冷存目录没有链接依赖这两个旧根地址。只删除旧检出，保留规范目录和全部 `.git/modules/` 对象数据；旧 `.git` 指针及 HEAD 作为回执保存。

三个发布目录共发现八组内容重复的 ZIP，保留每组一个原件，移除 15 份重复副本。优先保留 artifacts 中的原件，未把同名但不同哈希的版本混为一份。验证 JSON、下载脚本、发布前后 API 记录及标签检查记录完整保留；被去重地址逐项映射到保留原件，若原件随后冷存，则记录它最终的冷地址。去重计划、逐文件哈希和已删回执在两边的批次索引中保存。

## 冷存范围与来源

| 历史路径 | 来源与保留依据 |
| --- | --- |
| `output/release-v0.3.14-27019df/` | 历史发布及替换资产记录，名称关联 `27019df92c87dbdbed52da18f9ded7d8bf5ac031`；每个资产仍以哈希和验证回执识别，不声称全部文件是该 commit 的纯净检出。 |
| `output/release-verify-v0.3.14-62e5375/` | 名称关联 `62e5375` 的历史公开下载核验副本；保留不同版本的唯一资产与来源文件，完整相关 SHA 见索引。 |
| `output/um40/` | 冻结的 `UM40-ac9707a932d1` 布局数据、皮肤和验证日志；与历史迁移提交 `ddab179` 相关，未记录原创建 commit 和分支，不以关联提交冒充来源。 |
| `output/append-probes-static/`、`output/append-probes-static-v2/` | 早期静态探针部署及缓存。没有权威来源 commit／分支记录，明确标为未知；原目录结构、文件哈希和历史内容均冻结保存。 |
| `output/character-first-choice-state-prepare/` | 原始 prepare-only manifest 明确记录 revision 为 `d3b513737b7241f9a715c8949764fcbbdd6349bb`；保留变体、探针与源文件摘要。 |

各目录保持批次内相同相对路径。目录里的缓存随数据完整冷存；已有外部依赖链接只保存类型和目标，不跟随复制，也不在冷盘建立新链接。逐文件清单描述的是去重后剩余文件，原始集合和移除项另存 plan 与 deduplication receipt，不能把两者混算。

复制前冻结完整源集合；去重前整批核对所有待删项与保留原件，复制后核对目标哈希，再整批核对源与目标集合、大小、时间和 SHA-256。最终删除各源目录前再次核对该目录，失败则保留现场，不能盲目重跑一次性脚本。归档阶段、文档发布阶段和最终提交／两远端确认分别记录，completion 回执表示全部完成。

## 统一查询与核验

仓库根目录运行：

```powershell
just cold-storage status
just cold-storage find output/append-probes-static
just cold-storage find ice/cn_dicts/base.dict.yaml
just cold-storage verify all
just cold-storage verify <批次ID> --full
```

没有 just 时用 `bun scripts/cold-storage.ts` 替换命令前缀。支持 `--json`，以及 `--cold-root <实际项目冷存根>`、`--catalog <索引文件>` 和 `--metadata-root <本地清单根>`；显式相对参数按调用目录解析，不受脚本所在目录影响。工具只读取文件，不修改批次、创建联接或自动迁移／删除。

`status` 的 available-unverified 只说明路径存在；离线显示 offline，不查找同名热盘数据作为替代。`find` 从已提交索引查地址，即使冷盘离线也可用，并分别显示来源 commit 与归档时分支／HEAD；来源未知保持未知，去重项显示最终保留地址。旧两批更细的来源依据仍在各批次说明及详细索引中。

`verify` 校验本地／冷盘索引与文件清单摘要、载荷文件集合和大小；`--full` 还会逐文件重读 SHA-256，并核对索引中列出的证据和 Git bundle。不会跟随清单中的链接，不以大小相同替代完整哈希核验，不自动修复不一致。详细清单在本地缺失时可使用冷盘上经过总索引摘要绑定的副本。只读核验结果在终端输出，需要长期保存时由调用者单独保存回执；该工具不会覆盖封存时的验证结果。

恢复时查映射、复制到独立且不存在的目录，按 manifest 核对，再显式安装依赖或调整运行配置。旧脚本内的绝对地址保持为历史证据，重新运行前应在恢复副本中处理这些地址；去重项则从记录的唯一原件恢复。
