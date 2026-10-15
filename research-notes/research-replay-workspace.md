# 研究重放工作区

CKT 与神韵研究脚本默认从仓库内的持久缓存目录读取 R11 重放包：

```text
.research-cache/R11_integrated_replay/
```

该目录被 `.gitignore` 排除，不进入提交，也不再依赖容易被系统清理的 `%TEMP%`。需要把
`R11_integrated_replay.zip` 解压到上述位置，并按材料包说明运行其中的 `prepare_r11.py`，使目录至少包含
`source.json`、`model.npz` 和原重放引擎文件。

从仓库根目录可检查准备结果：

```powershell
Test-Path ".research-cache\R11_integrated_replay\source.json"
Test-Path ".research-cache\R11_integrated_replay\model.npz"
```

如果台式机希望把大文件放到其他磁盘，可设置覆盖变量；脚本仍使用同一套入口：

```powershell
$env:RIME_RESEARCH_REPLAY_DIR = "E:\rime-research\R11_integrated_replay"
python scripts/research/fast_ckt_v3_21x26.py
```

环境变量应直接指向 `R11_integrated_replay` 目录，而不是它的父目录。未设置时一律回落到仓库内缓存。
